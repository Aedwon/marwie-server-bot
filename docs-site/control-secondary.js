import { controlSimplePageHeaderMarkup, disclosure, taskIndicatorMarkup } from './control-components.js?v=29';
import { controlIcon } from './control-icons.js?v=3';

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

// Completed rows say nothing. Failed and rejected show a word with a warning icon. Others show a plain word.
function activityStatusMarkup(value) {
  const status = String(value);
  if (status === 'completed') return '';
  const label = statusLabel(status);
  if (status === 'failed' || status === 'rejected') {
    return `<span class="control-activity-status" data-status="failed">${controlIcon('warning', { size: 14 })}<span>${escapeHtml(label)}</span></span>`;
  }
  return `<span class="control-activity-status" data-status="${escapeHtml(status)}">${escapeHtml(label)}</span>`;
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

// "3 hours ago" style label. Older than 30 days falls back to the date.
export function relativeTimeLabel(value, { now = Date.now(), locale } = {}) {
  const time = new Date(String(value || '')).getTime();
  if (!Number.isFinite(time)) return 'Time unavailable';
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'Just now';
  try {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
    if (abs < 30 * 86400) return formatter.format(Math.round(seconds / 86400), 'day');
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(time);
  } catch {
    return timestampLabel(value);
  }
}

function activityDetailsMarkup(item, absolute) {
  const rows = [['Time', absolute]];
  if (item?.failure?.message) rows.push(['Problem', item.failure.message]);
  if (item?.failure?.reference) rows.push(['Reference', item.failure.reference]);
  return `<dl class="control-activity-details">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}

function activityItemMarkup(item, currentActorId, { now, locale } = {}) {
  const timestamp = String(item?.timestamp || '');
  const absolute = timestampLabel(timestamp);
  const status = activityStatusMarkup(item?.status);
  const trigger = `<span class="control-activity-row"><span class="control-activity-summary">${escapeHtml(item?.summary || 'Performed a Control action')}</span><span class="control-activity-meta"><span class="control-activity-actor">${escapeHtml(actorLabel(item?.actor, currentActorId))}</span>${status}<time datetime="${escapeHtml(timestamp)}" title="${escapeHtml(absolute)}">${escapeHtml(relativeTimeLabel(timestamp, { now, locale }))}</time></span></span>`;
  return `<li class="control-activity-item" data-activity-id="${escapeHtml(item?.id ?? '')}">${disclosure({ id: `activity-${item?.id ?? timestamp}`, trigger, body: activityDetailsMarkup(item, absolute) })}</li>`;
}

function activityErrorMarkup(error) {
  if (!error) return '';
  return `<div class="control-activity-error" role="alert">
    <p>${escapeHtml(error)}</p>
    <button type="button" class="control-button control-button-secondary" data-activity-retry>Retry</button>
  </div>`;
}

export function activityPageMarkup(state = {}) {
  const phase = state.phase || 'idle';
  const items = Array.isArray(state.items) ? state.items : [];
  let body = '';

  if ((phase === 'idle' || phase === 'loading') && items.length === 0) {
    body = `<p class="control-activity-loading" role="status">${taskIndicatorMarkup({ state: 'running', size: 18, label: 'Loading activity…' })}</p>`;
  } else if (phase === 'error' && items.length === 0) {
    body = activityErrorMarkup(state.error || 'Activity could not be loaded.');
  } else if (phase === 'ready' && items.length === 0) {
    body = '<p class="control-activity-empty">No administrative activity yet.</p>';
  } else {
    body = `<ol class="control-activity-list">${items.map(item => activityItemMarkup(item, state.actorId, { now: state.now, locale: state.locale })).join('')}</ol>`;
    if (state.error) body += activityErrorMarkup(state.error);
    if (state.nextCursor) {
      const loadMoreLabel = state.loadingMore
        ? taskIndicatorMarkup({ state: 'running', size: 16, label: 'Loading…' })
        : 'Load more';
      body += `<div class="control-activity-pagination"><button type="button" class="control-button control-button-secondary" data-activity-load-more${state.loadingMore ? ' disabled aria-disabled="true"' : ''}>${loadMoreLabel}</button></div>`;
    }
  }

  return `<section class="control-page-section control-activity-page">
    ${controlSimplePageHeaderMarkup({
    title: 'Activity',
    description: 'Changes made in Control, newest first.',
  })}
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
