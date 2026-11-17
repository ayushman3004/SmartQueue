import test from 'node:test';
import assert from 'node:assert/strict';
import { deploy } from '../scripts/render-deploy.mjs';

const sha = 'a'.repeat(40);
const env = {
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'ayushman3004/SmartQueue', GITHUB_SHA: sha,
  GH_TOKEN: 'test-token', RENDER_API_KEY: 'test-api-key', RENDER_SERVICE_ID: 'srv-test',
  RENDER_DEPLOY_HOOK_URL: 'https://api.render.com/deploy/srv-test?key=test-hook-key',
};
const service = () => ({
  id: 'srv-test', type: 'web_service', repo: 'https://github.com/ayushman3004/SmartQueue',
  branch: 'main', rootDir: '', autoDeploy: 'no', autoDeployTrigger: 'off',
  suspended: 'not_suspended', serviceDetails: {
    runtime: 'docker', healthCheckPath: '/ready',
    envSpecificDetails: { dockerContext: '.', dockerfilePath: './Dockerfile.backend', dockerCommand: '' },
  },
});
const liveDeploy = () => ({ id: 'dep-test', status: 'live', commit: { id: sha } });
const readyResponse = () => new Response(JSON.stringify({
  status: 'ready', database: { status: 'connected' },
}), { headers: {
  'access-control-allow-origin': 'https://serveq.tech',
  'access-control-allow-credentials': 'true',
} });

function harness(overrides = {}) {
  let time = 0;
  const calls = [];
  const messages = [];
  const data = {
    service: service(), deployments: [], head: { object: { sha } },
    domains: [{ customDomain: { name: 'api.serveq.tech', verificationStatus: 'verified' } }],
    hook: { deploy: { id: 'dep-test' } }, hookStatus: 200, current: liveDeploy(),
    ready: readyResponse, ...overrides,
  };
  return {
    calls, messages, data,
    run: (environment = env) => deploy({
      env: environment, now: () => time,
      sleep: async (ms) => { time += ms; },
      report: (message) => messages.push(message),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (data.intercept) {
          const response = await data.intercept(url, options, calls);
          if (response) return response;
        }
        if (url === 'https://api.serveq.tech/ready') return data.ready();
        if (options.method === 'POST') return new Response(JSON.stringify(data.hook), { status: data.hookStatus });
        if (url.includes('api.github.com')) return Response.json(data.head);
        if (url.includes('/custom-domains')) return Response.json(data.domains);
        if (url.includes('/deploys?')) return Response.json(data.deployments);
        if (url.includes('/deploys/')) return Response.json(data.current);
        return Response.json(data.service);
      },
    }),
  };
}
const posts = (h) => h.calls.filter(({ options }) => options.method === 'POST');

test('Render deployment verifies exact SHA, live status, readiness, and browser CORS', async () => {
  const h = harness();
  await h.run();
  assert.equal(posts(h).length, 1);
  assert.equal(new URL(posts(h)[0].url).searchParams.get('ref'), sha);
  assert.equal(h.calls.filter(({ url }) => url === 'https://api.serveq.tech/ready').length, 3);
  assert.ok(h.messages.at(-1).startsWith('Verified:'));
  assert.ok(!h.messages.join('\n').includes('test-hook-key'));
  for (const { url, options } of h.calls) {
    assert.equal(options.redirect, 'error');
    if (new URL(url).hostname === 'api.serveq.tech') assert.equal(options.headers.Authorization, undefined);
  }
});

test('Render deployment refuses untrusted refs, missing credentials, and mismatched hooks before networking', async () => {
  for (const changes of [
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_REPOSITORY: 'someone/SmartQueue' }, { RENDER_API_KEY: '' },
    { RENDER_DEPLOY_HOOK_URL: 'https://api.render.com/deploy/srv-old?key=test' },
    { RENDER_DEPLOY_HOOK_URL: 'https://example.com/deploy/srv-test?key=test' },
    { RENDER_DEPLOY_HOOK_URL: `${env.RENDER_DEPLOY_HOOK_URL}&imgURL=old` },
  ]) {
    const h = harness();
    await assert.rejects(h.run({ ...env, ...changes }));
    assert.equal(h.calls.length, 0);
  }
});

test('Render preflight blocks wrong source, old backend, command overrides, and duplicate deployment paths', async () => {
  for (const modify of [
    (s) => { s.imagePath = 'registry.example/image:latest'; },
    (s) => { s.buildSourceId = 'bld-test'; },
    (s) => { s.branch = 'old'; },
    (s) => { s.repo = 'https://github.com/someone/other'; },
    (s) => { s.autoDeploy = 'yes'; },
    (s) => { s.autoDeployTrigger = 'checksPass'; },
    (s) => { s.serviceDetails.runtime = 'node'; },
    (s) => { s.serviceDetails.envSpecificDetails.dockerfilePath = 'Dockerfile.frontend'; },
    (s) => { s.serviceDetails.envSpecificDetails.dockerCommand = 'node old.js'; },
    (s) => { s.serviceDetails.healthCheckPath = '/health'; },
  ]) {
    const s = service(); modify(s);
    const h = harness({ service: s });
    await assert.rejects(h.run());
    assert.equal(posts(h).length, 0);
  }
});

test('Render preflight rejects absent domain, active deployments, and stale main runs', async () => {
  for (const override of [
    { domains: [] },
    { deployments: [{ deploy: { status: 'build_in_progress' } }] },
    { head: { object: { sha: 'b'.repeat(40) } } },
  ]) {
    const h = harness(override);
    await assert.rejects(h.run());
    assert.equal(posts(h).length, 0);
  }
});

test('Render never retries an ambiguous deployment POST or prints underlying secret errors', async () => {
  const h = harness({ intercept: async (_url, options) => {
    if (options.method === 'POST') throw new Error(env.RENDER_DEPLOY_HOOK_URL);
  } });
  await assert.rejects(h.run(), (error) => {
    assert.match(error.message, /may have started/);
    assert.ok(!error.message.includes('test-hook-key'));
    return true;
  });
  assert.equal(posts(h).length, 1);
});

test('Render 202 queued hook acceptance is not reported as a completed deploy', async () => {
  const h = harness({ hookStatus: 202, hook: {} });
  await assert.rejects(h.run(), /without a trackable deployment ID/);
  assert.equal(posts(h).length, 1);
  assert.ok(!h.messages.some((m) => m.startsWith('Verified:')));
});

test('Render failed, canceled, wrong-commit, missing-commit, and unknown statuses fail verification', async () => {
  for (const current of [
    ...['build_failed', 'pre_deploy_failed', 'update_failed', 'canceled', 'deactivated', 'unknown']
      .map((status) => ({ ...liveDeploy(), status })),
    { ...liveDeploy(), commit: { id: 'b'.repeat(40) } },
    { id: 'dep-test', status: 'live' },
  ]) {
    const h = harness({ current });
    await assert.rejects(h.run());
    assert.ok(!h.messages.some((m) => m.startsWith('Verified:')));
  }
});

test('Render polls in-progress deploys and times out instead of accepting old healthy production', async () => {
  const h = harness({ current: { ...liveDeploy(), status: 'build_in_progress' } });
  await assert.rejects(h.run(), /Timed out waiting for Render/);
  assert.equal(h.calls.filter(({ url }) => new URL(url).hostname === 'api.serveq.tech').length, 0);
});

test('Render readiness fails closed on disconnected database, CORS mismatch, or redirect', async () => {
  for (const ready of [
    () => Response.json({ status: 'not_ready' }, { status: 503 }),
    () => Response.json({ status: 'ready', database: { status: 'disconnected' } }),
    () => Response.json({ status: 'ready', database: { status: 'connected' } }),
    () => { throw new Error('redirect'); },
  ]) {
    const h = harness({ ready });
    await assert.rejects(h.run(), /production readiness or CORS/);
  }
});

test('Render GET verification retries transient failures without duplicating the deployment', async () => {
  let count = 0;
  const h = harness({ intercept: async (_url, options) => {
    if (options.method === 'GET' && count++ < 2) return new Response('', { status: 503 });
  } });
  await h.run();
  assert.equal(posts(h).length, 1);
});

test('Render readiness requires consecutive successes and rechecks live status', async () => {
  let probes = 0;
  const h = harness({ ready: () => ++probes === 2
    ? Response.json({ status: 'not_ready' }, { status: 503 }) : readyResponse() });
  await h.run();
  assert.equal(probes, 5);

  let reads = 0;
  const changed = harness({ intercept: async (url) => {
    if (url.includes('/deploys/dep-test') && ++reads === 2) {
      return Response.json({ ...liveDeploy(), status: 'deactivated' });
    }
  } });
  await assert.rejects(changed.run(), /stopped being live/);
});
