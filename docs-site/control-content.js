import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';

export const CONTENT_PAGE_CONFIGS = Object.freeze({
  '/control/content/feeds': Object.freeze({
    title: 'Feeds',
    feature: 'ai_updates',
    kind: 'feeds',
  }),
  '/control/content/announcements': Object.freeze({
    title: 'Announcements',
    feature: 'announcements',
    kind: 'announcements',
  }),
  '/control/content/live': Object.freeze({
    title: 'Live',
    feature: 'live_announcements',
    kind: 'live',
  }),
});

let sourceSequence = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function featureEnabled(snapshot, feature) {
  const row = (snapshot?.features || []).find(item => item?.name === feature);
  return Boolean(row?.enabled);
}

function resource(snapshot, key) {
  return (snapshot?.resources || []).find(item => item?.key === key) || null;
}

function mappedResourceId(snapshot, key) {
  const row = resource(snapshot, key);
  return row?.id && row.exists ? String(row.id) : null;
}

function mappedResourceLabel(snapshot, key, fallback) {
  const row = resource(snapshot, key);
  if (!row?.id) return `Not connected — configure ${fallback} in Mappings`;
  if (!row.exists) return `Unavailable mapping — review ${fallback} in Mappings`;
  return row.name ? `#${row.name}` : 'Connected Discord resource';
}

function cloneSource(source) {
  return {
    id: source?.id == null ? null : Number(source.id),
    localId: String(source?.localId || (source?.id == null ? `new-${++sourceSequence}` : `source-${source.id}`)),
    name: String(source?.name || ''),
    url: String(source?.url || ''),
    category: String(source?.category || ''),
    enabled: Boolean(source?.enabled),
    last_checked_at: source?.last_checked_at || null,
  };
}

function sourceIdentity(source) {
  return source?.id == null ? source?.localId : `source-${source.id}`;
}

function sourceFieldsChanged(left, right) {
  return left.name !== right.name
    || left.url !== right.url
    || left.category !== right.category;
}

function validHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function feedPersisted(snapshot) {
  return {
    enabled: featureEnabled(snapshot, 'ai_updates'),
    sources: (snapshot?.ai_sources || []).map(item => cloneSource(item)),
  };
}

function simplePersisted(snapshot, feature) {
  return { enabled: featureEnabled(snapshot, feature) };
}

function validateFeedDraft(draft) {
  const errors = {};
  const seenUrls = new Map();
  for (const source of draft?.sources || []) {
    const identity = sourceIdentity(source);
    const name = String(source?.name || '').trim();
    const url = String(source?.url || '').trim();
    const category = String(source?.category || '').trim();

    if (!name) errors[`source:${source.id ?? identity}:name`] = 'Source name is required.';
    else if (name.length > 100) errors[`source:${source.id ?? identity}:name`] = 'Source name must be at most 100 characters.';

    if (!url) errors[`source:${source.id ?? identity}:url`] = 'Source URL is required.';
    else if (url.length > 1000 || !validHttpUrl(url)) errors[`source:${source.id ?? identity}:url`] = 'Source URL must be HTTP or HTTPS and at most 1000 characters.';

    if (!category) errors[`source:${source.id ?? identity}:category`] = 'Source category is required.';
    else if (category.length > 50) errors[`source:${source.id ?? identity}:category`] = 'Source category must be at most 50 characters.';

    if (source.id == null && !source.enabled) {
      errors[`source:${identity}:enabled`] = 'New sources must be enabled when first saved.';
    }

    if (url) {
      const previous = seenUrls.get(url);
      if (previous) {
        errors[`source:${source.id ?? identity}:url`] = 'Each source URL must be unique.';
        errors[`source:${previous.id ?? sourceIdentity(previous)}:url`] = 'Each source URL must be unique.';
      } else {
        seenUrls.set(url, source);
      }
    }
  }
  return errors;
}

function feedDiff(persisted, draft) {
  const changes = [];
  if (Boolean(persisted?.enabled) !== Boolean(draft?.enabled)) {
    changes.push({
      action_type: 'set_feature',
      payload: { feature: 'ai_updates', enabled: Boolean(draft?.enabled) },
    });
  }

  const persistedById = new Map(
    (persisted?.sources || [])
      .filter(item => item.id != null)
      .map(item => [Number(item.id), item]),
  );
  const draftExisting = new Map(
    (draft?.sources || [])
      .filter(item => item.id != null)
      .map(item => [Number(item.id), item]),
  );

  for (const current of persisted?.sources || []) {
    if (current.id == null) continue;
    const next = draftExisting.get(Number(current.id));
    if (!next) {
      if (current.enabled) {
        changes.push({
          action_type: 'disable_ai_source',
          payload: { source_id: Number(current.id) },
        });
      }
      continue;
    }

    const needsUpsert = sourceFieldsChanged(current, next)
      || (!current.enabled && next.enabled);
    if (needsUpsert) {
      changes.push({
        action_type: 'upsert_ai_source',
        payload: {
          source_id: Number(current.id),
          name: String(next.name).trim(),
          url: String(next.url).trim(),
          category: String(next.category).trim(),
        },
      });
    }
    if (!next.enabled && (current.enabled || needsUpsert)) {
      changes.push({
        action_type: 'disable_ai_source',
        payload: { source_id: Number(current.id) },
      });
    }
  }

  for (const next of draft?.sources || []) {
    if (next.id != null || persistedById.has(Number(next.id))) continue;
    changes.push({
      action_type: 'upsert_ai_source',
      payload: {
        name: String(next.name).trim(),
        url: String(next.url).trim(),
        category: String(next.category).trim(),
      },
    });
  }

  return changes;
}

function simpleDiff(feature, persisted, draft) {
  if (Boolean(persisted?.enabled) === Boolean(draft?.enabled)) return [];
  return [{
    action_type: 'set_feature',
    payload: { feature, enabled: Boolean(draft?.enabled) },
  }];
}

function statusMarkup(state) {
  if (state?.saveError) return `<p class="content-message" role="alert">${escapeHtml(state.saveError)}</p>`;
  if (state?.status === 'conflict') {
    return '<p class="content-message" role="alert">Server state changed while you were editing. Review your draft before saving again.</p>';
  }
  if (state?.status === 'saved') {
    return '<p class="content-message" role="status" aria-live="polite">Changes saved.</p>';
  }
  return '<p class="content-message" data-content-operation role="status" aria-live="polite"></p>';
}

function featureSettingMarkup(config, state) {
  if (state.mode === 'edit') {
    return `
      <section class="content-card content-settings-card">
        <div>
          <h2>Feature status</h2>
          <p>Turn ${escapeHtml(config.title)} on or off without changing its mappings or saved content.</p>
        </div>
        <label class="content-switch">
          <input type="checkbox" data-content-feature-toggle${state.draft.enabled ? ' checked' : ''}>
          <span>${state.draft.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </section>`;
  }
  return `
    <section class="content-card content-settings-card">
      <div>
        <h2>Feature status</h2>
        <p>${state.persisted.enabled ? 'Enabled' : 'Disabled'} for this server.</p>
      </div>
      <button class="control-button control-button-secondary" type="button" data-content-edit>Edit settings</button>
    </section>`;
}

function settingsActionsMarkup(state) {
  if (state.mode !== 'edit') return '';
  const disabled = !state.dirty || Object.keys(state.errors || {}).length || state.status === 'saving';
  return `
    <div class="content-page-actions">
      <button class="control-button control-button-primary" type="button" data-content-save${disabled ? ' disabled' : ''}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button>
      <button class="control-button control-button-secondary" type="button" data-content-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button>
    </div>`;
}

function fieldError(state, source, field) {
  const key = `source:${source.id ?? sourceIdentity(source)}:${field}`;
  return state.errors?.[key] || '';
}

function feedRowRead(source) {
  const checked = source.last_checked_at
    ? new Date(source.last_checked_at).toLocaleString()
    : 'Never';
  return `
    <article class="content-feed-row">
      <div><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.category)}</span></div>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a>
      <span>${escapeHtml(checked)}</span>
      <span class="content-state" data-enabled="${String(source.enabled)}">${source.enabled ? 'Enabled' : 'Disabled'}</span>
    </article>`;
}

function feedRowEdit(source, state) {
  const identity = sourceIdentity(source);
  const nameError = fieldError(state, source, 'name');
  const urlError = fieldError(state, source, 'url');
  const categoryError = fieldError(state, source, 'category');
  return `
    <article class="content-feed-editor" data-source-row="${escapeHtml(identity)}">
      <label>Source name
        <input type="text" maxlength="100" value="${escapeHtml(source.name)}" data-source-field="name" data-source-key="${escapeHtml(identity)}">
        ${nameError ? `<span class="content-field-error" role="alert">${escapeHtml(nameError)}</span>` : ''}
      </label>
      <label>Category
        <input type="text" maxlength="50" value="${escapeHtml(source.category)}" data-source-field="category" data-source-key="${escapeHtml(identity)}">
        ${categoryError ? `<span class="content-field-error" role="alert">${escapeHtml(categoryError)}</span>` : ''}
      </label>
      <label class="content-feed-url">Feed URL
        <input type="url" maxlength="1000" value="${escapeHtml(source.url)}" data-source-field="url" data-source-key="${escapeHtml(identity)}">
        ${urlError ? `<span class="content-field-error" role="alert">${escapeHtml(urlError)}</span>` : ''}
      </label>
      <label class="content-switch content-source-switch">
        <input type="checkbox" data-source-field="enabled" data-source-key="${escapeHtml(identity)}"${source.enabled ? ' checked' : ''}>
        <span>${source.enabled ? 'Enabled' : 'Disabled'}</span>
      </label>
      ${source.id == null ? '<button class="control-button control-button-secondary" type="button" data-source-remove>Remove</button>' : ''}
    </article>`;
}

function feedsMarkup(config, state, snapshot) {
  const mapping = mappedResourceLabel(snapshot, 'ai_updates', 'AI updates');
  const sources = state.mode === 'edit' ? state.draft.sources : state.persisted.sources;
  return `
    <section class="control-page content-page" data-page-key="/control/content/feeds">
      <header class="content-page-header">
        <div><h1>${escapeHtml(config.title)}</h1><p>Manage authoritative RSS and Atom sources. Automatic polling remains scheduled by Rob-bot.</p></div>
      </header>
      ${statusMarkup(state)}
      ${featureSettingMarkup(config, state)}
      <section class="content-card">
        <div class="content-card-heading">
          <div><h2>Sources</h2><p>Destination: ${escapeHtml(mapping)}. Change the destination in Mappings.</p></div>
          ${state.mode === 'edit' ? '<button class="control-button control-button-secondary" type="button" data-source-add>Add source</button>' : ''}
        </div>
        <div class="content-feed-head"><span>Source</span><span>URL</span><span>Last checked</span><span>State</span></div>
        <div class="content-feed-list">
          ${sources.length
    ? sources.map(source => state.mode === 'edit' ? feedRowEdit(source, state) : feedRowRead(source)).join('')
    : '<p class="content-empty">No feed sources are configured.</p>'}
        </div>
        <p class="content-note">Manual feed polling is available through <code>/ai-source poll</code>, where fetched candidates are previewed before Post or Cancel. This Control page never polls or publishes feeds.</p>
      </section>
      ${settingsActionsMarkup(state)}
    </section>`;
}

function announcementMarkup(config, state, snapshot) {
  const destination = mappedResourceLabel(snapshot, 'announcements', 'Announcements');
  const available = Boolean(mappedResourceId(snapshot, 'announcements'));
  return `
    <section class="control-page content-page" data-page-key="/control/content/announcements">
      <header class="content-page-header"><div><h1>${escapeHtml(config.title)}</h1><p>Publish a one-off server announcement using the destination owned by Mappings.</p></div></header>
      ${statusMarkup(state)}
      ${featureSettingMarkup(config, state)}
      ${settingsActionsMarkup(state)}
      <section class="content-card content-builder">
        <div class="content-card-heading"><div><h2>Announcement builder</h2><p>Destination: ${escapeHtml(destination)}</p></div></div>
        <label>Message / mentions<input type="text" data-announcement-message placeholder="Optional text before the embed"></label>
        <label>Title<input type="text" maxlength="256" data-announcement-title></label>
        <label>Body<textarea maxlength="4000" rows="7" data-announcement-body required></textarea></label>
        <div class="content-field-grid">
          <label>Footer<input type="text" maxlength="2048" data-announcement-footer></label>
          <label>Embed color<input type="text" value="5865F2" maxlength="7" data-announcement-color></label>
        </div>
        <p class="content-note">Recognized @everyone, @here, role names, and member display names are resolved against current server state. Mentioning people or roles requires consequence confirmation.</p>
        <button class="control-button control-button-primary" type="button" data-announcement-send${available && state.persisted.enabled ? '' : ' disabled'}>Post announcement</button>
      </section>
    </section>`;
}

function liveMarkup(config, state, snapshot) {
  const destination = mappedResourceLabel(snapshot, 'live_announcements', 'Live announcements');
  const fallback = mappedResourceId(snapshot, 'live_announcements') || mappedResourceId(snapshot, 'announcements');
  const pingRole = resource(snapshot, 'live_ping_role');
  const pingAvailable = Boolean(pingRole?.id && pingRole.exists);
  return `
    <section class="control-page content-page" data-page-key="/control/content/live">
      <header class="content-page-header"><div><h1>${escapeHtml(config.title)}</h1><p>Post the configured live-host notice to the mapped Live destination.</p></div></header>
      ${statusMarkup(state)}
      ${featureSettingMarkup(config, state)}
      ${settingsActionsMarkup(state)}
      <section class="content-card content-builder">
        <div class="content-card-heading"><div><h2>Live notice</h2><p>Destination: ${escapeHtml(destination)}</p></div></div>
        <label>Topic<input type="text" maxlength="200" data-live-topic placeholder="Optional stream topic"></label>
        <label class="content-switch">
          <input type="checkbox" data-live-ping${pingAvailable ? '' : ' disabled'}>
          <span>${pingAvailable ? `Ping ${escapeHtml(pingRole.name || 'configured Live role')}` : 'No Live ping role is connected in Mappings'}</span>
        </label>
        <p class="content-note">A role ping requires consequence confirmation. Posting without a ping does not add an extra confirmation.</p>
        <button class="control-button control-button-primary" type="button" data-live-send${fallback && state.persisted.enabled ? '' : ' disabled'}>Post Live notice</button>
      </section>
    </section>`;
}

export function createContentPageDefinition(pageKey) {
  const config = CONTENT_PAGE_CONFIGS[pageKey];
  if (!config) throw new Error(`Unknown Content page: ${pageKey}`);

  return {
    pageKey,

    selectPersisted(snapshot) {
      return config.kind === 'feeds'
        ? feedPersisted(snapshot)
        : simplePersisted(snapshot, config.feature);
    },

    cloneDraft(value) {
      if (config.kind === 'feeds') {
        return {
          enabled: Boolean(value?.enabled),
          sources: (value?.sources || []).map(item => cloneSource(item)),
        };
      }
      return { enabled: Boolean(value?.enabled) };
    },

    validateDraft(draft) {
      return config.kind === 'feeds' ? validateFeedDraft(draft) : {};
    },

    diffDraft(persisted, draft) {
      return config.kind === 'feeds'
        ? feedDiff(persisted, draft)
        : simpleDiff(config.feature, persisted, draft);
    },

    render({ state, snapshot } = {}) {
      if (!state?.persisted) {
        return `<section class="control-page content-page"><h1>${escapeHtml(config.title)}</h1><p>Load current server state to manage this page.</p></section>`;
      }
      if (config.kind === 'feeds') return feedsMarkup(config, state, snapshot);
      if (config.kind === 'announcements') return announcementMarkup(config, state, snapshot);
      return liveMarkup(config, state, snapshot);
    },

    install({ root, store = controlState, snapshot, onSave, onAction, onConfirm, rerender } = {}) {
      return installContentPageInteractions({
        root,
        pageKey,
        store,
        snapshot,
        onSave,
        onAction,
        onConfirm,
        rerender,
      });
    },
  };
}

export function registerContentPages() {
  for (const pageKey of Object.keys(CONTENT_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) registerControlPage(createContentPageDefinition(pageKey));
  }
}

function requireMappedId(snapshot, key, label) {
  const value = mappedResourceId(snapshot, key);
  if (!value) throw new Error(`${label} is not connected in Mappings.`);
  return value;
}

function normalizedMentions(mentions) {
  return {
    everyone: Boolean(mentions?.everyone),
    here: Boolean(mentions?.here),
    role_ids: [...new Set((mentions?.role_ids || []).map(String))],
    user_ids: [...new Set((mentions?.user_ids || []).map(String))],
  };
}

export function buildAnnouncementAction(snapshot, input = {}) {
  return {
    actionType: 'send_announcement',
    payload: {
      channel_id: requireMappedId(snapshot, 'announcements', 'Announcements destination'),
      message: String(input.message || '').trim(),
      title: String(input.title || '').trim(),
      body: String(input.body || '').trim(),
      footer: String(input.footer || '').trim(),
      color: String(input.color || '5865F2').trim().replace(/^#/, '').toUpperCase(),
      mentions: normalizedMentions(input.mentions),
    },
  };
}

export function buildLiveAction(snapshot, input = {}) {
  const channelId = mappedResourceId(snapshot, 'live_announcements')
    || mappedResourceId(snapshot, 'announcements');
  if (!channelId) throw new Error('Live destination is not connected in Mappings.');
  const pingRoleId = input.pingConfiguredRole
    ? requireMappedId(snapshot, 'live_ping_role', 'Live ping role')
    : null;
  return {
    actionType: 'post_live',
    payload: {
      channel_id: channelId,
      ping_role_id: pingRoleId,
      topic: String(input.topic || '').trim(),
    },
  };
}

export function requiresContentConfirmation(action) {
  if (action?.actionType === 'post_live') return Boolean(action.payload?.ping_role_id);
  if (action?.actionType !== 'send_announcement') return false;
  const mentions = action.payload?.mentions || {};
  return Boolean(
    mentions.everyone
    || mentions.here
    || mentions.role_ids?.length
    || mentions.user_ids?.length
  );
}

export function resolveAnnouncementMentions(snapshot, rawMessage) {
  let message = String(rawMessage || '');
  const roleIds = [];
  const userIds = [];
  const everyone = /(^|\s)@everyone(?=\s|$|[.,!?])/i.test(message);
  const here = /(^|\s)@here(?=\s|$|[.,!?])/i.test(message);
  const candidates = [
    ...(snapshot?.roles || []).map(role => ({ type: 'role', id: String(role.id), name: role.name })),
    ...(snapshot?.members || []).map(member => ({ type: 'user', id: String(member.id), name: member.name })),
  ]
    .filter(item => item.id && item.name)
    .sort((left, right) => right.name.length - left.name.length);

  for (const candidate of candidates) {
    const escaped = candidate.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|\\s)@${escaped}(?=\\s|$|[.,!?])`, 'gi');
    if (!pattern.test(message)) continue;
    pattern.lastIndex = 0;
    if (candidate.type === 'role') roleIds.push(candidate.id);
    else userIds.push(candidate.id);
    const replacement = candidate.type === 'role' ? `<@&${candidate.id}>` : `<@${candidate.id}>`;
    message = message.replace(pattern, (_match, prefix) => `${prefix}${replacement}`);
  }

  return {
    message: message.trim(),
    mentions: normalizedMentions({ everyone, here, role_ids: roleIds, user_ids: userIds }),
  };
}

function sourceForKey(draft, key) {
  return (draft.sources || []).find(item => sourceIdentity(item) === key) || null;
}

function localStatus(root, message, tone = '') {
  const node = root?.querySelector?.('[data-content-operation]');
  if (!node) return;
  node.textContent = message || '';
  node.dataset.tone = tone;
}

function confirmationCopy(action) {
  if (action.actionType === 'post_live') {
    return 'This Live notice will ping the configured Live notification role. Post it?';
  }
  return 'This announcement contains one or more real mentions. Post it and notify those recipients?';
}

export function installContentPageInteractions({
  root,
  pageKey,
  store = controlState,
  snapshot,
  onSave,
  onAction,
  onConfirm,
  rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const performAction = async action => {
    if (requiresContentConfirmation(action)) {
      const confirm = onConfirm || (message => globalThis.confirm?.(message) ?? false);
      const approved = await confirm(confirmationCopy(action));
      if (!approved) return false;
    }
    if (!onAction) throw new Error('Publishing is unavailable right now.');
    await onAction(action);
    return true;
  };

  const onClick = async event => {
    if (event.target?.closest?.('[data-content-edit]')) {
      store.beginEdit(pageKey);
      rerender();
      return;
    }
    if (event.target?.closest?.('[data-content-save]')) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }
    if (event.target?.closest?.('[data-content-discard]')) {
      store.discard(pageKey);
      store.get(pageKey).mode = 'read';
      rerender();
      return;
    }
    if (event.target?.closest?.('[data-source-add]')) {
      store.updateDraft(pageKey, draft => {
        draft.sources.push(cloneSource({ enabled: true }));
      });
      rerender();
      return;
    }
    const remove = event.target?.closest?.('[data-source-remove]');
    if (remove) {
      const row = remove.closest?.('[data-source-row]');
      if (row?.dataset?.sourceRow) {
        store.updateDraft(pageKey, draft => {
          draft.sources = draft.sources.filter(item => sourceIdentity(item) !== row.dataset.sourceRow);
        });
        rerender();
      }
      return;
    }
    if (event.target?.closest?.('[data-announcement-send]')) {
      try {
        const resolved = resolveAnnouncementMentions(
          snapshot,
          root.querySelector('[data-announcement-message]')?.value || '',
        );
        const action = buildAnnouncementAction(snapshot, {
          message: resolved.message,
          title: root.querySelector('[data-announcement-title]')?.value || '',
          body: root.querySelector('[data-announcement-body]')?.value || '',
          footer: root.querySelector('[data-announcement-footer]')?.value || '',
          color: root.querySelector('[data-announcement-color]')?.value || '5865F2',
          mentions: resolved.mentions,
        });
        if (!action.payload.body) throw new Error('Announcement body is required.');
        localStatus(root, 'Publishing announcement…');
        const posted = await performAction(action);
        if (posted) localStatus(root, 'Announcement posted.', 'good');
        else localStatus(root, 'Announcement cancelled.');
      } catch (error) {
        localStatus(root, error instanceof Error ? error.message : 'Announcement could not be posted.', 'bad');
      }
      return;
    }
    if (event.target?.closest?.('[data-live-send]')) {
      try {
        const action = buildLiveAction(snapshot, {
          topic: root.querySelector('[data-live-topic]')?.value || '',
          pingConfiguredRole: Boolean(root.querySelector('[data-live-ping]')?.checked),
        });
        localStatus(root, 'Publishing Live notice…');
        const posted = await performAction(action);
        if (posted) localStatus(root, 'Live notice posted.', 'good');
        else localStatus(root, 'Live notice cancelled.');
      } catch (error) {
        localStatus(root, error instanceof Error ? error.message : 'Live notice could not be posted.', 'bad');
      }
    }
  };

  const onChange = event => {
    const feature = event.target?.closest?.('[data-content-feature-toggle]');
    if (feature) {
      store.updateDraft(pageKey, draft => { draft.enabled = Boolean(feature.checked); });
      rerender();
      return;
    }
    const field = event.target?.closest?.('[data-source-field]');
    if (field?.dataset?.sourceKey && field.dataset.sourceField) {
      store.updateDraft(pageKey, draft => {
        const source = sourceForKey(draft, field.dataset.sourceKey);
        if (!source) return;
        if (field.dataset.sourceField === 'enabled') source.enabled = Boolean(field.checked);
        else source[field.dataset.sourceField] = field.value;
      });
      rerender();
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  };
}
