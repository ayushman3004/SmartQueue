# ServeQ WhatsApp integration

## Architecture

ServeQ is an Express modular monolith and Socket.IO server on Render with a Vite
SPA on Vercel. Passport handles Google OAuth with a signed, nonce-bound state
and the same ServeQ session as local email/password sign-in. Email OTP,
password recovery, account activation and RBAC remain in their existing
modules. The former Firebase client and Admin SDK handled profile SMS proof
only. WhatsApp verifies contact information for authenticated users and lets
patients sign in with a verified phone or a phone reserved at clinic check-in.
The one-time code opens the same patient account the clinic used for the visit.
Walk-in check-in writes the account, visit and queue entry in one MongoDB
transaction. The database must be a replica set or sharded cluster.

MongoDB stores users, clinic bookings and finalized prescriptions. The
one-time prescription write is the finalization boundary. Editing the form
sends no request. The existing doctor assignment and clinic checks run before
the insert, and private list and PDF endpoints remain protected by patient or
prescriber identity. AES-GCM still encrypts clinical fields. The old reminder
loop processes in-app follow-ups. The old optional WhatsApp follow-up sender is
retired. The new integration sends authentication codes and prescription
availability notices only.

The API verifies Cloudflare Turnstile in enforce mode for the
`whatsapp_phone_otp` action, regardless of the public forms' configured mode.
The existing Redis/Valkey client provides short-window limits and shared
challenge storage. A single Lua reservation enforces per-account and per-phone
resend limits, rolling per-phone/account/IP/global caps and a shared sending
budget. The code is generated with Node crypto. Redis stores a five-minute
challenge with an HMAC, opaque ID and attempt count. The HMAC binds the account,
current session, normalized phone, phone revision, challenge and purpose
(`registration`, `verify_phone` or `phone_change`). Node compares HMACs in
constant time and a Lua compare-and-consume operation makes the fifth wrong
attempt and successful verification terminal. Replacing an existing verified
number requires sign-in within ten minutes. MongoDB conditionally updates the
authenticated account and a partial unique index prevents reuse across new
WhatsApp-verified accounts. Redis or Turnstile failure stops verification.

## Prescription notification lifecycle

1. The final prescription and its pending outbox state are inserted in one
   MongoDB document. A failed or duplicate insert creates no second event.
2. The worker polls that indexed outbox and publishes BullMQ jobs containing
   only the internal prescription ID and version. MongoDB owns delivery state
   and atomically claims due records across worker replicas.
3. Before dispatch, the worker checks current phone proof and account consent,
   or consent recorded for that specific walk-in at check-in. The latter can
   send a generic notice before the patient's first sign-in. A phone change or
   consent withdrawal after the visit's opt-in cancels its pending notice.
4. Meta receives the destination phone, a generic template and a random callback
   UUID. The static button points to `https://serveq.tech/profile#prescriptions`.
   Authentication and record authorization happen in ServeQ. The message
   contains no record ID, clinic or patient name, or clinical details.
5. Explicit HTTP 429 rejections retry exponentially from one minute, up to
   five sends. Permanent provider rejections stop. A timeout, malformed
   response, 5xx response or worker crash after entering the sending state
   can mean Meta accepted the message. These are marked unknown, with no
   automatic resend. Signed delivery callbacks can resolve unknown attempts.
   Events expire after 24 hours. The global budget includes attempts, so
   provider retries consume budget conservatively.
6. A restarted worker can recreate lost Redis queue jobs from MongoDB.
   Abandoned pre-send leases are requeued. Failed BullMQ jobs retain minimal
   identifiers for up to seven days or 1,000 entries. Provider delivery metadata
   expires after 30 days. Backlog and worker failures produce rate-limited,
   identifier-free log messages. Monitor these along with Redis memory,
   acceptance and delivery rates, and counts of old pending or unknown outbox
   records. Render sends SIGTERM to drain the worker on shutdown.
7. An operator can preview reprocessing with
   `node scripts/requeue-whatsapp-prescription.mjs <id>` after explicitly
   supplying `MONGO_URI` through a secret source. Add `--apply` only after
   confirming the provider rejected the attempt and correcting the cause.
   The command only requeues confirmed synchronous rejections within the
   original expiry window. Investigate unknown outcomes in Meta before
   considering manual action.

## API inventory

| Method and path | Body or inputs | Behavior |
| --- | --- | --- |
| `POST /api/auth/phone/send-otp` | `phone`, `turnstileToken` | Authenticated. Returns `challengeId`, server-selected `purpose` and `resendAfterSeconds`. Accepted requests return identical wording even when Meta rejects a number. |
| `POST /api/auth/phone/verify-otp` | `phone`, `otp`, `challengeId`, `purpose` | Authenticated in the same session. Returns the updated public user profile. |
| `POST /api/auth/phone/signin/send-otp` | `phone`, `turnstileToken` | Starts patient sign-in. The response shape is the same for known and unknown numbers. |
| `POST /api/auth/phone/signin/verify-otp` | `phone`, `otp`, `challengeId` | Consumes the challenge and starts a patient session after successful proof. |
| `POST /api/queue/:businessId/walk-in` | `name`, `phone`, optional `whatsappConsent` | The clinic owner checks in the patient and receives the live queue position. |
| `PATCH /api/auth/phone/whatsapp-consent` | `enabled`, `version: "prescription-v1"` for opt-in | Authenticated patient. Verification and opt-in are independent. Opt-out continues to work with sending disabled. |
| `GET /api/auth/me` | Existing session | Adds the proof method, verification dates and current WhatsApp consent to the sanitized user. |
| `GET /api/whatsapp/webhook` | Meta subscription challenge | Returns the exact challenge for the configured verification token. |
| `POST /api/whatsapp/webhook` | Raw Meta JSON and `X-Hub-Signature-256` | Validates signature before updates. Filters configured business and sender IDs. Tracks monotonic sent, delivered, read and failed states using the provider ID or opaque callback. Incoming message bodies are ignored. |
| `POST /api/doctors/prescriptions` | Existing finalized prescription payload | Returns the prescription and `whatsappNotification` as `queued` or `disabled`. The request does not wait for Meta. |
| `GET /api/doctors/prescriptions/:id/notification` | Existing session | Prescribing doctor in the correct clinic, or admin scoped to their own test clinic. Returns status only. |
| `GET /api/doctors/prescriptions` and `GET /api/doctors/prescriptions/:id/pdf` | Existing session | Private list and download. The message button uses the ordinary authorized profile, with no bypass token. |

The Firebase proof route was removed. The older anonymous `/api/otp/send`
and `/api/otp/verify` endpoints continue returning 410.

## Render backend variables

Keep the existing application environment including `MONGO_URI`,
`PRESCRIPTION_ENCRYPTION_KEY`, `CLIENT_URL=https://serveq.tech`,
`REDIS_URL`, `RATE_LIMIT_KEY_SECRET`, `TURNSTILE_SECRET_KEY` and
`TURNSTILE_ALLOWED_HOSTNAMES`. Use a private, authenticated Redis 6.2+ or
Valkey endpoint with persistence and a `noeviction` policy. Use TLS for a
public/provider Redis URL. Keep `REDIS_URL` identical for all backend replicas.
The existing Cloudflare origin credential, CORS and cookie controls stay enabled.

Copy the following variables into the Render backend service. The empty values
come from the indicated deployment or Meta environment and are intentionally
absent from the repository.

```dotenv
WHATSAPP_ENABLED=false
WHATSAPP_NOTIFICATION_WORKER_ENABLED=false
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_GRAPH_API_VERSION=
WHATSAPP_OTP_TEMPLATE=serveq_phone_otp
WHATSAPP_DOCUMENT_TEMPLATE=serveq_document_ready
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_OTP_HMAC_SECRET=
WHATSAPP_OTP_TTL_SECONDS=300
WHATSAPP_OTP_RESEND_SECONDS=60
WHATSAPP_OTP_MAX_ATTEMPTS=5
WHATSAPP_DAILY_MESSAGE_LIMIT=200
WHATSAPP_OTP_PHONE_DAILY_LIMIT=5
WHATSAPP_OTP_ACCOUNT_DAILY_LIMIT=8
WHATSAPP_OTP_IP_DAILY_LIMIT=30
WHATSAPP_OTP_GLOBAL_DAILY_LIMIT=200
```

- Use the Meta system-user access token scoped to the sending assets and
  WhatsApp messaging. The app secret comes from the Meta app settings.
- Use the sending phone number ID and Meta WhatsApp business account ID. The
  latter is the webhook `entry.id` for your subscribed account. Confirm both
  with the test webhook from your Meta asset.
- Use a supported Graph version listed for the Meta app, formatted as
  `vMAJOR.MINOR`. Use the exact language configured in both approved templates.
- Generate independent webhook verification and OTP HMAC secrets locally with
  `openssl rand -hex 32`, once for each value. The OTP HMAC key must differ
  from the Redis rate-limit, JWT and prescription encryption keys. Protect and
  back up these secrets. HMAC rotation invalidates outstanding OTPs.
- Tune the shared message ceiling and the OTP-only ceilings to the approved
  budget before enabling. Keep all WhatsApp secrets in Render backend settings.

### Vercel and Docker

Keep `VITE_API_URL=https://api.serveq.tech` and add or retain the public
`VITE_TURNSTILE_SITE_KEY`. Allow each intended Vercel/production hostname in
Cloudflare's Turnstile widget and the backend allowlist. Rebuild Vercel after
changing build variables. Remove the four `VITE_FIREBASE_*` keys listed below
after the cutover has passed. Docker accepts the same site key as a frontend
build argument, named `PUBLIC_TURNSTILE_SITE`. Both frontend hosting configurations remove Firebase and
reCAPTCHA CSP origins and retain Cloudflare Turnstile and Razorpay origins.

## Meta onboarding and webhook setup

1. Configure a Meta Business Messaging app and an approved sending account
   with its phone number, test recipients, business verification and billing as
   required for the specific account. Start with Meta's test number and a
   separate staging database. Grant the sending runtime only messaging
   permission. Use appropriate management permissions separately to configure
   templates and subscriptions. [Meta developer overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
2. In WhatsApp Manager, create `serveq_phone_otp` as an **Authentication**
   template with a **Copy Code** button first in the button list, and a
   five-minute validity notice. The API supplies the same six-digit code to
   the body and button parameters. Set the language to match configuration.
   [Meta authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates)
3. Submit `serveq_document_ready` as a **Utility** template. Use generic text
   such as “A new document is available in ServeQ. Sign in with your mobile
   number to view or download it, check follow-ups, and book your next visit.”
   Set a static **View Document** URL
   `https://serveq.tech/profile#prescriptions`. For staging, use a staging
   template whose static URL points to a protected staging profile. The
   templates require Meta approval before production activation.
4. Set the Meta callback to
   `https://api.serveq.tech/api/whatsapp/webhook` and use
   `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as the verify token. Subscribe the app to the
   sending account's `messages` webhook field. Keep the host behind Cloudflare's
   existing origin-authentication rules. For this exact path and GET/POST, allow
   Meta's non-browser callback through interactive challenges and preserve raw
   POST bytes and `X-Hub-Signature-256`. Retain the origin header transformation,
   managed protections and webhook rate limit. Restrict access to edge log
   query parameters because the Meta GET handshake includes the verification
   token. [Meta message webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages)

## Migration, rollout and rollback

1. Back up Atlas and confirm a separate restore with the matching prescription
   encryption key. Use staging records for the integration trial.
2. Deploy the code with both flags off, verify email/password, password recovery,
   Google OAuth, ordinary sessions, existing phone labels and prescription
   access. No destructive migration runs. New schema fields are additive.
3. Leave historical `phoneVerification.provider="firebase"` proofs intact.
   Lazy migration occurs when a patient verifies the number through WhatsApp.
   Historical follow-up preferences are retained in storage and do not grant
   consent for the new purpose. Patients must explicitly opt in again. The
   partial unique index applies only to new WhatsApp proofs. Investigate account
   disputes through support without moving associations automatically.
4. On staging, enter complete secrets and the templates and turn on
   `WHATSAPP_ENABLED` to verify the phone flow and Meta callback. Then enable
   the notification worker and complete the manual checklist. Before repeating
   on production, approve the provider and privacy review, validate approved
   templates, and explicitly authorize the deployment.
5. If delivery fails in production, turn the worker flag off first and
   redeploy. Pending events remain available for up to 24 hours. Disable
   `WHATSAPP_ENABLED` as well to pause OTPs and new outbox events. Leave
   MongoDB, account proofs, consent history and prescription keys intact.
   Prefer the current version with flags off. Rolling back to an old binary
   may hide newer WhatsApp proof labels. Test this against a restored
   staging copy, preserve existing data, and leave old Firebase infrastructure
   intact until the rollback window closes.

### Firebase decommission checklist

- Confirm Firebase and Firebase Admin are absent from the lockfile and built
  frontend. Check normal Google sign-in through Passport.
- After approval and the rollback window, remove Vercel's
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
  and `VITE_FIREBASE_APP_ID` from Production and Preview.
- Remove legacy Render `FIREBASE_PROJECT_ID`,
  `FIREBASE_SERVICE_ACCOUNT_JSON` and Firebase-only
  `GOOGLE_APPLICATION_CREDENTIALS` configuration. Check whether any credential
  is shared with another service before revoking it. Disable Firebase phone
  sign-in only after confirming the project has no other consumers.
- Preserve historical phone proof method values and existing patient records.
  No production Firebase configuration has been changed by this implementation.

## Operations, costs and privacy review

The worker runs in the existing always-on Render backend, concurrency two per
instance, with two or more additional Valkey connections per worker-enabled
instance. That avoids incremental worker compute on a service with sufficient
headroom. At higher load or if the web instance sleeps, move the processing to
a continuously running worker and disable it on the web instance after testing
the dedicated entry point. The public Render pricing checked for planning
listed a small worker at about US$7/month and a persistent 256 MB Key Value plan
at US$10/month. Incremental Valkey cost can be zero when the existing paid
store has sufficient capacity. Taxes, bandwidth, and plan changes are extra.
[Render pricing](https://render.com/pricing?sid=fd383399-34c2-4faf-9a0e-f6893ade3d1a)

Meta rates depend on recipient market, template category, billing currency and
volume. For a planning example only, 1,000 authentication messages plus 500
utility notices at an assumed ₹0.12 per delivered message total about ₹180
before taxes. Use the account's current India and other recipient-market
rate cards and the approved cap to calculate the production budget. The shared
application cap bounds attempts during normal persistent Redis operation.
Set billing alerts at Meta because store resets and sender use outside ServeQ
can affect the provider bill. [WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing)

Meta processes the destination number, authentication code or generic notice,
and delivery metadata. Even a generic notice may imply the recipient uses
ServeQ. Review Meta terms, data processing and international transfer
arrangements, clinic agreements, incident reporting, consent wording and
retention periods with qualified privacy and healthcare counsel before launch.
Review India's DPDP Act and the phased implementation of the 2025 Rules,
along with any applicable sector and patient-age requirements. Application
changes do not establish compliance. The audit trail stores the 20 most
recent verification and preference events without phone values. Review whether
operations require a longer audit history or stronger administrative controls.
[MeitY announcement for the 2025 Rules](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&lang=1&reg=3)

Severe provider timeouts can leave an uncertain send; the system deliberately
avoids duplicate notices and waits for callbacks. A patient can withdraw
consent before dispatch, but cannot recall a notice once handed to Meta.
Provider metadata is retained for 30 days and MongoDB retains outbox state
with the prescription. Review clinical retention, backups, and protection
of historical plaintext prescriptions separately. Confirm WAF routing,
approved templates, real provider deliveries, and actual account rates in
staging. The automated suite never sends a live message.

## Manual staging checklist

- Sign up and sign in through email and Google, recover a password, and
  verify that unauthenticated OTP and prescription requests are rejected.
- Request a test OTP through the widget. Check invalid, expired, reused and
  concurrent codes, early resend and stale-session phone changes. Confirm
  legacy verification remains labeled and opting in is a separate action.
- Verify a test patient and opt in. Finalize a synthetic prescription. Confirm
  saved, accepted and delivered statuses independently. Check the generic
  button lands on the signed-in profile and that another account cannot
  download the PDF.
- Withdraw consent and repeat. Test a fresh registration without WhatsApp
  and verify the account still works. Interrupt Redis and restart the worker
  while an event is pending. Verify fail-closed OTPs and outbox recovery.
- Confirm the Meta test subscription handshake and real signed status
  callbacks. Verify tampered callbacks cannot update delivery state.
- Check Render limits, Redis persistence and eviction policy, webhook rules,
  billing alerts, redacted logs and rollback with both flags off.

## Repository inventory

| Area | Files |
| --- | --- |
| Added WhatsApp runtime | `src/modules/whatsapp/whatsapp.config.js`, `whatsapp.client.js`, `whatsapp.runtime.js`, `whatsapp-otp.store.js`, `whatsapp-webhook.routes.js`, `whatsapp-delivery.model.js`, `prescription-notifications.js` |
| Added contact policy and tooling | `src/modules/auth/phone-security.js`, `src/modules/auth/whatsapp-consent.service.js`, `scripts/requeue-whatsapp-prescription.mjs`, this guide |
| Added tests | `tests/whatsapp_otp.test.js`, `tests/whatsapp_notifications.test.js` |
| Removed | `config/firebase-admin.js`, `src/lib/firebase.js`, `src/modules/doctor/whatsapp.service.js`, both Firebase packages and their obsolete lockfile entries |
| Changed auth, routing and persistence | `middleware/auth.middleware.js`, `src/gateway/gateway.middleware.js`, `gateway.router.js`, `rateLimiter.js`, `rateLimitStore.js`, `src/modules/auth/auth.controller.js`, `auth.model.js`, `auth.routes.js`, `auth.service.js`, `phone-verification.service.js`, `verification.service.js`, `src/modules/doctor/doctor.routes.js`, `prescription.model.js`, `follow-up-reminder.service.js`, `src/utils/phoneNumbers.js` |
| Changed frontend | `src/api/auth.api.js`, `src/api/doctor.api.js`, `src/components/VerifyContactModal.jsx`, `src/pages/ProfilePage.jsx`, `DoctorPage.jsx`, `PrivacyPolicyPage.jsx`, `LandingPage.jsx`, `BusinessMarketingPage.jsx`, `src/seo/publicPages.js`, `src/utils/useSeo.js` |
| Changed deploy and architecture | `.env.example`, `.github/workflows/ci-cd.yml`, `Dockerfile.backend`, `Dockerfile.frontend`, `compose.yaml`, `nginx.conf`, `vercel.json`, `package.json`, `package-lock.json`, `server.js`, `docs/CI-CD.md`, `docs/profile-security.md`, `docs/serveq-workflow-architecture.md`, `docs/diagrams/generate-diagrams.py`, `docs/diagrams/serveq-system-architecture.svg` |
| Updated regressions | `tests/doctor_prescription_access.test.js`, `follow_up_reminders.test.js`, `profile_security.test.js`, `profile_security_http.test.js`, `profile_verification.test.js` |
