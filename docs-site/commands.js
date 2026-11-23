import { installShell, loadShellSession } from './control-shell.js?v=3';
import { GUILD_STORAGE_KEY, pickGuild } from './control-account.js?v=2';
import { plainHeading, slug } from './control-palette.js?v=1';
import { controlIcon } from './control-icons.js?v=3';

const WORKFLOWS = [
  { id: 'workflow-setup', title: 'Setup & health', commands: ['/ping', '/setup auto', '/setup status', '/setup role-panel', '/setup text-channel', '/setup voice-channel', '/setup forum', '/setup category', '/setup role', '/setup feature', '/setup log-ignore'] },
  { id: 'workflow-moderation', title: 'Moderation', commands: ['/history', '/warn', '/timeout', '/kick', '/ban', '/unban', '/anonwho'] },
  { id: 'workflow-tickets', title: 'Tickets', commands: ['/ticket-type list', '/ticket-type add', '/ticket-type disable', '/ticket-panel post'] },
  { id: 'workflow-publishing', title: 'Publishing', commands: ['/announce', '/live'] },
  { id: 'workflow-reputation', title: 'Reputation', commands: ['/rank', '/profile', '/leaderboard', '/reputation award', '/reputation thresholds'] },
  { id: 'workflow-learning', title: 'Quizzes & anonymous Q&A', commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask'] },
  { id: 'workflow-collaboration', title: 'Coworking & collaboration', commands: ['/pomodoro start', '/pomodoro status', '/pomodoro stop', '/lfg'] },
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

// The top bar, sidebar, theme, drawer and palette come from the shared Control shell.
const shell = installShell({ currentPath: '/commands' });
loadShellSession().then(session => {
  shell?.renderIdentity({ session, guild: pickGuild(session, localStorage.getItem(GUILD_STORAGE_KEY)) });
});

// The search shortcut yields to the command palette and to the navigation drawer.
const overlayOpen = () => document.querySelector('#controlPalette')?.dataset.open === 'true'
  || (document.querySelector('.control-shell')?.dataset.navMode === 'drawer'
    && document.querySelector('#controlNavDrawer')?.dataset.open === 'true');

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


const LABELS = Object.freeze({
  syntax: /^Syntax:/i,
  options: /^Parameters:/i,
  example: /^Example usage/i,
});

// Splits one command's manual nodes into what shows first and what waits behind "More details".
function splitCommandDetails(nodes) {
  const groups = { syntax: [], options: [], example: [], more: [] };
  let mode = 'more';
  for (const node of nodes) {
    const label = node.matches?.('p') && node.firstElementChild?.matches?.('strong') ? node.textContent.trim() : '';
    if (label) {
      mode = Object.keys(LABELS).find(key => LABELS[key].test(label)) || 'more';
    }
    if (node.matches?.('.command-detail-table-wrap')) groups.options.push(node);
    else groups[mode].push(node);
  }
  return groups;
}

function detailsMarkup(nodes) {
  const groups = splitCommandDetails(nodes);
  const html = list => list.map(node => node.outerHTML).join('');
  const more = groups.more.length
    ? `<div class="control-disclosure command-more" data-disclosure="more" data-open="false"><button type="button" class="control-disclose" data-command-toggle aria-expanded="false">More details${controlIcon('chevron', { size: 12, className: 'control-disclose-chev' })}</button><div class="control-reveal"><div inert data-disclosure-body>${html(groups.more)}</div></div></div>`
    : '';
  return `<div class="command-detail">${html(groups.syntax)}${html(groups.options)}${html(groups.example)}${more}</div>`;
}

function rowMarkup(command, preview, id, nodes) {
  const bodyId = `${id}-details`;
  return `<li class="command-row control-disclosure" id="${id}" data-command-row data-command="${escapeHtml(command)}" data-search="${escapeHtml(`${command} ${preview.permission} ${preview.description}`.toLowerCase())}" data-disclosure="${id}" data-open="false">
    <button type="button" class="control-disclose command-trigger" data-command-toggle aria-expanded="false" aria-controls="${bodyId}">
      <span class="command-name"><code>${escapeHtml(command)}</code></span>
      <span class="command-what">${escapeHtml(preview.description)}</span>
      <span class="command-who"><span class="sr-only">Who can use it: </span>${escapeHtml(preview.permission)}</span>
      ${controlIcon('chevron', { size: 12, className: 'control-disclose-chev' })}
    </button>
    <div class="control-reveal" id="${bodyId}"><div inert data-disclosure-body>${detailsMarkup(nodes)}</div></div>
  </li>`;
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

  const assigned = new Set();
  const sections = [];
  for (const workflow of WORKFLOWS) {
    const rows = [];
    for (const command of workflow.commands) {
      if (assigned.has(command)) continue;
      const nodes = commands.get(command);
      const preview = COMMAND_PREVIEWS[command];
      if (!nodes || !preview) {
        console.warn(`Command preview is incomplete for ${command}.`);
        continue;
      }
      const detailNodes = nodes.slice(1);
      while (detailNodes.at(-1)?.matches?.('hr')) detailNodes.pop();
      rows.push(rowMarkup(command, preview, nodes[0].id, detailNodes));
      assigned.add(command);
    }
    sections.push(`<section class="workflow-section" id="${workflow.id}" aria-labelledby="${workflow.id}-title">
      <h2 id="${workflow.id}-title">${escapeHtml(workflow.title)}</h2>
      ${workflow.intro ? `<p class="workflow-intro">${escapeHtml(workflow.intro)}</p>` : ''}
      <ul class="command-list">${rows.join('')}</ul>
    </section>`);
  }
  container.innerHTML = `${sections.join('')}<p class="command-empty-note" hidden>No commands match this search.</p>`;

  const unassigned = [...commands.keys()].filter(command => !assigned.has(command));
  if (unassigned.length) console.warn(`Unassigned command documentation: ${unassigned.join(', ')}`);
  return {
    sourceCount: commands.size,
    assignedCount: assigned.size,
    unassigned,
    rows: [...container.querySelectorAll('[data-command-row]')],
  };
}

// Opens or closes one disclosure (a command row or its "More details").
function setDisclosure(container, open) {
  container.dataset.open = String(open);
  container.querySelector(':scope > [data-command-toggle]')?.setAttribute('aria-expanded', String(open));
  const body = container.querySelector(':scope > .control-reveal > [data-disclosure-body]');
  if (body) body.inert = !open;
}

function setupCommandRows(container, rows) {
  const syncHash = (row, open) => {
    if (open && location.hash !== `#${row.id}`) history.replaceState(null, '', `#${row.id}`);
    else if (!open && location.hash === `#${row.id}`) history.replaceState(null, '', `${location.pathname}${location.search}`);
  };
  container.addEventListener('click', event => {
    const toggle = event.target.closest?.('[data-command-toggle]');
    if (!toggle) return;
    const disclosure = toggle.closest('.control-disclosure');
    const open = disclosure.dataset.open !== 'true';
    setDisclosure(disclosure, open);
    if (disclosure.matches('[data-command-row]')) syncHash(disclosure, open);
  });
  return {
    // /commands#command-<slug> opens that row and brings it into view.
    openHashTarget() {
      const row = rows.find(candidate => candidate.id === location.hash.slice(1));
      if (!row) return null;
      row.hidden = false;
      row.closest('.workflow-section')?.removeAttribute('hidden');
      setDisclosure(row, true);
      row.scrollIntoView({ block: 'start' });
      return row;
    },
  };
}

function setupCommandSearch(container, rows) {
  const input = document.querySelector('#commandSearch');
  const count = document.querySelector('#commandResultCount');
  const sections = [...container.querySelectorAll('.workflow-section')];
  const empty = container.querySelector('.command-empty-note');
  if (input) input.placeholder = `Search ${rows.length} commands`;

  function applyFilter() {
    const terms = (input?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const row of rows) {
      const match = terms.every(term => row.dataset.search.includes(term));
      row.hidden = !match;
      if (match) visible += 1;
    }
    for (const section of sections) section.hidden = !section.querySelector('[data-command-row]:not([hidden])');
    if (count) count.textContent = terms.length ? `${visible} command${visible === 1 ? '' : 's'}` : '';
    if (empty) empty.hidden = visible !== 0;
  }

  function clearSearch() {
    if (!input) return;
    input.value = '';
    applyFilter();
    input.focus();
  }

  input?.addEventListener('input', applyFilter);
  addEventListener('keydown', event => {
    if (event.defaultPrevented || overlayOpen()) return;
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
  return { clear: () => { if (input) { input.value = ''; applyFilter(); } } };
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
    const search = setupCommandSearch(container, result.rows);
    const rows = setupCommandRows(container, result.rows);
    const openHash = () => {
      if (!location.hash.slice(1)) return;
      search.clear();
      rows.openHashTarget();
    };
    openHash();
    addEventListener('hashchange', openHash);
  } catch (error) {
    console.error('Could not load command manual', error);
    container.innerHTML = '<div class="manual-error"><strong>Could not load commands.</strong><p>Read the <a href="/commands.md">plain Markdown manual</a>.</p></div>';
  }
}

loadManual();
