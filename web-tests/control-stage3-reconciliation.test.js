import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Stage 3 app registers every canonical domain module and stylesheet', () => {
  const app = read('docs-site/control-app.js');
  for (const token of [
    'registerCommunityPages',
    'registerContentPages',
    'registerUtilitiesPages',
    'registerAnalyticsPage',
    'registerMappingPages',
    'workflowPageMarkup',
    '/control-community.css?v=1',
    '/control-content.css?v=1',
    '/control-utilities.css?v=1',
    '/control-analytics-workflows.css?v=1',
    '/control-mappings.css?v=1',
  ]) assert.match(app, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('commands-only operations stay out of canonical feature page modules', () => {
  const community = read('docs-site/control-community.js');
  const content = read('docs-site/control-content.js');
  const utilities = read('docs-site/control-utilities.js');
  assert.equal(community.includes('adjust_reputation'), false);
  assert.equal(content.includes('poll_ai_sources'), false);
  assert.equal(content.includes('Poll now'), false);
  assert.equal(utilities.includes('refresh_ticket_panel'), false);
  assert.equal(utilities.includes('Post ticket panel'), false);
});

test('Analytics and Workflows preserve final Stage 3 presentation ownership', () => {
  const analytics = read('docs-site/control-analytics.js');
  const workflows = read('docs-site/control-workflows.js');
  assert.match(analytics, /<dl/);
  assert.equal(analytics.includes('Build Help'), false);
  assert.equal(analytics.includes('correct-answer count'), false);
  assert.equal(workflows.includes('control-eyebrow'), false);
  assert.equal(workflows.includes('<button'), false);
  assert.equal(workflows.includes('data-control-field'), false);
});
