const root = document.documentElement;
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeColor = document.querySelector('#themeColor');
const scheme = matchMedia('(prefers-color-scheme: dark)');

const WORKFLOWS = [
  {
    id: 'workflow-setup',
    title: 'Setup & health',
    intro: 'Install, discover existing resources, verify mappings, then override only what needs manual control.',
    path: ['`/ping`', '`/setup auto`', '`/setup status`', 'Manual `/setup …` only if needed'],
    commands: [
      '/ping',
      '/setup auto',
      '/setup status',
      '/setup role-panel',
      '/setup text-channel',
      '/setup voice-channel',
      '/setup forum',
      '/setup category',
      '/setup role',
      '/setup solved-tag',
      '/setup feature',
      '/setup log-ignore',
    ],
  },
  {
    id: 'workflow-moderation',
    title: 'Moderation',
    intro: 'Review context, act, reverse when needed, and audit anonymous questions only for moderation.',
    path: ['`/history` if needed', '`/warn`, `/timeout`, `/kick`, or `/ban`', '`/unban` to reverse', '`/anonwho` for audits'],
    commands: ['/history', '/warn', '/timeout', '/kick', '/ban', '/unban', '/anonwho'],
  },
  {
    id: 'workflow-tickets',
    title: 'Tickets',
    intro: 'Define support types and publish the entry panel. Claiming, closing, reopening, and transcripts use ticket controls.',
    path: ['`/ticket-type list`', '`/ticket-type add`', '`/ticket-panel post`', 'Staff ticket controls'],
    commands: ['/ticket-type list', '/ticket-type add', '/ticket-type disable', '/ticket-panel post'],
  },
  {
    id: 'workflow-publishing',
    title: 'Publishing',
    intro: 'Publish server announcements or Mar Wie’s TikTok Live notice.',
    path: ['`/announce` for server updates', '`/live` for TikTok Live'],
    commands: ['/announce', '/live'],
  },
  {
    id: 'workflow-reputation',
    title: 'Reputation',
    intro: 'Inspect reputation, tune milestones, and make staff adjustments.',
    path: ['Review reputation', 'Adjust only if needed'],
    commands: ['/rank', '/profile', '/leaderboard', '/reputation award', '/reputation thresholds'],
  },
  {
    id: 'workflow-learning',
    title: 'Quizzes & anonymous Q&A',
    intro: 'Create and schedule quizzes; support anonymous questions. Identity audits stay under Moderation.',
    path: ['`/quiz add`', '`/quiz start` or `/quiz schedule`', '`/anonask`'],
    commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask'],
  },
  {
    id: 'workflow-collaboration',
    title: 'Coworking & collaboration',
    intro: 'Member self-service tools for focus sessions and finding collaborators.',
    path: ['`/pomodoro start`', 'Check or stop', '`/lfg`'],
    commands: ['/pomodoro start', '/pomodoro status', '/pomodoro stop', '/lfg'],
  },
  {
    id: 'workflow-operations',
    title: 'Feeds & operations',
    intro: 'Maintain AI feeds, review analytics, and select App of the Week.',
    path: ['Review sources', 'Add, poll, or disable', '`/analytics`', '`/app-of-week`'],
    commands: ['/ai-source list', '/ai-source add', '/ai-source poll', '/ai-source disable', '/analytics', '/app-of-week'],
  },
];

const SOURCE_CONTEXT_WORKFLOW = new Map([
  ['System and setup', 'workflow-setup'],
  ['Moderation', 'workflow-moderation'],
  ['Tickets and announcements', 'workflow-tickets'],
  ['Reputation', 'workflow-reputation'],
  ['Quizzes and anonymous questions', 'workflow-learning'],
  ['Coworking and collaboration', 'workflow-collaboration'],
  ['AI updates, analytics, and showcase', 'workflow-operations'],
]);

function applyTheme(pref) {
  const actual = pref === 'system' ? (scheme.matches ? 'dark' : 'light') : pref;
  root.dataset.preference = pref;
  root.dataset.theme = actual;
  themeButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === pref));
  });
  localStorage.setItem('rob-doc-theme', pref);
  if (themeColor) themeColor.content = actual === 'dark' ? '#171719' : '#ffffff';
}

themeButtons.forEach(button => {
  button.addEventListener('click', () => applyTheme(button.dataset.themeChoice));
});
scheme.addEventListener?.('change', () => {
  if (root.dataset.preference === 'system') applyTheme('system');
});
applyTheme(root.dataset.preference || 'system');

const side = document.querySelector('#sidebar');
const menuBtn = document.querySelector('#menuBtn');
function closeMenu() {
  side?.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}
menuBtn?.addEventListener('click', () => {
  const open = side?.classList.toggle('open') || false;
  menuBtn.setAttribute('aria-expanded', String(open));
});
side?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    if (innerWidth <= 900) closeMenu();
  });
});
addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
});

const escapeHtml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function inlineMarkdown(value) {
  return value.split(/(`[^`]*`)/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    }
    let safe = escapeHtml(part);
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return safe;
  }).join('');
}

function plainHeading(value) {
  return value
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map(cell => cell.trim());
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  const ids = new Map();
  let skippedDocumentTitle = false;

  function uniqueId(base) {
    const count = ids.get(base) || 0;
    ids.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  }

  function heading(level, raw) {
    const plain = plainHeading(raw);
    if (level === 1 && !skippedDocumentTitle && plain.toLowerCase() === 'rob-bot command manual') {
      skippedDocumentTitle = true;
      return '';
    }

    let tag = `h${Math.min(level + 1, 6)}`;
    let base = `manual-${slug(plain)}`;
    let className = '';
    let data = '';

    if (level === 1) {
      tag = 'h2';
      base = `section-${slug(plain)}`;
      className = 'manual-category';
    } else if (level === 2) {
      tag = 'h3';
      if (plain.startsWith('/')) {
        base = `command-${slug(plain)}`;
        className = 'command-heading';
        data = ` data-command="${escapeHtml(plain)}"`;
      }
    }

    const id = uniqueId(base);
    const link = `<a class="heading-link" href="#${id}" aria-label="Link to ${escapeHtml(plain)}">#</a>`;
    return `<${tag} id="${id}" class="${className}"${data}>${inlineMarkdown(raw)}${link}</${tag}>`;
  }

  const special = (line, next) => {
    const trimmed = line.trim();
    return !trimmed
      || /^#{1,5}\s+/.test(line)
      || /^```/.test(trimmed)
      || /^---+$/.test(trimmed)
      || /^\s*[-*]\s+/.test(line)
      || /^\s*\d+\.\s+/.test(line)
      || /^\s*>\s?/.test(line)
      || (line.includes('|') && next !== undefined && isTableSeparator(next));
  };

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,5})\s+(.*)$/);
    if (headingMatch) {
      const rendered = heading(headingMatch[1].length, headingMatch[2]);
      if (rendered) output.push(rendered);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      output.push('<hr>');
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const languageClass = language ? ` class="language-${escapeHtml(language)}"` : '';
      output.push(`<pre><code${languageClass}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      const head = headers.map(cell => `<th scope="col">${inlineMarkdown(cell)}</th>`).join('');
      const body = rows.map(row => `<tr>${headers.map((_, index) => `<td>${inlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('');
      output.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      output.push(`<ul>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      output.push(`<ol>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      output.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const paragraph = [trimmed];
    i += 1;
    while (i < lines.length && !special(lines[i], lines[i + 1])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }

  return output.join('\n');
}

function headingText(element) {
  const copy = element.cloneNode(true);
  copy.querySelector?.('.heading-link')?.remove();
  return copy.textContent.trim();
}

function regroupByWorkflow(container) {
  const original = [...container.children];
  const preamble = [];
  const commands = new Map();
  const contexts = new Map(WORKFLOWS.map(workflow => [workflow.id, []]));
  let sourceCategory = null;
  let currentCommand = null;
  let skippingOldIndex = false;

  for (const node of original) {
    if (node.matches?.('h2.manual-category')) {
      sourceCategory = headingText(node);
      currentCommand = null;
      skippingOldIndex = false;
      continue;
    }

    if (sourceCategory === null) {
      if (node.tagName === 'H3' && headingText(node) === 'Command index') {
        skippingOldIndex = true;
        continue;
      }
      if (!skippingOldIndex) preamble.push(node);
      continue;
    }

    if (node.matches?.('h3[data-command]')) {
      currentCommand = node.dataset.command;
      if (!commands.has(currentCommand)) commands.set(currentCommand, []);
      commands.get(currentCommand).push(node);
      continue;
    }

    if (node.tagName === 'H3') currentCommand = null;

    if (currentCommand) {
      commands.get(currentCommand).push(node);
      continue;
    }

    const workflowId = SOURCE_CONTEXT_WORKFLOW.get(sourceCategory);
    if (workflowId) contexts.get(workflowId).push(node);
  }

  container.replaceChildren();

  const guidanceStart = preamble.findIndex(node => node.tagName === 'H3');
  if (guidanceStart >= 0) {
    const notes = document.createElement('details');
    notes.className = 'manual-notes';
    const summary = document.createElement('summary');
    summary.textContent = 'Using this manual';
    const body = document.createElement('div');
    body.className = 'manual-notes-body';
    preamble.slice(guidanceStart).forEach(node => body.append(node));
    notes.append(summary, body);
    container.append(notes);
  }

  const assigned = new Set();
  for (const workflow of WORKFLOWS) {
    const section = document.createElement('section');
    section.className = 'workflow-section';
    section.id = workflow.id;
    section.innerHTML = `
      <div class="workflow-header">
        <h2>${escapeHtml(workflow.title)}</h2>
        <p>${escapeHtml(workflow.intro)}</p>
        <div class="workflow-path" aria-label="Typical path">
          <strong>Path</strong>
          <ol>${workflow.path.map(step => `<li>${inlineMarkdown(step)}</li>`).join('')}</ol>
        </div>
      </div>`;

    const sharedContext = contexts.get(workflow.id) || [];
    if (sharedContext.length) {
      const context = document.createElement('div');
      context.className = 'workflow-context';
      sharedContext.forEach(node => context.append(node));
      section.append(context);
    }

    const list = document.createElement('div');
    list.className = 'workflow-command-list';
    for (const command of workflow.commands) {
      const nodes = commands.get(command);
      if (!nodes) {
        console.warn(`Workflow references missing command ${command}.`);
        continue;
      }
      assigned.add(command);
      const entry = document.createElement('section');
      entry.className = 'command-entry';
      nodes.forEach(node => entry.append(node));
      list.append(entry);
    }
    section.append(list);
    container.append(section);
  }

  const unassigned = [...commands.keys()].filter(command => !assigned.has(command));
  if (unassigned.length) {
    const section = document.createElement('section');
    section.className = 'workflow-section';
    section.id = 'workflow-other';
    section.innerHTML = '<div class="workflow-header"><h2>Other</h2><p>Commands not yet assigned to a workflow.</p></div>';
    const list = document.createElement('div');
    list.className = 'workflow-command-list';
    for (const command of unassigned) {
      const entry = document.createElement('section');
      entry.className = 'command-entry';
      commands.get(command).forEach(node => entry.append(node));
      list.append(entry);
    }
    section.append(list);
    container.append(section);
    console.warn(`Unassigned workflow commands: ${unassigned.join(', ')}`);
  }

  return { sourceCount: commands.size, assignedCount: assigned.size, unassigned };
}

function labeledParagraph(entry, label) {
  return [...entry.children].find(node => {
    if (node.tagName !== 'P') return false;
    const strong = node.querySelector(':scope > strong');
    return strong?.textContent.trim() === label;
  }) || null;
}

function paragraphValueHtml(paragraph) {
  if (!paragraph) return '';
  const copy = paragraph.cloneNode(true);
  copy.querySelector(':scope > strong')?.remove();
  return copy.innerHTML.trim();
}

function shortPermission(paragraph) {
  if (!paragraph) return '';
  const value = paragraph.textContent.replace(/^Permission:\s*/i, '').trim();
  const firstSentence = value.match(/^.*?\.(?:\s|$)/)?.[0] || value;
  return firstSentence.replace(/\.$/, '').trim();
}

function structureCommandCards(container) {
  const entries = [...container.querySelectorAll('.command-entry')];

  for (const entry of entries) {
    const heading = entry.querySelector(':scope > h3[data-command]');
    if (!heading) continue;

    const command = heading.dataset.command || headingText(heading);
    const syntax = labeledParagraph(entry, 'Syntax:');
    const permission = labeledParagraph(entry, 'Permission:');
    const behavior = labeledParagraph(entry, 'What happens:');
    const searchText = entry.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

    const card = document.createElement('details');
    card.className = 'command-card';
    card.id = heading.id;
    card.dataset.command = command;
    card.dataset.search = searchText;

    const summary = document.createElement('summary');
    const permissionText = shortPermission(permission);
    summary.innerHTML = `
      <span class="command-card-topline">
        <span class="command-name"><code>${escapeHtml(command)}</code></span>
        ${permissionText ? `<span class="permission-badge">${escapeHtml(permissionText)}</span>` : ''}
      </span>
      ${syntax ? `<span class="command-syntax">${paragraphValueHtml(syntax)}</span>` : ''}
      ${behavior ? `<span class="command-description">${paragraphValueHtml(behavior)}</span>` : ''}`;

    const body = document.createElement('div');
    body.className = 'command-body';
    const extracted = new Set([heading, syntax, permission, behavior].filter(Boolean));
    [...entry.children].forEach(node => {
      if (!extracted.has(node)) body.append(node);
    });

    card.append(summary, body);
    entry.replaceWith(card);
  }

  return [...container.querySelectorAll('.command-card')];
}

function setupManualNavigation() {
  const links = [...document.querySelectorAll('.manual-nav a[href^="#"]')];
  const targets = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting && !entry.target.hidden)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach(link => {
        link.setAttribute('aria-current', String(link.getAttribute('href') === `#${visible.target.id}`));
      });
    }, { rootMargin: '-12% 0px -76% 0px' });
    targets.forEach(target => observer.observe(target));
  }
}

function setupCommandSearch(container, cards) {
  const input = document.querySelector('#commandSearch');
  const clear = document.querySelector('#commandSearchClear');
  const count = document.querySelector('#commandResultCount');
  const workflows = [...container.querySelectorAll('.workflow-section')];
  const notes = container.querySelector('.manual-notes');
  const empty = document.createElement('div');
  empty.className = 'command-empty-note';
  empty.hidden = true;
  empty.textContent = 'No commands match this search.';
  container.append(empty);

  function applyFilter() {
    const query = (input?.value || '').trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    let visible = 0;

    for (const card of cards) {
      const haystack = `${card.dataset.command || ''} ${card.dataset.search || ''}`;
      const match = terms.every(term => haystack.includes(term));
      card.hidden = !match;
      if (match) visible += 1;
    }

    for (const workflow of workflows) {
      workflow.hidden = !workflow.querySelector('.command-card:not([hidden])');
    }

    if (notes) notes.hidden = Boolean(query);
    if (clear) clear.hidden = !query;
    if (count) count.textContent = `${visible} command${visible === 1 ? '' : 's'}`;
    empty.hidden = visible !== 0;
  }

  function clearSearch() {
    if (!input) return;
    input.value = '';
    applyFilter();
    input.focus();
  }

  input?.addEventListener('input', applyFilter);
  clear?.addEventListener('click', clearSearch);
  addEventListener('keydown', event => {
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (event.key === '/' && !typing) {
      event.preventDefault();
      input?.focus();
      input?.select();
    }
    if (event.key === 'Escape' && input && (document.activeElement === input || input.value)) {
      event.preventDefault();
      clearSearch();
    }
  });

  applyFilter();
}

function revealHashTarget() {
  if (!location.hash) return;
  const target = document.querySelector(location.hash);
  if (!target) return;

  if (target.classList.contains('command-card')) {
    target.hidden = false;
    target.open = true;
    target.closest('.workflow-section')?.removeAttribute('hidden');
  }

  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start' });
    if (target.classList.contains('command-card')) {
      target.querySelector(':scope > summary')?.focus({ preventScroll: true });
    }
  });
}

async function loadManual() {
  const container = document.querySelector('#manualContent');
  if (!container) return;

  try {
    const response = await fetch('/commands.md?v=1', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    container.innerHTML = renderMarkdown(markdown);

    const result = regroupByWorkflow(container);
    const cards = structureCommandCards(container);
    const renderedCount = cards.length;
    if (result.sourceCount !== 45 || result.assignedCount !== 45 || renderedCount !== 45 || result.unassigned.length) {
      console.warn(`Expected 45 workflow-assigned slash commands. Source=${result.sourceCount}, assigned=${result.assignedCount}, rendered=${renderedCount}, unassigned=${result.unassigned.length}.`);
    }

    setupManualNavigation();
    setupCommandSearch(container, cards);
    revealHashTarget();
    addEventListener('hashchange', revealHashTarget);
  } catch (error) {
    console.error('Could not load command manual', error);
    container.innerHTML = '<div class="manual-error"><strong>Could not load commands.</strong><p>Read the <a href="/commands.md">plain Markdown manual</a>.</p></div>';
  }
}

loadManual();
