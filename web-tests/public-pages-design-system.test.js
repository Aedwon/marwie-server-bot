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

test('Commands loads the pinned asset versions and the shared sidebar scrolls its own body', () => {
  const html = read('commands.html');
  assert.match(html, /href="\/control\.css\?v=35"/);
  assert.match(html, /href="\/commands\.css\?v=9"/);
  assert.match(html, /src="\/commands\.js\?v=9"/);
  assert.match(html, /<nav class="manual-nav" aria-label="Command workflows">/);
  assert.match(read('control.css'), /\.control-nav \{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s);
});

test('Commands yields keyboard shortcuts to open overlays and leaves the drawer to the shared shell', () => {
  const js = read('commands.js');
  assert.doesNotMatch(js, /matchMedia\('\(max-width: 875px\)'\)|commandWorkspace|commandMenuButton|installDrawerController/);
  assert.match(js, /function setupCommandSearch[\s\S]*?event\.defaultPrevented \|\| dialog\?\.open \|\| overlayOpen\(\)/);
  assert.match(js, /const overlayOpen = \(\) => document\.querySelector\('#controlPalette'\)\?\.dataset\.open === 'true'[\s\S]*?#controlNavDrawer[\s\S]*?dataset\.open === 'true'/);
  assert.match(js, /event\.key === ['"]\/['"]/);
});

test('Handbook uses System appearance, current assets, and confirmation copy', () => {
  const html = read('index.html');
  assert.match(html, /<html[^>]*data-theme="light"[^>]*data-preference="system"/);
  assert.match(html, /localStorage\.getItem\('rob-doc-theme'\) \|\| 'system'/);
  assert.match(html, /<meta name="theme-color" content="#fcfcfb">/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Figtree:wght@400;500;600/);
  assert.match(html, /href="\/control\.css\?v=35"/);
  assert.match(html, /href="\/styles\.css\?v=16"/);
  assert.match(html, /href="\/home\.css\?v=4"/);
  assert.match(html, /<script type="module" src="\/app\.js\?v=20">/);
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

test('Handbook view styles keep the view palette and carry no shell rules of their own', () => {
  const base = read('styles.css');
  const home = read('home.css');
  const visual = read('visual.css');
  assert.match(home, /@import url\('\/visual\.css\?v=3'\);/);
  assert.match(visual, /--page-surface:\s*var\(--surface-secondary\)/);
  assert.match(visual, /--page-surface-strong:\s*var\(--surface-selected\)/);
  assert.match(visual, /--hairline:\s*var\(--stroke-subtle\)/);
  for (const css of [base, home, visual]) {
    assert.doesNotMatch(css, /\.sidebar\b|\.mobilebar|\.theme-switcher|\.nav a|\.menubtn|\.appearance|\.nav-section|\.layout\s*\{/);
  }
  assert.match(home, /\.setup-principle\s*\{[^}]*background:\s*var\(--status-info-bg\)[^}]*border:\s*1px solid var\(--status-info-stroke\)/);
  assert.match(home, /\.task-card\s*\{[^}]*background:\s*var\(--surface-primary\)/);
  assert.match(home, /\.task-card:hover\s*\{[^}]*background:\s*var\(--surface-hover\)/);
});

test('Handbook renders in the shared shell with a sticky On this page list that hides below 1100px of main width', () => {
  const html = read('index.html');
  const home = read('home.css');
  assert.doesNotMatch(html, /id="sidebar"|id="menuBtn"|id="menuClose"|class="mobilebar"|class="layout"/);
  assert.match(html, /<main id="controlMain" class="control-main handbook-main"/);
  assert.match(html, /<aside class="handbook-toc" aria-label="On this page">/);
  const toc = html.slice(html.indexOf('class="handbook-toc"'), html.indexOf('</aside>', html.indexOf('class="handbook-toc"')));
  assert.equal((toc.match(/<a href="#/g) || []).length, 10);
  assert.match(home, /\.handbook-toc \{ display: none; \}/);
  assert.match(home, /@container control-main \(min-width: 1100px\) \{[\s\S]*?\.handbook-toc \{ display: block; position: sticky;/);
  assert.match(read('app.js'), /querySelectorAll\('\.handbook-toc a\[href\^="#"\]'\)/);
});

test('Handbook delegates theme choice to the shared theme controls and only persists explicit choices', () => {
  const js = read('app.js');
  assert.doesNotMatch(js, /applyTheme|menuBtn|menuNarrow|side\.classList/);
  assert.match(js, /installShell\(\{ currentPath: '\/handbook' \}\)/);
  const theme = read('control-theme.js');
  assert.match(theme, /if \(persist\) storage\?\.setItem\?\.\(STORAGE_KEY, resolved\.preference\)/);
  assert.match(theme, /apply\(button\.dataset\.themeChoice, \{ persist: true \}\)/);
  assert.match(theme, /apply\('system'\)/);
  assert.match(theme, /apply\(currentPreference\);/);
  assert.match(theme, /themeColor\.content = resolved\.theme === 'dark' \? '#0f0f11' : '#fcfcfb'/);
});

test('Handbook drawer is the shared shell drawer: inert background, focus return and Escape', () => {
  const shell = read('control-shell.js');
  const navigation = read('control-navigation.js');
  assert.match(shell, /background: \(\) => \[main, topbar\]/);
  assert.match(shell, /trigger: menuButton/);
  assert.match(navigation, /opener\?\.focus\?\.\(\)/);
  assert.match(navigation, /event\.key === 'Escape'/);
  assert.match(navigation, /setBackgroundInert\(true\)/);
});
