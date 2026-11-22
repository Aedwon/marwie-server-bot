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

test('public Commands hero and search use the simplified R3 language', () => {
  assert.match(html, /Find the right command by task, permission, or name\./);
  const hero = html.slice(html.indexOf('<section class="control-page-section commands-hero"'), html.indexOf('</section>'));
  assert.doesNotMatch(hero, /control-eyebrow|Reference|Public reference · No sign-in required/);
  assert.doesNotMatch(html, /control-eyebrow|Public reference · No sign-in required/);
  assert.doesNotMatch(source, /Using this manual/);
  assert.match(html, /id="commandSearch"/);
  assert.match(source, /event\.key === ['"]\/['"]/);
});

test('public Commands workflow previews have no PATH rows or implementation context blocks', () => {
  assert.doesNotMatch(source, /workflow-path|Typical path|<strong>Path<\/strong>/);
  assert.doesNotMatch(styles, /\.workflow-path\b/);
  assert.doesNotMatch(source, /className = 'workflow-context'|class="workflow-context"/);
  assert.match(source, /workflow-command-table/);
  assert.match(source, /Command<\/th><th scope="col">Description<\/th><th scope="col">Access/);
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

test('command cards do not expand inline and a focused dialog owns complete details', () => {
  assert.match(html, /<dialog[^>]+id="commandDialog"/);
  assert.match(html, /data-command-dialog-close/);
  assert.doesNotMatch(source, /document\.createElement\('details'\)|classList\.contains\('command-card'\).*open|\.open = true/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /data-command-dialog-close|commandDialogClose/);
  assert.match(source, /cancel/);
  assert.match(source, /focus\(\)/);
  assert.match(source, /history\.(?:replaceState|pushState)/);
  assert.match(source, /location\.hash/);
});

test('Commands renders the shared Control shell with Commands current and Appearance in the account menu', () => {
  assert.match(html, /<nav id="controlNavContent" class="control-nav"/);
  assert.match(html, /href="\/commands"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /href="\/handbook"[^>]*aria-current="page"/);
  const seg = html.slice(html.indexOf('class="control-seg"'), html.indexOf('data-account-sign-out'));
  assert.ok(seg.indexOf('data-theme-choice="light"') < seg.indexOf('data-theme-choice="dark"'));
  assert.ok(seg.indexOf('data-theme-choice="dark"') < seg.indexOf('data-theme-choice="system"'));
  assert.match(seg, />Light<\/button>/);
  assert.match(seg, />Auto<\/button>/);
  assert.doesNotMatch(html, /Rob-bot Control Panel|control-appearance|aria-label="Dark theme"/);
});

test('Commands CSS has modal overlay styling and no open-card expansion contract', () => {
  assert.match(styles, /\.command-dialog\b/);
  assert.match(styles, /::backdrop/);
  assert.doesNotMatch(styles, /\.command-card\[open\]/);
  assert.match(styles, /\.workflow-command-table-wrap/);
  assert.match(styles, /\.command-detail-table-wrap/);
});
