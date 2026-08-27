(() => {
  window.ROB_CONTROL_LIVE = true;

  const live = {
    session: null,
    guildId: null,
    guildMeta: null,
    state: null,
    snapshot: null,
    busy: false,
  };

  const ADMIN_SECTIONS = new Set(['setup', 'features', 'tickets', 'logs']);
  const RESOURCE_KIND = {
    moderation_log: 'text', message_log: 'text', bot_log: 'text', ticket_panel: 'text',
    ticket_category: 'category', ticket_logs: 'text', create_workspace_voice: 'voice',
    temp_voice_category: 'category', coworking_lounge: 'voice', announcements: 'text',
    live_announcements: 'text', live_ping_role: 'role', role_panel: 'text', ai_updates: 'text',
    build_help_forum: 'forum', solved_tag: 'forum_tag', quiz_channel: 'text',
    anon_questions: 'text', analytics: 'text', showcase_forum: 'forum', app_of_the_week: 'text',
    collab_lfg: 'text', builder_role: 'role', contributor_role: 'role', mentor_role: 'role',
  };

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .control-live-status {
        margin-top: 12px;
        min-height: 22px;
        color: var(--muted);
        font-size: 12px;
      }
      .control-live-status[data-tone="good"] { color: #26845f; }
      .control-live-status[data-tone="bad"] { color: #c74444; }
      .control-live-status[data-tone="busy"] { color: var(--text); }
      .control-login {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        text-decoration: none;
      }
      .control-disabled { opacity: .58; }
      .control-disabled :is(input, select, textarea, button) { pointer-events: none; }
      .live-user-actions { display:flex; gap:8px; align-items:center; }
      .live-user-actions button { min-height:32px; padding:0 10px; }
      .dialog-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
      .live-dialog-fields { display:grid; gap:10px; margin-top:14px; }
      .live-dialog-fields label { display:grid; gap:5px; font-size:12px; color:var(--muted); }
      .live-dialog-fields input, .live-dialog-fields textarea, .live-dialog-fields select {
        width:100%; min-height:42px; border-radius:10px; padding:9px 11px;
      }
      .ticket-state-action, .feed-state-action {
        border:0; background:transparent; padding:0; font:inherit; cursor:pointer;
      }
      .ticket-table .data-row:not(.head), .feed-table .data-row:not(.head) { cursor:pointer; }
      .notification-panel-editor .runtime-note { color:var(--muted); }
    `;
    document.head.appendChild(style);
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

  function status(message, tone = '') {
    const node = document.querySelector('#controlLiveStatus');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.tone = tone;
  }

  function prepareShell() {
    const strip = document.querySelector('.prototype-strip');
    if (strip) strip.innerHTML = '<strong>Live Control</strong><span>Discord-authenticated · actions executed by Rob-bot</span>';
    const lede = document.querySelector('.control-title-row .lede');
    if (lede) lede.textContent = 'Configure the selected Discord server through Rob-bot.';
    document.querySelectorAll('.prototype-caption').forEach(node => { node.textContent = 'Live'; });
    const footer = document.querySelector('.control-doc > footer');
    if (footer) footer.innerHTML = 'Rob-bot Handbook · <a href="/">Home</a> · <a href="/commands">Commands</a> · Live Control';
    const health = document.querySelector('#healthStrip');
    if (health && !document.querySelector('#controlLiveStatus')) {
      health.insertAdjacentHTML('afterend', '<div id="controlLiveStatus" class="control-live-status" role="status" aria-live="polite"></div>');
    }
  }

  function setSectionsEnabled(enabled) {
    document.querySelectorAll('.control-section').forEach(section => {
      section.classList.toggle('control-disabled', !enabled);
      section.querySelectorAll('input, select, textarea, button').forEach(control => {
        if (!enabled && control.dataset.liveWasDisabled === undefined) {
          control.dataset.liveWasDisabled = String(control.disabled);
        }
        if (!enabled) control.disabled = true;
        else if (control.dataset.liveWasDisabled !== undefined) {
          control.disabled = control.dataset.liveWasDisabled === 'true';
          delete control.dataset.liveWasDisabled;
        }
      });
    });
  }

  function currentGuildMeta() {
    return live.session?.guilds?.find(guild => String(guild.id) === String(live.guildId)) || null;
  }

  function canAdmin() {
    return Boolean(currentGuildMeta()?.administrator);
  }

  function applyPermissionLocks() {
    if (canAdmin()) return;
    for (const id of ADMIN_SECTIONS) {
      const section = document.querySelector(`#${id}`);
      section?.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = true; });
    }
    const liveButton = document.querySelector('#liveReviewBtn');
    if (liveButton) liveButton.disabled = true;
  }

  function renderLoggedOut() {
    const identity = document.querySelector('.identity-cluster');
    if (identity) identity.innerHTML = '<a class="primary control-login" href="/api/auth/start">Sign in with Discord</a>';
    setSectionsEnabled(false);
    const health = document.querySelector('#healthStrip');
    if (health) health.innerHTML = '<div class="health-chip"><span>Control</span><b>Sign in required</b><small>Discord OAuth</small></div>';
    status('Sign in with Discord to load live server state.');
  }

  function renderIdentity() {
    const identity = document.querySelector('.identity-cluster');
    if (!identity) return;
    const guildOptions = live.session.guilds.map(guild => `<option value="${esc(guild.id)}"${String(guild.id) === String(live.guildId) ? ' selected' : ''}>${esc(guild.name)}</option>`).join('');
    const user = live.session.user;
    identity.innerHTML = `
      <label class="server-picker control-field"><span>Server</span><select id="liveServerPicker">${guildOptions}</select></label>
      <div class="mock-user">
        ${user.avatar_url ? `<img class="avatar" src="${esc(user.avatar_url)}" alt="">` : `<span class="avatar">${esc((user.name || '?')[0])}</span>`}
        <span><b>${esc(user.name)}</b><small class="live-user-actions"><span>Discord</span><button class="quiet-action" id="controlLogoutBtn" type="button">Sign out</button></small></span>
      </div>`;
    document.querySelector('#liveServerPicker')?.addEventListener('change', async event => {
      live.guildId = event.target.value;
      localStorage.setItem('rob-control-guild', live.guildId);
      await loadGuild();
    });
    document.querySelector('#controlLogoutBtn')?.addEventListener('click', logout);
  }

  async function logout() {
    try {
      await request('/api/logout', {
        method: 'POST',
        headers: { 'X-Rob-CSRF': live.session.csrf_token },
        body: '{}',
      });
    } catch (error) {
      status(error.message, 'bad');
      return;
    }
    location.reload();
  }

  function healthChip(label, value, note) {
    return `<div class="health-chip"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`;
  }

  function renderHealth() {
    const health = document.querySelector('#healthStrip');
    if (!health || !live.state) return;
    const bot = live.state.bot || {};
    const perms = bot.permissions || {};
    const permissionOk = perms.administrator || (perms.manage_channels && perms.manage_roles && perms.send_messages && perms.embed_links);
    health.innerHTML = [
      healthChip('Rob-bot', live.snapshot?.fresh ? 'Online' : 'Stale', live.snapshot?.fresh ? 'Snapshot is fresh' : 'Writes disabled'),
      healthChip('Discord', live.state.guild?.name || 'Connected', 'Authenticated'),
      healthChip('Database', live.state.advanced?.database_backend === 'postgresql' ? 'Neon Postgres' : 'SQLite', 'Worker backend'),
      healthChip('Permissions', permissionOk ? 'No blockers' : 'Review needed', permissionOk ? 'Core permissions available' : 'Some bot permissions are missing'),
    ].join('');
  }

  function resourceMap() {
    return new Map((live.state?.resources || []).map(item => [item.key, item]));
  }

  function setupMap() {
    return new Map((live.state?.setup?.resources || []).map(item => [item.key, item]));
  }

  function channelLabel(channel) {
    return ['text', 'forum'].includes(channel.kind) ? `#${channel.name}` : channel.name;
  }

  function choicesForResource(key) {
    const kind = RESOURCE_KIND[key];
    const choices = [];
    if (kind === 'role') {
      for (const role of live.state.roles || []) choices.push({ id: String(role.id), label: role.name });
    } else if (kind === 'forum_tag') {
      const setup = live.state.setup?.solved_tag;
      const resource = resourceMap().get(key);
      for (const item of [setup?.tag, resource?.id ? { id: resource.id, name: resource.name } : null]) {
        if (item?.id && !choices.some(choice => choice.id === String(item.id))) choices.push({ id: String(item.id), label: item.name || 'Solved' });
      }
    } else {
      for (const channel of live.state.channels || []) {
        if (channel.kind === kind) choices.push({ id: String(channel.id), label: channelLabel(channel) });
      }
    }
    choices.sort((a, b) => a.label.localeCompare(b.label));
    return choices;
  }

  function fillSelect(select, choices, selected, { allowNone = true, noneLabel = 'Not connected' } = {}) {
    if (!select) return;
    const value = selected ? String(selected) : '';
    select.innerHTML = `${allowNone ? `<option value="">${esc(noneLabel)}</option>` : ''}${choices.map(choice => `<option value="${esc(choice.id)}">${esc(choice.label)}</option>`).join('')}`;
    select.value = value;
    if (value && select.value !== value) {
      select.insertAdjacentHTML('beforeend', `<option value="${esc(value)}">Unknown resource (${esc(value)})</option>`);
      select.value = value;
    }
  }

  function renderSetupAndResources() {
    const counts = live.state.setup?.counts || { matched: 0, review: 0, missing: 0 };
    const metrics = document.querySelectorAll('#setup .setup-metric strong');
    if (metrics[0]) metrics[0].textContent = counts.matched;
    if (metrics[1]) metrics[1].textContent = counts.review;
    if (metrics[2]) metrics[2].textContent = counts.missing;
    const setupButton = document.querySelector('#setupReviewBtn');
    const reviewCount = Number(counts.review || 0) + Number(counts.missing || 0);
    if (setupButton) {
      setupButton.textContent = reviewCount ? `Review ${reviewCount} item${reviewCount === 1 ? '' : 's'}` : 'Setup is current';
      setupButton.disabled = !reviewCount || !canAdmin() || !live.snapshot?.fresh;
    }

    const resources = resourceMap();
    document.querySelectorAll('.resource-row[data-resource-key]').forEach(row => {
      const key = row.dataset.resourceKey;
      const item = resources.get(key);
      const select = row.querySelector('select');
      fillSelect(select, choicesForResource(key), item?.id);
      row.dataset.initial = item?.id ? String(item.id) : '';
      row.dataset.initialState = item?.exists ? 'Connected' : item?.id ? 'Stale' : 'Missing';
      const state = row.querySelector('.mapping-state');
      if (state) {
        state.textContent = item?.exists ? 'Connected' : item?.id ? 'Stale' : 'Missing';
        state.className = `mapping-state${item?.exists ? ' good' : ''}`;
      }
      if (select) select.disabled = !canAdmin() || !live.snapshot?.fresh;
    });
  }

  function renderFeatures() {
    const features = new Map((live.state.features || []).map(item => [item.name, item]));
    document.querySelectorAll('.feature-row[data-feature-key]').forEach(row => {
      const input = row.querySelector('input[type="checkbox"]');
      const record = features.get(row.dataset.featureKey);
      if (!input || !record) return;
      input.checked = Boolean(record.enabled);
      input.dataset.initialChecked = String(Boolean(record.enabled));
      input.disabled = !canAdmin() || !live.snapshot?.fresh;
      row.classList.remove('is-changed');
    });
  }

  function renderTicketResourceFields() {
    const keys = ['ticket_panel', 'ticket_category', 'ticket_logs'];
    const selects = document.querySelectorAll('#tickets > .field-grid select');
    const resources = resourceMap();
    keys.forEach((key, index) => {
      const select = selects[index];
      if (!select) return;
      select.dataset.liveResourceKey = key;
      fillSelect(select, choicesForResource(key), resources.get(key)?.id);
      select.dataset.initial = resources.get(key)?.id || '';
      select.disabled = !canAdmin() || !live.snapshot?.fresh;
    });
  }

  function renderTickets() {
    renderTicketResourceFields();
    const table = document.querySelector('.ticket-table');
    if (!table) return;
    table.innerHTML = '<div class="data-row head"><span>Key</span><span>Label</span><span>Description</span><span>State</span></div>' +
      (live.state.ticket_types || []).map(item => `
        <div class="data-row" data-ticket-key="${esc(item.key)}">
          <code>${esc(item.key)}</code><span>${esc(item.label)}</span><span>${esc(item.description)}</span>
          <button class="ticket-state-action state ${item.enabled ? 'on' : 'off'}" type="button" data-ticket-state>${item.enabled ? 'On' : 'Off'}</button>
        </div>`).join('');
  }

  function renderReputation() {
    const values = live.state.reputation?.thresholds || {};
    const fields = [
      ['#builderThreshold', values.builder],
      ['#contributorThreshold', values.contributor],
      ['#mentorThreshold', values.mentor],
    ];
    fields.forEach(([selector, value]) => {
      const input = document.querySelector(selector);
      if (!input) return;
      input.value = value ?? '';
      input.dataset.initialValue = String(value ?? '');
    });
    const member = document.querySelector('#repMember');
    if (member) {
      member.innerHTML = '<option value="">Select member…</option>' + (live.state.members || [])
        .map(item => `<option value="${esc(item.id)}">@${esc(item.name)}</option>`).join('');
    }
    const note = document.querySelector('#reputationAdjustment')?.previousElementSibling?.querySelector('small');
    if (note && !live.state.member_directory_complete) note.textContent = 'Manage Server · recently cached members';
  }

  function renderQuizzes() {
    const input = document.querySelector('#quizInterval');
    if (input) {
      input.value = live.state.quiz?.interval_hours ?? 24;
      input.dataset.initialValue = String(input.value);
    }
  }

  function renderFeeds() {
    const table = document.querySelector('.feed-table');
    if (!table) return;
    table.innerHTML = '<div class="data-row head"><span>Source</span><span>Category</span><span>URL</span><span>State</span></div>' +
      (live.state.ai_sources || []).map(item => `
        <div class="data-row" data-source-id="${esc(item.id)}">
          <b>${esc(item.name)}</b><code>${esc(item.category)}</code><span>${esc(item.url)}</span>
          <button class="feed-state-action state ${item.enabled ? 'on' : 'off'}" type="button" data-source-state>${item.enabled ? 'On' : 'Off'}</button>
        </div>`).join('');
  }

  function textChannels() {
    return (live.state.channels || []).filter(channel => channel.kind === 'text')
      .map(channel => ({ id: String(channel.id), label: `#${channel.name}` }));
  }

  function renderPublishing() {
    const resources = resourceMap();
    fillSelect(document.querySelector('#announcementChannel'), textChannels(), resources.get('announcements')?.id, { allowNone: false });
    const liveDestination = document.querySelector('#liveDestination');
    fillSelect(liveDestination, textChannels(), resources.get('live_announcements')?.id || resources.get('announcements')?.id, { allowNone: true, noneLabel: 'Configured fallback' });
    const livePing = document.querySelector('#livePing');
    const roleChoices = (live.state.roles || []).map(role => ({ id: String(role.id), label: role.name }));
    fillSelect(livePing, roleChoices, resources.get('live_ping_role')?.id, { allowNone: true, noneLabel: 'None' });
    const captions = document.querySelectorAll('#publishing .prototype-caption');
    captions.forEach(node => { node.textContent = 'Live'; });
  }

  function renderLogs() {
    const keys = ['moderation_log', 'message_log', 'bot_log'];
    const selects = document.querySelectorAll('#logs > .field-grid select');
    const resources = resourceMap();
    keys.forEach((key, index) => {
      const select = selects[index];
      if (!select) return;
      select.dataset.liveResourceKey = key;
      fillSelect(select, choicesForResource(key), resources.get(key)?.id);
      select.dataset.initial = resources.get(key)?.id || '';
      select.disabled = !canAdmin() || !live.snapshot?.fresh;
    });
    renderIgnoredChannels();
  }

  function renderIgnoredChannels() {
    const root = document.querySelector('#ignoredChannels');
    if (!root) return;
    const byId = new Map((live.state.channels || []).map(channel => [String(channel.id), channel]));
    root.innerHTML = (live.state.log_exclusions || []).map(id => {
      const channel = byId.get(String(id));
      const label = channel ? channelLabel(channel) : `Channel ${id}`;
      return `<button class="value-chip" type="button" data-token-id="${esc(id)}">${esc(label)} <span aria-hidden="true">×</span></button>`;
    }).join('');
  }

  function renderAdvanced() {
    const cards = document.querySelectorAll('#advanced .advanced-grid > div');
    const advanced = live.state.advanced || {};
    const values = [
      [advanced.environment || 'unknown', 'Read-only'],
      [advanced.database_backend === 'postgresql' ? 'Neon Postgres' : 'SQLite', advanced.database_backend === 'postgresql' ? 'Connected' : 'Migration pending'],
      [advanced.background_tasks ? 'Enabled' : 'Disabled', 'Host setting'],
      [advanced.message_content ? 'Enabled' : 'Disabled', 'Host setting'],
      ['Enabled', 'Host setting'],
      [live.state.guild?.id || 'Global', 'Discord server'],
    ];
    cards.forEach((card, index) => {
      const bold = card.querySelector('b');
      const small = card.querySelector('small');
      if (bold) bold.textContent = values[index]?.[0] || 'Unknown';
      if (small) small.textContent = values[index]?.[1] || 'Read-only';
    });
  }

  function renderNotificationPanel() {
    const existing = document.querySelector('.notification-panel-editor');
    if (!existing) return;
    const editor = existing.cloneNode(true);
    existing.replaceWith(editor);
    const panel = live.state.notification_panel || {};
    const resources = resourceMap();
    const channel = editor.querySelector('#notificationPanelChannel');
    const title = editor.querySelector('#notificationPanelTitle');
    const description = editor.querySelector('#notificationPanelDescription');
    const list = editor.querySelector('#notificationRoleList');
    const statusNode = editor.querySelector('#notificationPanelStatus');
    const save = editor.querySelector('#notificationPanelSaveBtn');
    const runtime = editor.querySelector('.runtime-note');
    if (runtime) runtime.textContent = 'Persistent · role-safe';
    fillSelect(channel, textChannels(), panel.channel_id || resources.get('role_panel')?.id, { allowNone: false });
    if (title) title.value = panel.title || 'Notification roles';
    if (description) description.value = panel.description || 'Choose the notifications you want. Press a button again to remove the role.';

    const manageableRoles = (live.state.roles || []).filter(role => !role.managed && Number(role.position) < Number(live.state.bot?.top_role_position || 0));
    let rows = (panel.buttons || []).map(item => ({
      role_id: String(item.role_id), label: item.label, emoji: item.emoji || '', style: String(item.style || 'primary').toLowerCase(),
    }));
    if (!rows.length && resources.get('live_ping_role')?.id) {
      rows = [{ role_id: String(resources.get('live_ping_role').id), label: 'Live Notifications', emoji: '', style: 'primary' }];
    }
    if (!rows.length && manageableRoles[0]) rows = [{ role_id: String(manageableRoles[0].id), label: manageableRoles[0].name, emoji: '', style: 'primary' }];
    const initial = JSON.stringify({ channel_id: channel?.value || '', title: title?.value || '', description: description?.value || '', buttons: rows });

    const roleOptions = () => manageableRoles.map(role => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('');
    function renderRows() {
      if (!list) return;
      list.innerHTML = rows.map((row, index) => `
        <div class="notification-role-row" data-live-role-index="${index}">
          <label class="control-field"><span>Role</span><select data-field="role_id">${roleOptions()}</select></label>
          <label class="control-field"><span>Button label</span><input data-field="label" maxlength="80" value="${esc(row.label)}"></label>
          <label class="control-field emoji-field"><span>Emoji</span><input data-field="emoji" maxlength="32" value="${esc(row.emoji)}" placeholder="Optional"></label>
          <label class="control-field style-field"><span>Style</span><select data-field="style"><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="success">Success</option><option value="danger">Danger</option></select></label>
          <button class="notification-remove" type="button" aria-label="Remove role button" ${rows.length <= 1 ? 'disabled' : ''}>×</button>
        </div>`).join('');
      list.querySelectorAll('[data-live-role-index]').forEach(node => {
        const index = Number(node.dataset.liveRoleIndex);
        node.querySelectorAll('[data-field]').forEach(control => {
          control.value = rows[index][control.dataset.field] || '';
          control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
            rows[index][control.dataset.field] = control.value;
            updatePanel();
          });
        });
        node.querySelector('.notification-remove')?.addEventListener('click', () => {
          if (rows.length <= 1) return;
          rows.splice(index, 1);
          renderRows();
          updatePanel();
        });
      });
    }
    function panelPayload() {
      return {
        channel_id: channel?.value || '',
        title: title?.value.trim() || '',
        description: description?.value.trim() || '',
        buttons: rows.map(row => ({ ...row })),
      };
    }
    function updatePanel() {
      const payload = panelPayload();
      const valid = payload.channel_id && payload.title && payload.description && payload.buttons.length && payload.buttons.every(row => row.role_id && row.label.trim());
      const dirty = JSON.stringify(payload) !== initial;
      if (statusNode) statusNode.textContent = !valid ? 'Complete the panel and each role button.' : dirty ? 'Panel changed.' : 'No changes';
      if (save) save.disabled = !(valid && dirty && canAdmin() && live.snapshot?.fresh);
      const previewChannel = editor.querySelector('#notificationPreviewChannel');
      const previewTitle = editor.querySelector('#notificationPreviewTitle');
      const previewDescription = editor.querySelector('#notificationPreviewDescription');
      if (previewChannel) previewChannel.textContent = textChannels().find(item => item.id === payload.channel_id)?.label || '#roles';
      if (previewTitle) previewTitle.textContent = payload.title || 'Notification roles';
      if (previewDescription) previewDescription.textContent = payload.description;
      const previewButtons = editor.querySelector('#notificationPreviewButtons');
      if (previewButtons) previewButtons.innerHTML = payload.buttons.map(row => `<button type="button" class="discord-role-button ${row.style === 'primary' ? '' : row.style}" tabindex="-1">${esc(`${row.emoji ? `${row.emoji} ` : ''}${row.label}`)}</button>`).join('');
    }
    [channel, title, description].forEach(control => {
      control?.addEventListener('input', updatePanel);
      control?.addEventListener('change', updatePanel);
    });
    editor.querySelector('#addNotificationRoleBtn')?.addEventListener('click', () => {
      const unused = manageableRoles.find(role => !rows.some(row => row.role_id === String(role.id)));
      if (!unused || rows.length >= 25) return;
      rows.push({ role_id: String(unused.id), label: unused.name, emoji: '', style: 'secondary' });
      renderRows();
      updatePanel();
    });
    save?.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (save.disabled) return;
      await queueAction('save_notification_panel', panelPayload(), 'Save notification role panel?', `Update the panel in ${textChannels().find(item => item.id === channel.value)?.label || 'the selected channel'} with ${rows.length} role button${rows.length === 1 ? '' : 's'}.`);
    });
    renderRows();
    updatePanel();
  }

  function renderAll() {
    renderHealth();
    renderSetupAndResources();
    renderFeatures();
    renderTickets();
    renderReputation();
    renderQuizzes();
    renderFeeds();
    renderPublishing();
    renderLogs();
    renderAdvanced();
    renderNotificationPanel();
    applyPermissionLocks();
  }

  function dialogNodes() {
    const dialog = document.querySelector('#prototypeDialog');
    if (!dialog) return null;
    dialog.classList.remove('prototype-dialog');
    dialog.innerHTML = `
      <form method="dialog">
        <div class="dialog-head"><span>Confirm</span><button value="cancel" aria-label="Close">×</button></div>
        <h2 id="liveDialogTitle">Confirm change</h2>
        <p id="liveDialogCopy"></p>
        <div id="liveDialogFields" class="live-dialog-fields"></div>
        <div class="dialog-actions"><button class="secondary" value="cancel">Cancel</button><button class="primary" id="liveDialogConfirm" value="confirm">Confirm</button></div>
      </form>`;
    return dialog;
  }

  const dialog = dialogNodes();
  function confirmChange(title, copy) {
    if (!dialog?.showModal) return Promise.resolve(window.confirm(`${title}\n\n${copy}`));
    document.querySelector('#liveDialogTitle').textContent = title;
    document.querySelector('#liveDialogCopy').textContent = copy;
    document.querySelector('#liveDialogFields').innerHTML = '';
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
  }

  function editForm(title, copy, fields) {
    if (!dialog?.showModal) return Promise.resolve(null);
    document.querySelector('#liveDialogTitle').textContent = title;
    document.querySelector('#liveDialogCopy').textContent = copy;
    const root = document.querySelector('#liveDialogFields');
    root.innerHTML = fields.map(field => {
      const control = field.type === 'textarea'
        ? `<textarea id="live-field-${esc(field.name)}" maxlength="${field.max || 2000}" rows="${field.rows || 3}">${esc(field.value || '')}</textarea>`
        : `<input id="live-field-${esc(field.name)}" maxlength="${field.max || 200}" value="${esc(field.value || '')}"${field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : ''}>`;
      return `<label>${esc(field.label)}${control}</label>`;
    }).join('');
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        if (dialog.returnValue !== 'confirm') { resolve(null); return; }
        const result = {};
        fields.forEach(field => { result[field.name] = document.querySelector(`#live-field-${field.name}`)?.value || ''; });
        resolve(result);
      }, { once: true });
    });
  }

  async function queueAction(actionType, payload, title, copy) {
    if (live.busy) return false;
    if (!live.snapshot?.fresh) {
      status('Rob-bot state is stale. Wait for it to reconnect before making changes.', 'bad');
      return false;
    }
    if (!(await confirmChange(title, copy))) return false;
    live.busy = true;
    status('Queued. Waiting for Rob-bot…', 'busy');
    try {
      const queued = await request('/api/action', {
        method: 'POST',
        headers: {
          'X-Rob-CSRF': live.session.csrf_token,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ guild_id: live.guildId, action_type: actionType, payload }),
      });
      const result = await waitForAction(queued.action.id);
      if (result.status === 'completed') {
        status('Change completed.', 'good');
        await new Promise(resolve => setTimeout(resolve, 700));
        await loadGuild({ quiet: true });
        return true;
      }
      const suffix = result.error_reference ? ` Reference: ${result.error_reference}.` : '';
      status(`${result.error || 'The change was not applied.'}${suffix}`, 'bad');
      return false;
    } catch (error) {
      status(error.message, 'bad');
      return false;
    } finally {
      live.busy = false;
    }
  }

  async function waitForAction(id) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const response = await request(`/api/action-status?id=${encodeURIComponent(id)}`);
      const action = response.action;
      if (['completed', 'failed', 'rejected'].includes(action.status)) return action;
      status(action.status === 'claimed' ? 'Rob-bot is applying the change…' : 'Queued. Waiting for Rob-bot…', 'busy');
      await new Promise(resolve => setTimeout(resolve, 900));
    }
    throw new Error('Rob-bot did not finish the action within 45 seconds. The action remains auditable; refresh to check current state.');
  }

  function setupSummary() {
    const lines = [];
    for (const item of live.state.setup?.resources || []) {
      if (item.action === 'create') lines.push(`Create ${item.kind}: ${item.canonical_name}`);
      if (item.action === 'remap') lines.push(`Remap ${item.canonical_name} to ${item.target?.name || 'selected resource'}`);
    }
    const solved = live.state.setup?.solved_tag;
    if (solved?.action === 'create') lines.push('Create the Solved forum tag');
    if (solved?.action === 'remap') lines.push('Remap the Solved forum tag');
    return lines.length ? lines.join(' · ') : 'No Discord mutations are currently required.';
  }

  async function handlePrototypeAction(button) {
    const action = button.dataset.prototypeAction || '';
    if (button.id === 'setupReviewBtn' || action === 'Review setup') {
      if (!live.state.setup?.needs_confirmation) return;
      await queueAction('apply_auto_setup', { plan_hash: live.state.setup.plan_hash }, 'Apply automatic setup?', setupSummary());
      return;
    }
    if (button.id === 'thresholdSaveBtn') {
      await queueAction('set_reputation_thresholds', {
        builder: Number(document.querySelector('#builderThreshold').value),
        contributor: Number(document.querySelector('#contributorThreshold').value),
        mentor: Number(document.querySelector('#mentorThreshold').value),
      }, 'Save reputation thresholds?', 'Update Builder, Contributor, and Mentor thresholds for this server.');
      return;
    }
    if (button.id === 'repReviewBtn') {
      const member = document.querySelector('#repMember');
      await queueAction('adjust_reputation', {
        member_id: member.value,
        points: Number(document.querySelector('#repPoints').value),
        reason: document.querySelector('#repReason').value,
      }, 'Apply reputation adjustment?', `${member.options[member.selectedIndex]?.text || 'Member'} · ${document.querySelector('#repPoints').value} points · ${document.querySelector('#repReason').value}`);
      return;
    }
    if (button.id === 'quizScheduleBtn') {
      await queueAction('set_quiz_schedule', { interval_hours: Number(document.querySelector('#quizInterval').value) }, 'Save quiz schedule?', `Post automatic quizzes every ${document.querySelector('#quizInterval').value} hours.`);
      return;
    }
    if (button.id === 'quizQuestionBtn') {
      await queueAction('add_quiz_question', {
        category: document.querySelector('#quizCategory').value,
        prompt: document.querySelector('#quizPrompt').value,
        options: ['#quizA', '#quizB', '#quizC', '#quizD'].map(selector => document.querySelector(selector).value),
        correct: document.querySelector('#quizCorrect').selectedIndex + 1,
        explanation: document.querySelector('#quizExplanation').value,
      }, 'Add quiz question?', document.querySelector('#quizPrompt').value);
      return;
    }
    if (button.id === 'feedAddBtn') {
      await queueAction('upsert_ai_source', {
        name: document.querySelector('#feedName').value,
        category: document.querySelector('#feedCategory').value,
        url: document.querySelector('#feedUrl').value,
      }, 'Add AI feed?', `${document.querySelector('#feedName').value} · ${document.querySelector('#feedUrl').value}`);
      return;
    }
    if (button.id === 'announcementReviewBtn') {
      const rawMessage = document.querySelector('#announcementMessage')?.value || '';
      let resolved;
      try { resolved = resolveMentions(rawMessage); } catch (error) { status(error.message, 'bad'); return; }
      await queueAction('send_announcement', {
        channel_id: document.querySelector('#announcementChannel').value,
        message: resolved.message,
        title: document.querySelector('#announcementTitle').value,
        body: document.querySelector('#announcementBody').value,
        footer: document.querySelector('#announcementFooter').value,
        color: document.querySelector('#announcementColor').value,
        mentions: resolved.mentions,
      }, 'Send announcement?', `Send once to ${document.querySelector('#announcementChannel').options[document.querySelector('#announcementChannel').selectedIndex]?.text || 'the selected channel'}.`);
      return;
    }
    if (button.id === 'liveReviewBtn') {
      await queueAction('post_live', {
        channel_id: document.querySelector('#liveDestination').value || null,
        ping_role_id: document.querySelector('#livePing').value || null,
        topic: document.querySelector('#liveTopic').value,
      }, 'Post Live notice?', `Post once to ${document.querySelector('#liveDestination').options[document.querySelector('#liveDestination').selectedIndex]?.text || 'the configured fallback'}.`);
      return;
    }
    if (action === 'Post ticket panel') {
      await queueAction('refresh_ticket_panel', {}, 'Post ticket panel?', 'Post a fresh member ticket panel in the configured ticket panel channel.');
      return;
    }
    if (action === 'Poll feeds') {
      await queueAction('poll_ai_sources', {}, 'Poll AI feeds now?', 'Check all enabled feeds and post any new items.');
      return;
    }
    if (action === 'Add ticket type') {
      const values = await editForm('Add ticket type', 'Create or re-enable a ticket type.', [
        { name: 'key', label: 'Key', max: 32, placeholder: 'support' },
        { name: 'label', label: 'Label', max: 80, placeholder: 'Support' },
        { name: 'description', label: 'Description', max: 200, placeholder: 'General help from staff.' },
      ]);
      if (!values) return;
      await queueAction('upsert_ticket_type', values, 'Save ticket type?', `${values.key} · ${values.label}`);
      return;
    }
    if (action === 'Add ignored channel') {
      const available = textChannels().filter(channel => !(live.state.log_exclusions || []).includes(channel.id));
      if (!available.length) { status('All text channels are already excluded.', 'bad'); return; }
      const chosen = window.prompt(`Enter the exact channel name or ID to exclude:\n${available.slice(0, 20).map(item => item.label).join(', ')}`);
      if (!chosen) return;
      const match = available.find(item => item.id === chosen.trim() || item.label.toLowerCase() === chosen.trim().toLowerCase());
      if (!match) { status('That channel could not be resolved.', 'bad'); return; }
      await saveLogExclusions([...(live.state.log_exclusions || []), match.id]);
    }
  }

  function resolveMentions(raw) {
    let message = raw;
    const roleIds = [];
    const userIds = [];
    const everyone = /(^|\s)@everyone(?=\s|$|[.,!?])/i.test(message);
    const here = /(^|\s)@here(?=\s|$|[.,!?])/i.test(message);
    const candidates = [
      ...(live.state.roles || []).map(role => ({ type: 'role', id: String(role.id), name: role.name })),
      ...(live.state.members || []).map(member => ({ type: 'user', id: String(member.id), name: member.name })),
    ].sort((a, b) => b.name.length - a.name.length);
    for (const item of candidates) {
      const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)@${escaped}(?=\\s|$|[.,!?])`, 'gi');
      if (!regex.test(message)) continue;
      message = message.replace(regex, (_, prefix) => `${prefix}${item.type === 'role' ? `<@&${item.id}>` : `<@${item.id}>`}`);
      (item.type === 'role' ? roleIds : userIds).push(item.id);
    }
    const unresolved = message.match(/(^|\s)@([A-Za-z0-9_.-]+)(?=\s|$|[.,!?])/);
    if (unresolved && !['everyone', 'here'].includes(unresolved[2].toLowerCase())) {
      throw new Error(`Could not resolve @${unresolved[2]} to a server role or cached member.`);
    }
    return {
      message,
      mentions: { everyone, here, role_ids: [...new Set(roleIds)], user_ids: [...new Set(userIds)] },
    };
  }

  async function saveLogExclusions(ids) {
    await queueAction('set_log_exclusions', { channel_ids: [...new Set(ids.map(String))] }, 'Save message-log exclusions?', `Exclude ${ids.length} channel${ids.length === 1 ? '' : 's'} from edit/delete mirroring.`);
  }

  async function onResourceChange(select, key, previous) {
    const value = select.value;
    const label = select.options[select.selectedIndex]?.text || 'Not connected';
    const ok = await queueAction(
      value ? 'set_resource' : 'clear_resource',
      value ? { key, discord_id: value } : { key },
      value ? `Change ${key}?` : `Clear ${key}?`,
      value ? `Bind ${key} to ${label}.` : `Remove the saved ${key} mapping.`,
    );
    if (!ok) select.value = previous;
  }

  function bindLiveEvents() {
    document.querySelectorAll('.resource-row[data-resource-key] select').forEach(select => {
      if (select.dataset.liveBound) return;
      select.dataset.liveBound = 'true';
      select.addEventListener('change', () => onResourceChange(select, select.closest('.resource-row').dataset.resourceKey, select.closest('.resource-row').dataset.initial));
    });
    document.querySelectorAll('select[data-live-resource-key]').forEach(select => {
      if (select.dataset.liveBound) return;
      select.dataset.liveBound = 'true';
      select.addEventListener('change', () => onResourceChange(select, select.dataset.liveResourceKey, select.dataset.initial));
    });
    document.querySelectorAll('.feature-row[data-feature-key] input[type="checkbox"]').forEach(input => {
      if (input.dataset.liveBound) return;
      input.dataset.liveBound = 'true';
      input.addEventListener('change', async () => {
        const previous = input.dataset.initialChecked === 'true';
        const key = input.closest('.feature-row').dataset.featureKey;
        const ok = await queueAction('set_feature', { feature: key, enabled: input.checked }, `${input.checked ? 'Enable' : 'Disable'} ${key}?`, `Change the ${key} feature switch for this server.`);
        if (!ok) input.checked = previous;
      });
    });
  }

  document.addEventListener('click', async event => {
    const prototype = event.target.closest?.('.prototype-action');
    if (prototype) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!prototype.disabled) await handlePrototypeAction(prototype);
      return;
    }
    const chip = event.target.closest?.('.value-chip[data-token-id]');
    if (chip) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await saveLogExclusions((live.state.log_exclusions || []).filter(id => String(id) !== String(chip.dataset.tokenId)));
      return;
    }
    const ticketState = event.target.closest?.('[data-ticket-state]');
    if (ticketState) {
      event.preventDefault(); event.stopPropagation();
      const row = ticketState.closest('[data-ticket-key]');
      const item = (live.state.ticket_types || []).find(entry => entry.key === row.dataset.ticketKey);
      if (!item) return;
      await queueAction(item.enabled ? 'disable_ticket_type' : 'upsert_ticket_type', item.enabled ? { key: item.key } : { key: item.key, label: item.label, description: item.description }, `${item.enabled ? 'Disable' : 'Enable'} ${item.label}?`, `Change the ${item.key} ticket type state.`);
      return;
    }
    const ticketRow = event.target.closest?.('.ticket-table .data-row[data-ticket-key]');
    if (ticketRow && !event.target.closest('[data-ticket-state]')) {
      const item = (live.state.ticket_types || []).find(entry => entry.key === ticketRow.dataset.ticketKey);
      if (!item || !canAdmin()) return;
      const values = await editForm('Edit ticket type', `Update ${item.key}. Saving also enables the type.`, [
        { name: 'key', label: 'Key', value: item.key, max: 32 },
        { name: 'label', label: 'Label', value: item.label, max: 80 },
        { name: 'description', label: 'Description', value: item.description, max: 200 },
      ]);
      if (values) await queueAction('upsert_ticket_type', values, 'Save ticket type?', `${values.key} · ${values.label}`);
      return;
    }
    const sourceState = event.target.closest?.('[data-source-state]');
    if (sourceState) {
      event.preventDefault(); event.stopPropagation();
      const row = sourceState.closest('[data-source-id]');
      const item = (live.state.ai_sources || []).find(entry => String(entry.id) === String(row.dataset.sourceId));
      if (!item) return;
      await queueAction(item.enabled ? 'disable_ai_source' : 'upsert_ai_source', item.enabled ? { source_id: item.id } : { source_id: item.id, name: item.name, category: item.category, url: item.url }, `${item.enabled ? 'Disable' : 'Enable'} ${item.name}?`, item.url);
    }
  }, true);

  async function loadGuild({ quiet = false } = {}) {
    if (!live.guildId) return;
    setSectionsEnabled(false);
    if (!quiet) status('Loading live server state…', 'busy');
    try {
      const response = await request(`/api/guild-state?guild_id=${encodeURIComponent(live.guildId)}`);
      live.state = response.state;
      live.snapshot = response.snapshot;
      renderAll();
      setSectionsEnabled(Boolean(response.snapshot.fresh));
      applyPermissionLocks();
      bindLiveEvents();
      if (!quiet) status(response.snapshot.fresh ? 'Live state loaded.' : 'State loaded, but Rob-bot has not refreshed it recently. Writes are disabled.', response.snapshot.fresh ? 'good' : 'bad');
    } catch (error) {
      live.state = null;
      live.snapshot = null;
      status(error.message, 'bad');
      setSectionsEnabled(false);
    }
  }

  async function boot() {
    injectStyle();
    prepareShell();
    setSectionsEnabled(false);
    try {
      const session = await request('/api/session');
      if (!session.authenticated) {
        renderLoggedOut();
        return;
      }
      live.session = session;
      if (!session.guilds.length) {
        renderIdentity();
        status('No Discord server is currently both manageable by you and reporting Rob-bot control state.', 'bad');
        return;
      }
      const remembered = localStorage.getItem('rob-control-guild');
      live.guildId = session.guilds.some(guild => String(guild.id) === remembered) ? remembered : String(session.guilds[0].id);
      renderIdentity();
      await loadGuild();
    } catch (error) {
      renderLoggedOut();
      status(error.message, 'bad');
    }
  }

  boot();
})();
