async function jsonRequest(url, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function randomToken(cryptoImpl = crypto) {
  return typeof cryptoImpl.randomUUID === 'function'
    ? cryptoImpl.randomUUID()
    : Array.from(cryptoImpl.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('');
}

export function pageSaveIdempotencyKey(pageKey, cryptoImpl = crypto) {
  return `page-save:${String(pageKey).replace(/[^a-z0-9]+/gi, '-').slice(-36)}:${randomToken(cryptoImpl)}`.slice(0, 100);
}

export function controlActionIdempotencyKey(actionType, cryptoImpl = crypto) {
  return `control:${String(actionType).replace(/[^a-z0-9]+/gi, '-').slice(-40)}:${randomToken(cryptoImpl)}`.slice(0, 100);
}

async function retryQueuedRequest(url, options, fetchImpl, delay) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await jsonRequest(url, options, fetchImpl);
    } catch (error) {
      if (error?.status !== 503 || attempt === 2) throw error;
      await delay(500 * (attempt + 1));
    }
  }
  throw new Error('The control action could not be queued.');
}

export async function enqueuePageSave({ guildId, csrfToken, request, idempotencyKey, fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const key = idempotencyKey || pageSaveIdempotencyKey(request.page_key);
  const options = {
    method: 'POST',
    headers: { 'X-Rob-CSRF': csrfToken },
    body: JSON.stringify({
      guild_id: String(guildId),
      idempotency_key: key,
      payload: request,
    }),
  };
  return await retryQueuedRequest('/api/page-save', options, fetchImpl, delay);
}

export async function enqueueControlAction({ guildId, csrfToken, actionType, payload, idempotencyKey, fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const key = idempotencyKey || controlActionIdempotencyKey(actionType);
  const options = {
    method: 'POST',
    headers: { 'X-Rob-CSRF': csrfToken },
    body: JSON.stringify({
      guild_id: String(guildId),
      action_type: String(actionType),
      idempotency_key: key,
      payload: payload || {},
    }),
  };
  return await retryQueuedRequest('/api/action', options, fetchImpl, delay);
}

export async function waitForAction(actionId, { fetchImpl = fetch, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), maxAttempts = 90 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await jsonRequest(`/api/action-status?id=${encodeURIComponent(actionId)}`, {}, fetchImpl);
    const action = data.action;
    if (['completed', 'failed', 'rejected'].includes(action?.status)) return action;
    await delay(1000);
  }
  throw new Error('Rob-bot did not finish the Control save in time. Refresh and retry safely.');
}

export async function loadGuildState(guildId, fetchImpl = fetch) {
  return await jsonRequest(`/api/guild-state?guild_id=${encodeURIComponent(guildId)}`, {}, fetchImpl);
}

export async function loadActivity(guildId, { cursor = null, limit = 25, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ guild_id: String(guildId), limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return await jsonRequest(`/api/activity?${params}`, {}, fetchImpl);
}
