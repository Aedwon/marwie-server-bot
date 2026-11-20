import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = name => readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');
const legacyColors = /#(?:365544|eaf0ec|2f4d3d|a8c9b2|25352b|bee0c8|28623b|8fd49e|171719|1d1d1f|f5f5f7)\b/gi;

function assertTypography(css, floor, name) {
  const weights = [...css.matchAll(/(?:^|[;{])\s*font-weight:\s*([^;}]+)/gm)].map(match => match[1].trim());
  assert.deepEqual(weights.filter(weight => !['400', '500', '600'].includes(weight)), [], `${name} font weights`);

  const smallSizes = [];
  for (const [, property, value] of css.matchAll(/(?:^|[;{])\s*(font-size|font):\s*([^;}]+)/gm)) {
    const sizes = [...value.matchAll(/(\d*\.?\d+)(px|rem)\b/g)];
    for (const [size, amount, unit] of property === 'font' ? sizes.slice(0, 1) : sizes) {
      if (Number(amount) * (unit === 'rem' ? 16 : 1) < floor) smallSizes.push(size);
    }
  }
  assert.deepEqual(smallSizes, [], `${name} font sizes below ${floor}px`);
}

test('Commands uses only Control palette and typography', () => {
  const css = read('commands.css');
  assert.deepEqual(css.match(legacyColors), null);
  assert.doesNotMatch(css, /--(?:control-border|control-surface|control-muted|page-surface|surface|text)\b(?!-)/);
  for (const token of [
    'surface-primary', 'surface-secondary', 'surface-hover', 'text-primary', 'text-secondary',
    'text-tertiary', 'stroke-subtle', 'stroke-control', 'focus-ring', 'shadow-floating',
  ]) {
    assert.ok(css.includes(`var(--${token})`), `Missing Control token ${token}`);
  }
  assertTypography(css, 13, 'commands.css');
});

test('Commands sets legible weights and sizes for browser-default Markdown typography', () => {
  const css = read('commands.css');
  assert.match(css, /\.commands-page :is\(h2, h3, h4, h5, h6, strong, b\)\s*\{[^}]*font-weight:\s*600;/);
  assert.match(css, /\.command-dialog-body :is\(h5, h6\)\s*\{[^}]*font-size:\s*13px;/);
});

test('Commands keeps the desktop search field distinct and mobile input readable', () => {
  const css = read('commands.css');
  assert.match(css, /\.command-search-field\s*\{[^}]*border:\s*1px solid var\(--stroke-control\)[^}]*background:\s*var\(--surface-primary\)/);
  assert.match(css, /\.command-search-field:focus-within\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
  assert.match(css, /\.command-search-field svg\s*\{[^}]*(?:stroke|color):\s*var\(--text-secondary\)/);
  assert.match(css, /@media \(max-width: 639px\)\s*\{\s*\.command-search-field input\s*\{\s*font-size:\s*16px/);
  assert.match(read('commands.html'), /<kbd aria-hidden="true">\/<\/kbd>/);
});

test('Commands scrolls its navigation body and loads the pinned asset versions', () => {
  const html = read('commands.html');
  assert.match(html, /href="\/control\.css\?v=32"/);
  assert.match(html, /href="\/commands\.css\?v=8"/);
  assert.match(html, /src="\/commands\.js\?v=8"/);
  assert.match(html, /class="commands-nav-body">\s*<nav class="control-primary-nav[\s\S]*?<nav class="control-secondary-nav/);
  assert.match(html, /class="control-rail-foot">\s*<a class="control-brand"/);
  assert.match(read('commands.css'), /\.commands-nav-body\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;/);
});

test('Commands synchronizes its drawer at 875px and yields keyboard shortcuts to open overlays', () => {
  const js = read('commands.js');
  assert.match(js, /matchMedia\('\(max-width: 875px\)'\)/);
  assert.match(js, /isDrawer: \(\) => commandNarrow\.matches/);
  assert.match(js, /function syncCommandShell\(\)\s*\{[^}]*dataset\.navMode\s*=\s*commandNarrow\.matches\s*\? 'drawer' : 'expanded'[^}]*drawerController\.sync\(\)/);
  assert.match(js, /syncCommandShell\(\);\s*commandNarrow\.addEventListener\?\.\('change', syncCommandShell\)/);
  assert.match(js, /drawerController\.close\(\{ restoreFocus: false \}\)/);
  assert.match(js, /commandWorkspace\s*=\s*document\.querySelector\('\.commands-workspace'\)/);
  assert.match(js, /onOpen:\s*\(\)\s*=>\s*\{[\s\S]*?if \(commandWorkspace\) commandWorkspace\.inert = true;/);
  assert.match(js, /onClose:\s*\(\)\s*=>\s*\{[\s\S]*?if \(commandWorkspace\) commandWorkspace\.inert = false;[\s\S]*?commandMenuButton\?\.focus\(\);/);
  assert.match(js, /addEventListener\('keydown',\s*event\s*=>\s*\{[\s\S]*?event\.key !== 'Escape'[\s\S]*?commandNarrow\.matches && commandDrawer\?\.dataset\.open === 'true'[\s\S]*?event\.preventDefault\(\);[\s\S]*?drawerController\.close\(\);/);
  assert.match(js, /function setupCommandSearch[\s\S]*?event\.defaultPrevented \|\| dialog\?\.open \|\| commandDrawer\?\.dataset\.open === 'true'/);
});

test('Handbook uses System appearance, current assets, and confirmation copy', () => {
  const html = read('index.html');
  assert.match(html, /<html[^>]*data-theme="light"[^>]*data-preference="system"/);
  assert.match(html, /localStorage\.getItem\('rob-doc-theme'\) \|\| 'system'/);
  assert.match(html, /<meta name="theme-color" content="#fcfcfb" id="themeColor">/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Figtree:wght@400;500;600/);
  assert.match(html, /href="\/styles\.css\?v=15"/);
  assert.match(html, /href="\/home\.css\?v=3"/);
  assert.match(html, /src="\/app\.js\?v=18" defer/);
  assert.match(html, /<div class="release">V1 · slash commands require confirmation<\/div>/);
  assert.doesNotMatch(html, /45 slash commands/);
});

for (const name of ['styles.css', 'home.css', 'visual.css']) {
  test(`Handbook ${name} meets the palette and 12px typography floor`, () => {
    const css = read(name);
    assert.deepEqual(css.match(legacyColors), null);
    assert.doesNotMatch(css, /SF Pro Text/);
    assertTypography(css, 12, name);
  });
}

test('Handbook resolves both themes from canonical tokens in its base stylesheet', () => {
  const css = read('styles.css');
  const light = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  const dark = css.match(/html\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
  assert.ok(light && dark);
  assert.match(light, /color-scheme:\s*light;/);
  assert.match(dark, /color-scheme:\s*dark;/);
  for (const [token, lightHex, darkHex] of [
    ['surface-page', '#fcfcfb', '#0f0f11'],
    ['surface-primary', '#ffffff', '#19191c'],
    ['surface-secondary', '#f4f4f2', '#1b1b1e'],
    ['text-primary', '#111113', '#ececee'],
    ['accent-info', '#2f6fa3', '#7db9e8'],
  ]) {
    assert.match(light, new RegExp(`--${token}:\\s*${lightHex};`));
    assert.match(dark, new RegExp(`--${token}:\\s*${darkHex};`));
  }
  assert.match(light, /--font-sans:\s*"Figtree"/);
  assert.match(css, /body\s*\{[^}]*font:\s*16px\/1\.6 var\(--font-sans\)/);
});

test('Handbook view styles preserve the base navigation and appearance rules', () => {
  const base = read('styles.css');
  const home = read('home.css');
  const visual = read('visual.css');
  assert.match(home, /@import url\('\/visual\.css\?v=2'\);/);
  assert.match(visual, /--page-surface:\s*var\(--surface-secondary\)/);
  assert.match(visual, /--page-surface-strong:\s*var\(--surface-selected\)/);
  assert.match(visual, /--hairline:\s*var\(--stroke-subtle\)/);
  assert.match(base, /\.nav a\s*\{[^}]*min-height:\s*36px/);
  assert.match(base, /@media \(max-width: 600px\)\s*\{[^}]*\.nav a\s*\{[^}]*min-height:\s*44px/);
  assert.match(base, /\.nav a\[aria-current="true"\]\s*\{[^}]*var\(--surface-selected\)[^}]*var\(--text-primary\)[^}]*var\(--stroke-selected\)/);
  assert.match(base, /\.theme-switcher\s*\{[^}]*padding:\s*3px[^}]*border-radius:\s*10px[^}]*background:\s*var\(--surface-secondary\)/);
  assert.match(base, /\.theme-switcher button\[aria-pressed="true"\]\s*\{[^}]*var\(--surface-primary\)[^}]*var\(--text-primary\)/);
  assert.doesNotMatch(visual, /(?:\.theme-switcher|\.nav a)[^{]*\{[^}]*(?:background|color|min-height|font-size):/);
  assert.match(home, /\.setup-principle\s*\{[^}]*background:\s*var\(--status-info-bg\)[^}]*border:\s*1px solid var\(--status-info-stroke\)/);
  assert.match(home, /\.task-card\s*\{[^}]*background:\s*var\(--surface-primary\)/);
  assert.match(home, /\.task-card:hover\s*\{[^}]*background:\s*var\(--surface-hover\)/);
});

test('Handbook only persists explicit theme choices', () => {
  const js = read('app.js');
  assert.match(js, /if \(persist\) localStorage\.setItem\('rob-doc-theme', pref\)/);
  assert.match(js, /applyTheme\(button\.dataset\.themeChoice, \{ persist: true \}\)/);
  assert.match(js, /applyTheme\('system', \{ persist: false \}\)/);
  assert.match(js, /applyTheme\(root\.dataset\.preference \|\| 'system', \{ persist: false \}\)/);
  assert.match(js, /themeColor\.content = actual === 'dark' \? '#0f0f11' : '#fcfcfb'/);
});

test('Handbook drawer isolates the inactive surface and restores focus on dismissal', () => {
  const js = read('app.js');
  assert.match(js, /matchMedia\('\(max-width: 900px\)'\)/);
  assert.match(js, /side\.inert\s*=/);
  assert.match(js, /main\.inert\s*=/);
  assert.match(js, /side\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(js, /side\.removeAttribute\('aria-hidden'\)/);
  assert.match(js, /addEventListener\?\.\('change', syncMenu\)/);
  assert.match(js, /side\.querySelector\('\.nav a, \.theme-switcher button'\)\?\.focus\(\)/);
  assert.match(js, /if \(restoreFocus\) menuBtn\.focus\(\)/);
  assert.match(js, /menuBtn\.addEventListener\('click', \(\) => \{[^}]*closeMenu\(\{ restoreFocus: true \}\)/);
  assert.match(js, /querySelectorAll\('a\[href\^="#"\]'\)[\s\S]*?closeMenu\(\)/);
  assert.match(js, /event\.key === 'Escape'[\s\S]*?closeMenu\(\{ restoreFocus: true \}\)/);
});
