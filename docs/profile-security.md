Profile updates copy only `name`, `email`, `avatar`, `phone`, `bio`, and `location`
from the request. Values must be strings; all fields are validated before account
mutation. Roles, balances, password hashes, OAuth identifiers, subscriptions,
owner approval, token versions, verification flags, and phone proof metadata
cannot be assigned through this endpoint. Approved business email changes remain
restricted. Changing an email clears its verification, including Google-linked
accounts; a provider name alone no longer implies that a changed email is verified.

Phone numbers use E.164 format, with support for entering an Indian 10-digit
mobile number. Clearing or changing a number clears its verification proof.
Equivalent formatting preserves the existing proof.

`POST /api/auth/phone/verify-firebase` requires the authenticated ServeQ session,
the requested phone, and the Firebase ID token returned after SMS confirmation.
The official Firebase Admin SDK checks signature, issuer, project audience,
expiry, revocation, and disabled users. The proof must have a phone sign-in
provider, match the requested number, and have authenticated within ten minutes.
Only the authenticated account is updated. No Firebase token is persisted.

The old email-delivered phone OTP endpoints return HTTP 410. An email OTP proves
email access, not ownership of a phone. Existing boolean-only phone verification
flags are no longer trusted: users must verify again by SMS to obtain matching
server-issued proof metadata. There is no bulk account mutation during deployment.

Backend setup before deployment:

- Set `FIREBASE_PROJECT_ID` to the same project as the frontend SMS configuration.
- Configure Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`),
  or store the service account JSON in the backend secret variable
  `FIREBASE_SERVICE_ACCOUNT_JSON`. The service account must be able to read
  Firebase Authentication users for revocation/disabled-user checks.
- Keep service account credentials out of the repository, container image, and
  all `VITE_*` variables. Do not enable `FIREBASE_AUTH_EMULATOR_HOST` for this flow.

Missing configuration or an unavailable verifier fails closed without verifying
the phone. Live SMS delivery and production IAM configuration must be checked
after deploying; the automated security tests use offline claims and also ensure
the real SDK rejects unsigned JWTs.

Run `npm run ci:frontend` for lint, all tests, the frontend build, and artifact
validation. The production dependency audit remains a separate CI gate.
