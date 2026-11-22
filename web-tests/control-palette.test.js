import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaletteIndex,
  commandsFromMarkdown,
  filterPalette,
  paletteKeyAction,
} from '../docs-site/control-palette.js';

const destinations = [
  { label: 'Reputation', path: '/control/community/reputation', group: 'Engagement' },
  { label: 'Quizzes', path: '/control/community/quizzes', group: 'Engagement' },
  { label: 'Live', path: '/control/content/live', group: 'Publishing' },
  { label: 'Resources', path: '/control/mappings/channels', group: '' },
  { label: 'Handbook', path: '/handbook', group: 'Reference' },
];
const commands = [
  { name: '/quiz start', id: 'command-quiz-start' },
  { name: '/live', id: 'command-live' },
  { name: '/reputation award', id: 'command-reputation-award' },
];

test('index lists destinations first, then commands, with hints and hrefs', () => {
  const index = buildPaletteIndex({ destinations, commands });
  assert.equal(index.length, 8);
  assert.deepEqual(index.slice(0, 5).map(item => item.kind), Array(5).fill('destination'));
  assert.deepEqual(index.slice(5).map(item => item.kind), Array(3).fill('command'));
  assert.equal(index[0].hint, 'Engagement');
  assert.equal(index[0].href, '/control/community/reputation');
  assert.equal(index[5].hint, 'Command');
  assert.equal(index[5].label, '/quiz start');
  assert.equal(index[5].href, '/commands#command-quiz-start');
});

test('an empty query returns the first items in index order', () => {
  const index = buildPaletteIndex({ destinations, commands });
  assert.deepEqual(filterPalette(index, '', { limit: 3 }).map(item => item.label), ['Reputation', 'Quizzes', 'Live']);
});

test('filter matches every term, ignores case and the leading slash', () => {
  const index = buildPaletteIndex({ destinations, commands });
  assert.deepEqual(filterPalette(index, 'QUIZ').map(item => item.label), ['Quizzes', '/quiz start']);
  assert.deepEqual(filterPalette(index, 'quiz start').map(item => item.label), ['/quiz start']);
  assert.deepEqual(filterPalette(index, '/quiz').map(item => item.label), ['Quizzes', '/quiz start']);
  assert.deepEqual(filterPalette(index, 'publishing').map(item => item.label), ['Live']);
});

test('prefix matches rank before other matches and destinations rank before commands', () => {
  const index = buildPaletteIndex({ destinations, commands });
  const labels = filterPalette(index, 'live').map(item => item.label);
  assert.deepEqual(labels, ['Live', '/live']);
  assert.deepEqual(filterPalette(index, 're').map(item => item.label).slice(0, 2), ['Reputation', 'Resources']);
});

test('no matches returns an empty list', () => {
  const index = buildPaletteIndex({ destinations, commands });
  assert.deepEqual(filterPalette(index, 'zzzz'), []);
});

test('filter caps results at the limit', () => {
  const index = buildPaletteIndex({ destinations, commands });
  assert.equal(filterPalette(index, 'e', { limit: 2 }).length, 2);
});

test('keyboard: arrows wrap, Enter opens, Escape closes, Home and End jump', () => {
  assert.deepEqual(paletteKeyAction({ key: 'ArrowDown', index: 0, count: 3 }), { index: 1, action: 'move' });
  assert.deepEqual(paletteKeyAction({ key: 'ArrowDown', index: 2, count: 3 }), { index: 0, action: 'move' });
  assert.deepEqual(paletteKeyAction({ key: 'ArrowUp', index: 0, count: 3 }), { index: 2, action: 'move' });
  assert.deepEqual(paletteKeyAction({ key: 'Home', index: 2, count: 3 }), { index: 0, action: 'move' });
  assert.deepEqual(paletteKeyAction({ key: 'End', index: 0, count: 3 }), { index: 2, action: 'move' });
  assert.deepEqual(paletteKeyAction({ key: 'Enter', index: 1, count: 3 }), { index: 1, action: 'open' });
  assert.deepEqual(paletteKeyAction({ key: 'Escape', index: 1, count: 3 }), { index: 1, action: 'close' });
  assert.deepEqual(paletteKeyAction({ key: 'Enter', index: 0, count: 0 }), { index: 0, action: 'none' });
  assert.deepEqual(paletteKeyAction({ key: 'ArrowDown', index: 0, count: 0 }), { index: 0, action: 'none' });
  assert.deepEqual(paletteKeyAction({ key: 'a', index: 1, count: 3 }), { index: 1, action: 'none' });
});

test('commands come from level-2 slash headings of the manual with the Commands page ids', () => {
  const markdown = [
    '# Rob-bot command manual',
    '',
    '# Setup',
    '## `/setup auto`',
    'text',
    '## `/quiz start`',
    '## Not a command',
    '## `/setup auto`',
  ].join('\n');
  assert.deepEqual(commandsFromMarkdown(markdown), [
    { name: '/setup auto', id: 'command-setup-auto' },
    { name: '/quiz start', id: 'command-quiz-start' },
    { name: '/setup auto', id: 'command-setup-auto-2' },
  ]);
});
