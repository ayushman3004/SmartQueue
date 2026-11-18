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
| REST | `src/api/axios.js` appends `/api` to `VITE_API_URL`, sends credentials and bearer tokens, and falls back to the production API host outside localhost. |
| Realtime | `src/lib/socket.js` uses `VITE_API_URL` directly, credentials, WebSocket and polling. Without that variable it uses the frontend origin; Vercel's rewrites do **not** configure a Socket.IO proxy. |
| Backend | `npm start` → `node server.js`, HTTP + Socket.IO, binds `0.0.0.0` on `process.env.PORT` or 3001. It starts listening only after MongoDB connects. |
| Docker | Repository root context `.` and `Dockerfile.backend`; `node:24-alpine`, `npm ci --omit=dev`, `NODE_ENV=production`, `npm start`. Runtime sources are copied explicitly rather than copying the whole repository. `EXPOSE 3001` is metadata; Render's runtime `PORT` takes precedence. |
| Frontend Docker | `Dockerfile.frontend` builds Vite and serves `dist` with nginx. It is a local alternative, not the Vercel production deployment. It has no `VITE_API_URL` build argument; Compose therefore does not reproduce the production environment automatically. |
| Compose | `compose.yaml` builds both Dockerfiles from root and uses a local `.env` for the backend, port 3001, frontend port 8080 and a localhost client origin. Not used for Render deployment. |
| Node | The previous `>=18` engine was inaccurate. Firebase's locked app/auth/firestore packages require `>=24.12.0`, which is stricter than Vite's and OpenAI's requirements. Root manifest and lockfile declare `>=24.12.0`; CI and both Dockerfiles use Node 24. Set the existing Vercel project's Node version to 24.x if it is pinned to an older major. |
| Installation | `npm ci` for validation; `npm ci --omit=dev` in the backend image. No separate backend manifest or registry configuration. |
| Lint | `npm run lint` → `eslint .`. Existing ESLint configuration excludes backend paths and tests; this workflow preserves that scope. |
| Tests | `NODE_ENV=test npm test` → `node --test tests/*.test.js`. Existing tests mock model/service operations or use schema objects and local HTTP servers. No MongoDB service, Atlas URI, or external service credentials are required. These are not full integration tests of MongoDB, OAuth, email, payments or WebSockets. |
| Build | `npm run build` generates `public/sitemap.xml` and `public/robots.txt`, then runs Vite. Sitemap generation changes dates in the working tree; CI does not commit them. |
| Health | `/health`, `/api/health`, `/healthz` return 200 with database state, even when disconnected. `/live` checks the HTTP process. `/ready` and `/health/ready` require a connected MongoDB and a successful database ping, returning 503 otherwise. Use `/ready` for deployment readiness. |
| OAuth/cookies | `SERVER_URL` overrides `RENDER_EXTERNAL_URL` for `/api/auth/google/callback`; redirect goes to `CLIENT_URL/auth/callback`. Express trusts one proxy; secure production token cookies depend on forwarded HTTPS and use `SameSite=None`. |
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
| Existing integration credentials | Preserve `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_MAPS_API_KEY`, OpenRouter keys/model settings, Resend/SMTP/Gmail settings, and optional Twilio settings as used by the application. |
| Existing admin settings | The application has fallback admin credentials in `auth.service.js`; ensure strong `ADMIN_EMAIL`/`ADMIN_PASSWORD` configuration and review existing admin accounts separately. No auth logic was changed in this task. |

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
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` if those features are
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

## Platform references

- [Render deploy hooks: exact commit refs, deployment IDs and queued responses](https://render.com/docs/deploy-hooks)
- [Render retrieve-deploy API](https://api-docs.render.com/reference/retrieve-deploy)
- [Render retrieve-service API](https://api-docs.render.com/reference/retrieve-service)
- [Render public OpenAPI schema](https://api-docs.render.com/openapi/render-public-api-1.json)
- [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks)
