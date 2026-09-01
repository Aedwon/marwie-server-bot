const COMMAND_TASKS = Object.freeze([
  Object.freeze({
    key: 'reputation-award',
    title: 'Adjust member reputation',
    command: '/reputation award',
    href: '/commands#command-reputation-award',
    description: 'Use Discord when a staff member needs to make a manual reputation adjustment.',
  }),
  Object.freeze({
    key: 'ticket-panel-post',
    title: 'Refresh the ticket panel',
    command: '/ticket-panel post',
    href: '/commands#command-ticket-panel-post',
    description: 'Use Discord to post or refresh the configured ticket panel.',
  }),
  Object.freeze({
    key: 'ai-source-poll',
    title: 'Poll AI feeds manually',
    command: '/ai-source poll',
    href: '/commands#command-ai-source-poll',
    description: 'Use Discord to fetch candidates, review the preview, then Post or Cancel.',
  }),
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusLabel(value) {
  return ({
    queued: 'Queued',
    claimed: 'In progress',
    completed: 'Completed',
    failed: 'Failed',
    rejected: 'Rejected',
  })[String(value)] || 'Unknown';
}

function actorLabel(actor, currentActorId) {
  const id = String(actor?.id || '');
  if (id && currentActorId && id === String(currentActorId)) return 'You';
  return id ? `Discord user ${id}` : 'Discord user unavailable';
}

function timestampLabel(value) {
  const raw = String(value || '');
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) return raw || 'Time unavailable';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return raw;
  }
}

export function commandsPageMarkup() {
  const items = COMMAND_TASKS.map(task => `
    <li class="control-command-item" data-command-task="${task.key}">
      <div class="control-command-goal"><span class="control-command-kicker">Task</span><h2>${escapeHtml(task.title)}</h2><p>${escapeHtml(task.description)}</p></div>
      <code class="control-command-chip">${escapeHtml(task.command)}</code>
      <a class="control-inline-action control-command-action" href="${task.href}">Open guide</a>
    </li>`).join('');

  return `<section class="control-page-section control-commands-page">
    <h1>Commands</h1>
    <p class="control-page-intro">Administrative tasks that stay in Discord, organized by the outcome staff are trying to achieve.</p>
    <div class="control-command-table"><div class="control-command-table-head" aria-hidden="true"><span>Goal</span><span>Discord command</span><span>Reference</span></div><ul class="control-command-list">${items}</ul></div>
    <p class="control-secondary-footer"><a class="control-inline-action" href="/commands">Open the full Commands manual</a></p>
  </section>`;
}

function activityFailureMarkup(failure) {
  if (!failure?.message) return '';
  const reference = failure.reference
    ? ` <span class="control-activity-reference">Reference: ${escapeHtml(failure.reference)}</span>`
    : '';
  return `<p class="control-activity-failure"><strong>Failure:</strong> ${escapeHtml(failure.message)}${reference}</p>`;
}

function activityItemMarkup(item, currentActorId) {
  const timestamp = String(item?.timestamp || '');
  return `<li class="control-activity-item">
    <p class="control-activity-summary">${escapeHtml(item?.summary || 'Performed a Control action')}</p>
    <div class="control-activity-meta">
      <span><span class="control-activity-meta-label">Actor</span> ${escapeHtml(actorLabel(item?.actor, currentActorId))}</span>
      <span><span class="control-activity-meta-label">Status</span> <span class="control-activity-status">${escapeHtml(statusLabel(item?.status))}</span></span>
      <span><span class="control-activity-meta-label">Time</span> <time datetime="${escapeHtml(timestamp)}">${escapeHtml(timestampLabel(timestamp))}</time></span>
    </div>
    ${activityFailureMarkup(item?.failure)}
  </li>`;
}

function activityErrorMarkup(error) {
  if (!error) return '';
  return `<div class="control-activity-error" role="alert">
    <p>${escapeHtml(error)}</p>
    <button type="button" class="control-secondary-button" data-activity-retry>Retry</button>
  </div>`;
}

export function activityPageMarkup(state = {}) {
  const phase = state.phase || 'idle';
  const items = Array.isArray(state.items) ? state.items : [];
  let body = '';

  if ((phase === 'idle' || phase === 'loading') && items.length === 0) {
    body = '<p class="control-activity-loading" role="status">Loading activity…</p>';
  } else if (phase === 'error' && items.length === 0) {
    body = activityErrorMarkup(state.error || 'Activity could not be loaded.');
  } else if (phase === 'ready' && items.length === 0) {
    body = '<p class="control-activity-empty">No administrative activity yet.</p>';
  } else {
    body = `<ol class="control-activity-list">${items.map(item => activityItemMarkup(item, state.actorId)).join('')}</ol>`;
    if (state.error) body += activityErrorMarkup(state.error);
    if (state.nextCursor) {
      body += `<div class="control-activity-pagination"><button type="button" class="control-secondary-button" data-activity-load-more${state.loadingMore ? ' disabled aria-disabled="true"' : ''}>${state.loadingMore ? 'Loading…' : 'Load more'}</button></div>`;
    }
  }

  return `<section class="control-page-section control-activity-page">
    <h1>Activity</h1>
    <p class="control-page-intro">A chronological history of administrative changes in this server.</p>
    ${body}
  </section>`;
}

export function createActivityController({ guildId, actorId = null, loadPage, onChange = () => {} }) {
  const state = {
    phase: 'idle',
    actorId: actorId ? String(actorId) : null,
    items: [],
    nextCursor: null,
    error: null,
    loadingMore: false,
  };
  let inFlight = null;
  let retryRequest = null;

  const notify = () => onChange(state);

  function load({ cursor = null, append = false } = {}) {
    if (!guildId) return Promise.resolve(null);
    if (inFlight) return inFlight;
    if (append && !cursor) return Promise.resolve(null);

    state.error = null;
    if (append) state.loadingMore = true;
    else state.phase = 'loading';
    notify();

    const request = (async () => {
      try {
        const page = await loadPage(String(guildId), { cursor });
        const pageItems = Array.isArray(page?.items) ? page.items : [];
        state.items = append ? [...state.items, ...pageItems] : pageItems;
        state.nextCursor = page?.next_cursor || null;
        state.phase = 'ready';
        state.error = null;
        state.loadingMore = false;
        retryRequest = null;
        return page;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Activity could not be loaded.';
        state.loadingMore = false;
        if (!append) state.phase = 'error';
        retryRequest = { cursor, append };
        return null;
      } finally {
        inFlight = null;
        notify();
      }
    })();

    inFlight = request;
    return request;
  }

  return {
    state,
    loadInitial() {
      return load({ cursor: null, append: false });
    },
    loadMore() {
      if (inFlight) return inFlight;
      return load({ cursor: state.nextCursor, append: true });
    },
    retry() {
      return retryRequest ? load(retryRequest) : Promise.resolve(null);
    },
  };
}

export function installActivityPage(root, controller) {
  if (!root || !controller) return () => {};
  const retry = root.querySelector?.('[data-activity-retry]');
  const loadMore = root.querySelector?.('[data-activity-load-more]');
  const onRetry = () => { void controller.retry(); };
  const onLoadMore = () => { void controller.loadMore(); };
  retry?.addEventListener('click', onRetry);
  loadMore?.addEventListener('click', onLoadMore);

  if (controller.state.phase === 'idle') void controller.loadInitial();

  return () => {
    retry?.removeEventListener('click', onRetry);
    loadMore?.removeEventListener('click', onLoadMore);
  };
}
