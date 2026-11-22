import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const commandsHtml = read('docs-site/commands.html');
const commandsCss = read('docs-site/commands.css');
const commandsJs = read('docs-site/commands.js');
const publicManual = read('docs-site/commands.md');
const canonicalManual = read('docs/commands.md');
const controlSecondary = read('docs-site/control-secondary.js');
const vercel = JSON.parse(read('vercel.json'));

function slug(value) {
  return value
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function commandHeadings(markdown) {
  return [...markdown.matchAll(/^##\s+`(\/[^`]+)`\s*$/gm)].map(match => match[1]);
}

function commandAnchors(markdown) {
  return new Set(commandHeadings(markdown).map(command => `command-${slug(command)}`));
}

function fontSizeViolations(source) {
  const violations = [];
  const declarationPattern = /font-size\s*:\s*([^;{}]+);/g;
  const valuePattern = /(\d*\.?\d+)(px|rem)\b/g;
  for (const declaration of source.matchAll(declarationPattern)) {
    for (const token of declaration[1].matchAll(valuePattern)) {
      const pixels = token[2] === 'rem' ? Number(token[1]) * 16 : Number(token[1]);
      if (pixels < 13) violations.push(`${token[0]} = ${pixels}px`);
    }
  }
  return violations;
}

function cssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  const block = matches.map(match => match[1]).find(candidate => /font-size\s*:/.test(candidate));
  assert.ok(block, `Expected a font-size rule for ${selector}`);
  return block;
}

test('All Commands uses the shared Control shell instead of legacy handbook chrome', () => {
  assert.match(commandsHtml, /<body class="control-page commands-page">/);
  assert.match(commandsHtml, /<div class="control-shell" data-nav-mode="expanded"/);
  assert.match(commandsHtml, /<aside id="controlNavDrawer" class="control-rail"/);
  assert.match(commandsHtml, /<main id="controlMain" class="control-main commands-main"/);
  assert.match(commandsHtml, /href="\/control\.css\?v=/);
  assert.match(commandsHtml, /<h1[^>]*>All Commands<\/h1>/);
  assert.match(commandsHtml, /<title>All Commands · Rob-bot<\/title>/);
  assert.doesNotMatch(commandsHtml, /class="(?:layout|sidebar|mobilebar|mobilebrand|menubtn|commands-shell|commands-rail)"/);
  assert.doesNotMatch(commandsHtml, /Rob-bot Handbook/);
});

test('All Commands defaults to System and reuses the shared shell theme and drawer behavior', () => {
  assert.match(commandsHtml, /<html[^>]*data-theme="light"[^>]*data-preference="system"/);
  assert.match(commandsHtml, /localStorage\.getItem\('rob-doc-theme'\) \|\| 'system'/);
  assert.match(commandsHtml, /<meta name="theme-color" content="#fcfcfb">/);
  assert.match(commandsHtml, /fonts\.googleapis\.com\/css2\?family=Figtree:wght@400;500;600/);
  assert.doesNotMatch(commandsHtml, /\/styles\.css/);
  assert.match(commandsHtml, /data-nav-mode="expanded"[^>]*data-peek="false"/);
  assert.doesNotMatch(commandsHtml, /data-context-mode/);
  const segStart = commandsHtml.indexOf('class="control-seg"');
  assert.ok(segStart >= 0);
  const seg = commandsHtml.slice(segStart, commandsHtml.indexOf('</div>', segStart));
  assert.ok(seg.indexOf('data-theme-choice="light"') < seg.indexOf('data-theme-choice="dark"'));
  assert.ok(seg.indexOf('data-theme-choice="dark"') < seg.indexOf('data-theme-choice="system"'));
  assert.match(seg, /data-theme-choice="system"[^>]*aria-pressed="true"/);
  assert.match(commandsJs, /import \{ installShell, loadShellSession \} from '\.\/control-shell\.js\?v=\d+';/);
  assert.match(commandsJs, /installShell\(\{ currentPath: '\/commands' \}\)/);
  const shellSource = read('docs-site/control-shell.js');
  assert.match(shellSource, /installThemeControls\s*\(/);
  assert.match(shellSource, /installDrawerController\s*\(/);
  assert.match(shellSource, /isDrawer\s*:/);
});

test('All Commands keeps the approved 13px typography floor and metadata treatment', () => {
  assert.deepEqual(fontSizeViolations(commandsCss), []);
  for (const selector of ['.search-status', '.permission-badge']) {
    const block = cssBlock(commandsCss, selector);
    assert.match(block, /font-size\s*:\s*13px\s*;/);
    assert.match(block, /line-height\s*:\s*18px\s*;/);
  }
});

test('the public renderer retains every current command anchor and Control deep links resolve', () => {
  const commands = commandHeadings(publicManual);
  const anchors = commandAnchors(publicManual);
  assert.equal(commands.length, 43);
  assert.equal(anchors.size, commands.length);
  assert.ok(anchors.has('command-reputation-award'));
  assert.ok(anchors.has('command-ticket-panel-post'));
  assert.ok(anchors.has('command-ai-source-poll'));

  const publicLinks = [...controlSecondary.matchAll(/href:\s*'\/commands#([^']+)'/g)].map(match => match[1]);
  assert.ok(publicLinks.length > 0);
  for (const anchor of publicLinks) assert.ok(anchors.has(anchor), `Missing public manual anchor ${anchor}`);

  assert.match(commandsJs, /base = `command-\$\{slug\(plain\)\}`/);
  assert.match(commandsJs, /card\.id = heading\.id/);
  assert.doesNotMatch(commandsJs, /\/setup solved-tag|Build Help/i);
});

test('command search and hash reveal remain wired to the existing manual rendering path', () => {
  assert.match(commandsHtml, /id="commandSearch"[^>]*type="search"/);
  assert.match(commandsHtml, /id="commandSearchClear"/);
  assert.match(commandsHtml, /id="commandResultCount"/);
  assert.match(commandsJs, /function setupCommandSearch\(container, cards, dialog\)/);
  assert.match(commandsJs, /input\?\.addEventListener\('input', applyFilter\)/);
  assert.match(commandsJs, /terms\.every\(term => haystack\.includes\(term\)\)/);
  assert.match(commandsJs, /function openHashTarget\(\)/);
  assert.match(commandsJs, /addEventListener\('hashchange', dialogController\.openHashTarget\)/);
  assert.match(commandsJs, /fetch\('\/commands\.md\?v=/);
  assert.equal(publicManual, canonicalManual);
});

test('All Commands content stays public and canonical website routing stays separated from Control and handbook', () => {
  // The manual loads without a session. The shared top bar only adds Sign in or the account menu.
  assert.doesNotMatch(commandsJs, /loadManual\([^)]*session|await loadShellSession/);
  assert.match(commandsHtml, /href="\/control"[^>]*>Control<\/a>/);
  assert.match(commandsHtml, /href="\/handbook"[^>]*>Handbook<\/a>/);
  assert.match(commandsHtml, /id="controlLogin"[^>]*href="\/api\/auth\/start"/);

  const rewrite = source => vercel.rewrites.find(item => item.source === source)?.destination;
  assert.equal(rewrite('/'), '/docs-site/control');
  assert.equal(rewrite('/commands'), '/docs-site/commands');
  assert.equal(rewrite('/handbook'), '/docs-site/index');
  assert.equal(rewrite('/control/(.*)'), '/docs-site/control');
});
