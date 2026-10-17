import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const CONTROL_STYLES = ['control.css', 'control-features.css', 'control-emoji-picker.css'];

function sourceFor(name) {
  return readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function typographyBlock(name, selector) {
  const source = sourceFor(name);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  const block = matches.map(match => match[1]).find(candidate => /font-size\s*:/.test(candidate));
  assert.ok(block, `Expected a font-size rule for ${selector} in ${name}`);
  return block;
}

test('canonical Control styles never use numeric text below the approved 12px metadata floor', () => {
  const violations = [];
  for (const name of CONTROL_STYLES) {
    const source = sourceFor(name);
    for (const declaration of source.matchAll(/font-size\s*:\s*([^;{}]+);/g)) {
      for (const token of declaration[1].matchAll(/(\d*\.?\d+)(px|rem)\b/g)) {
        const px = token[2] === 'rem' ? Number(token[1]) * 16 : Number(token[1]);
        if (px < 12) violations.push(`${name}:${lineNumberAt(source, declaration.index)} ${token[0]} = ${px}px`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

for (const [name, selector] of [
  ['control.css', '.control-brand small'],
  ['control.css', '.control-global-status'],
  ['control.css', '.control-eyebrow'],
  ['control.css', '.control-state-chip'],
  ['control.css', '.control-context'],
  ['control.css', '.control-account-copy small'],
  ['control-features.css', '.control-stat-row dt'],
]) {
  test(`${selector} uses the approved 13px / 18px metadata treatment`, () => {
    const block = typographyBlock(name, selector);
    assert.match(block, /font-size\s*:\s*13px\s*;/);
    assert.match(block, /line-height\s*:\s*18px\s*;/);
  });
}

for (const selector of [
  '.control-account-copy strong',
  '.control-account-menu :is(a, button)',
  '.control-appearance button',
]) {
  test(`${selector} keeps routine UI text at the 13px floor`, () => {
    const block = typographyBlock('control.css', selector);
    assert.match(block, /font-size\s*:\s*13px\s*;/);
  });
}
