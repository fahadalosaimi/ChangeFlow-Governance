"""Offline signed approval, rooted in an OS-protected operational policy file."""
import base64
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
from typing import Literal

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.invitation import invitation_email


class BootstrapAuthorizationError(RuntimeError):
    pass


@dataclass(frozen=True)
class BootstrapPolicy:
    key_id: str
    public_key: bytes = field(repr=False)
    operators: frozenset[str]
    deployment_id: str


@dataclass(frozen=True)
class BootstrapGrant:
    authorization_id: str
    operator_id: str
    organization_id: int
    email: str
    role_id: int
    department_id: int | None
    expires_at: datetime
    key_id: str
    authorization_digest: str
    deployment_id: str


class ApprovalPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["tenant_bootstrap"]
    deployment_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
    key_id: str = Field(min_length=1, max_length=128)
    authorization_id: str = Field(min_length=3, max_length=128)
    operator_id: str = Field(min_length=1, max_length=256)
    organization_id: int = Field(gt=0, strict=True)
    email: str
    role_id: int = Field(gt=0, strict=True)
    department_id: int | None = Field(default=None, gt=0, strict=True)
    issued_at: datetime
    expires_at: datetime

    _email = field_validator("email")(invitation_email)


def verify_approval(document, policy: BootstrapPolicy, operator_id: str,
                    organization_id: int, email: str) -> BootstrapGrant:
    try:
        if not isinstance(document, dict) or set(document) != {"payload", "signature"}:
            raise ValueError()
        canonical = json.dumps(document["payload"], sort_keys=True, separators=(",", ":"),
                               ensure_ascii=False, allow_nan=False).encode("utf-8")
        signature = base64.b64decode(document["signature"], validate=True)
        Ed25519PublicKey.from_public_bytes(policy.public_key).verify(signature, canonical)
        payload = ApprovalPayload.model_validate(document["payload"])
        now = datetime.now(timezone.utc)
        if (payload.deployment_id != policy.deployment_id
                or payload.key_id != policy.key_id or operator_id not in policy.operators
                or payload.operator_id != operator_id or payload.organization_id != organization_id
                or payload.email != invitation_email(email)
                or payload.issued_at.utcoffset() is None or payload.expires_at.utcoffset() is None
                or not payload.issued_at <= now < payload.expires_at
                or payload.expires_at - payload.issued_at > timedelta(hours=1)):
            raise ValueError()
        return BootstrapGrant(
            payload.authorization_id, operator_id, payload.organization_id, payload.email,
            payload.role_id, payload.department_id, payload.expires_at, payload.key_id,
            hashlib.sha256(canonical).hexdigest(),
            payload.deployment_id,
        )
    except Exception:
        raise BootstrapAuthorizationError("Bootstrap authorization failed.") from None


def _powershell(script: str) -> str:
    # Never resolve security-sensitive commands/modules through user PATH or
    # PSModulePath. No profiles, interactive window, or user-supplied script.
    system = Path("C:/Windows/System32")
    shell = system / "WindowsPowerShell/v1.0/powershell.exe"
    env = {"SystemRoot": "C:\\Windows", "WINDIR": "C:\\Windows", "PATH": str(system),
           "PSModulePath": str(system / "WindowsPowerShell/v1.0/Modules")}
    result = subprocess.run(
        [str(shell), "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
         "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); " + script],
        env=env, check=True, capture_output=True, text=True, encoding="utf-8", timeout=15,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    return result.stdout.strip()


def current_operator_id() -> str:
    if os.name == "nt":
        return "sid:" + _powershell("[Security.Principal.WindowsIdentity]::GetCurrent().User.Value")
    return "uid:" + str(os.getuid())


def _protected_policy_bytes() -> bytes:
    if os.name == "nt":
        from app.services.windows_trust_policy import read_windows_policy
        return read_windows_policy(Path("C:/ProgramData/ChangeFlow/bootstrap-policy.json"))
    path = Path("/etc/changeflow/bootstrap-policy.json")
    for parent in path.parents:
        info = parent.stat()
        if parent.is_symlink() or info.st_uid != 0 or info.st_mode & 0o022:
            raise BootstrapAuthorizationError("Bootstrap authorization failed.")
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise BootstrapAuthorizationError("Bootstrap authorization failed.")
        return os.read(descriptor, 16385)
    finally:
        os.close(descriptor)


def load_bootstrap_policy() -> BootstrapPolicy:
    raw = _protected_policy_bytes()
    if len(raw) > 16384:
        raise BootstrapAuthorizationError("Bootstrap authorization failed.")
    document = json.loads(raw)
    if set(document) != {"key_id", "public_key", "operators", "deployment_id"}:
        raise BootstrapAuthorizationError("Bootstrap authorization failed.")
    key = base64.b64decode(document["public_key"], validate=True)
    operators = document["operators"]
    deployment = document["deployment_id"]
    if (not isinstance(deployment, str) or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}", deployment) is None
            or len(key) != 32 or not isinstance(document["key_id"], str) or not document["key_id"]
            or not isinstance(operators, list) or not operators
            or not all(isinstance(value, str) and 0 < len(value) <= 256 for value in operators)):
        raise BootstrapAuthorizationError("Bootstrap authorization failed.")
    return BootstrapPolicy(document["key_id"], key, frozenset(operators), deployment)


def authorize_bootstrap(manifest_path: Path, organization_id: int, email: str) -> BootstrapGrant:
    try:
        policy = load_bootstrap_policy()
        with manifest_path.open("rb") as stream:
            raw = stream.read(16385)
        if len(raw) > 16384:
            raise ValueError()
        return verify_approval(json.loads(raw), policy, current_operator_id(), organization_id, email)
    except Exception:
        raise BootstrapAuthorizationError("Bootstrap authorization failed.") from None
