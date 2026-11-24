# ServeQ CI/CD

GitHub Actions validates pull requests to `main`, pushes to `main`, and manual runs.
Vercel continues deploying the frontend through its existing GitHub integration.
The backend deployment path is deliberately disabled until the **new** Render
service has been verified and configured. No deployment was triggered while
implementing this pipeline, and no dashboard, DNS, or domain settings were changed.

## Repository findings

Analysis performed on November 17, 2026, against the local checkout of
`https://github.com/ayushman3004/SmartQueue` (the configured Git remote).
Uncommitted application changes were preserved.

| Area | Verified configuration |
| --- | --- |
| Application | One ESM npm package, shared frontend/backend dependencies and lockfile; Express modular monolith with an internal API gateway, not independently deployed microservices. |
| Frontend | React 19, Vite 8, Tailwind; production `https://serveq.tech` on Vercel per the deployment brief. `vercel.json` routes API and health requests to `https://api.serveq.tech`, then applies the SPA fallback. |
| REST | `src/api/axios.js` appends `/api` to `VITE_API_URL`, sends credentials using the web session cookie, and falls back to the production API host outside localhost. |
| Realtime | `src/lib/socket.js` uses `VITE_API_URL` directly, credentials, WebSocket and polling. Without that variable it uses the frontend origin on localhost and the production API host elsewhere. |
| Backend | `npm start` → `node server.js`, HTTP + Socket.IO, binds `0.0.0.0` on `process.env.PORT` or 3001. It starts listening only after MongoDB connects. |
| Docker | Repository root context `.` and `Dockerfile.backend`; `node:24-alpine`, `npm ci --omit=dev`, `NODE_ENV=production`, `npm start`. Runtime sources are copied explicitly rather than copying the whole repository. `EXPOSE 3001` is metadata; Render's runtime `PORT` takes precedence. |
| Frontend Docker | `Dockerfile.frontend` builds Vite and serves `dist` with nginx. It is a local alternative, not the Vercel production deployment. Its `VITE_API_URL` build argument defaults to the canonical production API. Use an empty build argument to test through the local Nginx proxy. |
| Compose | `compose.yaml` builds both Dockerfiles from root and uses a local `.env` for the backend, port 3001, frontend port 8080 and a localhost client origin. Not used for Render deployment. |
| Node | The previous `>=18` engine was inaccurate. Firebase's locked app/auth/firestore packages require `>=24.12.0`, which is stricter than Vite's and OpenAI's requirements. Root manifest and lockfile declare `>=24.12.0`; CI and both Dockerfiles use Node 24. Set the existing Vercel project's Node version to 24.x if it is pinned to an older major. |
| Installation | `npm ci` for validation; `npm ci --omit=dev` in the backend image. No separate backend manifest or registry configuration. |
| Lint | `npm run lint` → `eslint .`. Existing ESLint configuration excludes backend paths and tests; this workflow preserves that scope. |
| Tests | `NODE_ENV=test npm test` → `node --test tests/*.test.js`. Existing tests mock model/service operations or use schema objects and local HTTP servers. No MongoDB service, Atlas URI, or external service credentials are required. These are not full integration tests of MongoDB, OAuth, email, payments or WebSockets. |
| Build | `npm run build` generates `public/sitemap.xml` and `public/robots.txt`, then runs Vite. Sitemap generation changes dates in the working tree; CI does not commit them. |
| Health | `/health`, `/api/health`, `/healthz` return 200 with database state, even when disconnected. `/live` checks the HTTP process. `/ready` and `/health/ready` require a connected MongoDB and a successful database ping, returning 503 otherwise. Use `/ready` for deployment readiness. |
| OAuth/cookies | `SERVER_URL` overrides `RENDER_EXTERNAL_URL` for `/api/auth/google/callback`; redirect goes to `CLIENT_URL/auth/callback`. Express ignores generic forwarding headers. Production token cookies are `Secure` with `SameSite=Lax` by default. |
| CORS | REST and Socket.IO share `config/cors.js`, allow `https://serveq.tech` and credentials. Existing broad preview-domain allowances were preserved. |
| Prior deployment material | No existing `.github` workflows, Render Blueprint, service ID, registry image reference or deployment script. README still describes an older EC2 deployment. Stale old-backend examples were corrected in `.env.example` and the Axios comment only. |

The user confirms that the current backend is a Render Docker service. The
repository alone cannot prove whether Render builds it from Git or pulls a
registry image, nor reveal the service ID, auto-deploy settings, Vercel project
settings, or stored environment values. No Render account connector or credentials
were available to inspect those settings. The implemented path supports **Scenario
A (Git-backed Docker builds)**, with API preflight checks before any deploy hook
request. Scenario B remains unconfigured pending the actual registry details.

### Failed run and remediation

The first GitHub run built the image successfully but failed its secret-file
check because the checked-in ignore file still included `.env.example`. Lint
reported 16 errors and 5 warnings, and the dependency audit reported 21
vulnerabilities, including 16 high and 2 critical findings. The gate correctly
blocked production deployment.

The fixes preserve all validation gates:

- Exclude every `.env` variant, including the example; explicitly copy runtime sources in `Dockerfile.backend` so repository-root environment files are not copied even if ignore rules regress.
- Remove unused page bindings and obsolete local location-picker handlers. Document intentional storage/geocoding fallbacks instead of leaving empty catches. Auth loading already initializes from token presence, so its redundant synchronous effect update was removed.
- Refresh the lockfile using compatible dependency security updates, including patched Mongoose, Express dependencies, Socket.IO dependencies and Nodemailer.
- Override `@grpc/grpc-js` to a patched 1.x version because Firebase still requests `~1.9.0`. Override `nodemailer-otp`'s Nodemailer to the root dependency because the wrapper otherwise installs vulnerable Nodemailer 6. Its use of `createTransport` and `sendMail` is verified by an offline transport compatibility test. Do not force-downgrade Firebase as suggested by npm's broad audit remediation.
- Align Node with Firebase's actual `>=24.12.0` requirement.

Final local verification on Node **24.22.3**:

- Clean `npm ci --no-audit --no-fund` passed.
- **143 tests passed**: 131 original, 11 deployment safety tests, and one OTP/Nodemailer compatibility test. The full suite was verified in a clean source copy without `.env` files or inherited service credentials.
- The frontend build with `VITE_API_URL=https://api.serveq.tech` passed, with the existing large-bundle warning.
- Lint passed with **0 errors and 5 existing Fast Refresh warnings**. No rules or tests were disabled.
- `npm audit --omit=dev --audit-level=high` passed with **0 vulnerabilities**. The full development dependency audit still reports two moderate findings in nodemon/minimatch, below the production gate's threshold and outside its dependency scope.
- The final `linux/amd64` backend Docker image built successfully; the exact environment-file exclusion and `app.js` runtime import checks passed without application credentials.
- Both YAML files parsed successfully. A separate actionlint binary was unavailable during initial validation because its release host timed out; it was not run.

Advisories change over time. Keep the audit gate enabled and review future
findings. Commit the code fixes, Dockerfiles, manifest, lockfile, workflow and
supporting scripts together. Re-running the old failed commit does not apply
working-tree fixes.

## Workflow jobs

The complete executable workflow is [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

| Job/check | Behavior |
| --- | --- |
| `ServeQ lint` | Node 24, npm cache, clean installation, existing lint command. |
| `ServeQ test` | Same installation, all `tests/*.test.js`, `NODE_ENV=test`, no application credentials. |
| `ServeQ build` | Same installation, existing build with canonical public API URL. Firebase/payment public variables are optional for compilation; this is build verification, not a functional test of those integrations. |
| `ServeQ audit` | Audits production dependencies and blocks high/critical vulnerabilities. Moderate issues remain visible. Since both apps share dependencies, this includes frontend packages shipped in the backend image. |
| `ServeQ backend Docker` | Buildx builds `linux/amd64` from `Dockerfile.backend`, using GitHub Actions cache. Loads an ephemeral SHA-tagged image, checks secret-file exclusions, imports `app.js` without MongoDB. Does not push an image or start the production server. |
| `ServeQ CI gate` | Always evaluates validation results and fails if any matrix task or Docker job failed, was canceled, or was skipped. Stable required check for branch protection. |
| `ServeQ Render production` | Main only, successful gate, explicitly enabled configuration, push or manually selected deployment. Validates the service via Render API, checks main's current SHA, triggers the exact tested SHA through the secret hook, polls that deployment until live, then verifies production readiness and CORS. |

All third-party actions are pinned to verified release commit SHAs. Dependabot
checks npm, Actions and Docker weekly. Review action changes before merging.
The workflow has only `contents: read`; no registry push, PR write or OIDC token
permissions. Checkout does not persist credentials. PR validation receives no
production secrets, uses `pull_request` rather than `pull_request_target`, and
cannot deploy. GitHub-hosted ephemeral runners run untrusted PR code.

Docker context ignores all `.env` variants, `.npmrc`, `.aws`, `.ssh`, PEM/key files,
local agent settings and generated output. `.env.example` is excluded from images
too. Never pass backend secrets as Docker build arguments or Vite variables.
Private registry dependency authentication is not configured or required here.

The npm audit does not scan Alpine OS packages. For broader image coverage, enable
a maintained image scanner (for example Trivy) against the loaded image after
choosing a severity/remediation policy, pin its action or binary, and make it a
required gate. Avoid adding a nonblocking scanner and treating it as protection.
Also enable GitHub secret scanning/push protection where available.

## GitHub configuration

Create a GitHub environment named **`production`**, restricted to `main`. Required
reviewers are optional; if enabled, automated runs wait for that approval.
Keep its secrets restricted to this environment.

| Setting | Kind | Value/source |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | Production environment secret | Exact unmodified deploy hook from the **new Docker service** Settings. Never commit it, paste it into logs, or use the old service's hook. |
| `RENDER_API_KEY` | Production environment secret | Render API key permitted to read this service, its custom domains and deployments. Prefer a scoped read-only key if available. The hook, not this key, triggers the deployment. |
| `RENDER_SERVICE_ID` | Production environment variable | Actual ID of the new service from Render; must match the ID in its deploy hook. This is an identifier, not a credential. |
| `RENDER_DEPLOY_ENABLED` | **Repository** Actions variable | Leave unset or `false` during setup; set to exactly `true` after completing the checks below. It must be a repository variable because the deploy job condition is evaluated before environment variables become available. |

`GITHUB_TOKEN` is supplied automatically by GitHub with read-only contents access;
do not create a PAT. No Vercel token, MongoDB URI, JWT secret, payment key, OAuth
secret, email password, or registry credential belongs in CI.

Protect `main` with a ruleset requiring PR review and **`ServeQ CI gate`**, including
for administrators as appropriate. Require up-to-date branches. Do not allow direct
pushes or bypasses if every approved production push must be validated before merge.
There are no path filters that silently skip required checks.

## Render configuration: Git-backed Docker service (Scenario A)

Before enabling deployment, inspect the **new service** in Render and confirm:

1. Source is the Git repository `https://github.com/ayushman3004/SmartQueue`, branch `main`, runtime Docker. It is not an image-backed service or a separate Build Source service.
2. Root directory is repository root, Docker build context `.`, Dockerfile `./Dockerfile.backend`. No Docker command or pre-deploy command overrides; the image's `npm start` command is used.
3. Set **Auto-Deploy to Off** before enabling the Actions hook. “After CI Checks Pass” still creates a second deployment path and must also be off. The script refuses to deploy if automatic deployment remains enabled.
4. Existing custom domain **`api.serveq.tech`** remains attached and verified on this service. Do not move it, alter DNS, or restore the previous backend. Preflight checks verified domain ownership and matching hook/service IDs.
5. Health check path is **`/ready`**. Keep Render's runtime `PORT`; the server already binds to `0.0.0.0` correctly.
6. Preserve the current environment values in Render. Confirm the canonical values below, without copying credentials into GitHub.
7. If Render exposes an overlapping deployment policy, choose **Wait**, and avoid manual deploys while the workflow is running. The script rejects an already active deployment; GitHub concurrency cannot prevent a person or another integration from starting one later.
8. Copy this service's hook into `RENDER_DEPLOY_HOOK_URL`, its ID into `RENDER_SERVICE_ID`, and create the read API key. The workflow validates these settings each time rather than trusting the enable flag alone.

| Render environment | Purpose |
| --- | --- |
| `NODE_ENV=production` | Secure production behavior. |
| `PORT` | Render-provided/configured listening port. No fixed-port change required. |
| `MONGO_URI` | Existing Atlas URI and database; allow Render outbound connectivity in Atlas using the deployment's actual network configuration. Never point CI at production Atlas. |
| `JWT_SECRET` | Preserve existing strong value; changing it invalidates sessions. |
| `CLIENT_URL=https://serveq.tech` | OAuth redirects and allowed frontend origin. |
| `SERVER_URL=https://api.serveq.tech` | Ensures Google callback uses the custom API domain instead of a Render subdomain. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Keep existing Google credentials; authorized Google redirect URI must be `https://api.serveq.tech/api/auth/google/callback`. |
| Existing integration credentials | Preserve `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_MAPS_API_KEY`, OpenRouter keys/model settings, Resend/SMTP/Gmail settings, and optional WhatsApp Cloud API credentials as used by the application. |
| Administrator accounts | Sign-in authenticates existing database accounts only. There are no default administrator credentials or environment-based account bootstrap. Remove obsolete `ADMIN_EMAIL` / `ADMIN_PASSWORD` settings and review any previously bootstrapped accounts separately. |

The script does not read or log Render environment values. Dashboard verification
of those values is still necessary. Existing OAuth/cookie/CORS logic is preserved.

### If Render is image-backed (Scenario B)

Do **not** enable the Git-backed hook path. It will fail preflight without deploying.
Before implementing registry publishing, obtain: the actual registry host and image
repository, supported authentication method and credentials, Render image pull
credentials, target platform, and current configured image URL. None is checked
into this repository. Do not assume GHCR or Docker Hub.

With those confirmed, adapt the Docker job to push an immutable full-commit-SHA tag
(preferably deploy by digest) using minimum registry permissions, then pass that
exact image URL as the hook's supported `imgURL` parameter. The host/repository/image
must match Render's configured image. Update preflight to validate image-backed
configuration and verify the deployed image reference/digest through Render API.
Keep the CI gate, main restriction, serialization, verified domain, polling and
readiness checks. The current workflow intentionally performs no registry login,
push, or image-backed deployment.

## Vercel configuration

The repository now sets Vercel's install command to `npm ci --no-audit --no-fund`
and build command to `npm run ci:frontend`. That command requires lint, the entire
test suite, the production build, and generated artifact checks to pass. A failed
command stops the build. Keep backend credentials out of Vercel; these checks
need no live database, payment, mail, or AI credentials.

Preserve the existing project, GitHub integration, production branch `main`, SPA
routing and domain `https://serveq.tech`. Use `npm ci`, `npm run build`, output
`dist`, repository root, and Node **24.x**. Confirm the current dashboard settings;
they cannot be inferred from `vercel.json` alone.

Set the Production environment value **`VITE_API_URL=https://api.serveq.tech`**
with no trailing slash or `/api` suffix. Keep the existing public
`VITE_RAZORPAY_KEY_ID` and `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` if those features are
enabled. Vite embeds all `VITE_*` variables in public browser assets; never prefix
backend credentials with `VITE_`.

**Changing `VITE_API_URL` requires a new frontend build/deployment.** The workflow's
build variable does not update Vercel's configuration. Check Preview values too
before testing preview deployments; this workflow does not silently redirect them.

Enable Vercel **Deployment Checks**, where available, and select the GitHub check
`ServeQ CI gate` to hold production domain promotion until validation succeeds.
Optionally also require `ServeQ Render production` if every frontend release must
wait for the backend; this requires backend deployment to be enabled on every
production push, otherwise a skipped deploy check can block promotion. Branch
protection alone gates merges, not Vercel's independent push-triggered promotion.
No Vercel deployment action, CLI deployment, or deployment hook is added.

## Verification and failure behavior

`scripts/render-deploy.mjs` uses only Node built-ins and does not install or execute
application dependencies in the credential-bearing job.

1. Verify repository/ref/event, service/hook identity, Git-backed Docker source,
   auto-deploy off, `/ready`, verified production domain, no active deployment,
   and current main SHA. Failure here sends **no deploy request**.
2. POST the hook once with `ref=<tested full SHA>` so an unvalidated newer branch
   head cannot be deployed by a generic hook. Never automatically retry a POST:
   a lost response might still mean Render started a deploy.
3. Require the hook's deployment ID. HTTP 200 means only **triggered**. A 202 queued
   response without an ID fails verification and requires dashboard inspection.
4. Poll that exact deployment through Render API every 15 seconds, for up to 25
   minutes. Fail on build/pre-deploy/update failure, cancellation, deactivation,
   wrong commit, unknown status, or timeout. Require both `live` and the tested SHA.
5. Then require three consecutive successful `/ready` responses from
   `https://api.serveq.tech`, including MongoDB `connected`, the exact frontend
   CORS origin, and credentials header. Retry startup/readiness for up to 3 minutes.
6. Recheck the exact Render deployment remains live. Only then report **Verified**
   in the Actions summary. This does not claim end-to-end OAuth/payment/socket tests.

Verification GETs retry transient network, 429 and 5xx failures at most three times;
HTTP requests have explicit timeouts and refuse redirects. Hook URLs, API keys,
raw responses and underlying network errors are not printed. A failed workflow
does not cancel an already started Render deploy. Inspect Render before rerunning.

The workflow serializes all main runs through verification and does not cancel an
active main deployment. Newer pending runs can replace older pending runs; this is
not a FIFO release queue. A stale run fails before its hook if main has advanced.
PR runs cancel superseded runs. A push arriving after the final head check can
still allow the already validated commit to finish, followed by newer validation.

## Enable and test safely

1. Keep `RENDER_DEPLOY_ENABLED` unset/false. Open a PR with this implementation and
   review the workflow, script and tests. Confirm no Render production job runs.
2. Include the documented lint, dependency and Docker fixes in the reviewed changes.
   Never bypass the gate to test CD. Confirm all validation checks pass, including
   the backend Docker image build, exclusions and runtime imports on Linux.
3. Configure branch protection and Vercel Deployment Checks. A failing test/lint
   change on a throwaway PR must fail the gate without a production deploy.
4. Confirm Render's deployment model and every service setting above, disable
   Render auto-deploy, create the production environment and configure its secrets
   and service ID. This brief handover leaves backend deployment manual until enabled.
5. After merge, manually run **ServeQ CI/CD** on `main` with `deploy` unchecked to
   validate CI only. A manual run defaults to no deployment, even after enabling.
6. Record the current known-good Render deployment and Vercel deployment for rollback.
   Set the repository variable `RENDER_DEPLOY_ENABLED=true`.
7. Manually run on current `main` with `deploy` checked for the first controlled
   deployment. This is a real production deployment. Inspect preflight, Render's
   exact commit, deploy completion and readiness summary. Do not run fault-injection
   tests against production; the offline tests cover failure paths.
8. Subsequent approved pushes/merges to `main` validate and deploy automatically.
   Confirm exactly one new Render deploy per eligible run. For a dry run, leave
   `deploy` unchecked; for a deployment pause, set the enable variable to `false`.

Useful local checks (Node 24.12+; no production `.env` or inherited credentials):

```sh
npm ci
npm run lint
NODE_ENV=test npm test
VITE_API_URL=https://api.serveq.tech npm run build
npm audit --omit=dev --audit-level=high
docker buildx build --platform linux/amd64 --file Dockerfile.backend --load --tag serveq-backend:check .
docker run --rm --env NODE_ENV=test --entrypoint node serveq-backend:check --input-type=module -e "await import('./app.js')"
```

### Frontend-to-backend smoke checks

```sh
curl --fail --max-time 15 https://api.serveq.tech/ready
curl --fail --max-time 15 -i -H 'Origin: https://serveq.tech' https://api.serveq.tech/ready
curl --fail --max-time 15 'https://api.serveq.tech/socket.io/?EIO=4&transport=polling'
```

Expect `status: ready`, database `connected`, and CORS headers allowing precisely
`https://serveq.tech` with credentials. The polling handshake should begin with
Engine.IO packet `0` containing a session ID; that checks transport reachability,
not authenticated room events or the WebSocket upgrade.

Open `https://serveq.tech` and check browser Network:

- REST requests target `https://api.serveq.tech/api/...`; no old backend host.
- Socket.IO connects to `api.serveq.tech`; verify the WebSocket request returns
  **101 Switching Protocols**, authenticated rooms work, and a queue change appears
  in a second signed-in browser session.
- Google sign-in uses `https://api.serveq.tech/api/auth/google/callback` and returns
  to `https://serveq.tech/auth/callback`. Check session persistence, login/logout,
  bearer authentication and secure HTTP-only cookie behavior without printing tokens.
- Reload a nested frontend route to check SPA fallback; use an approved test account
  to verify queue and booking state persists in the existing Atlas database.

### Troubleshooting and rollback

| Symptom | Action |
| --- | --- |
| Gate fails | Read the failed matrix/Docker job. Lint/audit failures must be fixed before deployment; changing deployment secrets does not resolve them. |
| Production job skipped | Check ref/event, CI gate, repository enable variable and manual `deploy` input. |
| Missing/invalid configuration | Confirm environment-scoped secrets and service ID; do not print their values. |
| Preflight refuses source/domain/hook | Compare the **new** service's source, Docker paths, verified custom domain and hook. Do not change DNS to make an old service pass. |
| Stale run | Use the newest validated main run. Do not rerun an older deployment as a rollback. |
| Active deployment or hook 202/timeout | Inspect Render first. Avoid a second trigger until the prior deploy's outcome is known. |
| API 401/403 | Rotate/fix the read API key and confirm permission to read service, custom domains and deploys. |
| Build failed | Read Render logs and the Actions Docker job; compare context, Dockerfile, lockfile and Node version. |
| Live but readiness fails | Check Atlas network access, URI/credentials, application logs, `/ready`, verified domain routing and CORS. `/health` returning 200 is insufficient. |
| REST works, realtime fails | Confirm Vercel built with the exact API origin; same-origin fallback is insufficient for Socket.IO on Vercel. Inspect upgrade/CORS/authentication. |
| OAuth/cookie fails | Check `SERVER_URL`, Google authorized redirect URI, `CLIENT_URL`, production mode and forwarded HTTPS. |

For a failed release:

1. Set `RENDER_DEPLOY_ENABLED=false` to stop future automatic production jobs.
   This does not cancel a deploy already sent to Render. Wait for or cancel the
   active Render deploy in the dashboard before rollback; a workflow canceled on
   GitHub can still have an active Render deploy.
2. In the **same new Docker service**, use Render's rollback action to restore the
   recorded known-good deployment. If unavailable for the service/plan, use its
   supported manual deployment of a known-good commit. Do not change service,
   domain, MongoDB, or return to the previous backend. Keep auto-deploy off.
3. Recheck Render live status, `/ready`, REST, cookies/OAuth and Socket.IO. Code
   rollback does not restore environment changes or reverse database migrations;
   review compatibility and backups separately if either changed.
4. If frontend rollback is needed, promote the known-good deployment within the
   existing Vercel project, preserving `serveq.tech` and the API build variable.
5. Revert/fix the bad code on `main`, require green CI, confirm head matches the
   intended release, then re-enable automatic deployment. Leaving main on the bad
   revision risks redeploying it on the next enabled push.

## Validation update — November 18, 2026

- Fixed the subscription slot fixture to pass the API's `YYYY-MM-DD` date format
  in the venue timezone; the 403 subscription assertion is retained.
- Mocked the linked booking writes in three queue unit tests, eliminating real
  database buffering timeouts. Test execution now always sets `NODE_ENV=test`
  and imposes a 60-second test timeout. The payment client no longer loads a
  developer `.env` file in test mode.
- Added `npm run check:build` to verify built public pages, canonical URLs,
  CSS/JavaScript entries, favicons, sitemap, robots, and private/404 noindex tags.
- Added a frontend Docker job to build the real Nginx image, run `nginx -t`, and
  check public/private URLs, asset status/MIME/CORS, permanent redirects with
  query preservation, and a true HTTP 404 over HTTP. The CI gate now requires
  quality checks plus both backend and frontend Docker jobs before Render deploys.
- Local validation: 174 tests passed, lint had zero errors (five existing Fast
  Refresh warnings), production artifact checks passed, backend imports passed,
  and the production dependency audit reported zero vulnerabilities. Workflow
  YAML and action SHA pins were validated. Docker is unavailable on this machine;
  the actual Linux container checks must pass in GitHub Actions after pushing.

Run `VITE_API_URL=https://api.serveq.tech npm run ci:frontend` on a POSIX shell
to reproduce the frontend release gate. The HTTP smoke checker can also be run
with `node scripts/check-frontend-http.mjs http://127.0.0.1:8080` against a locally
running frontend container. These checks do not replace live service readiness,
OAuth/payment verification, or the deployment checks already described above.

## Cloudflare API cutover

The public API hostname is **`api.serveq.tech`**. The Render service designated
for the cutover is **`serveqdocker.onrender.com`**. Its `/ready` endpoint
returned HTTP 200 and reported MongoDB connected on November 22, 2026. Public
DNS still returned **`smartqueue-1-bxqx.onrender.com`** as the API's CNAME
target, so verify the custom-domain assignment in Render before switching it.
`serveq.tech` was delegated to OrderBox nameservers. A `CF-Ray` from Render's
upstream does not verify a proxy or rules in ServeQ's own Cloudflare zone.

1. **Prepare the zone.** In Cloudflare, choose **Add a domain**, enter
   `serveq.tech`, and select the plan. Before changing nameservers, export or
   inventory the current zone and reconcile it with **DNS → Records**. Preserve
   the apex and `www` Vercel targets, MX, SPF, DKIM, DMARC, verification, CAA,
   and any other existing records. Keep existing web/mail targets DNS only
   during this migration. If a DNSSEC DS record exists at the registrar, remove
   the old DS before changing delegation and verify that it is gone. Set the
   registrar's nameservers to exactly the two assigned by Cloudflare, then wait
   for **Overview** to show **Active** and independently verify DNS. Re-enable
   DNSSEC with Cloudflare's new DS after the cutover. [Cloudflare nameserver and DNSSEC checks](https://developers.cloudflare.com/dns/zone-setups/full-setup/troubleshooting/)
2. **Confirm the Render origin.** Open the service with the default hostname
   `serveqdocker.onrender.com`, then go to **Settings → Custom Domains**.
   Check whether `api.serveq.tech` is attached there. If it is attached to
   another service, coordinate moving the custom domain in Render with the
   DNS cutover. A CNAME edit alone does not move the domain binding or
   certificate. Record the previous service and DNS target before the move.
   In Cloudflare **DNS → Records**, use type **CNAME**, name **api**, and
   target **serveqdocker.onrender.com**. Use **DNS only** during Render
   verification if required, then switch to **Proxied** after Render shows
   an issued, valid certificate for `api.serveq.tech`. Preserve any Render
   verification or renewal records.
   [Render's Cloudflare DNS guide](https://render.com/docs/configure-cloudflare-dns)
3. **Configure verified TLS.** In **Rules → Overview → Create rule →
   Configuration Rule**, match `http.host eq "api.serveq.tech"` and select
   **SSL/TLS encryption mode → Full (strict)**. If using **SSL/TLS → Overview**
   instead, select **Full (strict)** there only after verifying the certificates
   of every proxied hostname affected by the zone setting. Under **SSL/TLS →
   Edge Certificates**, confirm the certificate covering the API is active.
   Keep TLS verification enabled. If origin verification fails, repair the
   Render certificate or roll back to the previously working DNS/TLS setup.
   [Cloudflare encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/) · [Full (strict) certificate requirements](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
4. **Redirect API HTTP at the edge.** In **Rules → Overview → Create rule →
   Redirect Rule**, choose **Custom filter expression** and enter
   `(http.host eq "api.serveq.tech" and not ssl)`. Choose **Dynamic** and set
   the target expression to
   `concat("https://api.serveq.tech", http.request.uri.path)`. Choose **308**,
   enable **Preserve query string**, then deploy ahead of broader redirect rules
   that would match. If zone-wide **Always Use HTTPS** is enabled, check the
   effective API redirect and keep API clients on the HTTPS URL directly.
   [Cloudflare redirect rules](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/)
5. **Bypass cache and enable WebSockets.** In **Cache Rules → Create rule**,
   match `http.host eq "api.serveq.tech"` and set **Cache eligibility →
   Bypass cache**. Check that no later cache rule overrides it. In **Network**,
   confirm **WebSockets** is on. Use this hostname for both WebSocket and polling.
   [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/) · [WebSockets](https://developers.cloudflare.com/network/websockets/)
6. **Authenticate traffic from ServeQ's edge.** Generate a fresh value locally
   with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   In **Rules → Overview → Create rule → Request Header Transform Rule**,
   choose **Custom filter expression** and use
   `(http.host eq "api.serveq.tech" and ssl)`. Set these two actions in the
   same rule, covering the whole hostname including `OPTIONS` and `/socket.io`.

   | Action | Header | Value |
   | --- | --- | --- |
   | Set static | `x-serveq-origin-auth` | The generated 64-character hex value |
   | Set dynamic | `x-serveq-client-ip` | `to_string(ip.src)` |

   **Set** overwrites incoming values. Check that no later transform replaces
   either field. Deploy the rule before deploying the backend with the same
   value as `CLOUDFLARE_ORIGIN_SECRET` in **Render → Environment**. Treat
   the header value and dashboard rule as secrets. Keep the values out of
   browser code, Vercel variables, logs, screenshots, and Git. Keep `/ready`
   as the Render HTTP health check. Direct `GET` and `HEAD` requests to
   `/live` and `/ready` are exempt for Render probes. The other application and
   Socket.IO requests require both headers. With the secret unset the guard is
   off and Express uses the immediate peer IP, which can group users behind
   Render's proxy, so coordinate the backend deployment with this rule.
   [Header transform setup](https://developers.cloudflare.com/rules/transform/request-header-modification/create-dashboard/) · [Render health probes](https://render.com/docs/health-checks)
7. **Verify before closing the default hostname.** Confirm public DNS no
   longer exposes the Render CNAME, and use Cloudflare Trace in the
   ServeQ zone to verify the API rule matches without sharing its secret.
   Check the API through the following commands without passing the secret.

   ```powershell
   Resolve-DnsName api.serveq.tech
   curl.exe -sS -i "http://api.serveq.tech/live?edge_check=1"
   curl.exe -sS -i "https://api.serveq.tech/ready"
   curl.exe -sS -i "https://api.serveq.tech/api/auth/me" -H "Origin: https://serveq.tech"
   curl.exe -sS -i -X OPTIONS "https://api.serveq.tech/api/auth/me" -H "Origin: https://serveq.tech" -H "Access-Control-Request-Method: GET"
   curl.exe -sS -i "https://api.serveq.tech/socket.io/?EIO=4&transport=polling" -H "Origin: https://serveq.tech"
   ```

   Expect the HTTP redirect to preserve the query, readiness `200`, anonymous
   `/me` `401` with credentialed CORS, preflight `204`, and a polling open packet.
   Repeat the `/me` request with dummy `x-serveq-origin-auth` and
   `x-serveq-client-ip` headers and expect the same `401`. Check the Render
   hostname's `/api/auth/me` directly and expect `404`. Verify the WebSocket
   upgrade in browser dev tools, along with login, Google OAuth, a signed test
   Razorpay webhook, and a relative Vercel API rewrite. Keep Vercel's
   `VITE_API_URL` and Render's `SERVER_URL` set to
   `https://api.serveq.tech`, with both provider callbacks using that domain.
   Cloudflare's IP is the address that reached the ServeQ edge. For relative
   Vercel rewrites this can be Vercel's egress IP. Prefer the direct API hostname
   for traffic that needs per-visitor limits. In staging, confirm the stored
   source IP for a test support submission matches the test client's public IP,
   even if the request included a different IP in a forwarding header.
8. **Close the default hostname.** Once integrations and monitors use
   `api.serveq.tech`, go to **Render → Settings → Custom Domains →
   Render Subdomain** and select **Disabled**. Retest public API and Socket.IO
   traffic. Render still receives public ingress traffic to its custom-domain
   infrastructure. The shared secret rejects unauthenticated application traffic
   at Node and does not provide network isolation. [Render subdomain policy](https://render.com/docs/custom-domains#disabling-your-onrendercom-subdomain)

If the API starts returning 404 while readiness is healthy, check proxy status
and the two header actions before touching the database or OAuth configuration.
Restore the previous rule or roll back the backend and its environment together.
Keep the transform in place as long as any active backend instance requires the
credential. Restore DNS-only service only after rolling back the origin guard.
Apply any WAF or bot rules separately and exercise OAuth, Razorpay, preflights,
and both Socket.IO transports before enforcing rules on those paths.

### TLS and origin certificate verification

**November 23, 2026: Public HTTPS verified. Effective Cloudflare-to-origin
certificate validation remains unverified.**

| Check | Observed result |
| --- | --- |
| Public `https://api.serveq.tech/live` over IPv4 | `200` with Windows certificate validation enabled and successful. Ray ID `a5eed98fef5238b4-DEL`. |
| Public HTTP redirect | `301` to `https://api.serveq.tech/live?tls_check=1`, preserving the path and query for the sampled HEAD request. The proposed `308` was not observed, so method preservation was not established. Ray ID `a5eed9926ee986e5-DEL`. |
| Published Render ingress with `api.serveq.tech` as HTTPS hostname | `200` with Windows certificate validation enabled and successful. Ray ID `a5eed9957b9725a4-DEL`. |
| Certificate observed on both successful canonical-name connections | Subject `api.serveq.tech`, issuer Google Trust Services `WE1`, expires February 15, 2027 at 12:45:57 UTC. |

Initial checks from this environment gave inconsistent trust results. Some
failed with an untrusted or self-signed chain. The Windows IPv4 retests above
passed without disabling verification. The IPv6-only request could not be
completed here. Recheck from an independent network if clients report trust
errors. These probes do not establish the zone's minimum TLS version, certificate
chain behavior on every path, or the certificate served on Render's internal
hop. Render's published ingress itself uses Cloudflare, and a certificate seen
on that path does not show how ServeQ's Cloudflare zone validates its origin.

For configuration evidence, open the `serveq.tech` zone and record
**SSL/TLS → Overview** and any **Rules → Configuration Rules** that set SSL/TLS
mode for `api.serveq.tech`. Verify the **effective** setting is **Full (strict)**.
Review any **Origin Rules** for an overridden origin hostname or TLS server
name and verify that the certificate on the actual upstream matches that name.
In Render, confirm `api.serveq.tech` is **Verified** and its certificate is
issued on the intended service. Keep the origin validation item open until
those settings are confirmed. If the current `301` is intentional, keep API clients
on HTTPS directly. If the intended policy requires preserving methods on
redirect, check which rule emitted the `301` and validate the API-specific
`308` separately. Do not downgrade certificate validation to work around
certificate errors.

[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) ·
[Configuration Rules settings](https://developers.cloudflare.com/rules/configuration-rules/settings/) ·
[Render TLS certificates](https://render.com/docs/tls)

## Cloudflare WAF rules for the API

Apply these rules in the `serveq.tech` zone after the API cutover checks pass.
The zone plan is unverified. Check the plan in the Cloudflare dashboard before
choosing the Free or paid configuration. Scope API rules to `api.serveq.tech`,
including when the browser reaches it via a Vercel rewrite. Review existing zone
rules and keep their settings recorded for rollback.

| Tier | Available controls used here |
| --- | --- |
| Free | Cloudflare Free Managed Ruleset, up to five custom rules, one path-based IP rate rule with a 10-second window and mitigation, and sampled Security Events. Custom-rule Log is unavailable. Leave Bot Fight Mode off for this zone because it cannot exempt API traffic. |
| Pro | Cloudflare Managed and OWASP Core rulesets, up to 20 custom rules, two IP rate rules with hostname matching and windows up to 60 seconds, and Super Bot Fight Mode with exceptions. Rate-rule match expressions still cannot use the HTTP method. |
| Business | Adds up to five rate rules, method matching, status-based counting, optional IP with NAT support, regex in custom rules, and Security Events alerts. Custom-rule Log is still unavailable. |
| Enterprise | Custom-rule Log and request-body fields are available. Bot scores, advanced rate counting and malicious upload detection depend on the relevant add-on or contract. |

[Managed rules availability](https://developers.cloudflare.com/waf/managed-rules/) ·
[Custom rule limits](https://developers.cloudflare.com/waf/custom-rules/) ·
[Rate rule fields and limits](https://developers.cloudflare.com/waf/rate-limiting-rules/) ·
[Bot feature interactions](https://developers.cloudflare.com/waf/feature-interoperability/)

### Enforcement verification

**Status on November 23, 2026: Cloudflare edge blocking verified for the
scanner path.** A follow-up check at 13:54 IST returned:

| Request | Result | Cloudflare Ray ID |
| --- | --- | --- |
| `GET /live` | `200`, forwarded to Render | `a5eec6920bf60dbf-DEL` |
| `GET /api/auth/me` without credentials | `401`, with the Express request ID | `a5eec5af090625d9-DEL` |
| `GET /wp-login.php` | `403`, with the Cloudflare block page and no Render origin response marker | `a5eec694aed97083-DEL` |

The response is consistent with the scanner rule. The exact rule ID and
enforcement of other WAF policies are still unverified because Cloudflare
Security Events were unavailable from this session. Look up the latest
scanner Ray ID in the ServeQ zone to attribute the block.

Earlier checks on November 23 returned:

| Request | Result | Cloudflare Ray ID |
| --- | --- | --- |
| `GET /live` | `200`, forwarded to Render | `a5ee72e9492efdc2-SIN` |
| `GET /api/auth/me` without credentials | `401`, with the Express request ID | `a5ee72ee69bcd976-SIN` |
| `GET /wp-login.php` | `404`, with Render's origin response marker | `a5ee72fd0fb04d6f-SIN` |

The recommended **ServeQ API scanner paths** rule would block
`/wp-login.php` if it matched this request in Block mode. The observed Render
`404` confirms that this request was not blocked by that rule. It does not
establish whether the rule is absent, disabled, logging, or scoped differently,
or whether other WAF rules enforce their policies. A Ray ID confirms Cloudflare
handled the request somewhere in the path. It does not identify the active
rules or prove that ServeQ's zone took a specific action.

To close the gap, inspect **Security → Security rules** in the `serveq.tech`
zone and record the enabled rule ID, hostname scope and action. If the scanner
rule is already intended to block, repeat one request to
`https://api.serveq.tech/wp-login.php`. In **Security → Analytics → Events**,
filter by the API hostname, path, narrow time window and Ray ID where available.
Record the matching rule ID, action and returned status. A `403` attributed to
the named WAF rule verifies that rule only. If the scanner rule is intentionally
in observation, use the temporary unused-path canary under
[Render origin exposure and hardening](#render-origin-exposure-and-hardening)
and verify the managed and rate-limit policies separately. Sampled logs may
omit a request. Use a narrow window and do not treat absence as proof.

[Cloudflare Security Events](https://developers.cloudflare.com/waf/analytics/security-events/)

### Managed rules

1. For Free, confirm the **Cloudflare Free Managed Ruleset** in **Security →
   Settings**, filtered by **Web application exploits**. Use its baseline
   protections against widely exploited vulnerabilities. Review its existing
   deployment separately from any new rules. Where action or scope overrides
   are unavailable, exercise production-equivalent traffic on staging before
   changing production settings.
2. For Pro and above, open **Security → Settings → Web application exploits →
   Cloudflare managed ruleset**. Under **Security rules → Managed rules**,
   edit its **Execute** rule. Use `http.host eq "api.serveq.tech"` as the scope
   for a new API-only deployment. If the existing execute rule protects other
   hosts, preserve its coverage and review changes against those hosts as well.
   Use **Log** for the new settings where the managed-rule editor offers it.
   After reviewing events, remove the temporary overrides and use Cloudflare's
   default actions, with narrow overrides for verified false positives.
3. Add **OWASP Core** separately if the plan supports it. Start at **PL1**
   with **OWASP Anomaly Score Threshold → Low (60)** and action **Log** where
   available. Switch to Block after reviewing false positives. For both managed
   rulesets, if Log is unavailable, validate the new policy in staging before
   enabling it on the production hostname. Avoid deploying redundant Free
   rules across the same traffic already covered by the broader ruleset.

Managed rules cover common SQL injection, XSS, protocol anomalies, and known
exploit signatures. ServeQ uses MongoDB. Continue validating field types and
building explicit query filters from allowed fields at the origin. Generic WAF
signatures cannot reliably identify every NoSQL operator injection or malformed
business payload. Managed inspection has a plan-dependent body limit, while
custom request-body expressions require Enterprise. Avoid blanket string filters
over free text, chat, prescriptions, and webhook payloads.

[Managed rules dashboard](https://developers.cloudflare.com/waf/managed-rules/deploy-zone-dashboard/) ·
[OWASP Core settings](https://developers.cloudflare.com/waf/managed-rules/reference/owasp-core-ruleset/concepts/) ·
[Request body field requirements](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/http.request.body.raw/)

### Custom rules

In **Security → Security rules → Create rule → Custom rules**, use **Edit
expression** for each rule. Save new blocking rules as drafts while testing.
Use **Log** for a production observation period when the plan supports it.

**ServeQ API scanner paths** · Free and above · **Block after validation**

```text
(http.host eq "api.serveq.tech" and (
  lower(http.request.uri.path) in {"/.env" "/.env.local" "/.env.production" "/.git" "/wp-login.php" "/xmlrpc.php"}
  or starts_with(lower(http.request.uri.path), "/.git/")
  or starts_with(lower(http.request.uri.path), "/wp-admin/")
))
```

**ServeQ API unused methods** · Free and above · **Block after validation**

```text
(http.host eq "api.serveq.tech" and http.request.method in {"TRACE" "CONNECT"})
```

**ServeQ API bot challenge exclusion** · Pro and above, only if enabling Super
Bot Fight Mode · **Skip** with only **All Super Bot Fight Mode rules** selected

```text
(http.host eq "api.serveq.tech")
```

Put the bot exception before enabling Super Bot Fight Mode for the rest of the
zone. The whole API hostname serves clients that may be unable to complete a
browser challenge, including browsers using cross-origin fetch, mobile clients,
Vercel rewrites, Socket.IO and providers. Keep managed inspection, custom rules,
and rate limits enabled there.

**ServeQ API automated sign-in observation** · Enterprise with Bot Management ·
**Log**

```text
(http.host eq "api.serveq.tech" and http.request.method eq "POST"
  and lower(http.request.uri.path) in {"/api/auth/signin" "/api/auth/signin/"}
  and cf.bot_management.score eq 1 and not cf.bot_management.verified_bot)
```

Review it alongside credential failures and burst rates before configuring any
blocking action. An automated score can also identify legitimate client tools.
Keep challenges out of the API and avoid treating user agent, country, or
missing `Origin` as proof of abuse.

[Custom rule actions](https://developers.cloudflare.com/waf/custom-rules/) ·
[Skip options](https://developers.cloudflare.com/waf/custom-rules/skip/options/) ·
[Super Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/super-bot-fight-mode/) ·
[Bot scores](https://developers.cloudflare.com/bots/concepts/bot-score/)

### Rate rules

Use **Security → Security rules → Create rule → Rate limiting rules**.
Select **IP** as the counting characteristic and **Block** as the final
action. Keep the origin's JSON 429 limits and account-level OTP limits.
The following are conservative starting points for detecting sustained bursts.
Calibrate them against normal traffic and origin 429s before enabling them. A
Vercel rewrite or a shared network can concentrate clients into one IP bucket.

**Free** · Use the single rule only if the two paths are unique in this zone.
Free cannot add the API hostname or method to this rate rule. Start with
**30 requests per 10 seconds**, **10 seconds mitigation**.

```text
(lower(http.request.uri.path) in {"/api/auth/signin" "/api/auth/signin/"})
```

**Pro and above, rule 1** · Credential and OTP surfaces. Start with **60
requests per 60 seconds**, **10 seconds mitigation**. On Business or above,
add `and http.request.method eq "POST"` inside the outer parentheses.
Without method matching, preflights can count towards the rate.

```text
(http.host eq "api.serveq.tech" and (
  lower(http.request.uri.path) in {
    "/api/auth/signin" "/api/auth/signin/" "/api/auth/signup" "/api/auth/signup/"
    "/api/auth/forgot-password" "/api/auth/forgot-password/"
    "/api/auth/verify-otp" "/api/auth/verify-otp/"
    "/api/auth/reset-password" "/api/auth/reset-password/"
  }
  or starts_with(lower(http.request.uri.path), "/api/auth/forgot-password/")
  or starts_with(lower(http.request.uri.path), "/api/auth/email/")
  or starts_with(lower(http.request.uri.path), "/api/auth/phone/")
  or starts_with(lower(http.request.uri.path), "/api/otp/")
))
```

**Pro and above, rule 2** · Costly public API traffic. Start with **240
requests per 60 seconds**, **10 seconds mitigation**. On Business or above,
consider separate rules after measuring Maps autocomplete and form traffic.

```text
(http.host eq "api.serveq.tech" and (
  starts_with(lower(http.request.uri.path), "/api/maps/")
  or lower(http.request.uri.path) in {
    "/api/chatbot/chat" "/api/chatbot/chat/"
    "/api/support" "/api/support/" "/api/waitlist" "/api/waitlist/"
    "/api/business-applications" "/api/business-applications/"
  }
))
```

Both paid rules exclude OAuth callbacks, the Razorpay webhook, Socket.IO and
health probes by construction. When a rate rule offers **Log**, use it first.
Otherwise keep the rule off in production during baseline collection. Use
**Security → Analytics → Traffic** and origin 429 metrics to estimate legitimate
bursts, then verify the thresholds with controlled requests to staging. Traffic
analytics does not register matches from a disabled rule. Business can add
status-based counting after observing which responses actually indicate failed
sign-ins. Keep OTP send limits based on attempts, since some OTP flows return
generic success responses for privacy.

[Create rate rules](https://developers.cloudflare.com/waf/rate-limiting-rules/create-dashboard/) ·
[Rate parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)

### Monitor, validate, and enable blocking

1. Validate successful sign-in, OTP send and verify, Google OAuth navigation and
   callback, credentialed CORS preflight, real signed Razorpay test delivery,
   Socket.IO upgrade, polling GET and POST, reconnection, public and Render
   health checks, and ordinary Maps and free-text requests. Test both direct API
   requests and the Vercel rewrite with staging fixtures. Use Cloudflare Trace
   to check scope and order, and staging requests to verify actual behavior.
   Cloudflare inspects the WebSocket handshake and polling HTTP, with ongoing
   WebSocket messages handled by ServeQ.
2. Review **Security → Analytics → Events** by hostname, rule ID, action and
   path. Correlate `CF-Ray` with origin logs if available and check origin 429s,
   payment delivery retries, login failures and reconnect failures. Observe a
   normal peak period before enforcing. Sampled events may omit individual
   requests. Do not collect payload logs, credentials, OAuth query values, or
   patient data for this rollout.
3. If a managed rule falsely flags a legitimate provider request, use
   **Security rules → Deploy → Deploy managed exception**. Match the API host,
   exact path and method where appropriate, and select only the specific managed
   rule ID shown in Events. Place the exception before the relevant Execute
   rule. Keep Razorpay signature verification and the original body intact.
4. Enable blocking one rule at a time and repeat the smoke checks. If legitimate
   traffic starts failing, return the offending rule to Log or disable that
   rule. Keep the Render origin guard and TLS in place while rolling back WAF
   changes.

[Security Events](https://developers.cloudflare.com/waf/analytics/security-events/) ·
[Managed exceptions](https://developers.cloudflare.com/waf/managed-rules/waf-exceptions/define-dashboard/) ·
[WebSocket inspection](https://developers.cloudflare.com/network/websockets/)

## Cloudflare and Redis rate limits

The limits below are initial deployment settings based on code paths and client
behavior. Production traffic telemetry was not available. Active booking history
polls every 5 seconds and refreshes on socket events and focus. The doctor
dashboard polls every 10 seconds, the admin dashboard makes four API calls every
10 seconds plus event refreshes, customer venue discovery refreshes every 12
seconds, and notifications poll every 60 seconds. Keep the existing general
limit at 180/minute initially. Reducing it to 100 or using 3/minute per IP for
sign-in could penalize busy users, multiple tabs, and shared networks. Use a
separate account budget for sign-in and validate all limits against a normal peak
in staging and after cutover.

| Backend route or bucket | Starting sliding-window policy |
| --- | --- |
| General `/api` | 180/min per IP. CORS preflight, health routes, Socket.IO and the signed Razorpay delivery route are outside the visitor quota. |
| `POST /api/auth/signin` | 20/min per IP and 6/min per normalized email, including retries and successful submissions. |
| `POST /api/auth/signup` | 10/min per IP and 3/min per normalized email. |
| OTP sends | Legacy login OTP: 20/5 min per IP and 3/5 min per normalized phone. Profile phone/email sends share 20/5 min per IP and 6/5 min per signed-in user, with an additional 3/5 min per recipient within the corresponding flow. Firebase sends SMS from the client; the backend limits its proof verification alongside other profile verification. |
| OTP verification | Legacy login OTP: 30/5 min per IP and 8/5 min per phone. Signed-in profile verification: 10/5 min per user. Existing per-code attempt and cooldown checks still apply. |
| Password recovery | Send and complete each have 20/5 min per IP and 3/5 min per email. Verify has 30/5 min per IP and 8/5 min per email. The old and new URLs share the same bucket for each stage. |
| Selected authenticated sensitive writes | 5/min per user within each family: password/owner upgrade, doctor access invite/revoke, and payment settings. Regular queue and booking activity uses the general quota. |
| Checkout | Booking and subscription order creation share 10/min per signed-in user. Legacy unauthenticated order creation has 15/min per IP. Payment verification remains under the general API quota. `POST /api/payments/webhook` still requires the original body and valid Razorpay signature, with existing deduplication. |
| Public provider and application routes | Maps share 90/min per IP; chatbot allows 24/min per IP; business applications retain 5/hour per IP. |

The API accepts the client IP from the authenticated Cloudflare origin guard or
uses the immediate peer address. Generic forwarding headers never determine the
key. IPv4-mapped IPv6 is normalized to IPv4 and IPv6 addresses share their
/64. Signed-in budgets take the user ID only after authentication. Recipient
budgets apply to requests for both known and unknown accounts, with normalized
emails and phones keyed by HMAC. Redis keys contain no raw emails, phone numbers,
IPs, tokens, or passwords. Each budget is checked separately, so a request
rejected by an account budget still counts toward the earlier IP budgets.

Redis applies each budget atomically using Redis server time and expires keys
after their window. All Render API instances use the same store and key secret.
An exceeded budget sends JSON HTTP `429` and `Retry-After` in seconds. During a
Redis outage, ordinary API and Maps traffic can continue without Redis limits.
Endpoints with stricter policies return `503` and `Retry-After: 5` instead of
using process-local counters or calling costlier services. Health probes,
Socket.IO and valid webhook delivery can still operate. Alert on the
`Rate limit store unavailable` log, store capacity, latency and evictions.

### Provisioning and rollout

1. In Render, create a dedicated **Key Value** instance in the same workspace
   and region as `serveqdocker`. Use the internal connection URL, require
   internal authentication if available and use the URL Render provides for
   that configuration. Keep external access disabled. For an external Redis
   provider, use its verified `rediss://` URL. Retain TLS verification.
   Choose capacity and a no-eviction policy for this dedicated store.
2. In **serveqdocker → Environment**, set `REDIS_URL` to that URL and
   `RATE_LIMIT_KEY_SECRET` to a fresh 64-character lowercase hex value
   generated by `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Production startup requires both. Share the values across instances of
   the same backend and use separate staging credentials and storage. Keep
   them out of Vercel and logs. Keep the secret stable during rolling deploys.
3. Verify Phase 2 origin attribution **before** enforcing these limits on Render.
   Otherwise the immediate peer can be a shared Render proxy. Verify that normal
   Vercel clients take the direct `VITE_API_URL` path. Vercel rewrites can still
   share an edge-visible egress IP. Compare direct and rewrite traffic in staging.
4. Validate with two backend processes sharing the staging store, then deploy.
   Exercise distinct accounts on one IP, the same account from multiple IPs,
   reset aliases, browser-visible `Retry-After`, WebSocket upgrade and polling,
   and signed Razorpay retries. Test Redis interruption and recovery in staging.
   The CI test job runs the concurrent-counter test against disposable Valkey.
5. Apply the **Rate rules** from Phase 3 in Cloudflare. Free has one sign-in
   burst rule. Pro and above can separate credential bursts from costly API
   routes. Business and above can count selected methods and sign-in response
   statuses. Keep edge rules in Log when available, otherwise observe actual
   traffic and test in staging before switching them to Block. Do not apply
   a blanket edge quota to the payment webhook, Socket.IO, health probes, or
   OAuth callbacks. Keep API clients free of browser challenges.

Cloudflare filters high-volume bursts before traffic reaches Render. Its
rate-limit counters are scoped by edge location and can enforce with a delay.
Redis provides one precise budget across origin instances and can distinguish
signed-in users or normalized recipients. An edge rejection can have a
different response format from the backend JSON 429. Monitor edge rule hits
and origin 429s separately, then tune one policy at a time.

If Business or above has five available rate rules, use the following as an
alternative to the two grouped Pro rules. In each auth rule, match
`http.host eq "api.serveq.tech" and http.request.method eq "POST"`, then use
`lower(http.request.uri.path) in {...}` with the listed exact paths and
their trailing-slash variants. Count by IP and start with a 10-second Block
mitigation after the observation period. Use the same costly API expression
from Phase 3, with its existing method behavior, for the fifth rule.

| Edge rule | Paths | Initial burst ceiling per IP |
| --- | --- | --- |
| Sign-in | `/api/auth/signin` | 60/min |
| Registration | `/api/auth/signup` | 30/min |
| OTP and reset sends | `/api/auth/email/send-otp`, `/api/auth/phone/send-otp`, `/api/auth/forgot-password`, `/api/auth/forgot-password/send-otp` | 90/5 min |
| Verify and complete | `/api/auth/phone/verify-otp`, `/api/auth/phone/verify-firebase`, `/api/auth/email/verify-otp`, `/api/auth/verify-otp`, `/api/auth/forgot-password/verify-otp`, `/api/auth/reset-password`, `/api/auth/forgot-password/reset-password` | 120/5 min |
| Costly public API | Phase 3 Maps, chatbot, support, waitlist, and business application rule | 240/min |

The edge ceilings intentionally leave room for shared networks and do not
duplicate per-account limits. Keep the general API and authenticated sensitive
write budgets at the origin. A Business failure-only sign-in rule can be tuned
later using response status, after confirming the origin's invalid-credential
responses and deciding whether a failed-IP burst should also delay successes.

[Render Key Value](https://render.com/docs/key-value) ·
[Cloudflare rate limit plans and limits](https://developers.cloudflare.com/waf/rate-limiting-rules/)

## Bot, credential stuffing, and HTTP DDoS protection

Use these settings in the ServeQ zone after confirming `api.serveq.tech` is
proxied through that zone. Verify the plan in the account. A Cloudflare header
from Render's upstream alone does not show that ServeQ's own rules are active.
On November 22, 2026, public DNS showed Cloudflare nameservers and proxied API
addresses. Public HTTPS liveness, CORS preflight, Socket.IO polling and a
guest WebSocket connection passed. These checks do not show which dashboard
rules or SSL/TLS origin mode are configured.

1. **HTTP DDoS.** Keep Cloudflare's default HTTP DDoS Attack Protection managed
   ruleset on the proxied API hostname. It is always on for onboarded zones on
   all plans. In **Security → Security rules → DDoS protection**, review existing
   overrides and start with the defaults. In **Security → Analytics → Events**,
   filter for HTTP DDoS and correlate with Render origin errors and latency.
   Do not use zone-wide Under Attack mode for this API. Investigate confirmed
   false positives by rule ID before tuning. Most plans have one override that
   applies across the zone. Request-specific expressions require Enterprise
   Advanced DDoS Protection.
2. **Automated login and credential stuffing.** Keep the Phase 4 IP and
   normalized email sign-in budgets, plus the Cloudflare burst rule appropriate
   to the plan. Under **Security → Settings → Detection tools**, review
   **Leaked credential detection**. It is enabled by default on Free and may
   need to be enabled on a paid plan. Free can see the leaked-password signal;
   Pro and above can see the leaked-pair signal. Verify that the default
   detection understands ServeQ's JSON login before relying on either signal.
   If Enterprise is available and detection misses it, open **Configurations →
   Edit → Add custom username and password location** and use
   `lookup_json_string(http.request.body.raw, "email")` for the username
   and `lookup_json_string(http.request.body.raw, "password")` for the password.
   Test with Cloudflare's published fixture credentials against staging.
   Keep enforcement limited to `POST /api/auth/signin` on the API host, including
   its trailing-slash variant. Start with Analytics or Log where available.
   Do not auto-block an account on a leaked-password-only signal or use a
   browser challenge on the sign-in API. When a confirmed leaked pair leads
   to enforcement, ensure the affected user can still reach password recovery.
3. **Scraping and excessive API requests.** Keep the Phase 4 costly-route and
   origin budgets. Use **Security → Analytics → Traffic** to baseline public
   business listings, public queue reads, Maps, and chatbot traffic. Check
   normal polling, shared IPs, mobile browsers and Vercel rewrites before
   adding a dedicated read-rate rule. Prefer an exact route burst limit over
   blocking broad client categories. Verified bots are a useful signal for
   public web pages, not proof of authorization for API data.

| Capability | Plan and ServeQ setting |
| --- | --- |
| Bot Fight Mode | Free. Leave it off on the API's zone because it cannot exempt legitimate automated requests or non-browser clients. |
| Super Bot Fight Mode | Pro, Business, and Enterprise without the Bot Management add-on. Apply the Phase 3 API hostname **Skip** rule for this phase alone before enabling it for eligible proxied web hosts elsewhere in the zone. Keep API WAF and rate rules enabled. |
| Bot Management | Enterprise add-on. Use the Phase 3 automated sign-in **Log** rule first. For suspected scraping, optionally log `http.host eq "api.serveq.tech" and http.request.method eq "GET" and lower(http.request.uri.path) in {"/api/businesses" "/api/businesses/"} and cf.bot_management.score eq 1 and not cf.bot_management.verified_bot`. Correlate with traffic volume before choosing any mitigation. Extend to other observed paths individually. |
| Turnstile | Available independently on Free, with an Enterprise tier for higher limits and additional features. ServeQ uses a form widget on Vercel with server-side verification. It does not require Vercel DNS to be proxied. |

[HTTP DDoS managed rules](https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/) ·
[Leaked credential detection setup](https://developers.cloudflare.com/waf/detections/leaked-credentials/get-started/) ·
[Bot compatibility](https://developers.cloudflare.com/waf/feature-interoperability/) ·
[Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)

### Turnstile setup and rollout

Turnstile applies to business application submissions and to support requests
without a valid ServeQ session. These browser forms can trigger processing and
email for unauthenticated visitors. Authentication, registration, OAuth,
signed-in support, payment and external callbacks, WebSocket and Socket.IO
polling, health checks, and other API consumers do not use the widget.

1. Open **Cloudflare Dashboard → Turnstile → Add widget**. Name it
   `ServeQ web forms`. Under **Hostname Management**, add the exact production
   Vercel frontend hostnames, normally `serveq.tech` and `www.serveq.tech` if
   both serve pages. Use **Managed** mode with **pre-clearance disabled**.
   Use a separate widget and keys for staging. Configure its actual frontend
   hostname independently and avoid wildcard preview coverage.
2. Set **Vercel → Project → Settings → Environment Variables →
   `VITE_TURNSTILE_SITE_KEY`** to the public site key and rebuild the frontend.
   If a frontend Content Security Policy is added outside the repo, allow
   `https://challenges.cloudflare.com` in `script-src` and `frame-src` as documented.
   In **Render → serveqdocker → Environment**, set `TURNSTILE_MODE=observe`,
   `TURNSTILE_SECRET_KEY` to the matching secret, and
   `TURNSTILE_ALLOWED_HOSTNAMES=serveq.tech,www.serveq.tech` adjusted to the
   actual frontend hosts. Never put the secret in a `VITE_` variable. Server
   verification checks the hostname serving the form, rather than the API
   hostname receiving the submission.
3. Confirm the shared Redis store from Phase 4 is ready. Render calls Siteverify
   with a three-second timeout, checks success, hostname and expected action
   (`business_application` or `guest_support`), then atomically claims a token
   digest in Redis for five minutes. This prevents reuse across Render instances
   even when Cloudflare accepts concurrent redemptions. Render logs only
   aggregate outcomes, without tokens or form data. Observe mode continues
   accepting submissions while collecting these outcomes.
4. With a staging widget, exercise both forms on iOS Safari and Android Chrome,
   including narrow screens, expired tokens, script failures and submitting
   after retry. Use the real staging widget for hostname and action checks.
   Repeat signed-in support, customer/owner/doctor login, OAuth, Socket.IO
   WebSocket and polling, and a signed Razorpay test delivery. If another
   integration submits either protected form without a browser, identify it
   before enforcement and give it an authenticated integration path. Native
   consumers of the browser forms can use the hosted form in a supported
   browser or a Turnstile-compatible WebView.
5. Review **Turnstile → ServeQ web forms → Analytics** and Render outcome logs
   across normal peak traffic. Only then set `TURNSTILE_MODE=enforce` on Render.
   Missing, invalid, and replayed tokens receive `403`. If Siteverify or Redis
   is unavailable, the protected forms return `503` with `Retry-After`.
   If legitimate submissions drop or checks fail, roll back to `observe`
   (or `off` to stop validation). The WAF, origin guard, and rate limits can
   continue operating independently.

[Create a Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/) ·
[Server-side validation and token reuse](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) ·
[Mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/) ·
[Content Security Policy](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)

## Render origin exposure and hardening

Read-only checks on November 22, 2026, used normal TLS certificate validation.
The public API DNS resolved to ServeQ's Cloudflare proxy. Render's public
service hostname resolved to a different upstream address range.

| Request path | Observed result | What it establishes |
| --- | --- | --- |
| `api.serveq.tech`, normal DNS | `GET /api/auth/me` returned the application's anonymous `401`. | The public API forwards legitimate traffic to the app. |
| `serveqdocker.onrender.com` | `GET /live` returned `200`. `GET /api/auth/me` returned the same generic JSON `404` used by the origin guard, without the gateway request ID. | The default name is public. The tested application route was rejected in a way consistent with the origin guard. |
| `smartqueue-1-bxqx.onrender.com`, the former public DNS target | `GET /live` returned `200`. `GET /api/auth/me` returned the application's anonymous `401` with a gateway request ID. | A legacy route reaches a ServeQ authentication handler outside the canonical API hostname. The probe did not establish which Atlas database or background jobs the legacy service uses. |
| Canonical API hostname sent to the published Render ingress, retaining its HTTPS hostname | `/live` returned `200`, `/api/auth/me` returned `401`, and Socket.IO polling opened with `200`. | The canonical hostname is accepted at that ingress. Both public and forced-ingress responses had Cloudflare headers, including reporting headers. These status codes do not establish whether ServeQ's zone rules ran or whether the route circumvented them. Treat the path as unverified until checked against the zone's own events. |

The repository uses a constant-time comparison of a 256-bit origin secret
before Express route handling or Engine.IO polling and upgrades. The Cloudflare
rule must overwrite both the secret header and the client IP header, and scope
injection to HTTPS requests for `api.serveq.tech`. The origin ignores generic
forwarding headers. CORS is browser policy. DNS, `Host`, `CF-Ray`, and
`CF-Connecting-IP` are not proof that ServeQ's zone authorized the request.
The guard is disabled when the Render secret is unset. Exactly `GET` and
`HEAD` on `/live` and `/ready` can bypass the secret for Render health checks.
The guard currently does not enforce an application-level hostname allowlist.

### Recommended steps on the current Render web service

1. In **Render → serveqdocker → Settings → Custom Domains**, confirm that
   `api.serveq.tech` is the verified custom domain, check its certificate, and
   inventory any other bindings. Confirm Full (strict) and the
   Phase 2 origin request-header rule in the ServeQ zone. Verify the matching
   `CLOUDFLARE_ORIGIN_SECRET` is set in Render without reading its value into
   logs. Restrict access to that configuration and rotate the credential if
   it was disclosed. Keep `/ready` for Render's direct health check.
2. On the **ServeQ Cloudflare zone**, temporarily create a custom **Block**
   rule for one unused, unique audit path and only on the API host. Give the
   rule a recognizable name. Request that path once through normal public DNS
   and once using the known Render ingress with the canonical hostname.
   Check the application and ServeQ **Security → Analytics → Events** for
   both requests. An event for this exact temporary rule proves the request
   reached ServeQ's WAF. A missing event alone is inconclusive because events
   can be sampled. If the public path is blocked but the Render ingress gets
   the app's normal response, treat that ingress path as a bypass and resolve
   it before relying on WAF-only controls. Remove the rule after the check.
3. Confirm Vercel, Razorpay, Google OAuth, Socket.IO, release automation and
   monitors use `api.serveq.tech` before changing Render. Set **Settings →
   Custom Domains → Render Subdomain → Disabled** on `serveqdocker`.
   Verify the default hostname returns Render's `404` even at `/live`.
   Rerun the canonical API, CORS, signed webhook and Socket.IO smoke checks.
   Disabling the name does not by itself lock down the custom-domain ingress.
4. Audit the former Render service, `smartqueue-1-bxqx.onrender.com`. Check
   users, integrations, monitoring, deploy hooks, Atlas database binding,
   and the booking completion worker before removing it. Retire the service
   after confirming it is unused. If it still has a purpose, give it a distinct
   staging database and credentials, and apply an origin restriction that
   fits that service. No public probe determines whether the legacy service
   can read or modify production data.
5. Consider validating the literal HTTP Host against the canonical hostname
   in Express and Engine.IO as a second check. Test the host that Render
   sends for its probes before enforcing. Do not use `X-Forwarded-Host` as
   authority. Host validation reduces accidental alias exposure. An external
   client can still send the canonical hostname, so keep origin authentication.

### Render network restrictions and stronger options

| Control | Fit for ServeQ |
| --- | --- |
| Render inbound IP restrictions | Public web-service rules require a **Render Scale or Enterprise** workspace and support IPv4 CIDRs only. In **serveqdocker → Settings → Networking → Inbound IP Restrictions**, first reproduce the two-hop topology on staging and verify which IP Render evaluates. Render uses its own Cloudflare ingress, so do not assume its filter sees the ServeQ Cloudflare egress IP. Confirm normal HTTPS, WebSocket, polling, signed provider traffic, verification/renewal, and probes before changing a production allowlist. Shared Cloudflare ranges do not identify ServeQ's zone. Keep the secret guard, even with a verified IP allowlist. |
| Cloudflare Authenticated Origin Pulls | Requires the actual TLS listener to validate Cloudflare's client certificate. Render terminates public TLS before handing HTTP to Express. Standard Render web-service settings do not document customer control of client-certificate enforcement at that listener. Do not count an enabled Cloudflare toggle as mTLS unless Render confirms support and an origin-side rejection test passes. On an origin you control, use a zone-specific or per-hostname certificate and enforce verification at the listener. Full (strict) validates the origin's certificate and is independent of client-certificate authentication. |
| Private Render service and Cloudflare Tunnel | Strongest fit if the API must have no public origin. Deploy the API as a **Render Private Service** and run an outbound `cloudflared` connector with access to its private endpoint, for example from a Render worker in the same region and private network. Route `api.serveq.tech` through the tunnel after staging and remove the public service binding once cutover is verified. Preserve end-user TLS and use a trusted certificate if the connector-to-origin leg uses HTTPS. Plan connector redundancy and private service health checks, update the public-web-service assumptions in the deployment script, and validate WebSocket behavior, provider callbacks, and both new and active booking flows before retiring the old service. |

The near-term choice is to verify and keep the secret guard and close both
unneeded public hostnames. Render's public ingress still accepts network
traffic and the application still needs to reject requests; the guard does
not move that traffic off Render or protect against a leaked credential.
ServeQ's WAF protections do not cover requests that reach an origin without
passing through the ServeQ zone. Use a private origin and Tunnel if that
residual exposure is unacceptable.

[Render custom domains](https://render.com/docs/custom-domains#disabling-your-onrendercom-subdomain) ·
[Render inbound IP rules](https://render.com/docs/inbound-ip-rules) ·
[Render TLS termination](https://render.com/docs/web-services#connect-to-your-web-service) ·
[Cloudflare SaaS product compatibility](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/product-compatibility/) ·
[Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/) ·
[Render private services](https://render.com/docs/private-services) ·
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)

## Platform references

The frontend smoke failure in [run 44320083098](https://github.com/ayushman3004/SmartQueue/actions/runs/44320083098)
was a real routing defect: Nginx returned `/help`'s absolute Location with port 80
instead of the externally mapped port 8080. `absolute_redirect off` now returns
relative redirects, preserving the public host, HTTPS scheme and mapped port.
The exact dropped-port case is retained in `tests/frontend_http.test.js`; the
container's HTTP assertions and deployment gate remain enabled. Local verification
reproduced the original failure and passed the fixed configuration against official
Nginx 1.30.6 behind a proxy using a different public port. Docker itself still
needs to run in GitHub Actions.

- [Render deploy hooks: exact commit refs, deployment IDs and queued responses](https://render.com/docs/deploy-hooks)
- [Render retrieve-deploy API](https://api-docs.render.com/reference/retrieve-deploy)
- [Render retrieve-service API](https://api-docs.render.com/reference/retrieve-service)
- [Render public OpenAPI schema](https://api-docs.render.com/openapi/render-public-api-1.json)
- [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks)
