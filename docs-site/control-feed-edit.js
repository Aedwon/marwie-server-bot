(() => {
  let busy = false;

  function setStatus(message, tone = '') {
    const node = document.querySelector('#controlLiveStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  function dialog() {
    const node = document.querySelector('#prototypeDialog');
    return node?.querySelector('#liveDialogFields') ? node : null;
  }

  function editFeed(values) {
    const node = dialog();
    if (!node?.showModal) return Promise.resolve(null);
    document.querySelector('#liveDialogTitle').textContent = 'Edit AI feed';
    document.querySelector('#liveDialogCopy').textContent = 'Update this source. Saving also enables it.';
    document.querySelector('#liveDialogFields').innerHTML = `
      <label>Name<input id="feed-edit-name" maxlength="100" value="${escapeHtml(values.name)}"></label>
      <label>Category<input id="feed-edit-category" maxlength="50" value="${escapeHtml(values.category)}"></label>
      <label>URL<input id="feed-edit-url" maxlength="1000" value="${escapeHtml(values.url)}"></label>`;
    node.showModal();
    return new Promise(resolve => {
      node.addEventListener('close', () => {
        if (node.returnValue !== 'confirm') {
          resolve(null);
          return;
        }
        resolve({
          name: document.querySelector('#feed-edit-name')?.value.trim() || '',
          category: document.querySelector('#feed-edit-category')?.value.trim() || '',
          url: document.querySelector('#feed-edit-url')?.value.trim() || '',
        });
      }, { once: true });
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  async function waitForAction(id) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const response = await request(`/api/action-status?id=${encodeURIComponent(id)}`);
      const action = response.action;
      if (['completed', 'failed', 'rejected'].includes(action.status)) return action;
      setStatus(action.status === 'claimed' ? 'Rob-bot is applying the feed change…' : 'Feed change queued…', 'busy');
      await new Promise(resolve => setTimeout(resolve, 900));
    }
    throw new Error('Rob-bot did not finish the feed change within 45 seconds. Refresh to check current state.');
  }

  async function saveFeed(sourceId, values) {
    if (!values.name || !values.category || !/^https?:\/\/[^\s]+$/i.test(values.url)) {
      setStatus('Feed name, category, and a valid HTTP/HTTPS URL are required.', 'bad');
      return;
    }
    const session = await request('/api/session');
    if (!session.authenticated) throw new Error('Sign in with Discord to edit feeds.');
    const guildId = document.querySelector('#liveServerPicker')?.value;
    if (!guildId) throw new Error('Select a server before editing feeds.');

    setStatus('Feed change queued…', 'busy');
    const queued = await request('/api/action', {
      method: 'POST',
      headers: {
        'X-Rob-CSRF': session.csrf_token,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        guild_id: guildId,
        action_type: 'upsert_ai_source',
        payload: { source_id: sourceId, ...values },
      }),
    });
    const result = await waitForAction(queued.action.id);
    if (result.status !== 'completed') {
      const suffix = result.error_reference ? ` Reference: ${result.error_reference}.` : '';
      throw new Error(`${result.error || 'The feed was not updated.'}${suffix}`);
    }
    setStatus('Feed updated.', 'good');
    setTimeout(() => location.reload(), 500);
  }

  document.addEventListener('mouseover', event => {
    const row = event.target.closest?.('.feed-table .data-row[data-source-id]');
    if (row && !row.title) row.title = 'Click to edit this feed';
  });

  document.addEventListener('click', async event => {
    if (!window.ROB_CONTROL_LIVE || busy) return;
    const row = event.target.closest?.('.feed-table .data-row[data-source-id]');
    if (!row || event.target.closest?.('[data-source-state]')) return;

    event.preventDefault();
    const values = await editFeed({
      name: row.querySelector('b')?.textContent.trim() || '',
      category: row.querySelector('code')?.textContent.trim() || '',
      url: row.querySelector('span')?.textContent.trim() || '',
    });
    if (!values) return;

    busy = true;
    try {
      await saveFeed(row.dataset.sourceId, values);
    } catch (error) {
      setStatus(error.message, 'bad');
    } finally {
      busy = false;
    }
  });
})();
