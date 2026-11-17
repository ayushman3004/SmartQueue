import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const activeStatuses = new Set([
  'created', 'queued', 'build_in_progress', 'pre_deploy_in_progress', 'update_in_progress',
]);
const failedStatuses = new Set([
  'build_failed', 'pre_deploy_failed', 'update_failed', 'canceled', 'deactivated',
]);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const rootPath = (path) => ['', '.', './'].includes(path);

// All network dependencies are injectable so safety behavior can be tested offline.
export async function deploy({
  env = process.env, fetchImpl = fetch, sleep = pause, now = Date.now,
  report = console.log,
} = {}) {
  const { RENDER_DEPLOY_HOOK_URL: hook, RENDER_API_KEY: key,
    RENDER_SERVICE_ID: serviceId, GITHUB_SHA: sha, GITHUB_REPOSITORY: repository,
    GH_TOKEN: token } = env;
  requireCondition(env.GITHUB_REF === 'refs/heads/main' &&
    ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'Deployment requires a trusted main run.');
  requireCondition(repository === 'ayushman3004/SmartQueue', 'Unexpected deployment repository.');
  requireCondition(hook && key && token && /^srv-[a-z0-9]+$/.test(serviceId || '') &&
    /^[a-f0-9]{40}$/.test(sha || ''), 'Missing or invalid deployment secrets, service ID, or commit SHA.');
  let hookUrl;
  try { hookUrl = new URL(hook); } catch { throw new Error('Invalid Render deploy hook URL.'); }
  requireCondition(hookUrl.origin === 'https://api.render.com' &&
    hookUrl.pathname === `/deploy/${serviceId}` && hookUrl.searchParams.get('key') &&
    !hookUrl.username && !hookUrl.password && !hookUrl.hash &&
    [...hookUrl.searchParams.keys()].every((name) => name === 'key'),
  'Deploy hook must belong to the configured Render service and contain only its key parameter.');

  async function request(url, { method = 'GET', headers = {} } = {}) {
    // Never print fetch errors or response bodies: they may contain credentials.
    // GETs can be retried; deployment POSTs must never be automatically repeated.
    for (let attempt = 0; attempt < (method === 'GET' ? 3 : 1); attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          method, headers, redirect: 'error', signal: AbortSignal.timeout(15_000),
        });
      } catch {
        if (method === 'GET' && attempt < 2) { await sleep(3000); continue; }
        throw new Error(method === 'POST'
          ? 'Hook request failed or timed out; deployment may have started. Inspect Render before retrying.'
          : 'Verification request failed after retries.');
      }
      if (method === 'GET' && (response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(3000);
        continue;
      }
      requireCondition(response.ok, `Deployment request failed (HTTP ${response.status}).`);
      let data;
      try { data = await response.json(); } catch { throw new Error('Deployment response was not valid JSON.'); }
      return { status: response.status, data };
    }
  }
  const api = async (path) => (await request(`https://api.render.com/v1/services/${serviceId}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })).data;

  const service = await api('');
  const details = service.serviceDetails;
  const docker = details?.envSpecificDetails;
  requireCondition(service.id === serviceId && service.type === 'web_service' &&
    details?.runtime === 'docker' && !service.imagePath && !service.buildSourceId &&
    service.repo?.replace(/\.git$/, '').replace(/\/$/, '') === `https://github.com/${repository}` &&
    service.branch === 'main' && rootPath(service.rootDir) && rootPath(docker?.dockerContext) &&
    ['Dockerfile.backend', './Dockerfile.backend'].includes(docker?.dockerfilePath) &&
    !docker?.dockerCommand && !docker?.preDeployCommand,
  'Service must build this repository/main with root context and Dockerfile.backend, without command overrides. Image-backed or Build Source services require a different deployment configuration.');
  requireCondition(service.autoDeploy === 'no' &&
    (!service.autoDeployTrigger || service.autoDeployTrigger === 'off'),
  'Disable Render automatic deployments before enabling GitHub Actions deployments.');
  requireCondition(service.suspended === 'not_suspended' && details.healthCheckPath === '/ready',
    'Render service must be active with health check path /ready.');
  const domains = await api('/custom-domains?name=api.serveq.tech&limit=100');
  requireCondition(Array.isArray(domains) && domains.some(({ customDomain: domain }) =>
    domain?.name === 'api.serveq.tech' && domain.verificationStatus === 'verified'),
  'The selected Render service must own the verified api.serveq.tech domain.');
  const deployments = await api('/deploys?limit=100');
  requireCondition(Array.isArray(deployments) && !deployments.some(({ deploy: entry }) =>
    activeStatuses.has(entry?.status)), 'A Render deployment is already in progress. Inspect Render before retrying.');

  // An older queued run must not roll production back after a newer main push.
  const head = (await request(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })).data;
  requireCondition(head.object?.sha === sha, 'This run is stale: main has changed. Deploy the latest validated main run.');
  report('Preflight passed: correct Docker service, production domain, and current main commit.');

  hookUrl.searchParams.set('ref', sha);
  const triggered = await request(hookUrl.toString(), { method: 'POST' });
  requireCondition(triggered.status === 200 && /^dep-[a-z0-9]+$/.test(triggered.data.deploy?.id || ''),
    'Hook accepted without a trackable deployment ID. Inspect Render; do not blindly retry.');
  const deployId = triggered.data.deploy.id;
  report('Deployment triggered. Waiting for Render to mark the tested commit live.');

  const deadline = now() + 25 * 60_000;
  let live = false;
  let lastStatus;
  while (now() < deadline) {
    const current = await api(`/deploys/${deployId}`);
    requireCondition(current.id === deployId, 'Render returned an unexpected deployment ID.');
    requireCondition(!current.commit?.id || current.commit.id === sha, 'Render deployment commit does not match the tested commit.');
    requireCondition(!failedStatuses.has(current.status), 'Render deployment failed, was canceled, or was deactivated. Inspect Render logs.');
    requireCondition(activeStatuses.has(current.status) || current.status === 'live', 'Unknown Render deployment status; verification stopped.');
    if (current.status !== lastStatus) { report(`Render status: ${current.status}`); lastStatus = current.status; }
    if (current.status === 'live') {
      requireCondition(current.commit?.id === sha, 'Live deployment did not identify the tested commit.');
      live = true;
      break;
    }
    await sleep(15_000);
  }
  requireCondition(live, 'Timed out waiting for Render. Deployment may still be running; inspect Render before retrying.');

  // Probe the production custom domain only after this specific deploy is live.
  // Require three consecutive responses including browser CORS compatibility.
  const healthDeadline = now() + 3 * 60_000;
  let healthy = 0;
  while (now() < healthDeadline && healthy < 3) {
    try {
      const response = await fetchImpl('https://api.serveq.tech/ready', {
        headers: { Origin: 'https://serveq.tech', 'Cache-Control': 'no-cache' },
        redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json();
      healthy = response.status === 200 && body.status === 'ready' &&
        body.database?.status === 'connected' &&
        response.headers.get('access-control-allow-origin') === 'https://serveq.tech' &&
        response.headers.get('access-control-allow-credentials') === 'true' ? healthy + 1 : 0;
    } catch { healthy = 0; }
    if (healthy < 3) await sleep(10_000);
  }
  requireCondition(healthy === 3, 'Render is live, but production readiness or CORS verification failed. Inspect MongoDB, domain routing, and Render logs.');
  const final = await api(`/deploys/${deployId}`);
  requireCondition(final.status === 'live' && final.commit?.id === sha,
    'Deployment stopped being live during readiness verification.');
  report(`Verified: Render deployment ${deployId}, commit ${sha}, production readiness, MongoDB ping, and CORS.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = (message) => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
  };
  try { await deploy({ report }); } catch (error) {
    report(`Deployment verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
