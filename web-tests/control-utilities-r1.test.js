import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { legacyMountPlanForPath } from '../docs-site/control-page-adapter.js';

const UTILITY_PATHS = [
  '/control/utilities/ticket-configuration',
  '/control/utilities/notification-roles',
  '/control/utilities/anonymous-questions',
];

test('Utilities routes are canonical registered pages instead of transitional adapters', () => {
  for (const path of UTILITY_PATHS) {
    assert.equal(legacyMountPlanForPath(path), null, `${path} must not use a legacy adapter`);
  }

  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(app, /registerUtilitiesPages\(\)/);
  assert.match(app, /control-utilities\.css/);
});

test('Message logging has no Utilities route, mapping editor, or canonical page registration', () => {
  const adapter = readFileSync(new URL('../docs-site/control-page-adapter.js', import.meta.url), 'utf8');
  const mappings = readFileSync(new URL('../docs-site/control-mappings.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');

  for (const source of [adapter, mappings, app]) {
    assert.doesNotMatch(source, /utilities\/message(?:-|_)logging/i);
  }
  assert.doesNotMatch(mappings, /message_logs|message logging/i);
});
