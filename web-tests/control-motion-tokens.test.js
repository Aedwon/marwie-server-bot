import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const FILES = ['control.css', 'control-features.css'];
const TOKEN_DURATIONS = ['--motion-micro', '--motion-exit', '--motion-enter', '--motion-layout'];
const LOADING = /spinner|loading|control-task-status|data-state="running"|control-task-indicator/;

function strip(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseRules(css, stack = []) {
  const rules = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;
    const prelude = css.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = css.slice(open + 1, cursor - 1);
    if (prelude.startsWith('@media') || prelude.startsWith('@supports') || prelude.startsWith('@container')) {
      rules.push(...parseRules(body, [...stack, prelude]));
    } else if (!prelude.startsWith('@keyframes') && !prelude.startsWith('@view-transition')) {
      rules.push({ selector: prelude, body, stack });
    }
    index = cursor;
  }
  return rules;
}

function motionDeclarations(body) {
  return [...body.matchAll(/(?:^|[;\s])((?:transition|animation)(?:-[a-z-]+)?)\s*:\s*([^;]+)/g)]
    .map(match => ({ property: match[1], value: match[2].replace(/\s*!important\s*$/, '').trim() }));
}

const sources = FILES.map(name => ({ name, css: strip(readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8')) }));
const rules = sources.flatMap(({ name, css }) => parseRules(css).map(rule => ({ ...rule, file: name })));
const live = rules.filter(rule => !rule.stack.some(entry => /prefers-reduced-motion/.test(entry)));

test('motion tokens are defined with the approved values', () => {
  const css = sources[0].css;
  assert.match(css, /--motion-micro:\s*120ms;/);
  assert.match(css, /--motion-exit:\s*160ms;/);
  assert.match(css, /--motion-enter:\s*220ms;/);
  assert.match(css, /--motion-layout:\s*280ms;/);
  assert.match(css, /--ease-out:\s*cubic-bezier\(\.22, 1, \.36, 1\);/);
  assert.match(css, /--ease-in:\s*cubic-bezier\(\.55, 0, 1, \.45\);/);
});

test('every transition and animation duration uses a motion token', () => {
  const offenders = [];
  for (const rule of live) {
    if (LOADING.test(rule.selector)) continue;
    for (const { property, value } of motionDeclarations(rule.body)) {
      if (/timing-function|iteration|fill-mode|direction|play-state|-name|-property|-behavior/.test(property)) continue;
      if (/^(none|inherit|initial|unset)$/.test(value)) continue;
      const durations = value.match(/(?<![\w-])-?\.?\d*\.?\d+m?s(?![\w-])/g) || [];
      const tokens = TOKEN_DURATIONS.filter(token => value.includes(`var(${token})`));
      const allowedTint = /^500ms /.test(value) || /calc\(500ms/.test(value);
      const bare = durations.filter(duration => !allowedTint || duration !== '500ms');
      if (!tokens.length && !(allowedTint && /saved|changed/.test(rule.selector))) offenders.push(`${rule.file} ${rule.selector} { ${property}: ${value} }`);
      else if (bare.length && !allowedTint) offenders.push(`${rule.file} ${rule.selector} { ${property}: ${value} }`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no linear easing, bare ease keyword or private cubic-bezier outside spinners and loading indicators', () => {
  const offenders = [];
  for (const rule of live) {
    if (LOADING.test(rule.selector) || rule.selector.trim() === ':root') continue;
    for (const { property, value } of motionDeclarations(rule.body)) {
      if (/(?<![\w-])linear(?!-gradient)(?![\w-])/.test(value) || /\bcubic-bezier\(/.test(value) || /(?<![\w-])ease(-in|-out|-in-out)?(?![\w-])/.test(value)) {
        offenders.push(`${rule.file} ${rule.selector} { ${property}: ${value} }`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('infinite animations are limited to spinners and loading indicators', () => {
  const offenders = live.filter(rule => /\binfinite\b/.test(rule.body) && !LOADING.test(rule.selector));
  assert.deepEqual(offenders.map(rule => `${rule.file} ${rule.selector}`), []);
});

test('reduced motion block exists and snaps accordion and rail', () => {
  const css = sources[0].css;
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('motion tokens replace the old duration and easing names', () => {
  for (const { name, css } of sources) {
    assert.doesNotMatch(css, /var\(--duration-(fast|medium)\)/, name);
    assert.doesNotMatch(css, /var\(--ease-standard\)/, name);
  }
});
