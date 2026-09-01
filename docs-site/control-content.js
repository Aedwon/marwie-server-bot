import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import { featureHeaderActionsMarkup } from './control-components.js';

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
const DEFAULT_ANNOUNCEMENT_COLOR = '5865F2';
let announcementComposerState = {
  destinationId: null,
  message: '',
  title: '',
  body: '',
  footer: '',
  color: DEFAULT_ANNOUNCEMENT_COLOR,
  imageUrl: '',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizeHex(value, fallback = DEFAULT_ANNOUNCEMENT_COLOR) {
  const raw = String(value || '').trim().replace('#', '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(raw)) return raw;
  if (/^[0-9A-F]{3}$/.test(raw)) return raw.split('').map(char => char + char).join('');
  return fallback;
}

function hexToHsv(value) {
  const hex = normalizeHex(value);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }
  if (h < 0) h += 360;
  const sat = max === 0 ? 0 : delta / max;
  return { h: Math.round(h), s: Math.round(sat * 100), v: Math.round(max * 100) };
}

function hsvToHex(hue, saturation, value) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const saturationRatio = clamp(saturation, 0, 100) / 100;
  const valueRatio = clamp(value, 0, 100) / 100;
  const c = valueRatio * saturationRatio;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = valueRatio - c;
  let rgb = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(value) {
  const hex = normalizeHex(value);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(red, green, blue) {
  return [red, green, blue]
    .map(channel => clamp(channel, 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const COLOR_PRESETS = Object.freeze([
  '14B8A6', '22C55E', '3B82F6', 'A855F7', 'E11D48', 'FACC15', 'F97316', 'EF4444',
  '94A3B8', '64748B', '27272A', 'FFFFFF',
]);

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

function contentHeaderMarkup(config, state, description) {
  const enabled = state.mode === 'edit' ? state.draft.enabled : state.persisted.enabled;
  return `<header class="content-page-header"><div><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(description)}</p></div>${featureHeaderActionsMarkup({
    label: config.title,
    enabled,
    editing: state.mode === 'edit',
    editAttribute: 'data-content-edit',
    toggleAttribute: 'data-content-feature-toggle',
  })}</header>`;
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
    <tr class="content-feed-row">
      <th scope="row"><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.category)}</span></th>
      <td><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a></td>
      <td>${escapeHtml(checked)}</td>
      <td class="content-state" data-enabled="${String(source.enabled)}">${source.enabled ? 'Enabled' : 'Disabled'}</td>
    </tr>`;
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
    <section class="control-page content-page content-page-compact" data-page-key="/control/content/feeds">
      ${contentHeaderMarkup(config, state, 'Manage authoritative RSS and Atom sources. Automatic polling remains scheduled by Rob-bot.')}
      ${statusMarkup(state)}
      <section class="content-admin-surface">
        <div class="content-card-heading">
          <div><h2>Sources</h2><p>Destination: ${escapeHtml(mapping)}. Change the destination in Mappings.</p></div>
          ${state.mode === 'edit' ? '<button class="control-button control-button-secondary" type="button" data-source-add>Add source</button>' : ''}
        </div>
        ${state.mode === 'edit'
    ? `<div class="content-feed-edit-list">${sources.length ? sources.map(source => feedRowEdit(source, state)).join('') : '<p class="content-empty">No feed sources are configured.</p>'}</div>`
    : sources.length
      ? `<div class="control-summary-table-wrap"><table class="control-summary-table content-feed-table"><thead><tr><th>Source</th><th>URL</th><th>Last checked</th><th>State</th></tr></thead><tbody>${sources.map(feedRowRead).join('')}</tbody></table></div>`
      : '<p class="content-empty">No feed sources are configured.</p>'}
        <p class="content-note">Manual feed polling is available through <code>/ai-source poll</code>, where fetched candidates are previewed before Post or Cancel. This Control page never polls or publishes feeds.</p>
      </section>
      ${settingsActionsMarkup(state)}
    </section>`;
}

export function announcementDestinationOptions(snapshot) {
  return (snapshot?.channels || []).filter(channel => channel?.kind === 'text' && channel?.send_messages === true);
}

function mappedAnnouncementDestination(snapshot) {
  return mappedResourceId(snapshot, 'announcements');
}

function ensureAnnouncementComposer(snapshot) {
  const options = announcementDestinationOptions(snapshot);
  const optionIds = new Set(options.map(item => String(item.id)));
  const mapped = mappedAnnouncementDestination(snapshot);
  if (!announcementComposerState.destinationId || !optionIds.has(String(announcementComposerState.destinationId))) {
    announcementComposerState.destinationId = mapped && optionIds.has(mapped) ? mapped : (options[0]?.id ? String(options[0].id) : null);
  }
  return announcementComposerState;
}

export function announcementHasPostableContent(input = {}) {
  return Boolean(String(input.message || '').trim() || String(input.title || '').trim() || String(input.body || '').trim());
}

export function announcementHasEmbed(input = {}) {
  return Boolean(String(input.title || '').trim() || String(input.body || '').trim());
}

export function clearAnnouncementComposer(input = {}) {
  return {
    destinationId: input.destinationId || null,
    message: '',
    title: '',
    body: '',
    footer: '',
    color: DEFAULT_ANNOUNCEMENT_COLOR,
    imageUrl: '',
  };
}

function announcementRemaining(value, limit) {
  return Math.max(0, limit - String(value || '').length);
}

function previewToken(snapshot, token) {
  if (token.startsWith('<@&')) {
    const id = token.slice(3, -1);
    const role = (snapshot?.roles || []).find(item => String(item.id) === id);
    return `<span class="discord-mention">@${escapeHtml(role?.name || id)}</span>`;
  }
  if (token.startsWith('<@')) {
    const id = token.replace('<@!', '').replace('<@', '').replace('>', '');
    const member = (snapshot?.members || []).find(item => String(item.id) === id);
    return `<span class="discord-mention">@${escapeHtml(member?.name || id)}</span>`;
  }
  if (token.startsWith('<#')) {
    const id = token.slice(2, -1);
    const channel = (snapshot?.channels || []).find(item => String(item.id) === id);
    return `<span class="discord-mention">#${escapeHtml(channel?.name || id)}</span>`;
  }
  return `<span class="discord-mention">${escapeHtml(token)}</span>`;
}

function previewMessageMarkup(snapshot, raw) {
  const value = String(raw || '');
  const pattern = /<@!?[0-9]{1,20}>|<@&[0-9]{1,20}>|<#[0-9]{1,20}>|@everyone|@here/g;
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    output += escapeHtml(value.slice(cursor, match.index));
    output += previewToken(snapshot, match[0]);
    cursor = match.index + match[0].length;
  }
  output += escapeHtml(value.slice(cursor));
  return output.split(String.fromCharCode(10)).join('<br>');
}

export function announcementPreviewMarkup(snapshot, composer = {}) {
  const destination = (snapshot?.channels || []).find(item => String(item.id) === String(composer.destinationId || ''));
  const message = String(composer.message || '');
  const title = String(composer.title || '');
  const body = String(composer.body || '');
  const footer = String(composer.footer || '');
  const hasEmbed = announcementHasEmbed(composer);
  const image = hasEmbed && validHttpUrl(composer.imageUrl) ? `<img class="discord-preview-image" src="${escapeHtml(composer.imageUrl)}" alt="Announcement embed preview">` : '';
  const embed = hasEmbed ? `<div class="discord-embed" style="--embed-color:#${escapeHtml(String(composer.color || DEFAULT_ANNOUNCEMENT_COLOR).replace('#', ''))}">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${body ? `<p>${escapeHtml(body).split(String.fromCharCode(10)).join('<br>')}</p>` : ''}${image}${footer ? `<small>${escapeHtml(footer)}</small>` : ''}</div>` : '';
  return `<div class="discord-preview-channel">#${escapeHtml(destination?.name || 'select-a-channel')}</div><div class="discord-preview-message"><div class="discord-preview-avatar" aria-hidden="true">R</div><div><strong>Rob-bot</strong><span class="discord-bot-label">APP</span>${message ? `<p>${previewMessageMarkup(snapshot, message)}</p>` : ''}${embed || (!message ? '<p class="discord-preview-empty">Your announcement preview appears here.</p>' : '')}</div></div>`;
}

function announcementCanPost(snapshot, state, featureEnabled) {
  if (!featureEnabled || !announcementHasPostableContent(state)) return false;
  const channel = announcementDestinationOptions(snapshot).find(item => String(item.id) === String(state.destinationId || ''));
  if (!channel) return false;
  if (announcementHasEmbed(state) && channel.embed_links !== true) return false;
  return true;
}

function announcementMarkup(config, state, snapshot) {
  const composer = ensureAnnouncementComposer(snapshot);
  const destinations = announcementDestinationOptions(snapshot);
  const enabled = state.mode === 'edit' ? state.draft.enabled : state.persisted.enabled;
  const canPost = announcementCanPost(snapshot, composer, enabled);
  const destinationOptions = destinations.map(channel => `<option value="${escapeHtml(channel.id)}"${String(channel.id) === String(composer.destinationId) ? ' selected' : ''}>#${escapeHtml(channel.name)}</option>`).join('');
  const picker = hexToHsv(composer.color);
  return `
    <section class="control-page content-page content-page-compact" data-page-key="/control/content/announcements">
      ${contentHeaderMarkup(config, state, 'Build a one-off server announcement and preview exactly what Rob-bot will post.')}
      ${statusMarkup(state)}
      ${settingsActionsMarkup(state)}
      <div class="content-announcement-layout">
        <section class="content-admin-surface content-announcement-composer">
          <div class="content-card-heading"><div><h2>Announcement builder</h2><p>Composer values are local until you post.</p></div><button class="content-clear-action" type="button" data-announcement-clear>Clear all</button></div>
          <label>Destination channel<select data-announcement-destination>${destinationOptions || '<option value="">No permitted text channels</option>'}</select></label>
          <label>Message / mentions<textarea maxlength="2000" rows="4" data-announcement-message placeholder="Literal Discord syntax: <@123>, <@&456>, <#789>, @everyone, @here">${escapeHtml(composer.message)}</textarea><span class="content-field-counter" data-announcement-counter="message">${announcementRemaining(composer.message, 2000)}</span></label>
          <label>Title<input type="text" maxlength="256" data-announcement-title value="${escapeHtml(composer.title)}"><span class="content-field-counter" data-announcement-counter="title">${announcementRemaining(composer.title, 256)}</span></label>
          <label>Body<textarea maxlength="4096" rows="7" data-announcement-body>${escapeHtml(composer.body)}</textarea><span class="content-field-counter" data-announcement-counter="body">${announcementRemaining(composer.body, 4096)}</span></label>
          <div class="content-field-grid">
            <label>Footer<input type="text" maxlength="2048" data-announcement-footer value="${escapeHtml(composer.footer)}"><span class="content-field-counter" data-announcement-counter="footer">${announcementRemaining(composer.footer, 2048)}</span></label>
            <div class="content-color-field"><span>Embed color</span><button class="content-color-swatch" type="button" data-announcement-color-swatch aria-haspopup="dialog" aria-expanded="false" style="--swatch:#${escapeHtml(composer.color)}"><span aria-hidden="true"></span><strong>#${escapeHtml(composer.color)}</strong></button><div class="content-color-popover" data-announcement-color-popover role="dialog" aria-label="Embed color picker" hidden><div class="content-color-popover-heading"><strong>Embed color</strong><button type="button" data-announcement-color-close aria-label="Close color picker">Close</button></div><div class="content-color-selected-row"><span class="content-color-selected" data-announcement-color-preview style="--swatch:#${escapeHtml(composer.color)}" aria-hidden="true"></span><output data-announcement-color-output>#${escapeHtml(composer.color)}</output></div><div class="content-color-plane" data-announcement-color-plane role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${picker.s}" aria-valuetext="Saturation ${picker.s}%, brightness ${picker.v}%" data-saturation="${picker.s}" data-value="${picker.v}" style="--picker-hue:${picker.h};--picker-saturation:${picker.s}%;--picker-value:${picker.v}%"><span aria-hidden="true"></span></div><label class="content-color-hue-field">Hue<input type="range" min="0" max="359" step="1" value="${picker.h}" data-announcement-color-hue aria-label="Hue"></label><div class="content-color-values"><label>Hex<input type="text" maxlength="7" inputmode="text" autocomplete="off" spellcheck="false" data-announcement-color value="#${escapeHtml(composer.color)}" aria-label="Hex color"></label>${['r', 'g', 'b'].map(channel => `<label>${channel.toUpperCase()}<input type="number" min="0" max="255" step="1" inputmode="numeric" data-announcement-color-${channel} aria-label="${channel.toUpperCase()} value"></label>`).join('')}</div><div class="content-color-presets" role="group" aria-label="Color presets">${COLOR_PRESETS.map(color => `<button type="button" data-announcement-color-preset="${color}" aria-label="Use ${color} preset" style="--swatch:#${color}"><span aria-hidden="true"></span></button>`).join('')}</div><button type="button" class="content-color-reset" data-announcement-color-reset>Reset</button></div></div>
          </div>
          <label>Image URL <span class="content-field-meta">1 max</span><input type="url" maxlength="1000" data-announcement-image value="${escapeHtml(composer.imageUrl)}" placeholder="https://example.com/image.png"></label>
          <p class="content-note">Message alone is postable. An embed is created only when Title and/or Body has content. Footer, color, and image apply only to that embed.</p>
        </section>
        <section class="content-admin-surface content-announcement-preview-card">
          <div class="content-preview-heading"><div><h2>Preview</h2><p>Final Discord rendering before publish.</p></div><button class="control-button control-button-primary content-announcement-post" type="button" data-announcement-send${canPost ? '' : ' disabled'}>Post</button></div>
          <div class="discord-preview-shell" data-announcement-preview>${announcementPreviewMarkup(snapshot, composer)}</div>
        </section>
      </div>
    </section>`;
}

function liveMarkup(config, state, snapshot) {
  const destination = mappedResourceLabel(snapshot, 'live_announcements', 'Live announcements');
  const fallback = mappedResourceId(snapshot, 'live_announcements') || mappedResourceId(snapshot, 'announcements');
  const pingRole = resource(snapshot, 'live_ping_role');
  const pingAvailable = Boolean(pingRole?.id && pingRole.exists);
  return `
    <section class="control-page content-page content-page-compact" data-page-key="/control/content/live">
      ${contentHeaderMarkup(config, state, 'Post the configured live-host notice to the mapped Live destination.')}
      ${statusMarkup(state)}
      ${settingsActionsMarkup(state)}
      <section class="content-admin-surface content-live-dispatch" aria-labelledby="live-dispatch-heading">
        <div class="content-card-heading"><div><h2 id="live-dispatch-heading">Live notice</h2><p>Review each dispatch step before publishing.</p></div></div>
        <ol class="content-dispatch-flow">
          <li><span class="content-dispatch-number">1</span><div><strong>Destination</strong><p>${escapeHtml(destination)}</p></div></li>
          <li><span class="content-dispatch-number">2</span><label>Topic<input type="text" maxlength="200" data-live-topic placeholder="Optional stream topic"><small>Optional. Included with the configured live-host notice.</small></label></li>
          <li><span class="content-dispatch-number">3</span><label class="content-switch"><input type="checkbox" data-live-ping${pingAvailable ? '' : ' disabled'}><span>${pingAvailable ? `Ping ${escapeHtml(pingRole.name || 'configured Live role')}` : 'No Live ping role is connected in Mappings'}</span></label></li>
        </ol>
        <div class="content-dispatch-actions"><button class="control-button control-button-primary" type="button" data-live-send${fallback && state.persisted.enabled ? '' : ' disabled'}>Post Live notice</button></div>
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
  const channelId = String(input.channelId || input.destinationId || '');
  const channel = announcementDestinationOptions(snapshot).find(item => String(item.id) === channelId);
  if (!channel) throw new Error('Choose a permitted announcement destination.');
  const message = String(input.message || '');
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  const footer = String(input.footer || '').trim();
  const color = String(input.color || DEFAULT_ANNOUNCEMENT_COLOR).trim().replace('#', '').toUpperCase();
  const imageUrl = String(input.imageUrl || '').trim();
  if (!announcementHasPostableContent({ message, title, body })) throw new Error('Add a message, title, or body before posting.');
  if (title.length + body.length + footer.length > 6000) throw new Error('Embed text must be at most 6000 characters total.');
  if (announcementHasEmbed({ title, body }) && channel.embed_links !== true) throw new Error('Rob-bot needs Embed Links in the selected channel for this announcement.');
  if (imageUrl && !validHttpUrl(imageUrl)) throw new Error('Image URL must be HTTP or HTTPS.');
  return {
    actionType: 'send_announcement',
    payload: { channel_id: channelId, message, title, body, footer, color, image_url: imageUrl, mentions: normalizedMentions(input.mentions) },
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
  const message = String(rawMessage || '');
  const roleIds = [];
  const userIds = [];
  const knownRoles = new Set((snapshot?.roles || []).map(item => String(item.id)));
  const knownMembers = new Set((snapshot?.members || []).map(item => String(item.id)));
  for (const match of message.matchAll(/<@&([0-9]{1,20})>/g)) if (knownRoles.has(match[1])) roleIds.push(match[1]);
  for (const match of message.matchAll(/<@!?([0-9]{1,20})>/g)) if (knownMembers.has(match[1])) userIds.push(match[1]);
  const everyone = /(^|[^A-Za-z0-9_])@everyone(?=$|[^A-Za-z0-9_])/i.test(message);
  const here = /(^|[^A-Za-z0-9_])@here(?=$|[^A-Za-z0-9_])/i.test(message);
  return { message, mentions: normalizedMentions({ everyone, here, role_ids: roleIds, user_ids: userIds }) };
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
  root, pageKey, store = controlState, snapshot, onSave, onAction, onConfirm, rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};
  let colorTrigger = null;

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

  const readComposer = () => {
    const destination = root.querySelector('[data-announcement-destination]');
    if (destination) announcementComposerState.destinationId = destination.value || null;
    const fields = [
      ['message', '[data-announcement-message]'], ['title', '[data-announcement-title]'], ['body', '[data-announcement-body]'],
      ['footer', '[data-announcement-footer]'], ['imageUrl', '[data-announcement-image]'],
    ];
    for (const [key, selector] of fields) { const node = root.querySelector(selector); if (node) announcementComposerState[key] = node.value || ''; }
    const color = root.querySelector('[data-announcement-color]');
    if (color) { const raw = String(color.value || '').replace('#', '').toUpperCase(); if (/^[0-9A-F]{6}$/.test(raw)) announcementComposerState.color = raw; }
    return announcementComposerState;
  };

  const syncAnnouncement = () => {
    const composer = readComposer();
    const limits = { message: 2000, title: 256, body: 4096, footer: 2048 };
    for (const [key, limit] of Object.entries(limits)) {
      const counter = root.querySelector(`[data-announcement-counter="${key}"]`);
      if (counter) counter.textContent = String(announcementRemaining(composer[key], limit));
    }
    const preview = root.querySelector('[data-announcement-preview]');
    if (preview) preview.innerHTML = announcementPreviewMarkup(snapshot, composer);
    const send = root.querySelector('[data-announcement-send]');
    const enabled = store.get(pageKey)?.mode === 'edit' ? store.get(pageKey)?.draft?.enabled : store.get(pageKey)?.persisted?.enabled;
    if (send) send.disabled = !announcementCanPost(snapshot, composer, Boolean(enabled));
    const swatch = root.querySelector('[data-announcement-color-swatch]');
    if (swatch) { swatch.style.setProperty('--swatch', `#${composer.color}`); const copy = swatch.querySelector('strong'); if (copy) copy.textContent = `#${composer.color}`; }
    const hsv = hexToHsv(composer.color);
    const hue = root.querySelector('[data-announcement-color-hue]');
    if (hue && String(hue.value) !== String(hsv.h)) hue.value = String(hsv.h);
    const plane = root.querySelector('[data-announcement-color-plane]');
    if (plane) { plane.dataset.saturation = String(hsv.s); plane.dataset.value = String(hsv.v); plane.style.setProperty('--picker-hue', String(hsv.h)); plane.style.setProperty('--picker-saturation', `${hsv.s}%`); plane.style.setProperty('--picker-value', `${hsv.v}%`); plane.setAttribute('aria-valuenow', String(hsv.s)); plane.setAttribute('aria-valuetext', `Saturation ${hsv.s}%, brightness ${hsv.v}%`); }
    const colorPreview = root.querySelector('[data-announcement-color-preview]');
    if (colorPreview) colorPreview.style.setProperty('--swatch', `#${composer.color}`);
    const colorOutput = root.querySelector('[data-announcement-color-output]');
    if (colorOutput) colorOutput.textContent = `#${composer.color}`;
    const colorText = root.querySelector('[data-announcement-color]');
    if (colorText && globalThis.document?.activeElement !== colorText && colorText.value.toUpperCase() !== `#${composer.color}`) colorText.value = `#${composer.color}`;
    const rgb = hexToRgb(composer.color);
    for (const channel of ['r', 'g', 'b']) {
      const field = root.querySelector(`[data-announcement-color-${channel}]`);
      if (field && globalThis.document?.activeElement !== field) field.value = String(rgb[channel]);
    }

  };

  const closeColorPopover = () => {
    const popover = root.querySelector('[data-announcement-color-popover]');
    const trigger = root.querySelector('[data-announcement-color-swatch]');
    if (popover && !popover.hidden) { popover.hidden = true; trigger?.setAttribute('aria-expanded', 'false'); colorTrigger?.focus?.(); }
  };

  const openColorPopover = trigger => {
    const popover = root.querySelector('[data-announcement-color-popover]');
    if (!popover) return;
    colorTrigger = trigger;
    popover.hidden = false; trigger.setAttribute('aria-expanded', 'true'); syncAnnouncement();
    const rect = trigger.getBoundingClientRect();
    const width = popover.offsetWidth || 290; const height = popover.offsetHeight || 330; const margin = 12;
    popover.style.position = 'fixed';
    popover.style.left = `${Math.max(margin, Math.min(globalThis.innerWidth - width - margin, rect.right - width))}px`;
    popover.style.top = `${Math.max(margin, Math.min(globalThis.innerHeight - height - margin, rect.bottom + 8))}px`;
    popover.querySelector('[data-announcement-color-hue]')?.focus?.();
  };

  const setColorFromHsv = (hue, saturation, value) => {
    const text = root.querySelector('[data-announcement-color]');
    if (text) text.value = `#${hsvToHex(hue, saturation, value)}`;
    syncAnnouncement();
  };

  const setColorFromRgbFields = () => {
    const channels = ['r', 'g', 'b'].map(channel => Number(root.querySelector(`[data-announcement-color-${channel}]`)?.value || 0));
    const text = root.querySelector('[data-announcement-color]');
    if (text) text.value = `#${rgbToHex(...channels)}`;
    syncAnnouncement();
  };

  const setPlaneFromPointer = event => {
    const plane = event.target?.closest?.('[data-announcement-color-plane]');
    if (!plane) return false;
    const rect = plane.getBoundingClientRect();
    if (!rect.width || !rect.height) return true;
    const saturation = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const value = clamp(100 - (((event.clientY - rect.top) / rect.height) * 100), 0, 100);
    const hue = Number(root.querySelector('[data-announcement-color-hue]')?.value || 0);
    setColorFromHsv(hue, saturation, value);
    return true;
  };

  const onClick = async event => {
    if (event.target?.closest?.('[data-content-edit]')) { store.beginEdit(pageKey); rerender(); return; }
    if (event.target?.closest?.('[data-content-save]')) { if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey)); return; }
    if (event.target?.closest?.('[data-content-discard]')) { store.discard(pageKey); store.get(pageKey).mode = 'read'; rerender(); return; }
    if (event.target?.closest?.('[data-source-add]')) { store.updateDraft(pageKey, draft => { draft.sources.push(cloneSource({ enabled: true })); }); rerender(); return; }
    const remove = event.target?.closest?.('[data-source-remove]');
    if (remove) { const row = remove.closest?.('[data-source-row]'); if (row?.dataset?.sourceRow) { store.updateDraft(pageKey, draft => { draft.sources = draft.sources.filter(item => sourceIdentity(item) !== row.dataset.sourceRow); }); rerender(); } return; }
    const colorButton = event.target?.closest?.('[data-announcement-color-swatch]');
    if (colorButton) { const popover = root.querySelector('[data-announcement-color-popover]'); if (popover?.hidden) openColorPopover(colorButton); else closeColorPopover(); return; }
    if (event.target?.closest?.('[data-announcement-color-close]')) { closeColorPopover(); return; }
    const preset = event.target?.closest?.('[data-announcement-color-preset]');
    if (preset) { const text = root.querySelector('[data-announcement-color]'); if (text) text.value = `#${normalizeHex(preset.dataset.announcementColorPreset)}`; syncAnnouncement(); return; }
    if (event.target?.closest?.('[data-announcement-color-reset]')) { const text = root.querySelector('[data-announcement-color]'); if (text) text.value = `#${DEFAULT_ANNOUNCEMENT_COLOR}`; syncAnnouncement(); return; }
    if (setPlaneFromPointer(event)) return;
    if (event.target?.closest?.('[data-announcement-clear]')) {
      announcementComposerState = clearAnnouncementComposer(readComposer());
      const values = { '[data-announcement-message]': '', '[data-announcement-title]': '', '[data-announcement-body]': '', '[data-announcement-footer]': '', '[data-announcement-image]': '', '[data-announcement-color]': DEFAULT_ANNOUNCEMENT_COLOR };
      for (const [selector, value] of Object.entries(values)) { const node = root.querySelector(selector); if (node) node.value = value; }
      syncAnnouncement(); return;
    }
    if (event.target?.closest?.('[data-announcement-send]')) {
      try {
        const composer = readComposer();
        const resolved = resolveAnnouncementMentions(snapshot, composer.message);
        const action = buildAnnouncementAction(snapshot, { channelId: composer.destinationId, ...composer, message: resolved.message, mentions: resolved.mentions });
        localStatus(root, 'Publishing announcement…');
        const posted = await performAction(action);
        if (posted) localStatus(root, 'Announcement posted.', 'good'); else localStatus(root, 'Announcement cancelled.');
      } catch (error) { localStatus(root, error instanceof Error ? error.message : 'Announcement could not be posted.', 'bad'); }
      return;
    }
    if (event.target?.closest?.('[data-live-send]')) {
      try { const action = buildLiveAction(snapshot, { topic: root.querySelector('[data-live-topic]')?.value || '', pingConfiguredRole: Boolean(root.querySelector('[data-live-ping]')?.checked) }); localStatus(root, 'Publishing Live notice…'); const posted = await performAction(action); if (posted) localStatus(root, 'Live notice posted.', 'good'); else localStatus(root, 'Live notice cancelled.'); } catch (error) { localStatus(root, error instanceof Error ? error.message : 'Live notice could not be posted.', 'bad'); }
    }
  };

  const onChange = event => {
    const feature = event.target?.closest?.('[data-content-feature-toggle]');
    if (feature) { store.updateDraft(pageKey, draft => { draft.enabled = Boolean(feature.checked); }); rerender(); return; }
    const field = event.target?.closest?.('[data-source-field]');
    if (field?.dataset?.sourceKey && field.dataset.sourceField) { store.updateDraft(pageKey, draft => { const source = sourceForKey(draft, field.dataset.sourceKey); if (!source) return; if (field.dataset.sourceField === 'enabled') source.enabled = Boolean(field.checked); else source[field.dataset.sourceField] = field.value; }); rerender(); return; }
    if (event.target?.closest?.('[data-announcement-destination]')) { syncAnnouncement(); return; }
    const hue = event.target?.closest?.('[data-announcement-color-hue]');
    if (hue) { const plane = root.querySelector('[data-announcement-color-plane]'); setColorFromHsv(Number(hue.value), Number(plane?.dataset?.saturation || 0), Number(plane?.dataset?.value || 0)); return; }
    const hex = event.target?.closest?.('[data-announcement-color]');
    if (hex) { announcementComposerState.color = normalizeHex(hex.value, announcementComposerState.color); hex.value = `#${announcementComposerState.color}`; syncAnnouncement(); }
    if (event.target?.closest?.('[data-announcement-color-r], [data-announcement-color-g], [data-announcement-color-b]')) setColorFromRgbFields();

  };

  const onInput = event => {
    if (event.target?.closest?.('[data-announcement-color-hue]')) {
      const plane = root.querySelector('[data-announcement-color-plane]');
      setColorFromHsv(Number(event.target.value), Number(plane?.dataset?.saturation || 0), Number(plane?.dataset?.value || 0));
      return;
    }
    if (event.target?.closest?.('[data-announcement-color-r], [data-announcement-color-g], [data-announcement-color-b]')) { setColorFromRgbFields(); return; }
    if (event.target?.closest?.('[data-announcement-message], [data-announcement-title], [data-announcement-body], [data-announcement-footer], [data-announcement-image], [data-announcement-color]')) syncAnnouncement();
  };
  const onKeydown = event => {
    if (event.key === 'Escape') { closeColorPopover(); return; }
    const plane = event.target?.closest?.('[data-announcement-color-plane]');
    if (!plane || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    let saturation = Number(plane.dataset.saturation || 0);
    let value = Number(plane.dataset.value || 0);
    if (event.key === 'ArrowLeft') saturation -= step;
    if (event.key === 'ArrowRight') saturation += step;
    if (event.key === 'ArrowUp') value += step;
    if (event.key === 'ArrowDown') value -= step;
    const hue = Number(root.querySelector('[data-announcement-color-hue]')?.value || 0);
    setColorFromHsv(hue, clamp(saturation, 0, 100), clamp(value, 0, 100));
  };


  root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root.addEventListener('keydown', onKeydown);
  if (pageKey === '/control/content/announcements') { ensureAnnouncementComposer(snapshot); syncAnnouncement(); }
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKeydown); };
}
