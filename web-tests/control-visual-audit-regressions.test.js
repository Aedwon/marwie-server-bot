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
  assert.match(
    shellStyles,
    /:where\(a, button, input, select, textarea, summary\):focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus-ring\);[^}]*outline-offset:\s*2px;/,
  );
  const sharedFields = featureStyles.match(/\.control-page :is\(input:not\(\[type\]\),[^{}]*\{([^}]+)\}/)?.[1];
  assert.ok(sharedFields, 'Expected the shared field rule to include the untyped Quizzes inputs');
  assert.doesNotMatch(sharedFields, /\boutline(?:-[\w-]+)?\s*:/, 'Shared field styles must preserve the keyboard outline');
});

test('Control Commands can reflow its stacked rows to the available width', () => {
  assert.match(featureStyles, /\.control-command-item[^{}]*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  assert.doesNotMatch(featureStyles, /\.control-command-table(?=\s*[,\{])[^{}]*\{[^}]*min-width:\s*560px;/);
});

test('Control text fields expose their boundaries and retain the focus stroke on hover', () => {
  assert.match(
    shellStyles,
    /--stroke-field:\s*color-mix\(in srgb, var\(--text-tertiary\) 75%, var\(--stroke-control\)\);/,
  );
  assert.match(featureStyles, /\.community-threshold-input\s*\{[^}]*border:\s*1px solid var\(--stroke-field\);/);
  assert.match(featureStyles, /:hover:not\(:disabled, :focus\)\s*\{[^}]*border-color:\s*var\(--text-tertiary\);/);
});

test('Notification subsections and Control Command titles use compact heading typography', () => {
  assert.match(featureStyles, /\.utility-subheading\s+h3\s*\{[^}]*font-size:\s*16px;[^}]*font-weight:\s*600;/);
  assert.match(featureStyles, /\.control-command-goal\s+h2\s*\{[^}]*font-size:\s*16px;[^}]*font-weight:\s*600;/);
});
