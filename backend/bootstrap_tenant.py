"""Issue a first-administrator invitation; never accept passwords on argv."""
import argparse
import json
from pathlib import Path
import sys

from app.services.bootstrap_authorization import BootstrapAuthorizationError, authorize_bootstrap


class SafeBootstrapParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes unknown arguments, which can contain a
        # password supplied by mistake even though the CLI accepts no secrets.
        self.exit(2, "Invalid bootstrap arguments. Credentials are not accepted on argv.\n")


def main(argv=None):
    parser = SafeBootstrapParser(description="Issue an explicitly authorized tenant bootstrap invitation.")
    parser.add_argument("--organization-id", type=int, required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--manifest", type=Path, required=True, help="Offline signed, non-secret approval manifest")
    args = parser.parse_args(argv)
    try:
        grant = authorize_bootstrap(args.manifest, args.organization_id, args.email)
    except BootstrapAuthorizationError:
        print("Bootstrap authorization failed.", file=sys.stderr)
        return 2
    # Database dependencies are intentionally loaded only after authorization.
    from app.database import SessionLocal
    from app.services.invitation_mailer import get_invitation_mailer
    from app.services.invitation_service import create_bootstrap_invitation
    try:
        with SessionLocal() as db:
            result = create_bootstrap_invitation(db, grant, get_invitation_mailer())
        print(json.dumps({"invitation_id": result.id, "organization_id": result.organization_id,
                          "status": result.status, "delivery_status": result.delivery_status}))
        return 0
    except Exception:
        print("Bootstrap could not complete. No credentials are displayed.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
