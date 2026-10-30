"""Native Windows ACL/handle tests; never provision a real bootstrap policy."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import subprocess

import pytest

pytestmark = pytest.mark.skipif(os.name != "nt", reason="Windows native security APIs required")


def descriptor(sddl):
    from contextlib import contextmanager

    @contextmanager
    def allocated():
        advapi = ctypes.WinDLL("advapi32", use_last_error=True)
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        convert = advapi.ConvertStringSecurityDescriptorToSecurityDescriptorW
        convert.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.DWORD)]
        convert.restype = wintypes.BOOL
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree.restype = ctypes.c_void_p
        pointer = ctypes.c_void_p()
        assert convert(sddl, 1, ctypes.byref(pointer), None), ctypes.get_last_error()
        try:
            yield pointer
        finally:
            kernel.LocalFree(pointer)
    return allocated()


@pytest.mark.parametrize("sddl", [
    "O:SYG:SYD:NO_ACCESS_CONTROL",
    "O:BUG:SYD:P(A;;FA;;;SY)",
    *[f"O:SYG:SYD:P(A;;FA;;;SY)(A;;0x{mask:X};;;BU)" for mask in
      (2, 4, 16, 64, 256, 65536, 262144, 524288, 0x10000000, 0x40000000)],
])
def test_native_security_descriptor_rejects_untrusted_owner_or_mutation_rights(sddl):
    from app.services.windows_trust_policy import PolicySecurityError, _validate_descriptor
    with descriptor(sddl) as pointer, pytest.raises(PolicySecurityError):
        _validate_descriptor(pointer)


def test_native_descriptor_accepts_read_only_users_and_ignores_inherit_only_aces():
    from app.services.windows_trust_policy import _validate_descriptor
    with descriptor("O:SYG:SYD:P(A;;FA;;;SY)(A;;FR;;;BU)(A;OICIIO;GA;;;CO)") as pointer:
        _validate_descriptor(pointer)


def test_native_pinned_file_cannot_be_replaced_deleted_or_written(tmp_path):
    from app.services.windows_trust_policy import _pinned_handle, _read_handle
    policy, replacement = tmp_path / "policy.json", tmp_path / "replacement.json"
    policy.write_bytes(b'{"synthetic":"original"}')
    replacement.write_bytes(b'{"synthetic":"replacement"}')
    with _pinned_handle(policy, directory=False) as handle:
        with pytest.raises(PermissionError):
            os.replace(replacement, policy)
        with pytest.raises(PermissionError):
            policy.unlink()
        with pytest.raises(PermissionError):
            policy.write_bytes(b"changed")
        assert _read_handle(handle) == b'{"synthetic":"original"}'
    assert policy.read_bytes() == b'{"synthetic":"original"}'


def test_native_junction_is_rejected_without_following_target(tmp_path):
    from app.services.windows_trust_policy import PolicySecurityError, _pinned_handle
    target, junction = tmp_path / "target", tmp_path / "junction"
    target.mkdir()
    env = {**os.environ, "A3_TEST_JUNCTION": str(junction), "A3_TEST_TARGET": str(target)}
    result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
        "New-Item -ItemType Junction -Path $env:A3_TEST_JUNCTION -Target $env:A3_TEST_TARGET | Out-Null"],
        env=env, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=15)
    assert result.returncode == 0
    try:
        with pytest.raises(PolicySecurityError):
            with _pinned_handle(junction, directory=True):
                pytest.fail("junction accepted")
    finally:
        junction.rmdir()  # remove the junction itself, never its target


def test_native_reader_rejects_a_policy_with_untrusted_mutation_rights(tmp_path):
    from app.services.windows_trust_policy import PolicySecurityError, read_windows_policy
    policy = tmp_path / "policy.json"
    policy.write_bytes(b'{"synthetic":true}')
    set_security = ctypes.WinDLL("advapi32", use_last_error=True).SetFileSecurityW
    set_security.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p]
    set_security.restype = wintypes.BOOL
    with descriptor("D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;BU)") as security:
        assert set_security(str(policy), 0x80000004, security), ctypes.get_last_error()
    with pytest.raises(PolicySecurityError):
        read_windows_policy(policy)


@pytest.mark.skipif(os.environ.get("CHANGEFLOW_A3_WINDOWS_TRUST_TESTS") != "1",
    reason="Positive protected-policy integration needs an explicitly prepared Windows runner with trusted ancestor ACLs and an elevated token; no system ACLs are changed on the development host.")
def test_native_positive_policy_chain_on_prepared_windows_runner(tmp_path):
    from app.services.windows_trust_policy import read_windows_policy
    assert ctypes.windll.shell32.IsUserAnAdmin(), "prepared runner must have an elevated token"
    policy = tmp_path / "synthetic-policy.json"
    policy.write_bytes(b'{"synthetic":"protected-policy"}')
    advapi = ctypes.WinDLL("advapi32", use_last_error=True)
    set_security = advapi.SetFileSecurityW
    set_security.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p]
    set_security.restype = wintypes.BOOL
    # Only fixture-owned objects are changed. The runner must prepare trusted
    # ancestors itself; this test never changes host/OS directory permissions.
    with descriptor("O:BAG:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)") as security:
        for path in (tmp_path, policy):
            assert set_security(str(path), 0x80000005, security), ctypes.get_last_error()
    assert read_windows_policy(policy) == b'{"synthetic":"protected-policy"}'
