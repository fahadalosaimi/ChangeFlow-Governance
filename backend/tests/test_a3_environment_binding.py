"""A signed approval must belong to the deployment's protected trust policy."""
import base64
from datetime import datetime, timedelta, timezone
import json

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import pytest

from app.services import bootstrap_authorization as authorization


@pytest.mark.parametrize("deployment", ["production-b", None, "", "postgresql://user:password@host/db"])
def test_approval_for_another_or_missing_deployment_is_rejected(deployment):
    key = Ed25519PrivateKey.generate()
    policy = authorization.BootstrapPolicy("review-key", key.public_key().public_bytes(
        Encoding.Raw, PublicFormat.Raw), frozenset({"operator"}), "production-a")
    now = datetime.now(timezone.utc)
    payload = dict(action="tenant_bootstrap", key_id="review-key", authorization_id="approval-001",
        operator_id="operator", organization_id=3, email="first@example.test", role_id=8,
        issued_at=(now-timedelta(seconds=5)).isoformat(), expires_at=(now+timedelta(minutes=20)).isoformat())
    if deployment is not None:
        payload["deployment_id"] = deployment
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    document = dict(payload=payload, signature=base64.b64encode(key.sign(canonical)).decode())
    with pytest.raises(authorization.BootstrapAuthorizationError):
        authorization.verify_approval(document, policy, "operator", 3, "first@example.test")


@pytest.mark.parametrize("deployment", [None, "", "https://database.example", "prod-a"])
def test_deployment_identifier_is_loaded_only_from_protected_policy(monkeypatch, deployment):
    document = dict(key_id="review-key", public_key=base64.b64encode(bytes(32)).decode(), operators=["operator"])
    if deployment is not None:
        document["deployment_id"] = deployment
    monkeypatch.setattr(authorization, "_protected_policy_bytes", lambda: json.dumps(document).encode())
    if deployment == "prod-a":
        assert authorization.load_bootstrap_policy().deployment_id == "prod-a"
    else:
        with pytest.raises(authorization.BootstrapAuthorizationError):
            authorization.load_bootstrap_policy()
