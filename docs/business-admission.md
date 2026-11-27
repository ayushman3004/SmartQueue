# Admin-controlled business admission

## Architecture and reuse

ServeQ continues to use its existing Mongoose `User` and `Business` models, `customer` / `owner` / `admin` roles, JWT/cookie authentication, email OTP records and ten-minute OTP lifetime, three failed-attempt limit and 30-second resend cooldown. The existing onboarding wizard, subscription checkout, staff/services, bookings and queue APIs remain in place.

Previously `/business` allowed password and Google owner registration. It is now a public business acquisition page. `BusinessApplication` is the only new collection. It records applications, administrative review, provisioned relationships, invitation delivery and an append-only action history. Security metadata lives on the existing owner, not a second authentication system.

## Complete journey

1. A business visits `/business` or `/business/apply` and submits its details with privacy acknowledgement. The server validates fields, strips markup, limits lengths and permits HTTP(S) profile URLs only. An application is stored as `PENDING`; no user, business or authenticated session is created.
2. All valid submissions receive the same generic acknowledgement, including repeated active applications. A unique partial email index permits only one `PENDING` or `APPROVED` application per email. A rejected applicant may apply again. Confirmation email is best-effort and never creates an account.
3. An existing `admin` reviews **Business Applications** in the admin dashboard or opens `/admin/applications`. Search, status filters, pagination and an inline detail view show business information, notes, timestamps, delivery status and audit history. Reject only transitions `PENDING` to `REJECTED` and retains the record.
4. Approval runs in a MongoDB transaction: check the application and email identity, create an existing-model owner and associated business draft, hash a cryptographically random password, hash a separate 256-bit activation code, record the approving administrator and set invitation expiry to issuance plus exactly five hours. The draft is approved but **inactive** and `IN_PROGRESS`, so the existing wizard finds and reuses it. Existing customer/admin identities are never silently converted into owners.
5. After the transaction commits, the existing email infrastructure sends the invitation. Delivery becomes `SENT` or `FAILED`; a crash during delivery may leave `PENDING`. The admin can reissue an unactivated invitation in either case. Reissue changes credentials and token version in a transaction while retaining the same owner and draft; old credentials, OTP association and sessions stop working. Updates to delivery state match an invitation generation, so an older send cannot overwrite newer delivery status.
6. The invitation links to `/hub/activate` without a query string, password or token. The owner enters their registered email, temporary password and separate activation code from the email. If they start at `/hub/login`, valid temporary credentials reveal the activation-code field inline; a missing code is not reported as an expired invitation and no session is issued yet. Password authentication validates the code and expiry, and issues a restricted activation JWT. It can only read its own session and use the existing email OTP endpoints; it cannot update the profile, start onboarding, pay, operate a queue or connect an authenticated socket.
7. Email OTP verification is bound to the approved email and invitation token version. After the existing OTP checks succeed, activation atomically compares account state, version and `invitationExpiresAt > now`, consumes the activation credential and sets `activatedAt`, `firstLoginAt` and `passwordChangeDeadline = firstLoginAt + 24 hours`. The owner receives a fresh normal token and a password-change notice. Exactly at five hours is too late. Reissued/consumed credentials and stale OTPs cannot activate an account.
8. The owner is offered immediate password replacement at `/hub/change-password`. Before the 24-hour deadline, the normal business flow remains available with a deadline banner. At the deadline, backend protection blocks normal operations and frontend routing sends them to password change. The existing password recovery flow remains available; unactivated/expired accounts cannot use recovery to bypass invitation activation.
9. Password replacement checks the current password, existing strength rules, maximum length and non-reuse. It updates the hash, clears the requirement and increments `tokenVersion`. Previous JWTs stop working; authenticated sockets are disconnected. The change screen receives a fresh token. The owner continues to `/hub/dashboard`, chooses the existing subscription if needed, completes the unchanged onboarding steps and launches the existing draft.

## Routes and API boundaries

| UI route | Access |
| --- | --- |
| `/business`, `/business/apply` | Public marketing/application |
| `/hub/login` | Approved owner password login and recovery |
| `/hub/activate` | Credential form; activation API requires a valid invitation |
| `/hub/change-password` | Activated owner security screen, also available after deadline |
| `/hub/dashboard` | Existing owner command centre, protected by lifecycle rules |
| `/business/onboarding/:businessId?` | Existing wizard, protected by lifecycle rules |
| `/admin`, `/admin/login` | Existing administrator login/dashboard |
| `/admin/dashboard`, `/admin/applications` | Protected existing `admin` role |

New endpoints:

- `POST /api/business-applications`: public submission, five requests/IP/hour, no owner/session creation.
- `GET /api/admin/applications?status=&search=&page=`: admin-only, 30 records/page; `EXPIRED` is a derived invitation filter.
- `POST /api/admin/applications/:id/approve|reject|reissue`: admin-only, optional `notes` body.
- `POST /api/auth/change-password`: existing authenticated owner; `currentPassword`, `newPassword` body.

Existing `POST /api/auth/signin` accepts `activationCredential` only when activating an invited account. Existing email OTP verification returns a fresh token on activation. Public `/auth/signup` rejects every explicit role except `customer`. Google and legacy phone OTP cannot create new owners or activate an invited account. Existing activated-owner/customer phone login remains available. The dedicated owner login also retains Google sign-in for existing approved accounts and displays OAuth failure messages. Customers cannot assign role, verification flags, password, token version, subscription or owner lifecycle fields through profile updates.

Owner middleware checks current database state and token version on every request, approved business ownership on business/queue management routes, and account deadlines. Existing service checks continue to isolate bookings and business data. Managed owners cannot create an additional unreviewed business with the legacy create/createNew endpoints. Admin operations retain their separate role guard. Optional authentication does not attach a restricted/stale owner. Socket authentication uses current database role/version and rejects restricted owners; private booking rooms also verify customer identity or approved business ownership; connected owners with a password deadline are disconnected when it arrives. Password changes/recovery disconnect the user's existing socket rooms.

Cookie-only write requests require an explicitly allowed frontend Origin; bearer requests retain existing API compatibility. Invitations never place secrets in URLs or API responses. Public application confirmations and outward password-recovery acknowledgements do not reveal whether a business email exists.

## Database preparation and rollout

MongoDB 6+ is required for the partial active-application index. MongoDB **transactions are required** for approval, reissue and activation. Atlas replica sets support them; a standalone local `mongod` does not. There is deliberately no unsafe multi-write fallback. Use a local replica set for development of this flow.

Before enabling the flow in production, run with the target environment:

```sh
node scripts/prepare-business-admission.js
```

This checks transaction-capable topology and creates the application collection/indexes without modifying existing accounts. It is idempotent. Review and resolve duplicate-index errors instead of dropping application records. Normal Mongoose index initialization also applies on connection when auto-indexing is enabled. Existing users without `ownerAccess.applicationId` are treated as legacy active accounts; no bulk migration is required and no customer roles change. Existing JWTs without a version are version zero until password replacement or recovery invalidates them.

Deploy backend and frontend together. Vercel rewrites for `/hub/*` and `/admin/*` route direct visits to the private app shell. Pricing is ₹999 / ₹1,999 per 30-day period, with manual renewal; no new billing integration is introduced here.

Required existing environment:

- `MONGO_URI`: transaction-capable MongoDB with collection/index and transaction permissions.
- `JWT_SECRET`: strong production signing secret.
- `CLIENT_URL`: production frontend origin, e.g. `https://www.serveq.tech`, used for activation/login/security links and allowed cookie-write origin.
- `CORS_ADDITIONAL_ORIGINS`: optional comma-separated extra trusted frontend origins. Arbitrary Vercel/Render subdomains are no longer automatically trusted.
- `RESEND_API_KEY` and a verified `EMAIL_SECURITY_FROM`, **or** the existing SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; existing EMAIL/GMAIL aliases remain supported). `EMAIL_SUPPORT` supplies reply-to.
- Administrator accounts must already exist in the database with an explicitly assigned admin role and their own password hash. Sign-in never creates accounts or changes roles, and `ADMIN_EMAIL` / `ADMIN_PASSWORD` are not used for authentication or provisioning. Remove obsolete bootstrap variables from deployment configuration. Existing admins continue to authenticate using their stored credentials; review any accounts created by the former bootstrap separately.
- Existing Razorpay, Google and other integration variables are unchanged. No invitation-specific secret or third-party dependency is added.

## Operational notes and security tradeoffs

- Temporary credentials are directly emailed as requested. This exposes them to mailbox access, forwarding and email-provider retention. They are held in memory for delivery only, never persisted or returned by the API. The separate activation code is stored only as SHA-256; passwords use existing bcrypt. Both initial credentials expire for activation after five hours, and password replacement invalidates the temporary password. The temporary password remains usable after activation only until the enforced 24-hour replacement deadline; protected operations are then blocked.
- Email send failure never rolls back an approved database transaction or loses the application. Reissue is the supported retry mechanism because plaintext credentials are not retained for resending. Only the latest invitation is valid. Provider acceptance (`SENT`) is not proof of inbox delivery.
- Expiry is enforced from timestamps in login, activation and middleware. The admin listing also refreshes expired owner states and clears credential hashes. No scheduler is required for authorization correctness. Expired applications remain available for reissue; automatic expiry emails are not sent on every rejected request to avoid spam.
- Existing in-memory rate limiting is reused, including auth/OTP limits. Limits apply per backend instance; use an infrastructure-level shared limit before scaling to multiple instances. Application requests are five per IP per hour. Existing email OTP attempt/resend rules are retained.
- Application records are intentionally not TTL-deleted: approval/rejection history must survive invitation expiry. Limit admin access and apply your published privacy/retention process to rejected applications and contact details. This change does not invent a legally binding retention interval or automatically delete audit history.
- New owner creation and activation use atomic transactions/conditional updates. The automated concurrency tests exercise serialized database adapters and compare-and-set behavior; they do not substitute for a replica-set integration run under production write conflicts. A staging round-trip with your real MongoDB and mail provider remains a deployment check.

## Verification and changed files

`tests/business_admission_socket.test.js` covers restricted/stale socket authentication and cross-business booking-room isolation.

`tests/business_admission_http.test.js` also exercises real Express routes for public submission without cookies, forbidden signup, unauthorized admin review, restricted activation sessions, OTP token exchange and stale cookies.

`tests/business_admission.test.js` covers public/duplicate/invalid applications, admin authorization, approval, owner/draft provisioning, failed delivery and retry, concurrent approval/activation, invitation login and restricted sessions, existing OTP activation, exact five-hour/24-hour boundaries, reissue/stale OTPs, credential reuse, password replacement and session invalidation, legacy owners, customer login, public signup restrictions, profile escalation, cross-business denial, draft reuse, recovery bypass and cookie-origin protection. Existing auth, Google and recovery tests reflect the new contract and selected-password query.

Main additions:

- `src/modules/business-application/{business-application.model,business-application.service,business-application.email,business-application.routes,owner-lifecycle}.js`
- `src/pages/{BusinessMarketingPage,BusinessApplicationPage,HubLoginPage}.jsx`
- `src/components/AdminBusinessApplications.jsx`, `src/styles/business-admission.css`
- `middleware/cookie-origin.middleware.js`, `scripts/prepare-business-admission.js`
- `tests/business_admission.test.js`, `tests/business_admission_http.test.js`, `tests/business_admission_socket.test.js`, this document.

Updated integration points:

- Auth model, utilities, service, controller, routes, verification/recovery services, phone OTP controller and OTP model.
- Auth middleware, gateway router/optional authentication, `app.js`, `config/cors.js`, and realtime socket authorization.
- `App.jsx`, business SEO metadata, axios error navigation, `AdminDashboard`, `AuthCallback`, `Navbar`, `SocketContext`.
- Existing business controller/service, command centre, dashboard, subscription and onboarding navigation. The former `BusinessPortalPage` is a compatibility re-export of the promotional page.
- `vercel.json` private-route rewrites; existing auth/Google/profile-verification regression tests.

## Local validation result

The initial full Node suite passed 223 tests. The owner-login activation follow-up passes 44 authentication/lifecycle tests and eight HTTP tests; an emulated-phone check confirms the activation field appears, entered credentials remain in the form, and no session is created before activation. The production build and whitespace check pass. ESLint has zero errors and five existing Fast Refresh warnings. Desktop business marketing and phone-sized marketing, application and activation screens were rendered in temporary headless Chrome; the three phone views measured a 390px document width at a 390px viewport (no horizontal page overflow). No live application approval, production invitation email, payment or deployment was performed.
