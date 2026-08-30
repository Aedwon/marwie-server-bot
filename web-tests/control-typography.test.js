import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const docsSiteUrl = new URL('../docs-site/', import.meta.url);
const controlStylesheets = readdirSync(docsSiteUrl)
  .filter(name => /^control.*\.css$/.test(name))
  .sort();

function sourceFor(name) {
  return readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function subFloorFontSizes() {
  const violations = [];
  const declarationPattern = /font-size\s*:\s*([^;{}]+);/g;
  const valuePattern = /(\d*\.?\d+)(px|rem)\b/g;

  for (const name of controlStylesheets) {
    const source = sourceFor(name);
    for (const declaration of source.matchAll(declarationPattern)) {
      const value = declaration[1];
      for (const token of value.matchAll(valuePattern)) {
        const numeric = Number(token[1]);
        const pixels = token[2] === 'rem' ? numeric * 16 : numeric;
        if (pixels < 13) {
          violations.push(`${name}:${lineNumberAt(source, declaration.index)} ${token[0]} = ${pixels}px`);
        }
      }
    }
  }

  return violations;
}

function typographyBlock(name, selector) {
  const source = sourceFor(name);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  const block = matches.map(match => match[1]).find(candidate => /font-size\s*:/.test(candidate));
  assert.ok(block, `Expected a font-size rule for ${selector} in ${name}`);
  return block;
}

test('every Control stylesheet keeps numeric px/rem font sizes at or above 13px', () => {
  assert.ok(controlStylesheets.length > 0, 'Expected Control stylesheets');
  assert.deepEqual(subFloorFontSizes(), []);
});

for (const [name, selector] of [
  ['control.css', '.control-brand small'],
  ['control.css', '.control-global-status'],
  ['control.css', '.control-eyebrow'],
  ['control.css', '.control-state-chip'],
  ['control.css', '.control-context'],
  ['control.css', '.control-account-copy small'],
  ['control-analytics-workflows.css', '.analytics-stat dt'],
  ['control-analytics-workflows.css', '.analytics-channel-label'],
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
