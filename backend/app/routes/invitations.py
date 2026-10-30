from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foundation import User
from app.schemas.invitation import InvitationAcceptance, InvitationCreate, InvitationOutput, MembershipActivated
from app.services.auth_service import require_roles
from app.services.invitation_mailer import InvitationMailer, get_invitation_mailer
from app.services.invitation_service import (
    accept_invitation, create_invitation, list_invitations, resend_invitation, revoke_invitation,
)


class SafeInvitationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError:
                # Framework errors otherwise echo raw credentials or extra fields.
                raise HTTPException(400, "Invalid invitation request.") from None
        return handler


router = APIRouter(prefix="/auth/invitations", tags=["Invitations"], route_class=SafeInvitationRoute)


@router.post("", response_model=InvitationOutput, status_code=201)
def create(payload: InvitationCreate,
           current_user: User = Depends(require_roles("System Administrator")),
           db: Session = Depends(get_db), mailer: InvitationMailer = Depends(get_invitation_mailer)):
    return create_invitation(db, current_user.organization_id, current_user.id, payload, mailer)


@router.get("", response_model=list[InvitationOutput])
def listing(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
            current_user: User = Depends(require_roles("System Administrator")), db: Session = Depends(get_db)):
    return list_invitations(db, current_user.organization_id, limit, offset)


@router.post("/accept", response_model=MembershipActivated)
def acceptance(payload: InvitationAcceptance, db: Session = Depends(get_db)):
    return accept_invitation(db, payload)


@router.post("/{invitation_id}/revoke", response_model=InvitationOutput)
def revoke(invitation_id: int, current_user: User = Depends(require_roles("System Administrator")),
           db: Session = Depends(get_db)):
    return revoke_invitation(db, current_user.organization_id, current_user.id, invitation_id)


@router.post("/{invitation_id}/resend", response_model=InvitationOutput, status_code=201)
def resend(invitation_id: int, current_user: User = Depends(require_roles("System Administrator")),
           db: Session = Depends(get_db), mailer: InvitationMailer = Depends(get_invitation_mailer)):
    return resend_invitation(db, current_user.organization_id, current_user.id, invitation_id, mailer)
