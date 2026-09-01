import { installDrawerController } from './control-navigation.js';
import { installThemeControls } from './control-theme.js';

const root = document.documentElement;
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeColor = document.querySelector('#themeColor');
const scheme = matchMedia('(prefers-color-scheme: dark)');

const WORKFLOWS = [
  { id: 'workflow-setup', title: 'Setup & health', intro: 'Connect Discord resources, review configuration health, and adjust server settings.', commands: ['/ping', '/setup auto', '/setup status', '/setup role-panel', '/setup text-channel', '/setup voice-channel', '/setup forum', '/setup category', '/setup role', '/setup feature', '/setup log-ignore'] },
  { id: 'workflow-moderation', title: 'Moderation', intro: 'Review member history and take or reverse moderation actions.', commands: ['/history', '/warn', '/timeout', '/kick', '/ban', '/unban', '/anonwho'] },
  { id: 'workflow-tickets', title: 'Tickets', intro: 'Configure support ticket types and publish the member entry panel.', commands: ['/ticket-type list', '/ticket-type add', '/ticket-type disable', '/ticket-panel post'] },
  { id: 'workflow-publishing', title: 'Publishing', intro: 'Send server announcements and the authorized TikTok Live notice.', commands: ['/announce', '/live'] },
  { id: 'workflow-reputation', title: 'Reputation', intro: 'Review reputation, manage tiers, and make staff point adjustments.', commands: ['/rank', '/profile', '/leaderboard', '/reputation award', '/reputation thresholds'] },
  { id: 'workflow-learning', title: 'Quizzes & anonymous Q&A', intro: 'Manage quizzes and anonymous questions for the community.', commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask'] },
  { id: 'workflow-collaboration', title: 'Coworking & collaboration', intro: 'Use focus-session tools and help members find collaborators.', commands: ['/pomodoro start', '/pomodoro status', '/pomodoro stop', '/lfg'] },
  { id: 'workflow-operations', title: 'Feeds & operations', intro: 'Manage AI feed sources, review activity reporting, and spotlight showcase work.', commands: ['/ai-source list', '/ai-source add', '/ai-source poll', '/ai-source disable', '/analytics', '/app-of-week'] },
];

const COMMAND_PREVIEWS = Object.freeze({
  '/ping': Object.freeze({ permission: 'Anyone', description: 'Check whether Rob-bot is online and see how quickly it responds.' }),
  '/setup auto': Object.freeze({ permission: 'Administrator', description: 'Find existing server channels and roles, then connect clear matches automatically.' }),
  '/setup role-panel': Object.freeze({ permission: 'Administrator', description: 'Post or refresh the Live Notifications self-role panel for members.' }),
  '/setup text-channel': Object.freeze({ permission: 'Administrator', description: 'Connect a Rob-bot destination to an existing Discord text channel.' }),
  '/setup voice-channel': Object.freeze({ permission: 'Administrator', description: 'Connect a Rob-bot destination to an existing Discord voice channel.' }),
  '/setup forum': Object.freeze({ permission: 'Administrator', description: 'Connect a Rob-bot destination to an existing Discord forum.' }),
  '/setup category': Object.freeze({ permission: 'Administrator', description: 'Connect a Rob-bot destination to an existing Discord category.' }),
  '/setup role': Object.freeze({ permission: 'Administrator', description: 'Connect a Rob-bot function to an existing Discord role.' }),
  '/setup feature': Object.freeze({ permission: 'Administrator', description: 'Enable or disable one Rob-bot feature for this server.' }),
  '/setup log-ignore': Object.freeze({ permission: 'Administrator', description: 'Include or exclude a channel from message edit and delete logging.' }),
  '/setup status': Object.freeze({ permission: 'Administrator', description: 'Review which Rob-bot features are on and where server destinations are connected.' }),
  '/warn': Object.freeze({ permission: 'Moderate Members', description: 'Record a moderation warning for a member and attempt to notify them.' }),
  '/timeout': Object.freeze({ permission: 'Moderate Members', description: 'Apply a Discord timeout to a member for the requested duration and record the case.' }),
  '/kick': Object.freeze({ permission: 'Kick Members', description: 'Remove a member from the server and record the moderation action.' }),
  '/ban': Object.freeze({ permission: 'Ban Members', description: 'Ban a member or account and record the moderation action.' }),
  '/unban': Object.freeze({ permission: 'Ban Members', description: 'Remove an existing server ban and record the reversal.' }),
  '/history': Object.freeze({ permission: 'Moderate Members', description: 'Review recorded moderation history for a member.' }),
  '/ticket-type add': Object.freeze({ permission: 'Administrator', description: 'Create or update a support ticket type and ensure it is enabled.' }),
  '/ticket-type disable': Object.freeze({ permission: 'Administrator', description: 'Disable an existing support ticket type so members cannot open new tickets of that type.' }),
  '/ticket-type list': Object.freeze({ permission: 'Administrator', description: 'List the support ticket types currently enabled for the server.' }),
  '/ticket-panel post': Object.freeze({ permission: 'Administrator', description: 'Post the support ticket entry panel with its persistent Open ticket control.' }),
  '/announce': Object.freeze({ permission: 'Manage Server', description: 'Publish a server announcement to an approved destination without triggering mentions.' }),
  '/live': Object.freeze({ permission: 'Administrator · Mar Wie only', description: 'Publish the configured TikTok Live notice, with the optional Live Notifications role ping when available.' }),
  '/rank': Object.freeze({ permission: 'Anyone', description: 'Show your current reputation points and tier progress.' }),
  '/profile': Object.freeze({ permission: 'Anyone', description: 'Show reputation and profile information for yourself or another member.' }),
  '/leaderboard': Object.freeze({ permission: 'Anyone', description: 'Show the server reputation leaderboard.' }),
  '/reputation award': Object.freeze({ permission: 'Manage Server', description: 'Add or remove staff-adjusted reputation points for a member and synchronize tier roles.' }),
  '/reputation thresholds': Object.freeze({ permission: 'Manage Server', description: 'Set the Builder, Contributor, and Mentor reputation thresholds.' }),
  '/quiz add': Object.freeze({ permission: 'Manage Server', description: 'Add a multiple-choice question to the server quiz bank.' }),
  '/quiz start': Object.freeze({ permission: 'Manage Server', description: 'Post a quiz question now and open its timed answer session.' }),
  '/quiz schedule': Object.freeze({ permission: 'Manage Server', description: 'Set or update the interval used for automatic quiz posting.' }),
  '/anonask': Object.freeze({ permission: 'Anyone', description: 'Submit a question that is posted publicly without exposing the author.' }),
  '/anonwho': Object.freeze({ permission: 'Moderate Members', description: 'Resolve the author of an anonymous question for a deliberate staff audit.' }),
  '/pomodoro start': Object.freeze({ permission: 'Anyone', description: 'Start a personal Pomodoro focus session in the coworking system.' }),
  '/pomodoro status': Object.freeze({ permission: 'Anyone', description: 'Check the remaining state of your active Pomodoro session.' }),
  '/pomodoro stop': Object.freeze({ permission: 'Anyone', description: 'Stop your active Pomodoro focus session.' }),
  '/lfg': Object.freeze({ permission: 'Anyone', description: 'Post a collaboration request in the configured looking-for-group destination.' }),
  '/ai-source add': Object.freeze({ permission: 'Manage Server', description: 'Add an AI news feed source for later polling.' }),
  '/ai-source list': Object.freeze({ permission: 'Manage Server', description: 'List configured AI feed sources and their identifiers.' }),
  '/ai-source disable': Object.freeze({ permission: 'Manage Server', description: 'Disable a configured AI feed source by its identifier.' }),
  '/ai-source poll': Object.freeze({ permission: 'Manage Server', description: 'Fetch eligible feed items for review and controlled posting.' }),
  '/analytics': Object.freeze({ permission: 'Manage Server', description: 'Generate the aggregate seven-day server activity report.' }),
  '/app-of-week': Object.freeze({ permission: 'Manage Server', description: 'Spotlight an eligible showcase thread as App of the Week.' }),
});

installThemeControls({
  root,
  buttons: themeButtons,
  media: scheme,
  storage: localStorage,
  themeColor,
});

const commandDrawer = document.querySelector('#commandsNavDrawer');
const commandMenuButton = document.querySelector('#commandsMenuButton');
const commandNavClose = document.querySelector('#commandsNavClose');
const commandNarrow = matchMedia('(max-width: 944px)');

installDrawerController({
  drawer: commandDrawer,
  trigger: commandMenuButton,
  closeButton: commandNavClose,
  mediaQuery: commandNarrow,
});

commandDrawer?.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    if (commandNarrow.matches) commandNavClose?.click();
  });
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
      output.push(`<div class="control-summary-table-wrap command-detail-table-wrap"><table class="control-summary-table command-detail-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
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
  const commands = new Map();
  let currentCommand = null;

  for (const node of original) {
    if (node.matches?.('h3[data-command]')) {
      currentCommand = node.dataset.command;
      if (!commands.has(currentCommand)) commands.set(currentCommand, []);
      commands.get(currentCommand).push(node);
      continue;
    }

    if (node.matches?.('h2.manual-category') || node.tagName === 'H3') {
      currentCommand = null;
      continue;
    }

    if (currentCommand) commands.get(currentCommand).push(node);
  }

  container.replaceChildren();
  const cards = [];
  const details = new Map();
  const assigned = new Set();

  for (const workflow of WORKFLOWS) {
    const section = document.createElement('section');
    section.className = 'workflow-section';
    section.id = workflow.id;
    section.innerHTML = `<div class="workflow-header"><h2>${escapeHtml(workflow.title)}</h2><p>${escapeHtml(workflow.intro)}</p></div>`;

    const tableWrap = document.createElement('div');
    tableWrap.className = 'workflow-command-table-wrap';
    tableWrap.innerHTML = '<table class="workflow-command-table"><colgroup><col class="command-column"><col class="description-column"><col class="access-column"></colgroup><thead><tr><th scope="col">Command</th><th scope="col">Description</th><th scope="col">Access</th></tr></thead><tbody></tbody></table>';
    const table = tableWrap.querySelector('table');
    const body = table.querySelector('tbody');
    for (const command of workflow.commands) {
      if (assigned.has(command)) continue;
      const nodes = commands.get(command);
      const preview = COMMAND_PREVIEWS[command];
      if (!nodes || !preview) {
        console.warn(`Command preview is incomplete for ${command}.`);
        continue;
      }
      const heading = nodes[0];
      const row = document.createElement('tr');
      row.dataset.commandRow = command;
      row.tabIndex = 0;
      row.setAttribute('aria-label', `Open ${command} details`);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'command-card';
      card.id = heading.id;
      card.dataset.command = command;
      card.dataset.search = `${command} ${preview.permission} ${preview.description}`.toLowerCase();
      card.innerHTML = `
        <span class="command-name"><code>${escapeHtml(command)}</code></span>`;
      row.innerHTML = `<th scope="row"></th><td class="command-description">${escapeHtml(preview.description)}</td><td class="permission-badge">${escapeHtml(preview.permission)}</td>`;
      row.firstElementChild.append(card);
      body.append(row);
      cards.push(card);
      const detailNodes = nodes.slice(1).map(node => node.cloneNode(true));
      while (detailNodes.at(-1)?.matches?.('hr')) detailNodes.pop();
      details.set(command, detailNodes);
      assigned.add(command);
    }
    section.append(tableWrap);
    container.append(section);
  }

  const unassigned = [...commands.keys()].filter(command => !assigned.has(command));
  if (unassigned.length) console.warn(`Unassigned command documentation: ${unassigned.join(', ')}`);
  return { sourceCount: commands.size, assignedCount: assigned.size, unassigned, cards, details };
}

function setupManualNavigation() {
  const links = [...document.querySelectorAll('.manual-nav a[href^="#"]')];
  const targets = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting && !entry.target.hidden)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => {
      if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-12% 0px -76% 0px' });
  targets.forEach(target => observer.observe(target));
}

function setupCommandDialog(cards, details) {
  const dialog = document.querySelector('#commandDialog');
  const title = document.querySelector('#commandDialogTitle');
  const body = document.querySelector('#commandDialogBody');
  const closeButton = document.querySelector('[data-command-dialog-close]');
  if (!dialog || !title || !body || !closeButton) return { openHashTarget() {} };

  let lastTrigger = null;
  let clearHashOnClose = true;
  let restoreFocusOnClose = true;

  function setHash(id) {
    if (location.hash === `#${id}`) return;
    history.pushState(null, '', `#${id}`);
  }

  function clearCommandHash() {
    if (!location.hash.startsWith('#command-')) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  function openCommand(card, { direct = false, updateHash = true } = {}) {
    const command = card?.dataset?.command;
    const nodes = details.get(command);
    if (!command || !nodes) return;
    if (dialog.open) {
      clearHashOnClose = false;
      restoreFocusOnClose = false;
      dialog.close();
    }
    lastTrigger = direct ? null : card;
    title.textContent = command;
    body.replaceChildren(...nodes.map(node => node.cloneNode(true)));
    if (updateHash) setHash(card.id);
    dialog.showModal();
    closeButton.focus();
  }

  function requestClose({ clearHash = true, restoreFocus = true } = {}) {
    clearHashOnClose = clearHash;
    restoreFocusOnClose = restoreFocus;
    if (dialog.open) dialog.close();
  }

  closeButton.addEventListener('click', () => requestClose());
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('close', () => {
    if (clearHashOnClose) clearCommandHash();
    body.replaceChildren();
    title.textContent = '';
    const restore = restoreFocusOnClose ? lastTrigger : null;
    lastTrigger = null;
    clearHashOnClose = true;
    restoreFocusOnClose = true;
    restore?.focus();
  });

  cards.forEach(card => {
    card.addEventListener('click', () => openCommand(card));
    const row = card.closest('[data-command-row]');
    row?.addEventListener('click', event => {
      if (event.target.closest('button, a, input, select, textarea')) return;
      openCommand(card);
    });
    row?.addEventListener('keydown', event => {
      if (event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openCommand(card);
    });
  });

  function openHashTarget() {
    const id = location.hash.slice(1);
    if (!id) {
      if (dialog.open) requestClose({ clearHash: false, restoreFocus: false });
      return;
    }
    const card = cards.find(candidate => candidate.id === id);
    if (!card) return;
    card.hidden = false;
    card.closest('.workflow-section')?.removeAttribute('hidden');
    openCommand(card, { direct: true, updateHash: false });
  }

  return { openHashTarget };
}

function setupCommandSearch(container, cards, dialog) {
  const input = document.querySelector('#commandSearch');
  const clear = document.querySelector('#commandSearchClear');
  const count = document.querySelector('#commandResultCount');
  const workflows = [...container.querySelectorAll('.workflow-section')];
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
      card.closest('[data-command-row]')?.toggleAttribute('hidden', !match);
      if (match) visible += 1;
    }
    for (const workflow of workflows) workflow.hidden = !workflow.querySelector('[data-command-row]:not([hidden])');
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
    if (dialog?.open) return;
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

async function loadManual() {
  const container = document.querySelector('#manualContent');
  if (!container) return;
  try {
    const response = await fetch('/commands.md?v=1', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    container.innerHTML = renderMarkdown(await response.text());
    const result = regroupByWorkflow(container);
    const expectedCount = Object.keys(COMMAND_PREVIEWS).length;
    if (result.sourceCount !== expectedCount || result.assignedCount !== expectedCount || result.unassigned.length) {
      console.warn(`Expected ${expectedCount} unique command previews. Source=${result.sourceCount}, assigned=${result.assignedCount}, unassigned=${result.unassigned.length}.`);
    }
    setupManualNavigation();
    const dialog = document.querySelector('#commandDialog');
    setupCommandSearch(container, result.cards, dialog);
    const dialogController = setupCommandDialog(result.cards, result.details);
    dialogController.openHashTarget();
    addEventListener('hashchange', dialogController.openHashTarget);
  } catch (error) {
    console.error('Could not load command manual', error);
    container.innerHTML = '<div class="manual-error"><strong>Could not load commands.</strong><p>Read the <a href="/commands.md">plain Markdown manual</a>.</p></div>';
  }
}

loadManual();
