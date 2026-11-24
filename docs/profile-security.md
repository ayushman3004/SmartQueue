# Profile and contact security

Profile writes explicitly allowlist editable properties. Authentication role,
password, session revision, patient relationships and proof state are
server-controlled. A verified phone change requires a session issued in the
past ten minutes. Changing the number clears its verification and the associated
notice consent. Changing email clears its verification.

WhatsApp phone verification reuses the authenticated profile OTP endpoints.
Turnstile and Redis are required, and the challenge is bound to the original
session, normalized number, purpose and contact revision. The code cannot log a
patient in or transfer an account. Legacy Firebase proof remains valid as
historical phone verification. A fresh WhatsApp verification and separate opt-in
are required for prescription availability notices.

See the [WhatsApp integration guide](./whatsapp-integration.md) for API details,
data handling, deployment settings, and the Firebase decommission checklist.
