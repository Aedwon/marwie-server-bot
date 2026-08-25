const root = document.documentElement;
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeColor = document.querySelector('#themeColor');
const scheme = matchMedia('(prefers-color-scheme: dark)');

const WORKFLOWS = [
  {
    id: 'workflow-setup',
    title: 'Set up and check Rob-bot health',
    audience: 'Administrator workflow',
    intro: 'Use this when installing Rob-bot, reconnecting it to an existing server layout, checking configuration, or overriding one resource manually.',
    path: ['`/ping`', '`/setup auto`', '`/setup status`', 'Use a specific `/setup …` override only when needed'],
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
    title: 'Moderate members and investigate incidents',
    audience: 'Moderator and administrator workflow',
    intro: 'Start here when reviewing a member’s history, choosing an enforcement action, reversing a ban, or auditing an anonymous question for a legitimate moderation reason.',
    path: ['Review `/history` when context is needed', 'Choose `/warn`, `/timeout`, `/kick`, or `/ban`', 'Use `/unban` to reverse a ban', 'Use `/anonwho` only for moderation audits'],
    commands: ['/history', '/warn', '/timeout', '/kick', '/ban', '/unban', '/anonwho'],
  },
  {
    id: 'workflow-tickets',
    title: 'Set up and run support tickets',
    audience: 'Administrator setup, staff handling',
    intro: 'Use these commands to define the support topics members can choose and publish the ticket entry point. Day-to-day claiming, closing, reopening, and transcripts happen through ticket controls.',
    path: ['`/ticket-type list`', '`/ticket-type add` as needed', '`/ticket-panel post`', 'Staff use the ticket buttons to claim and close'],
    commands: ['/ticket-type list', '/ticket-type add', '/ticket-type disable', '/ticket-panel post'],
  },
  {
    id: 'workflow-publishing',
    title: 'Publish community updates',
    audience: 'Administrator and leadership workflow',
    intro: 'Use this when publishing a normal server announcement or notifying the community that Mar Wie is live on TikTok.',
    path: ['Use `/announce` for normal community announcements', 'Use `/live` for the authorized TikTok Live notice'],
    commands: ['/announce', '/live'],
  },
  {
    id: 'workflow-reputation',
    title: 'Manage reputation and build-help recognition',
    audience: 'Community operations workflow',
    intro: 'Use these commands to inspect reputation, tune milestone roles, make staff adjustments, and recognize a helper whose build-help reply solved a problem.',
    path: ['Review `/rank`, `/profile`, or `/leaderboard`', 'Adjust thresholds or award points only when needed', 'Use `/solve` for accepted build-help answers'],
    commands: ['/rank', '/profile', '/leaderboard', '/reputation award', '/reputation thresholds', '/solve'],
  },
  {
    id: 'workflow-learning',
    title: 'Run quizzes and anonymous Q&A',
    audience: 'Administrator setup with member participation',
    intro: 'Use this workflow to build and schedule learning activities and to understand the member-facing anonymous-question command. Identity audits are documented under moderation because that is the staff workflow where they belong.',
    path: ['`/quiz add`', 'Use `/quiz start` for an immediate session or `/quiz schedule` for recurring delivery', 'Members use `/anonask` for anonymous questions'],
    commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask'],
  },
  {
    id: 'workflow-collaboration',
    title: 'Coordinate coworking and collaboration',
    audience: 'Member-facing workflow staff may need to support',
    intro: 'These are self-service community tools. They are grouped here so moderators and admins can quickly understand what members are trying to do when they ask for help.',
    path: ['Use `/pomodoro start` for a focus session', 'Check or stop it with the matching Pomodoro command', 'Use `/lfg` to find collaborators'],
    commands: ['/pomodoro start', '/pomodoro status', '/pomodoro stop', '/lfg'],
  },
  {
    id: 'workflow-operations',
    title: 'Maintain feeds, analytics, and showcase',
    audience: 'Administrator and community-operations workflow',
    intro: 'Use this for trusted AI feed maintenance, operational reporting, and manual App of the Week selection.',
    path: ['Review `/ai-source list`', 'Add or test sources with `/ai-source add` and `/ai-source poll`', 'Disable stale sources when needed', 'Use `/analytics` and `/app-of-week` for community operations'],
    commands: ['/ai-source list', '/ai-source add', '/ai-source poll', '/ai-source disable', '/analytics', '/app-of-week'],
  },
];

const SOURCE_CONTEXT_WORKFLOW = new Map([
  ['System and setup', 'workflow-setup'],
  ['Moderation', 'workflow-moderation'],
  ['Tickets and announcements', 'workflow-tickets'],
  ['Reputation and build-help', 'workflow-reputation'],
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
  preamble.forEach(node => container.append(node));

  const assigned = new Set();
  for (const workflow of WORKFLOWS) {
    const section = document.createElement('section');
    section.className = 'workflow-section';
    section.id = workflow.id;
    section.innerHTML = `
      <div class="workflow-header">
        <div class="workflow-audience">${escapeHtml(workflow.audience)}</div>
        <h2>${escapeHtml(workflow.title)}</h2>
        <p>${escapeHtml(workflow.intro)}</p>
        <div class="workflow-path" aria-label="Typical workflow">
          <strong>Typical path</strong>
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
    section.innerHTML = '<div class="workflow-header"><div class="workflow-audience">Reference</div><h2>Other commands</h2><p>These commands were not yet assigned to a staff workflow. They are kept here so the manual never drops newly added commands.</p></div>';
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

function setupManualNavigation() {
  const links = [...document.querySelectorAll('.manual-nav a[href^="#"]')];
  const targets = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach(link => {
        link.setAttribute('aria-current', String(link.getAttribute('href') === `#${visible.target.id}`));
      });
    }, { rootMargin: '-8% 0px -78% 0px' });
    targets.forEach(target => observer.observe(target));
  }
}

function setupCommandSearch() {
  const headings = [...document.querySelectorAll('[data-command]')];
  const options = document.querySelector('#commandOptions');
  const input = document.querySelector('#commandSearch');
  const button = document.querySelector('#commandSearchButton');

  if (options) {
    options.innerHTML = headings
      .map(heading => `<option value="${escapeHtml(heading.dataset.command || '')}"></option>`)
      .join('');
  }

  function go() {
    const query = (input?.value || '').trim().toLowerCase();
    if (!query) return;
    const target = headings.find(heading => (heading.dataset.command || '').toLowerCase() === query)
      || headings.find(heading => (heading.dataset.command || '').toLowerCase().startsWith(query))
      || headings.find(heading => (heading.dataset.command || '').toLowerCase().includes(query));
    if (!target) {
      input?.setCustomValidity('No matching Rob-bot command was found.');
      input?.reportValidity();
      return;
    }
    input?.setCustomValidity('');
    history.replaceState(null, '', `#${target.id}`);
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  input?.addEventListener('input', () => input.setCustomValidity(''));
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      go();
    }
  });
  button?.addEventListener('click', go);
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
    const renderedCount = container.querySelectorAll('[data-command]').length;
    if (result.sourceCount !== 45 || result.assignedCount !== 45 || renderedCount !== 45 || result.unassigned.length) {
      console.warn(`Expected 45 workflow-assigned slash commands. Source=${result.sourceCount}, assigned=${result.assignedCount}, rendered=${renderedCount}, unassigned=${result.unassigned.length}.`);
    }

    setupManualNavigation();
    setupCommandSearch();

    if (location.hash) {
      requestAnimationFrame(() => {
        const target = document.querySelector(location.hash);
        target?.scrollIntoView({ block: 'start' });
      });
    }
  } catch (error) {
    console.error('Could not load command manual', error);
    container.innerHTML = '<div class="manual-error"><strong>Could not load the workflow-formatted manual.</strong><p>You can still read the <a href="/commands.md">plain Markdown command manual</a>.</p></div>';
  }
}

loadManual();
