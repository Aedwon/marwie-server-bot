import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  WEB_LABEL,
  buildLaunchAgent,
  checkRuntime,
  environmentTemplate,
  installRuntime,
  loadRuntimeEnvironment,
} from '../scripts/local_web_hosting.mjs';

function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'rob-web-hosting-'));
  const home = join(root, 'home');
  const repoRoot = join(root, 'site');
  const botRoot = join(root, 'bot');
  mkdirSync(home, { recursive: true });
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  mkdirSync(join(repoRoot, 'server'), { recursive: true });
  mkdirSync(join(repoRoot, 'docs-site'), { recursive: true });
  mkdirSync(join(botRoot, 'data'), { recursive: true });
  writeFileSync(join(repoRoot, 'scripts', 'local_web_hosting.mjs'), '// fixture\n');
  writeFileSync(join(repoRoot, 'server', 'local-server.js'), '// fixture\n');
  writeFileSync(join(repoRoot, 'docs-site', 'control.html'), '<html></html>');
  writeFileSync(join(botRoot, 'data', 'marwie.db'), 'sqlite fixture');
  const nodePath = join(root, 'node');
  writeFileSync(nodePath, 'node');
  try {
    return run({ root, home, repoRoot, botRoot, nodePath });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('environment template keeps secrets blank and pins local production defaults', () => {
  const text = environmentTemplate('/bot/data/marwie.db');
  assert.match(text, /^DISCORD_CLIENT_ID=$/m);
  assert.match(text, /^DISCORD_CLIENT_SECRET=$/m);
  assert.match(text, /^CONTROL_BASE_URL=$/m);
  assert.match(text, /^CONTROL_SQLITE_PATH=\/bot\/data\/marwie\.db$/m);
  assert.match(text, /^CONTROL_WORKER_MODE=always_on$/m);
  assert.match(text, /^LOCAL_WEB_HOST=127\.0\.0\.1$/m);
  assert.match(text, /^LOCAL_WEB_PORT=8787$/m);
});

test('LaunchAgent contains only non-secret runtime paths and local helper command', () => {
  withFixture(({ home, repoRoot, nodePath }) => {
    const agent = buildLaunchAgent(repoRoot, home, nodePath);
    assert.equal(agent.Label, WEB_LABEL);
    assert.deepEqual(agent.ProgramArguments, [nodePath, join(repoRoot, 'scripts', 'local_web_hosting.mjs'), 'run']);
    assert.equal(agent.WorkingDirectory, repoRoot);
    assert.match(agent.StandardOutPath, /web-stdout\.log$/);
    assert.match(agent.StandardErrorPath, /web-stderr\.log$/);
    assert.equal(JSON.stringify(agent).includes('DISCORD_CLIENT_SECRET'), false);
  });
});

test('install creates a private env once and never overwrites operator secrets', () => {
  withFixture(({ home, repoRoot, botRoot, nodePath }) => {
    const first = installRuntime({ home, repoRoot, botRoot, nodePath });
    assert.equal(statSync(first.envPath).mode & 0o777, 0o600);
    const original = readFileSync(first.envPath, 'utf8');
    assert.match(original, /CONTROL_WORKER_MODE=always_on/);

    writeFileSync(first.envPath, original.replace('DISCORD_CLIENT_SECRET=', 'DISCORD_CLIENT_SECRET=operator-secret'));
    chmodSync(first.envPath, 0o600);
    installRuntime({ home, repoRoot, botRoot, nodePath });
    assert.match(readFileSync(first.envPath, 'utf8'), /DISCORD_CLIENT_SECRET=operator-secret/);

    const plist = readFileSync(first.plistPath, 'utf8');
    assert.match(plist, new RegExp(WEB_LABEL));
    assert.equal(plist.includes('operator-secret'), false);
  });
});

test('runtime validation reports missing keys without echoing secret values', () => {
  withFixture(({ home, repoRoot, botRoot, nodePath }) => {
    const { envPath } = installRuntime({ home, repoRoot, botRoot, nodePath });
    let errors = checkRuntime({ home, repoRoot, botRoot, nodePath });
    assert(errors.some(error => error.includes('DISCORD_CLIENT_ID')));
    assert(errors.some(error => error.includes('DISCORD_CLIENT_SECRET')));
    assert(errors.some(error => error.includes('CONTROL_BASE_URL')));

    writeFileSync(envPath, [
      'DISCORD_CLIENT_ID=123456789',
      'DISCORD_CLIENT_SECRET=super-secret-value',
      'CONTROL_BASE_URL=https://example.com',
      `CONTROL_SQLITE_PATH=${join(botRoot, 'data', 'marwie.db')}`,
      'CONTROL_WORKER_MODE=always_on',
      'LOCAL_WEB_HOST=127.0.0.1',
      'LOCAL_WEB_PORT=8787',
      '',
    ].join('\n'));
    chmodSync(envPath, 0o600);

    errors = checkRuntime({ home, repoRoot, botRoot, nodePath });
    assert.deepEqual(errors, []);
    assert.equal(errors.join('\n').includes('super-secret-value'), false);

    const environment = loadRuntimeEnvironment(envPath, { PATH: '/usr/bin' });
    assert.equal(environment.DISCORD_CLIENT_SECRET, 'super-secret-value');
    assert.equal(environment.CONTROL_WORKER_MODE, 'always_on');
  });
});
