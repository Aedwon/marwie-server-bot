import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { createLocalServer, DEFAULT_LOCAL_HOST, DEFAULT_LOCAL_PORT } from '../server/local-server.js';

async function withServer(run) {
  const server = createLocalServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('local server defaults are loopback-only', () => {
  assert.equal(DEFAULT_LOCAL_HOST, '127.0.0.1');
  assert.equal(DEFAULT_LOCAL_PORT, 8787);
});

test('local server exposes health, clean site routes, assets, and signed-out Control session', async () => {
  await withServer(async origin => {
    const health = await fetch(`${origin}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    for (const route of ['/', '/control', '/control/community/reputation']) {
      const response = await fetch(`${origin}${route}`);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      assert.match(await response.text(), /Rob-bot Control/);
    }

    const commands = await fetch(`${origin}/commands`);
    assert.equal(commands.status, 200);
    assert.match(await commands.text(), /Commands/i);

    const handbook = await fetch(`${origin}/handbook`);
    assert.equal(handbook.status, 200);
    assert.match(await handbook.text(), /Rob-bot/i);

    const asset = await fetch(`${origin}/styles.css`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') || '', /text\/css/);

    const session = await fetch(`${origin}/api/session`);
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { authenticated: false, login_url: '/api/auth/start' });
  });
});

test('local server fails closed for unknown APIs and files outside docs-site', async () => {
  await withServer(async origin => {
    const unknownApi = await fetch(`${origin}/api/not-real`);
    assert.equal(unknownApi.status, 404);

    const repoFile = await fetch(`${origin}/package.json`);
    assert.equal(repoFile.status, 404);

    const traversal = await fetch(`${origin}/%2e%2e/package.json`);
    assert.equal(traversal.status, 404);
  });
});
