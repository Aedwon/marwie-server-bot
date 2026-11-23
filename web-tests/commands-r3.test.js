import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../docs-site/commands.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../docs-site/commands.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../docs-site/commands.css', import.meta.url), 'utf8');
const manual = readFileSync(new URL('../docs-site/commands.md', import.meta.url), 'utf8');

function canonicalCommands() {
  return [...manual.matchAll(/^## `([^`]+)`$/gm)].map(match => match[1]);
}

function previewKeys() {
  return [...source.matchAll(/^\s*'([^']+)':\s*Object\.freeze\(/gm)]
    .map(match => match[1])
    .filter(key => key.startsWith('/'));
}

test('Commands has a title, one search field and no lede, eyebrow or workflow jump list', () => {
  assert.match(html, /<h1 id="commandsTitle">Commands<\/h1>/);
  assert.doesNotMatch(html, /Find the right command by task|control-page-intro|control-eyebrow|manual-nav|search-status|Press \/ to search/);
  assert.match(html, /id="commandSearch"/);
  assert.match(html, /<kbd aria-hidden="true">\/<\/kbd>/);
  assert.doesNotMatch(source, /Using this manual|setupManualNavigation/);
  assert.match(source, /event\.key === ['"]\/['"]/);
  assert.match(source, /event\.key === 'Escape'/);
});

test('the search placeholder takes its count from the parsed manual, not a hard-coded number', () => {
  assert.match(source, /input\.placeholder = `Search \$\{rows\.length\} commands`/);
  assert.doesNotMatch(html, /placeholder="Search \d+ commands"/);
  assert.equal(canonicalCommands().length, 43);
  assert.doesNotMatch(source, /commands-hero-count|result-count/);
});

test('public Commands rows are a list of command, description and access with no PATH rows or context blocks', () => {
  assert.doesNotMatch(source, /workflow-path|Typical path|<strong>Path<\/strong>/);
  assert.doesNotMatch(styles, /\.workflow-path\b/);
  assert.doesNotMatch(source, /className = 'workflow-context'|class="workflow-context"/);
  assert.match(source, /class="command-name"/);
  assert.match(source, /class="command-what"/);
  assert.match(source, /class="command-who"/);
  assert.doesNotMatch(source, /workflow-command-table/);
});

test('every canonical command has one explicit concise preview metadata entry', () => {
  const canonical = canonicalCommands();
  const previews = previewKeys();
  assert.equal(canonical.length, 43);
  assert.equal(previews.length, canonical.length);
  assert.equal(new Set(previews).size, previews.length);
  assert.deepEqual([...previews].sort(), [...canonical].sort());
  assert.doesNotMatch(source, /role_panel|Control resource|forum-backed Control resource|Discord resource mappings|gateway latency|bind clear existing matches/i);
});

test('each command row expands in place with aria-expanded and no dialog remains', () => {
  assert.doesNotMatch(html, /<dialog|commandDialog|data-command-dialog-close/);
  assert.doesNotMatch(source, /showModal|commandDialog|createElement\('details'\)/);
  assert.match(source, /<button type="button" class="control-disclose command-trigger" data-command-toggle aria-expanded="false" aria-controls="\$\{bodyId\}">/);
  assert.match(source, /\.setAttribute\('aria-expanded', String\(open\)\)/);
  assert.match(source, /body\.inert = !open/);
  assert.match(source, /syntax: \[\], options: \[\], example: \[\], more: \[\]/);
  assert.match(source, /history\.replaceState/);
  assert.match(source, /location\.hash/);
  assert.match(source, /row\.scrollIntoView/);
});

test('Commands renders the shared Control shell with Commands current and Appearance in the account menu', () => {
  assert.match(html, /<nav id="controlNavContent" class="control-nav"/);
  assert.match(html, /href="\/commands"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /href="\/handbook"[^>]*aria-current="page"/);
  assert.match(html, /href="\/control\/overview"[^>]*data-nav-key="overview"/);
  const seg = html.slice(html.indexOf('class="control-seg"'), html.indexOf('data-account-sign-out'));
  assert.ok(seg.indexOf('data-theme-choice="light"') < seg.indexOf('data-theme-choice="dark"'));
  assert.ok(seg.indexOf('data-theme-choice="dark"') < seg.indexOf('data-theme-choice="system"'));
  assert.match(seg, />Light<\/button>/);
  assert.match(seg, />Auto<\/button>/);
  assert.doesNotMatch(html, /Rob-bot Control Panel|control-appearance|aria-label="Dark theme"/);
});

test('Commands CSS styles in-place rows and carries no modal overlay', () => {
  assert.doesNotMatch(styles, /\.command-dialog|::backdrop|\.workflow-command-table/);
  assert.match(styles, /\.command-trigger\b/);
  assert.match(styles, /\.command-detail\b/);
  assert.match(styles, /\.command-detail-table-wrap/);
});
