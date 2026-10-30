"""Delivery boundary: no provider is configured or contacted by default."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from pydantic import SecretStr


@dataclass(frozen=True)
class InvitationMessage:
    invitation_id: int
    email: str
    workspace_slug: str
    expires_at: datetime
    token: SecretStr = field(repr=False)


class InvitationMailer(Protocol):
    def send_invitation(self, message: InvitationMessage) -> None: ...


class DeliveryUnavailable(RuntimeError):
    pass


class UnconfiguredInvitationMailer:
    def send_invitation(self, message: InvitationMessage) -> None:
        raise DeliveryUnavailable("Invitation delivery is not configured.")


def get_invitation_mailer() -> InvitationMailer:
    return UnconfiguredInvitationMailer()
