"""Fail-closed Windows policy reads, with pinned objects and handle-based ACLs.

No trust override is supported. In particular, a writable development tree is
not an operational trust root. OS administrators and TrustedInstaller remain
trusted; this does not defend against an administrator modifying the process.
"""
from contextlib import contextmanager, ExitStack
import ctypes
from ctypes import wintypes as w
from pathlib import Path


class PolicySecurityError(RuntimeError):
    pass


_kernel = ctypes.WinDLL("kernel32", use_last_error=True)
_security = ctypes.WinDLL("advapi32", use_last_error=True)
_TRUSTED = frozenset({"S-1-5-18", "S-1-5-32-544",
    "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"})
# Write/append data, EA/attributes, delete-child, DELETE, WRITE_DAC/OWNER,
# GENERIC_ALL and GENERIC_WRITE. Conservative: a deny ACE does not rescue an
# untrusted allow ACE; unsupported/callback/object ACEs fail closed.
_MUTATION_RIGHTS = 0x500D0156


class _FileInformation(ctypes.Structure):
    _fields_ = [("attributes", w.DWORD), ("creation", w.FILETIME),
        ("access", w.FILETIME), ("write", w.FILETIME), ("volume", w.DWORD),
        ("size_high", w.DWORD), ("size_low", w.DWORD), ("links", w.DWORD),
        ("index_high", w.DWORD), ("index_low", w.DWORD)]


class _AclInformation(ctypes.Structure):
    _fields_ = [("count", w.DWORD), ("used", w.DWORD), ("free", w.DWORD)]


def _api(library, name, arguments, result):
    function = getattr(library, name)
    function.argtypes, function.restype = arguments, result
    return function


_create = _api(_kernel, "CreateFileW", [w.LPCWSTR, w.DWORD, w.DWORD, ctypes.c_void_p,
    w.DWORD, w.DWORD, w.HANDLE], w.HANDLE)
_close = _api(_kernel, "CloseHandle", [w.HANDLE], w.BOOL)
_info = _api(_kernel, "GetFileInformationByHandle", [w.HANDLE, ctypes.POINTER(_FileInformation)], w.BOOL)
_type = _api(_kernel, "GetFileType", [w.HANDLE], w.DWORD)
_free = _api(_kernel, "LocalFree", [ctypes.c_void_p], ctypes.c_void_p)
_get_security = _api(_security, "GetSecurityInfo", [w.HANDLE, w.DWORD, w.DWORD,
    ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_void_p)], w.DWORD)
_owner = _api(_security, "GetSecurityDescriptorOwner", [ctypes.c_void_p,
    ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(w.BOOL)], w.BOOL)
_dacl = _api(_security, "GetSecurityDescriptorDacl", [ctypes.c_void_p, ctypes.POINTER(w.BOOL),
    ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(w.BOOL)], w.BOOL)
_acl_info = _api(_security, "GetAclInformation", [ctypes.c_void_p, ctypes.c_void_p, w.DWORD, w.DWORD], w.BOOL)
_ace = _api(_security, "GetAce", [ctypes.c_void_p, w.DWORD, ctypes.POINTER(ctypes.c_void_p)], w.BOOL)
_valid_sid = _api(_security, "IsValidSid", [ctypes.c_void_p], w.BOOL)
_sid_text = _api(_security, "ConvertSidToStringSidW", [ctypes.c_void_p, ctypes.POINTER(w.LPWSTR)], w.BOOL)
_read = _api(_kernel, "ReadFile", [w.HANDLE, ctypes.c_void_p, w.DWORD,
    ctypes.POINTER(w.DWORD), ctypes.c_void_p], w.BOOL)


def _sid(pointer):
    text = w.LPWSTR()
    if not pointer or not _valid_sid(pointer) or not _sid_text(pointer, ctypes.byref(text)):
        raise PolicySecurityError("Invalid policy security descriptor.")
    try:
        return text.value
    finally:
        _free(ctypes.cast(text, ctypes.c_void_p))


def _validate_descriptor(descriptor):
    owner, acl, present, defaulted = ctypes.c_void_p(), ctypes.c_void_p(), w.BOOL(), w.BOOL()
    if not _owner(descriptor, ctypes.byref(owner), ctypes.byref(defaulted)) or _sid(owner) not in _TRUSTED:
        raise PolicySecurityError("Untrusted policy path owner.")
    if (not _dacl(descriptor, ctypes.byref(present), ctypes.byref(acl), ctypes.byref(defaulted))
            or not present.value or not acl.value):
        raise PolicySecurityError("Policy DACL is missing or unrestricted.")
    info = _AclInformation()
    if not _acl_info(acl, ctypes.byref(info), ctypes.sizeof(info), 2):
        raise PolicySecurityError("Invalid policy ACL.")
    for index in range(info.count):
        ace = ctypes.c_void_p()
        if not _ace(acl, index, ctypes.byref(ace)):
            raise PolicySecurityError("Invalid policy ACE.")
        header = ctypes.string_at(ace, 4)
        kind, flags, size = header[0], header[1], int.from_bytes(header[2:], "little")
        if flags & 0x08:  # INHERIT_ONLY_ACE does not grant access to this object
            continue
        if kind not in (0, 1) or size < 16:
            raise PolicySecurityError("Unsupported policy ACE.")
        if kind == 0:
            mask = w.DWORD.from_address(ace.value + 4).value
            if mask & _MUTATION_RIGHTS and _sid(ace.value + 8) not in _TRUSTED:
                raise PolicySecurityError("Policy path permits untrusted mutation.")


def _check_security(handle):
    descriptor = ctypes.c_void_p()
    result = _get_security(handle, 1, 0x05, None, None, None, None, ctypes.byref(descriptor))
    if result:
        raise PolicySecurityError("Cannot inspect policy security.")
    try:
        _validate_descriptor(descriptor)
    finally:
        _free(descriptor)


@contextmanager
def _pinned_handle(path: Path, *, directory: bool):
    # READ_CONTROL | FILE_READ_ATTRIBUTES, plus GENERIC_READ for the file.
    # Deny share-write/share-delete and open reparse objects themselves. Existing
    # incompatible writer/deleter handles also make this acquisition fail closed.
    access = 0x20080 | (0 if directory else 0x80000000)
    handle = _create(str(path), access, 1, None, 3, 0x02200000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise PolicySecurityError("Cannot pin policy path.")
    try:
        info = _FileInformation()
        if not _info(handle, ctypes.byref(info)) or _type(handle) != 1:
            raise PolicySecurityError("Policy path is not a disk object.")
        if info.attributes & 0x400 or bool(info.attributes & 0x10) != directory:
            raise PolicySecurityError("Reparse or unexpected policy object.")
        if not directory and ((info.size_high << 32) | info.size_low) > 16384:
            raise PolicySecurityError("Oversized policy.")
        yield handle
    finally:
        _close(handle)


def _read_handle(handle):
    # Read exactly the handle whose identity/ACL was checked; never reopen path.
    buffer, count = ctypes.create_string_buffer(16385), w.DWORD()
    if not _read(handle, buffer, 16385, ctypes.byref(count), None) or count.value > 16384:
        raise PolicySecurityError("Cannot read bounded policy.")
    return buffer.raw[:count.value]


def read_windows_policy(path: Path) -> bytes:
    path = Path(path)
    if (not path.is_absolute() or path.drive.upper() != "C:"
            or any(part in (".", "..") or ":" in part for part in path.parts[1:])):
        raise PolicySecurityError("Unsupported policy path.")
    # Pin the entire chain root-first until after the final handle has been read.
    # No resolve(): resolving beforehand would follow a substitution/reparse.
    with ExitStack() as stack:
        for parent in reversed(path.parents):
            handle = stack.enter_context(_pinned_handle(parent, directory=True))
            _check_security(handle)
        handle = stack.enter_context(_pinned_handle(path, directory=False))
        _check_security(handle)
        return _read_handle(handle)
