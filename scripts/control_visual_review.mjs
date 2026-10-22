#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ROUTES = [
  '/control/community/reputation',
  '/control/community/quizzes',
  '/control/community/voice-coworking',
  '/control/community/showcase',
  '/control/utilities/notification-roles',
  '/control/content/feeds',
  '/control/content/announcements',
  '/control/content/live',
  '/control/utilities/ticket-configuration',
  '/control/utilities/anonymous-questions',
  '/control/workflows/moderation',
  '/control/analytics',
  '/control/activity',
  '/control/mappings/channels',
  '/control/mappings/roles',
  '/control/mappings/categories',
  '/control/commands',
  '/control/workflows/ticket-handling',
  '/control/workflows/events',
];

const EDIT_SELECTORS = [
  '[data-community-edit]',
  '[data-content-edit]',
  '[data-utility-edit]',
  '[data-mapping-edit]',
  '[data-workflow-edit]',
  '[data-analytics-edit]',
];

function parseArgs(argv) {
  const options = {
    baseUrl: 'http://127.0.0.1:8787',
    out: '.visual-companion/control-finish-review/screenshots',
    routes: DEFAULT_ROUTES,
    sizes: ['1440x900', '1024x800', '390x844'],
    themes: ['light', 'dark'],
    edit: false,
    context: true,
    brave: process.env.BRAVE_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    profile: '.visual-companion/control-finish-review/brave-profile',
    headless: false,
    loginTimeout: 180000,
    port: 9333,
    timeout: 20000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--base-url') options.baseUrl = next().replace(/\/$/, '');
    else if (arg === '--out') options.out = next();
    else if (arg === '--routes') options.routes = next().split(',').map(item => item.trim()).filter(Boolean);
    else if (arg === '--sizes') options.sizes = next().split(',').map(item => item.trim()).filter(Boolean);
    else if (arg === '--themes') options.themes = next().split(',').map(item => item.trim()).filter(Boolean);
    else if (arg === '--edit') options.edit = true;
    else if (arg === '--no-context') options.context = false;
    else if (arg === '--brave') options.brave = next();
    else if (arg === '--profile') options.profile = next();
    else if (arg === '--headless') options.headless = true;
    else if (arg === '--login-timeout') options.loginTimeout = Number(next());
    else if (arg === '--port') options.port = Number(next());
    else if (arg === '--timeout') options.timeout = Number(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid size: ${value}`);
  return { label: value, width: Number(match[1]), height: Number(match[2]) };
}

function fileSafe(value) {
  return value.replace(/^\/+/, '').replaceAll('/', '-') || 'root';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForEndpoint(url, timeout) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Browser debugging endpoint did not start${lastError ? `: ${lastError.message}` : ''}`);
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const key = `${message.sessionId || 'browser'}:${message.method}`;
      const listeners = this.listeners.get(key) || [];
      for (const listener of listeners) listener(message.params);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(event, sessionId, listener) {
    const key = `${sessionId || 'browser'}:${event}`;
    const listeners = this.listeners.get(key) || [];
    listeners.push(listener);
    this.listeners.set(key, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return new CdpSession(socket);
}

async function evaluate(page, sessionId, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForAuth(page, sessionId, baseUrl, timeout) {
  const started = Date.now();
  let announced = false;
  while (Date.now() - started < timeout) {
    try {
      const session = await evaluate(page, sessionId, `fetch('/api/session').then(response => response.json())`);
      if (session?.authenticated) return session;
    } catch {
      // Navigation during Discord OAuth temporarily detaches page execution.
    }
    if (!announced) {
      console.log(`Sign in at ${baseUrl}/control in the opened browser. Waiting up to ${Math.round(timeout / 1000)} seconds.`);
      announced = true;
    }
    await sleep(1000);
  }
  throw new Error('The Control session is not authenticated. Sign in once with --profile, then rerun this script.');
}

async function waitForApp(page, sessionId, route, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const state = await evaluate(page, sessionId, `JSON.stringify({
      path: location.pathname,
      pageKey: document.querySelector('#controlMain')?.dataset.pageKey || '',
      login: Boolean(document.querySelector('.control-login')),
      ready: document.readyState,
      context: document.querySelector('.control-shell')?.dataset.context || ''
    })`);
    const parsed = JSON.parse(state || '{}');
    if (parsed.pageKey === route) {
      await evaluate(page, sessionId, 'document.fonts?.ready');
      await sleep(250);
      return parsed;
    }
    if (parsed.login) return parsed;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${route}`);
}

async function setTheme(page, sessionId, theme) {
  await evaluate(page, sessionId, `localStorage.setItem('rob-doc-theme', ${JSON.stringify(theme)})`);
  await page.send('Page.reload', {}, sessionId);
  await sleep(800);
}

async function openContext(page, sessionId) {
  const opened = await evaluate(page, sessionId, `(() => {
    const trigger = document.querySelector('#controlContextButton');
    if (!trigger || trigger.hidden) return false;
    trigger.click();
    return true;
  })()`);
  if (opened) await sleep(350);
  return opened;
}

async function enterEditMode(page, sessionId) {
  return await evaluate(page, sessionId, `(() => {
    const selector = ${JSON.stringify(EDIT_SELECTORS.join(','))};
    const button = document.querySelector(selector);
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function settle(page, sessionId) {
  try {
    await evaluate(page, sessionId, `(async () => {
      const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
      const started = performance.now();
      while (fontLink && !fontLink.sheet && performance.now() - started < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await Promise.all(document.getAnimations().filter(animation => {
        const timing = animation.effect?.getTiming?.();
        return !timing || timing.iterations !== Infinity;
      }).map(animation => animation.finished.catch(() => {})));
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    })()`);
  } catch {
    // A navigation during settle leaves no animations to wait for.
  }
  await sleep(350);
}

async function capture(page, sessionId, file, size) {
  try {
    await page.send('Page.bringToFront', {}, sessionId);
  } catch {
    // The page may be navigating.
  }
  try {
    await evaluate(page, sessionId, `document.activeElement?.blur?.(); true`);
  } catch {
    // A navigation during capture leaves no focused element to clear.
  }
  await settle(page, sessionId);
  const params = {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  };
  if (size) params.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  const { data } = await page.send('Page.captureScreenshot', params, sessionId);
  await writeFile(file, Buffer.from(data, 'base64'));
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const sizes = options.sizes.map(parseSize);
  await mkdir(options.out, { recursive: true });

  const browserArgs = [
    `--remote-debugging-port=${options.port}`,
    `--user-data-dir=${path.resolve(options.profile)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1440,900',
    'about:blank',
  ];
  if (options.headless) browserArgs.unshift('--headless=new');
  const browser = spawn(options.brave, browserArgs, { stdio: 'ignore' });

  const stop = () => {
    browser.kill('SIGTERM');
  };
  process.on('exit', stop);

  let page = null;
  const manifest = [];
  try {
    const version = await waitForEndpoint(`http://127.0.0.1:${options.port}/json/version`, options.timeout);
    page = await connect(version.webSocketDebuggerUrl);
    const { targetId } = await page.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await page.send('Target.attachToTarget', { targetId, flatten: true });
    await page.send('Page.enable', {}, sessionId);
    await page.send('Runtime.enable', {}, sessionId);

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);
    await page.send('Page.navigate', { url: `${options.baseUrl}/control` }, sessionId);
    await sleep(1000);

    const session = await waitForAuth(page, sessionId, options.baseUrl, options.loginTimeout);
    if (!session?.authenticated) throw new Error('The Control session is not authenticated.');

    for (const route of options.routes) {
      for (const theme of options.themes) {
        for (const size of sizes) {
          await page.send('Emulation.setDeviceMetricsOverride', {
            width: size.width,
            height: size.height,
            deviceScaleFactor: 1,
            mobile: false,
          }, sessionId);
          await page.send('Page.navigate', { url: `${options.baseUrl}${route}` }, sessionId);
          await sleep(300);
          await setTheme(page, sessionId, theme);
          const state = await waitForApp(page, sessionId, route, options.timeout);
          if (state.login) {
            throw new Error('The Control session expired. Sign in again, then rerun this script.');
          }

          const base = `${fileSafe(route)}-${theme}-${size.label}`;
          const viewport = JSON.parse(await evaluate(page, sessionId, `JSON.stringify({
            innerWidth,
            innerHeight,
            devicePixelRatio,
            visualScale: visualViewport?.scale || 1,
            shellWidth: document.querySelector('.control-shell')?.getBoundingClientRect().width
          })`));
          const readFile = path.join(options.out, `${base}.png`);
          await capture(page, sessionId, readFile, size);
          manifest.push({ route, theme, size: size.label, context: 'closed', edit: false, file: readFile, viewport, at: new Date().toISOString() });

          if (options.context && size.width < 1200 && state.context === 'true') {
            const opened = await openContext(page, sessionId);
            if (opened) {
              const contextFile = path.join(options.out, `${base}-context.png`);
              await capture(page, sessionId, contextFile, size);
              manifest.push({ route, theme, size: size.label, context: 'open', edit: false, file: contextFile, at: new Date().toISOString() });
              await evaluate(page, sessionId, `document.querySelector('#controlContextClose')?.click()`);
              await sleep(250);
            }
          }

          if (options.edit) {
            const editing = await enterEditMode(page, sessionId);
            if (editing) {
              await sleep(300);
              const editFile = path.join(options.out, `${base}-edit.png`);
              await capture(page, sessionId, editFile, size);
              manifest.push({ route, theme, size: size.label, context: 'closed', edit: true, file: editFile, at: new Date().toISOString() });
              if (options.context && size.width < 1200 && state.context === 'true') {
                const opened = await openContext(page, sessionId);
                if (opened) {
                  const editContextFile = path.join(options.out, `${base}-edit-context.png`);
                  await capture(page, sessionId, editContextFile, size);
                  manifest.push({ route, theme, size: size.label, context: 'open', edit: true, file: editContextFile, at: new Date().toISOString() });
                  await evaluate(page, sessionId, `document.querySelector('#controlContextClose')?.click()`);
                  await sleep(200);
                }
              }
              await evaluate(page, sessionId, `document.querySelector('[data-community-discard],[data-content-discard],[data-utility-discard],[data-mapping-discard],[data-workflow-discard],[data-analytics-discard]')?.click()`);
              await sleep(200);
            }
          }
        }
      }
    }

    const manifestPath = path.join(options.out, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify({ baseUrl: options.baseUrl, capturedAt: new Date().toISOString(), captures: manifest }, null, 2)}\n`);
    console.log(`Captured ${manifest.length} screenshots in ${options.out}`);
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    page?.close();
    stop();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
