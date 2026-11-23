import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import {
  disclosure,
  masterSwitchRow,
  problemLine,
  setDisclosureOpen,
  settingRow,
  settingsRows,
  settingsSection,
  switchMarkup,
} from './control-components.js?v=28';
import { featureResourceKeys } from './control-resource-contract.js';
import { withResourceBindings } from './control-resource-bindings.js?v=6';
import {
  fieldMarkup,
  itemHead,
  itemRow,
  supportPageFrame,
  supportResourceSection,
  textArea,
  textInput,
} from './control-support-shared.js?v=6';

const FEEDS = '/control/content/feeds';
const ANNOUNCEMENTS = '/control/content/announcements';
const LIVE = '/control/content/live';

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
let liveComposerState = { topic: '', ping: false };
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

function contentFrame(pageKey, state, { lede = '', enabled, body, className = '' }) {
  return supportPageFrame({
    pageKey,
    className: `content-page${className ? ` ${className}` : ''}`,
    title: CONTENT_PAGE_CONFIGS[pageKey].title,
    lede,
    enabled,
    body,
    state,
    save: 'data-content-save',
    discard: 'data-content-discard',
  });
}

function masterRows({ title, label, offHint, enabled }) {
  return settingsRows(masterSwitchRow({
    label,
    offHint,
    checked: enabled,
    field: 'enabled',
    attribute: 'data-content-field',
  }), { label: `${title} settings` });
}

function fieldError(state, source, field) {
  const key = `source:${source.id ?? sourceIdentity(source)}:${field}`;
  return state.errors?.[key] || '';
}

function sourceHost(url) {
  try { return new URL(String(url || '')).hostname; } catch { return ''; }
}

function feedSourceRow(source, state) {
  const identity = sourceIdentity(source);
  const attrs = field => `data-source-field="${field}" data-source-key="${escapeHtml(identity)}"`;
  const errors = Object.fromEntries(['name', 'category', 'url', 'enabled'].map(field => [field, fieldError(state, source, field)]));
  const checked = source.last_checked_at ? new Date(source.last_checked_at).toLocaleString() : '';
  const body = `${checked ? `<p class="control-setting-hint">Last checked ${escapeHtml(checked)}</p>` : ''}
    ${fieldMarkup({ id: `feed-${identity}-name`, label: 'Source name', problem: errors.name, control: textInput({ id: `feed-${identity}-name`, value: source.name, maxlength: 100, attributes: attrs('name'), invalid: Boolean(errors.name) }) })}
    ${fieldMarkup({ id: `feed-${identity}-category`, label: 'Category', problem: errors.category, control: textInput({ id: `feed-${identity}-category`, value: source.category, maxlength: 50, attributes: attrs('category'), invalid: Boolean(errors.category) }) })}
    ${fieldMarkup({ id: `feed-${identity}-url`, label: 'Feed URL', problem: errors.url, control: textInput({ id: `feed-${identity}-url`, type: 'url', value: source.url, maxlength: 1000, attributes: attrs('url'), invalid: Boolean(errors.url) }) })}
    ${errors.enabled ? problemLine(errors.enabled) : ''}
    ${source.id == null ? '<div class="control-item-actions"><button class="control-button control-button-secondary" type="button" data-source-remove>Remove source</button></div>' : ''}`;
  return itemRow({
    id: `feed-source-${identity}`,
    rowKey: source.id == null ? `source:${identity}` : `source:${source.id}`,
    head: itemHead(source.name || 'New source', sourceHost(source.url)),
    aside: switchMarkup({ id: `feed-${identity}-enabled`, checked: source.enabled, label: `${source.name || 'New source'} enabled`, attributes: attrs('enabled') }),
    body,
    error: Object.values(errors).some(Boolean),
    dataAttributes: `data-source-row="${escapeHtml(identity)}"`,
  });
}

function feedsMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const list = value.sources.length
    ? `<div class="control-question-list">${value.sources.map(source => feedSourceRow(source, state)).join('')}</div>`
    : '<p class="control-empty-line">No sources yet. Add one to start checking feeds.</p>';
  return contentFrame(FEEDS, state, {
    lede: 'Post new items with /ai-source poll in Discord.',
    enabled: value.enabled,
    body: `${masterRows({ title: 'Feeds', label: 'Check feeds', offHint: 'Rob-bot stops checking sources.', enabled: value.enabled })}
      ${settingsSection({ id: 'feed-sources-heading', title: 'Sources', body: `${list}<div class="control-list-add"><button class="control-button control-button-secondary" type="button" data-source-add>Add source</button></div>` })}
      ${supportResourceSection(FEEDS, state, snapshot, 'Channels')}`,
  });
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
  const embed = hasEmbed ? `<div class="discord-embed" style="--embed-color:#${escapeHtml(String(composer.color || DEFAULT_ANNOUNCEMENT_COLOR).replace('#', ''))}">${title ? `<strong class="discord-embed-title">${escapeHtml(title)}</strong>` : ''}${body ? `<p class="discord-embed-description">${escapeHtml(body).split(String.fromCharCode(10)).join('<br>')}</p>` : ''}${image}${footer ? `<small class="discord-embed-footer">${escapeHtml(footer)}</small>` : ''}</div>` : '';
  return `<div class="discord-preview-channel"><span class="discord-preview-channel-icon" aria-hidden="true">#</span><span>${escapeHtml(destination?.name || 'select-a-channel')}</span></div><div class="discord-preview-message"><img class="discord-preview-avatar" src="/rob-robin.jpg?v=1" alt="" aria-hidden="true"><div class="discord-preview-body"><div class="discord-preview-author"><strong>Rob-bot</strong><span class="discord-bot-label">APP</span><span class="discord-preview-timestamp" aria-hidden="true">Today at 12:00 PM</span></div>${message ? `<div class="discord-preview-content">${previewMessageMarkup(snapshot, message)}</div>` : ''}${embed || (!message ? '<p class="discord-preview-empty">Your announcement preview appears here.</p>' : '')}</div></div>`;
}

function announcementCanPost(snapshot, state, featureEnabled) {
  if (!featureEnabled || !announcementHasPostableContent(state)) return false;
  const channel = announcementDestinationOptions(snapshot).find(item => String(item.id) === String(state.destinationId || ''));
  if (!channel) return false;
  if (announcementHasEmbed(state) && channel.embed_links !== true) return false;
  return true;
}

// The one problem that blocks sending: no permitted channel, or a channel that cannot take the embed.
export function announcementBlockingProblem(snapshot, composer) {
  const options = announcementDestinationOptions(snapshot);
  if (!options.length) return "Rob-bot can't send messages in any text channel.";
  const channel = options.find(item => String(item.id) === String(composer?.destinationId || ''));
  if (channel && announcementHasEmbed(composer) && channel.embed_links !== true) return "Rob-bot can't embed links in that channel.";
  return '';
}

function announcementColorMarkup(composer) {
  const picker = hexToHsv(composer.color);
  return `<div class="content-color-field"><span class="control-field-label">Embed color</span><button class="content-color-swatch" id="announcement-color-swatch" type="button" data-announcement-color-swatch aria-haspopup="dialog" aria-expanded="false" style="--swatch:#${escapeHtml(composer.color)}"><span aria-hidden="true"></span><strong>#${escapeHtml(composer.color)}</strong></button><div class="content-color-popover" data-announcement-color-popover role="dialog" aria-label="Embed color picker" hidden><div class="content-color-popover-heading"><strong>Embed color</strong><button type="button" data-announcement-color-close aria-label="Close color picker">Close</button></div><div class="content-color-selected-row"><span class="content-color-selected" data-announcement-color-preview style="--swatch:#${escapeHtml(composer.color)}" aria-hidden="true"></span><output data-announcement-color-output>#${escapeHtml(composer.color)}</output></div><div class="content-color-plane" data-announcement-color-plane role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${picker.s}" aria-valuetext="Saturation ${picker.s}%, brightness ${picker.v}%" data-saturation="${picker.s}" data-value="${picker.v}" style="--picker-hue:${picker.h};--picker-saturation:${picker.s}%;--picker-value:${picker.v}%"><span aria-hidden="true"></span></div><label class="content-color-hue-field">Hue<input type="range" min="0" max="359" step="1" value="${picker.h}" data-announcement-color-hue aria-label="Hue"></label><div class="content-color-values"><label>Hex<input type="text" id="announcement-color" maxlength="7" inputmode="text" autocomplete="off" spellcheck="false" data-announcement-color value="#${escapeHtml(composer.color)}" aria-label="Hex color"></label>${['r', 'g', 'b'].map(channel => `<label>${channel.toUpperCase()}<input type="number" min="0" max="255" step="1" inputmode="numeric" data-announcement-color-${channel} aria-label="${channel.toUpperCase()} value"></label>`).join('')}</div><div class="content-color-presets" role="group" aria-label="Color presets">${COLOR_PRESETS.map(color => `<button type="button" data-announcement-color-preset="${color}" aria-label="Use ${color} preset" style="--swatch:#${color}"><span aria-hidden="true"></span></button>`).join('')}</div><button type="button" class="content-color-reset" data-announcement-color-reset>Reset</button></div></div>`;
}

const OPERATION_STATUS = '<p class="control-composer-status" data-content-operation role="status" aria-live="polite"></p>';

function announcementMarkup(state, snapshot) {
  const composer = ensureAnnouncementComposer(snapshot);
  const destinations = announcementDestinationOptions(snapshot);
  const value = state.draft ?? state.persisted;
  const canPost = announcementCanPost(snapshot, composer, value.enabled);
  const problem = announcementBlockingProblem(snapshot, composer);
  const destinationOptions = destinations.map(channel => `<option value="${escapeHtml(channel.id)}"${String(channel.id) === String(composer.destinationId) ? ' selected' : ''}>#${escapeHtml(channel.name)}</option>`).join('');
  const more = `${fieldMarkup({ id: 'announcement-message', label: 'Text above the message', hint: 'Mentions like @everyone, <@&role> or <@user> go here.', control: textArea({ id: 'announcement-message', value: composer.message, maxlength: 2000, rows: 3, attributes: 'data-announcement-message', placeholder: 'Literal Discord syntax: <@123>, <@&456>, <#789>, @everyone, @here' }) })}
    ${fieldMarkup({ id: 'announcement-footer', label: 'Footer', control: textInput({ id: 'announcement-footer', value: composer.footer, maxlength: 2048, attributes: 'data-announcement-footer' }) })}
    ${announcementColorMarkup(composer)}
    ${fieldMarkup({ id: 'announcement-image', label: 'Image URL', control: textInput({ id: 'announcement-image', type: 'url', value: composer.imageUrl, maxlength: 1000, attributes: 'data-announcement-image', placeholder: 'https://example.com/image.png' }) })}`;
  const composerMarkup = `<section class="control-composer" aria-label="Announcement">
      <div class="control-field"${problem ? ' data-problem' : ''}>
        <label class="control-field-label" for="announcement-destination">Destination</label>
        <select id="announcement-destination" data-announcement-destination>${destinationOptions || '<option value="">No permitted text channels</option>'}</select>
        <div data-announcement-problem>${problemLine(problem)}</div>
      </div>
      ${fieldMarkup({ id: 'announcement-title', label: 'Title', control: textInput({ id: 'announcement-title', value: composer.title, maxlength: 256, attributes: 'data-announcement-title' }) })}
      ${fieldMarkup({ id: 'announcement-body', label: 'Message', control: textArea({ id: 'announcement-body', value: composer.body, maxlength: 4096, rows: 6, attributes: 'data-announcement-body' }) })}
      ${disclosure({ id: 'announcement-more', label: 'More options', body: `<div class="control-item-fields">${more}</div>` })}
      <div class="control-composer-actions">
        <button class="content-clear-action" type="button" data-announcement-clear>Clear all</button>
        ${OPERATION_STATUS}
        <button class="control-button control-button-primary" type="button" data-announcement-send${canPost ? '' : ' disabled'}>Send announcement</button>
      </div>
    </section>`;
  const preview = `<aside class="control-preview" aria-labelledby="announcement-preview-heading"><h2 id="announcement-preview-heading">Preview</h2><div class="discord-preview-shell" data-announcement-preview>${announcementPreviewMarkup(snapshot, composer)}</div></aside>`;
  return contentFrame(ANNOUNCEMENTS, state, {
    enabled: value.enabled,
    body: `${masterRows({ title: 'Announcements', label: 'Send announcements from Control', offHint: "Announcements can't be sent from Control.", enabled: value.enabled })}
      <div class="control-composer-layout">${composerMarkup}${preview}</div>`,
  });
}

function liveSendBlocked(snapshot) {
  const id = mappedResourceId(snapshot, 'live_announcements') || mappedResourceId(snapshot, 'announcements');
  if (!id) return true;
  const channel = (snapshot?.channels || []).find(item => String(item.id) === String(id));
  // A mapped channel that no longer exists in Discord blocks posting just like a missing permission.
  if (!channel) return true;
  return channel.send_messages === false;
}

function liveMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const pingRole = resource(snapshot, 'live_ping_role');
  const pingAvailable = Boolean(pingRole?.id && pingRole.exists);
  const canPost = Boolean(state.persisted.enabled) && !liveSendBlocked(snapshot);
  const pingRow = settingsRows(settingRow({
    label: pingAvailable ? `Ping @${pingRole.name || 'Live role'}` : 'Ping a role',
    hint: pingAvailable ? '' : 'Choose a ping role under Channels.',
    controlId: 'live-ping',
    control: switchMarkup({ id: 'live-ping', checked: pingAvailable && liveComposerState.ping, attributes: `data-live-ping${pingAvailable ? '' : ' disabled'}` }),
  }));
  const composer = `<section class="control-composer" aria-label="Live notice">
      ${fieldMarkup({ id: 'live-topic', label: 'Topic', control: textInput({ id: 'live-topic', value: liveComposerState.topic, maxlength: 200, attributes: 'data-live-topic', placeholder: 'Optional stream topic' }) })}
      ${pingRow}
      <div class="control-composer-actions">
        ${OPERATION_STATUS}
        <button class="control-button control-button-primary" type="button" data-live-send${canPost ? '' : ' disabled'}>Post live notice</button>
      </div>
    </section>`;
  return contentFrame(LIVE, state, {
    enabled: value.enabled,
    body: `${masterRows({ title: 'Live', label: 'Post live notices', offHint: "Live notices can't be posted from Control.", enabled: value.enabled })}
      ${supportResourceSection(LIVE, state, snapshot, 'Channels', { labels: { live_announcements: 'Posts to', live_ping_role: 'Ping role' } })}
      ${composer}`,
  });
}

export function createContentPageDefinition(pageKey) {
  const config = CONTENT_PAGE_CONFIGS[pageKey];
  if (!config) throw new Error(`Unknown Content page: ${pageKey}`);

  return {
    pageKey,
    editOnMount: true,

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
      if (config.kind === 'feeds') return feedsMarkup(state, snapshot || {});
      if (config.kind === 'announcements') return announcementMarkup(state, snapshot || {});
      return liveMarkup(state, snapshot || {});
    },

    // Context content now lives in the page as rows, problems and the Channels section.
    renderContext() {
      return '';
    },

    install({ root, store = controlState, snapshot, onSave, onAction, onConfirm, rerender } = {}) {
      return installContentPageInteractions({ root, pageKey, store, snapshot, onSave, onAction, onConfirm, rerender });
    },
  };
}

export function registerContentPages() {
  for (const pageKey of Object.keys(CONTENT_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) registerControlPage(withResourceBindings(createContentPageDefinition(pageKey), featureResourceKeys(pageKey), { genericContext: 'never' }));
  }
}

function requireMappedId(snapshot, key, label) {
  const value = mappedResourceId(snapshot, key);
  if (!value) throw new Error(`${label} is not connected.`);
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
  if (!channelId) throw new Error('Live destination is not connected.');
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
    const preview = root.querySelector('[data-announcement-preview]');
    if (preview) preview.innerHTML = announcementPreviewMarkup(snapshot, composer);
    const problem = root.querySelector('[data-announcement-problem]');
    if (problem) {
      const text = announcementBlockingProblem(snapshot, composer);
      problem.innerHTML = problemLine(text);
      problem.closest('.control-field')?.toggleAttribute('data-problem', Boolean(text));
    }
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
    if (event.target?.closest?.('[data-content-save]')) { if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey)); return; }
    if (event.target?.closest?.('[data-content-discard]')) { store.discard(pageKey); rerender(); return; }
    if (event.target?.closest?.('[data-source-add]')) { let added = ''; store.updateDraft(pageKey, draft => { const source = cloneSource({ enabled: true }); draft.sources.push(source); added = sourceIdentity(source); }); setDisclosureOpen(`feed-source-${added}`, true); rerender(); return; }
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
      try { const action = buildLiveAction(snapshot, { topic: root.querySelector('[data-live-topic]')?.value || liveComposerState.topic || '', pingConfiguredRole: Boolean(root.querySelector('[data-live-ping]')?.checked) }); localStatus(root, 'Publishing Live notice…'); const posted = await performAction(action); if (posted) localStatus(root, 'Live notice posted.', 'good'); else localStatus(root, 'Live notice cancelled.'); } catch (error) { localStatus(root, error instanceof Error ? error.message : 'Live notice could not be posted.', 'bad'); }
    }
  };

  const onChange = event => {
    const feature = event.target?.closest?.('[data-content-field="enabled"]');
    if (feature) { store.updateDraft(pageKey, draft => { draft.enabled = Boolean(feature.checked); }); rerender(); return; }
    if (event.target?.closest?.('[data-live-ping]')) { liveComposerState.ping = Boolean(event.target.checked); return; }
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
    const sourceField = event.target?.closest?.('[data-source-field]');
    if (sourceField?.dataset?.sourceKey && sourceField.type !== 'checkbox') { onChange(event); return; }
    if (event.target?.closest?.('[data-live-topic]')) { liveComposerState.topic = event.target.value; return; }
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
