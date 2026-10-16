import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_LABEL = 'com.aedwon.marwie-server-web';
const HOST = '127.0.0.1';
const PORT = '8787';
const REQUIRED = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'CONTROL_BASE_URL', 'CONTROL_SQLITE_PATH'];

export function environmentTemplate(databasePath) {
  return ['DISCORD_CLIENT_ID=', 'DISCORD_CLIENT_SECRET=', 'CONTROL_BASE_URL=', `CONTROL_SQLITE_PATH=${databasePath}`, 'CONTROL_WORKER_MODE=always_on', `LOCAL_WEB_HOST=${HOST}`, `LOCAL_WEB_PORT=${PORT}`, ''].join('\n');
}

export function buildLaunchAgent(repoRoot, home, nodePath) {
  const logs = join(home, 'Library', 'Logs', 'marwie-server-bot');
  return { Label: WEB_LABEL, ProgramArguments: [nodePath, join(repoRoot, 'scripts', 'local_web_hosting.mjs'), 'run'], RunAtLoad: true, KeepAlive: true, ThrottleInterval: 15, WorkingDirectory: repoRoot, StandardOutPath: join(logs, 'web-stdout.log'), StandardErrorPath: join(logs, 'web-stderr.log'), ProcessType: 'Background' };
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function plistValue(value, indent = '') {
  if (typeof value === 'string') return `${indent}<string>${escapeXml(value)}</string>`;
  if (typeof value === 'boolean') return `${indent}<${value ? 'true' : 'false'}/>`;
  if (Number.isInteger(value)) return `${indent}<integer>${value}</integer>`;
  if (Array.isArray(value)) return [`${indent}<array>`, ...value.map(item => plistValue(item, `${indent}  `)), `${indent}</array>`].join('\n');
  const lines = [`${indent}<dict>`];
  for (const [key, item] of Object.entries(value)) {
    lines.push(`${indent}  <key>${escapeXml(key)}</key>`);
    lines.push(plistValue(item, `${indent}  `));
  }
  lines.push(`${indent}</dict>`);
  return lines.join('\n');
}

function renderPlist(agent) {
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', '<plist version="1.0">', plistValue(agent), '</plist>', ''].join('\n');
}

function parseEnvironment(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function paths(home) {
  const configDir = join(home, '.config', 'marwie-server-bot');
  return { configDir, envPath: join(configDir, 'web-production.env'), plistPath: join(home, 'Library', 'LaunchAgents', `${WEB_LABEL}.plist`), logDir: join(home, 'Library', 'Logs', 'marwie-server-bot') };
}

function validate(values) {
  const errors = [];
  for (const key of REQUIRED) if (!String(values[key] || '').trim()) errors.push(`${key} is unset`);
  if (values.CONTROL_BASE_URL) {
    try { if (new URL(values.CONTROL_BASE_URL).protocol !== 'https:') errors.push('CONTROL_BASE_URL must use https'); } catch { errors.push('CONTROL_BASE_URL must be a valid absolute URL'); }
  }
  if ((values.CONTROL_WORKER_MODE || '').toLowerCase() !== 'always_on') errors.push('CONTROL_WORKER_MODE must be always_on');
  if ((values.LOCAL_WEB_HOST || HOST) !== HOST) errors.push(`LOCAL_WEB_HOST must be ${HOST}`);
  const port = Number(values.LOCAL_WEB_PORT || PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('LOCAL_WEB_PORT must be an integer from 1 through 65535');
  return errors;
}

export function loadRuntimeEnvironment(envPath, baseEnv = {}) {
  if (!existsSync(envPath)) throw new Error(`web production environment file is missing: ${envPath}`);
  const parsed = parseEnvironment(readFileSync(envPath, 'utf8'));
  const errors = validate(parsed);
  if (errors.length) throw new Error(errors[0]);
  return { ...baseEnv, ...parsed };
}

export function installRuntime({ home, repoRoot, botRoot, nodePath }) {
  const databasePath = join(botRoot, 'data', 'marwie.db');
  const requiredFiles = [nodePath, join(repoRoot, 'scripts', 'local_web_hosting.mjs'), join(repoRoot, 'server', 'local-server.js'), join(repoRoot, 'docs-site', 'control.html'), databasePath];
  for (const path of requiredFiles) if (!existsSync(path)) throw new Error(`required local hosting path is missing: ${path}`);
  const runtime = paths(home);
  mkdirSync(runtime.configDir, { recursive: true, mode: 0o700 }); chmodSync(runtime.configDir, 0o700);
  mkdirSync(runtime.logDir, { recursive: true, mode: 0o700 }); chmodSync(runtime.logDir, 0o700);
  mkdirSync(dirname(runtime.plistPath), { recursive: true });
  if (!existsSync(runtime.envPath)) writeFileSync(runtime.envPath, environmentTemplate(databasePath), { mode: 0o600 });
  chmodSync(runtime.envPath, 0o600);
  writeFileSync(runtime.plistPath, renderPlist(buildLaunchAgent(repoRoot, home, nodePath)), { mode: 0o644 });
  chmodSync(runtime.plistPath, 0o644);
  return runtime;
}

export function checkRuntime({ home, repoRoot, botRoot, nodePath }) {
  const errors = [];
  const databasePath = join(botRoot, 'data', 'marwie.db');
  const runtime = paths(home);
  for (const path of [nodePath, join(repoRoot, 'server', 'local-server.js'), join(repoRoot, 'docs-site', 'control.html'), databasePath]) if (!existsSync(path)) errors.push(`required local hosting path is missing: ${path}`);
  if (!existsSync(runtime.envPath)) errors.push(`web production environment file is missing: ${runtime.envPath}`);
  else {
    if ((statSync(runtime.envPath).mode & 0o777) !== 0o600) errors.push('web production environment file permissions must be 0600');
    const values = parseEnvironment(readFileSync(runtime.envPath, 'utf8'));
    errors.push(...validate(values));
    if (values.CONTROL_SQLITE_PATH && resolve(values.CONTROL_SQLITE_PATH) !== resolve(databasePath)) errors.push('CONTROL_SQLITE_PATH must point to the bot production database');
  }
  if (!existsSync(runtime.plistPath)) errors.push(`LaunchAgent plist is missing: ${runtime.plistPath}`);
  else if (readFileSync(runtime.plistPath, 'utf8') !== renderPlist(buildLaunchAgent(repoRoot, home, nodePath))) errors.push('LaunchAgent plist does not match the current website checkout');
  return errors;
}

function context() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const projectsRoot = dirname(repoRoot);
  const nodePath = existsSync('/opt/homebrew/bin/node') ? '/opt/homebrew/bin/node' : process.execPath;
  return { home: homedir(), repoRoot, botRoot: process.env.ROB_BOT_ROOT?.trim() || join(projectsRoot, 'marwie-server-bot'), nodePath };
}

function runRuntime(ctx) {
  const environment = loadRuntimeEnvironment(paths(ctx.home).envPath, process.env);
  const result = spawnSync(ctx.nodePath, [join(ctx.repoRoot, 'server', 'local-server.js')], { cwd: ctx.repoRoot, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2]; const ctx = context();
  try {
    if (action === 'install') { const result = installRuntime(ctx); console.log(`web production environment: ${result.envPath}`); console.log(`LaunchAgent plist: ${result.plistPath}`); console.log('LaunchAgent activation is intentionally separate from this command.'); }
    else if (action === 'check') { const errors = checkRuntime(ctx); if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exitCode = 1; } else console.log('local website hosting configuration: OK'); }
    else if (action === 'run') process.exitCode = runRuntime(ctx);
    else { console.error('usage: node scripts/local_web_hosting.mjs <install|check|run>'); process.exitCode = 2; }
  } catch (error) { console.error(`local website hosting failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; }
}
