import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const LEGACY_DOMAIN_STYLES = [
  'control-community.css',
  'control-content.css',
  'control-utilities.css',
  'control-analytics-workflows.css',
  'control-mappings.css',
  'control-secondary.css',
];

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Control has one canonical feature style layer and no legacy domain stylesheet stack', () => {
  const app = read('docs-site/control-app.js');
  const html = read('docs-site/control.html');
  assert.equal(app.includes('installDomainStyles'), false);
  assert.equal(html.includes('/control-features.css?v=15'), true);
  assert.equal(html.includes('control-emoji-picker.css'), false);
  for (const file of LEGACY_DOMAIN_STYLES) {
    assert.equal(app.includes(file), false, `${file} must not be loaded dynamically`);
    assert.equal(existsSync(new URL(`../docs-site/${file}`, import.meta.url)), false, `${file} must be deleted`);
  }
});

test('canonical Control styles contain no staged legacy visual systems', () => {
  const shell = read('docs-site/control.css');
  const features = read('docs-site/control-features.css');
  const source = `${shell}\n${features}`;
  for (const marker of [
    'Legacy Control aliases',
    'Foundation R2 transitional',
    'Sidebar polish R1',
    'Control UI/UX refinements R2 shared language',
    '--control-card-shadow',
  ]) assert.equal(source.includes(marker), false, marker);

  for (const raw of ['#248a3d', '#d70015', '#30d158', '#ff453a']) {
    assert.equal(source.toLowerCase().includes(raw), false, raw);
  }

  const weights = [...source.matchAll(/font-weight:\s*(\d+)/g)].map(match => Number(match[1]));
  assert.deepEqual([...new Set(weights.filter(weight => ![400, 500, 600].includes(weight)))], []);
});

test('feature modules do not emit legacy card and mapping-block chrome', () => {
  const forbidden = {
    'docs-site/control-community.js': [
      'community-field-card', 'community-question-card', 'community-ops-snapshot',
      'community-section-grid', 'community-tier-progression', 'community-tier-editor',
    ],
    'docs-site/control-content.js': [
      'content-admin-surface', 'content-announcement-preview-card', 'content-card-heading',
    ],
    'docs-site/control-utilities.js': [
      'utility-panel-summary-list', 'utility-notification-grid', 'utility-ticket-grid',
    ],
    'docs-site/control-analytics.js': [
      'analytics-dashboard', 'analytics-metrics', 'analytics-stat',
    ],
  };

  for (const [file, classes] of Object.entries(forbidden)) {
    const source = read(file);
    for (const className of classes) assert.equal(source.includes(className), false, `${file}: ${className}`);
  }
});

test('Control shell source is not an append-only sequence of old redesign layers', () => {
  const shell = read('docs-site/control.css');
  assert.equal(shell.match(/\/\*[^*]*(?:R1|R2|refinement|polish|transitional|completion)[^*]*\*\//gi)?.length || 0, 0);
  assert.equal(shell.includes('display: none !important;'), false);
});
