import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shellStyles = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
const featureStyles = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');

test('Control headings, emphasis, and row headings use the approved 600 weight by default', () => {
  assert.match(
    shellStyles,
    /:where\(body\.control-page\)\s+:where\(h1, h2, h3, h4, h5, h6, b, strong, th\)\s*\{[^}]*font-weight:\s*600;/,
  );
});

test('Quizzes scheduling help and Live topic help meet the 12px metadata floor', () => {
  assert.match(featureStyles, /\.control-field-group\s*>\s*small,\s*\.content-dispatch-flow label\s*>\s*small\s*\{[^}]*font-size:\s*12px;/);
});

test('Control placeholders use the current theme’s readable text color', () => {
  assert.match(
    shellStyles,
    /:where\(body\.control-page\)\s+:is\(input, textarea\)::placeholder\s*\{[^}]*color:\s*var\(--text-tertiary\);/,
  );
});

test('Control fields use mobile dimensions in both the workspace and Context', () => {
  assert.match(
    shellStyles,
    /@media \(max-width: 639px\)\s*\{\s*body\.control-page\s*\{[^}]*--control-field-height:\s*44px;[^}]*--control-field-font-size:\s*16px;/,
  );
  assert.match(
    shellStyles,
    /\.control-resource-field select\s*\{[^}]*min-height:\s*var\(--control-field-height\);[^}]*font-size:\s*var\(--control-field-font-size\);/,
  );
  assert.match(
    featureStyles,
    /\.control-page :is\(input:not\(\[type\]\),[^}]*\{[^}]*min-height:\s*var\(--control-field-height\);[^}]*font-size:\s*var\(--control-field-font-size\);/,
  );
});

test('Quizzes category and option fields inherit the shared 3px keyboard outline', () => {
  const sharedFocus = ':where(a, button, input, select, textarea, summary):focus-visible';
  // These selectors style the shell, a toggle track, navigation links, or chart points.
  const unrelated = new Set([
    '.control-main',
    '.control-main:focus-visible',
    '.control-feature-toggle input:focus-visible + .control-feature-toggle-track',
    '.control-switch input:focus-visible + .control-switch-track',
    '.control-nav-row[aria-current="page"]',
    '.control-palette input:focus-visible',
    '.analytics-point-group:focus-visible',
    '.analytics-hit:focus-visible',
    // Number-with-unit draws the shared outline on its bordered box, not on the inner input.
    '.control-page .control-number .control-number-input:focus-visible',
    '.control-number:has(.control-number-input:focus-visible)',
  ]);
  const outlines = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selector, body]) => {
      const declarations = body.split(';').map(value => value.trim())
        .filter(value => /^(?:outline(?:-[\w-]+)?|all)\s*:/i.test(value));
      return declarations.length && !unrelated.has(selector.trim())
        ? [{ selector: selector.trim(), declarations }]
        : [];
    });

  // A base or :focus rule can win over :focus-visible through specificity or source order.
  assert.deepEqual(outlines(shellStyles), [{
    selector: sharedFocus,
    declarations: ['outline: 3px solid var(--focus-ring)', 'outline-offset: 2px'],
  }], 'Control shell must preserve the shared outline on focused Quizzes fields');
  assert.deepEqual(outlines(featureStyles), [], 'Control features must preserve the shared outline on focused Quizzes fields');
});

test('Commands rows reflow to one column below 760px', () => {
  const commandsStyles = readFileSync(new URL('../docs-site/commands.css', import.meta.url), 'utf8');
  assert.match(commandsStyles, /@media \(max-width: 760px\) \{\s*\.command-trigger \{ grid-template-columns: minmax\(0, 1fr\) 12px; \}/);
});

test('Control text fields expose their boundaries and retain the focus stroke on hover', () => {
  assert.match(
    shellStyles,
    /--stroke-field:\s*color-mix\(in srgb, var\(--text-tertiary\) 75%, var\(--stroke-control\)\);/,
  );
  assert.match(featureStyles, /\.community-threshold-input\s*\{[^}]*border:\s*1px solid var\(--stroke-field\);/);
  assert.match(featureStyles, /:hover:not\(:disabled, :focus\)\s*\{[^}]*border-color:\s*var\(--text-tertiary\);/);
});

test('Notification subsections and Commands group titles use compact heading typography', () => {
  assert.match(featureStyles, /\.utility-subheading\s+h3\s*\{[^}]*font-size:\s*16px;[^}]*font-weight:\s*600;/);
  const commandsStyles = readFileSync(new URL('../docs-site/commands.css', import.meta.url), 'utf8');
  assert.match(commandsStyles, /\.workflow-section h2\s*\{[^}]*font-size:\s*15px;[^}]*font-weight:\s*600;/);
});

test('hidden skip link casts no shadow into the top-left corner', () => {
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const base = css.match(/\n\.skip \{([^}]*)\}/)[1];
  assert.match(base, /box-shadow:\s*none/);
  assert.match(css, /\.skip:focus-visible \{[^}]*box-shadow:\s*var\(--shadow-floating\)/);
});
