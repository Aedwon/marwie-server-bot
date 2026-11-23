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
  settingsRows,
  settingsSection,
  switchMarkup,
} from './control-components.js?v=25';
import { featureResourceKeys } from './control-resource-contract.js';
import { withResourceBindings } from './control-resource-bindings.js?v=3';
import {
  fieldMarkup,
  itemHead,
  itemRow,
  supportPageFrame,
  supportResourceSection,
  textArea,
  textInput,
} from './control-support-shared.js?v=2';

const TICKET_PAGE = '/control/utilities/ticket-configuration';
const NOTIFICATION_PAGE = '/control/utilities/notification-roles';
const ANONYMOUS_PAGE = '/control/utilities/anonymous-questions';

export const UTILITY_PAGE_CONFIGS = Object.freeze({
  [TICKET_PAGE]: Object.freeze({
    title: 'Tickets',
    description: 'Manage ticket intake and ticket types.',
  }),
  [NOTIFICATION_PAGE]: Object.freeze({
    title: 'Notification roles',
    description: 'Manage the self-assignable role panel.',
  }),
  [ANONYMOUS_PAGE]: Object.freeze({
    title: 'Anonymous Questions',
    description: 'Manage anonymous question intake without exposing submitter identity.',
  }),
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function featureEnabled(snapshot, name) {
  const row = (snapshot?.features || []).find(item => item?.name === name);
  return Boolean(row?.enabled);
}

function resourceFor(snapshot, key) {
  return (snapshot?.resources || []).find(item => item?.key === key) || {
    key,
    id: null,
    name: null,
    exists: false,
    kind: null,
  };
}

function cloneTicketState(value) {
  return {
    enabled: Boolean(value?.enabled),
    ticket_types: (value?.ticket_types || []).map(item => ({
      key: String(item?.key || ''),
      label: String(item?.label || ''),
      description: String(item?.description || ''),
      enabled: Boolean(item?.enabled),
      isNew: Boolean(item?.isNew),
    })),
  };
}

function ticketErrors(draft) {
  const errors = {};
  const rows = draft?.ticket_types || [];
  const seen = new Set();

  rows.forEach((item, index) => {
    const prefix = `ticket_types.${index}`;
    const key = String(item?.key || '').trim().toLowerCase();
    const label = String(item?.label || '').trim();
    const description = String(item?.description || '').trim();

    if (!key) {
      errors[`${prefix}.key`] = 'Ticket type key is required.';
    } else if (key.length > 32 || !/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      errors[`${prefix}.key`] = 'Use 1 to 32 lowercase letters, numbers, dashes, or underscores.';
    } else if (seen.has(key)) {
      errors[`${prefix}.key`] = 'Ticket type keys must be unique.';
    } else {
      seen.add(key);
    }

    if (!label) errors[`${prefix}.label`] = 'Label is required.';
    else if (label.length > 80) errors[`${prefix}.label`] = 'Label must be at most 80 characters.';

    if (!description) errors[`${prefix}.description`] = 'Description is required.';
    else if (description.length > 200) {
      errors[`${prefix}.description`] = 'Description must be at most 200 characters.';
    }

    if (item?.isNew && !item?.enabled) {
      errors[`${prefix}.enabled`] = 'A new ticket type must be enabled before it can be saved.';
    }
  });

  return errors;
}

function ticketDiff(persisted, draft) {
  const changes = [];
  if (Boolean(persisted?.enabled) !== Boolean(draft?.enabled)) {
    changes.push({
      action_type: 'set_feature',
      payload: { feature: 'tickets', enabled: Boolean(draft?.enabled) },
    });
  }

  const persistedByKey = new Map(
    (persisted?.ticket_types || []).map(item => [String(item.key), item]),
  );

  for (const item of draft?.ticket_types || []) {
    const key = String(item?.key || '').trim().toLowerCase();
    if (!key) continue;
    const current = persistedByKey.get(key);

    if (!current) {
      if (item.enabled) {
        changes.push({
          action_type: 'upsert_ticket_type',
          payload: {
            key,
            label: String(item.label || '').trim(),
            description: String(item.description || '').trim(),
          },
        });
      }
      continue;
    }

    if (current.enabled && !item.enabled) {
      changes.push({ action_type: 'disable_ticket_type', payload: { key } });
      continue;
    }

    const copyChanged = (
      String(current.label || '') !== String(item.label || '').trim()
      || String(current.description || '') !== String(item.description || '').trim()
    );
    if (item.enabled && (!current.enabled || copyChanged)) {
      changes.push({
        action_type: 'upsert_ticket_type',
        payload: {
          key,
          label: String(item.label || '').trim(),
          description: String(item.description || '').trim(),
        },
      });
    }
  }
  return changes;
}

function cloneNotificationState(value) {
  return {
    title: String(value?.title || ''),
    description: String(value?.description || ''),
    buttons: (value?.buttons || []).map(item => ({
      role_id: String(item?.role_id || ''),
      label: String(item?.label || ''),
      emoji: String(item?.emoji || ''),
      style: String(item?.style || 'primary'),
    })),
  };
}

function notificationErrors(draft) {
  const errors = {};
  const title = String(draft?.title || '').trim();
  const description = String(draft?.description || '').trim();
  const buttons = draft?.buttons || [];

  if (!title) errors.title = 'Panel title is required.';
  else if (title.length > 256) errors.title = 'Panel title must be at most 256 characters.';

  if (!description) errors.description = 'Panel description is required.';
  else if (description.length > 2000) {
    errors.description = 'Panel description must be at most 2000 characters.';
  }

  if (!buttons.length) errors.buttons = 'Add at least one notification role button.';
  if (buttons.length > 25) errors.buttons = 'At most 25 notification role buttons are supported.';

  const seenRoles = new Set();
  buttons.forEach((item, index) => {
    const prefix = `buttons.${index}`;
    const roleId = String(item?.role_id || '').trim();
    const label = String(item?.label || '').trim();
    const emoji = String(item?.emoji || '').trim();
    const style = String(item?.style || '').trim();

    if (!/^[1-9]\d*$/.test(roleId)) {
      errors[`${prefix}.role_id`] = 'Choose a Discord role.';
    } else if (seenRoles.has(roleId)) {
      errors[`${prefix}.role_id`] = 'Each role can appear only once.';
    } else {
      seenRoles.add(roleId);
    }

    if (!label) errors[`${prefix}.label`] = 'Button label is required.';
    else if (label.length > 80) errors[`${prefix}.label`] = 'Button label must be at most 80 characters.';
    if (emoji.length > 100) errors[`${prefix}.emoji`] = 'Emoji must be at most 100 characters.';
    if (!['primary', 'secondary', 'success', 'danger'].includes(style)) {
      errors[`${prefix}.style`] = 'Choose a supported button style.';
    }
  });

  return errors;
}

function notificationDiff(persisted, draft) {
  const current = cloneNotificationState(persisted);
  const next = cloneNotificationState(draft);
  if (JSON.stringify(current) === JSON.stringify(next)) return [];
  return [{
    action_type: 'save_notification_panel',
    payload: next,
  }];
}

function anonymousDiff(persisted, draft) {
  if (Boolean(persisted?.enabled) === Boolean(draft?.enabled)) return [];
  return [{
    action_type: 'set_feature',
    payload: { feature: 'anonymous_questions', enabled: Boolean(draft?.enabled) },
  }];
}

export function createUtilitiesPageDefinition(pageKey) {
  if (!UTILITY_PAGE_CONFIGS[pageKey]) {
    throw new Error(`Unknown Utilities page: ${pageKey}`);
  }

  if (pageKey === TICKET_PAGE) {
    return {
      pageKey,
      editOnMount: true,
      selectPersisted(snapshot) {
        return {
          enabled: featureEnabled(snapshot, 'tickets'),
          ticket_types: (snapshot?.ticket_types || []).map(item => ({
            key: String(item?.key || ''),
            label: String(item?.label || ''),
            description: String(item?.description || ''),
            enabled: Boolean(item?.enabled),
            isNew: false,
          })),
        };
      },
      cloneDraft: cloneTicketState,
      validateDraft(draft) {
        return ticketErrors(draft);
      },
      diffDraft: ticketDiff,
      render({ state, snapshot } = {}) {
        return ticketPageMarkup(state, snapshot || {});
      },
      // Context content now lives in the page as rows, problems and the Channels section.
      renderContext() {
        return '';
      },
      install(context = {}) {
        return installUtilitiesPageInteractions({ ...context, pageKey });
      },
    };
  }

  if (pageKey === NOTIFICATION_PAGE) {
    return {
      pageKey,
      editOnMount: true,
      selectPersisted(snapshot) {
        const panel = snapshot?.notification_panel;
        return {
          title: String(panel?.title || ''),
          description: String(panel?.description || ''),
          buttons: (panel?.buttons || []).map(item => ({
            role_id: String(item?.role_id || ''),
            label: String(item?.label || ''),
            emoji: String(item?.emoji || ''),
            style: String(item?.style || 'primary'),
          })),
        };
      },
      cloneDraft: cloneNotificationState,
      validateDraft: notificationErrors,
      diffDraft: notificationDiff,
      render({ state, snapshot } = {}) {
        return notificationPageMarkup(state, snapshot || {});
      },
      // Context content now lives in the page as rows, problems and the Channels section.
      renderContext() {
        return '';
      },
      install(context = {}) {
        return installUtilitiesPageInteractions({ ...context, pageKey });
      },
    };
  }

  return {
    pageKey,
    editOnMount: true,
    selectPersisted(snapshot) {
      return { enabled: featureEnabled(snapshot, 'anonymous_questions') };
    },
    cloneDraft(value) {
      return { enabled: Boolean(value?.enabled) };
    },
    validateDraft() {
      return {};
    },
    diffDraft: anonymousDiff,
    render({ state, snapshot } = {}) {
      return anonymousPageMarkup(state, snapshot || {});
    },
    // Context content now lives in the page as rows, problems and the Channels section.
    renderContext() {
      return '';
    },
    install(context = {}) {
      return installUtilitiesPageInteractions({ ...context, pageKey });
    },
  };
}

export function registerUtilitiesPages() {
  for (const pageKey of Object.keys(UTILITY_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) {
      registerControlPage(withResourceBindings(createUtilitiesPageDefinition(pageKey), featureResourceKeys(pageKey), { genericContext: 'never' }));
    }
  }
}

function manageableRoles(snapshot) {
  const top = Number(snapshot?.bot?.top_role_position || 0);
  return (snapshot?.roles || [])
    .filter(role => role && !role.managed && (!top || Number(role.position || 0) < top))
    .sort((left, right) => Number(right.position || 0) - Number(left.position || 0));
}

function roleOptions(snapshot, selected) {
  const options = manageableRoles(snapshot);
  const selectedId = String(selected || '');
  const hasSelected = options.some(role => String(role.id) === selectedId);
  return `
    <option value="">Choose a role…</option>
    ${selectedId && !hasSelected ? `<option value="${escapeHtml(selectedId)}" selected>Current role unavailable</option>` : ''}
    ${options.map(role => `<option value="${escapeHtml(role.id)}"${String(role.id) === selectedId ? ' selected' : ''}>${escapeHtml(role.name)}</option>`).join('')}`;
}

function availableServerEmojis(snapshot) {
  return (snapshot?.emojis || [])
    .filter(emoji => emoji && emoji.id && emoji.name && emoji.available !== false)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function customEmojiValue(emoji) {
  const prefix = emoji?.animated ? 'a' : '';
  return `<${prefix}:${String(emoji?.name || '')}:${String(emoji?.id || '')}>`;
}

function parseCustomEmoji(value) {
  const match = String(value || '').match(/^<(a?):([^:>]+):([1-9]\d*)>$/);
  if (!match) return null;
  return {
    animated: match[1] === 'a',
    name: match[2],
    id: match[3],
  };
}

function serverEmojiForValue(snapshot, value) {
  const parsed = parseCustomEmoji(value);
  if (!parsed) return null;
  return availableServerEmojis(snapshot).find(emoji => String(emoji.id) === parsed.id) || null;
}

function emojiImageMarkup(emoji, className = 'utility-emoji-image') {
  if (!emoji?.url) return '';
  return `<img class="${className}" src="${escapeHtml(emoji.url)}" alt="" aria-hidden="true">`;
}

function emojiSummaryMarkup(snapshot, value) {
  const selected = String(value || '');
  if (!selected) {
    return '<span class="utility-emoji-placeholder" aria-hidden="true">—</span><span>None</span>';
  }
  const emoji = serverEmojiForValue(snapshot, selected);
  if (emoji) {
    return `${emojiImageMarkup(emoji)}<span>${escapeHtml(emoji.name)}${emoji.animated ? ' <small>Animated</small>' : ''}</span>`;
  }
  const parsed = parseCustomEmoji(selected);
  if (parsed) {
    return `<span class="utility-emoji-placeholder" aria-hidden="true">?</span><span>Current emoji unavailable <small>:${escapeHtml(parsed.name)}:</small></span>`;
  }
  return `<span class="utility-emoji-placeholder" aria-hidden="true">?</span><span>${escapeHtml(selected)}</span>`;
}

function emojiPickerMarkup(snapshot, selected, index, error) {
  const selectedValue = String(selected || '');
  const emojis = availableServerEmojis(snapshot);
  const hasSelected = !selectedValue || emojis.some(emoji => customEmojiValue(emoji) === selectedValue);
  const stale = selectedValue && !hasSelected;
  return `
    <div class="utility-emoji-field" data-notification-emoji-picker>
      <span class="control-field-label" id="notification-emoji-label-${index}">Emoji</span>
      <details class="utility-emoji-combobox">
        <summary aria-label="Choose emoji for button ${index + 1}">
          <span class="utility-emoji-current">${emojiSummaryMarkup(snapshot, selectedValue)}</span>
          <span class="utility-emoji-chevron" aria-hidden="true"></span>
        </summary>
        <div class="utility-emoji-menu">
          <label class="utility-emoji-search-label">
            <span class="sr-only">Search server emoji</span>
            <input type="search" placeholder="Search server emoji…" autocomplete="off" data-notification-emoji-search="true">
          </label>
          <div class="utility-emoji-options" role="listbox" aria-label="Server emoji">
            <button class="utility-emoji-option" type="button" role="option" aria-selected="${!selectedValue}" data-notification-emoji-option="" data-emoji-name="none">
              <span class="utility-emoji-none" aria-hidden="true">—</span><span>None</span>
            </button>
            ${stale ? `
              <button class="utility-emoji-option utility-emoji-option-stale" type="button" role="option" aria-selected="true" data-notification-emoji-option="${escapeHtml(selectedValue)}" data-emoji-name="current emoji unavailable" disabled>
                <span class="utility-emoji-none" aria-hidden="true">?</span><span>Current emoji unavailable</span>
              </button>` : ''}
            ${emojis.map(emoji => {
              const value = customEmojiValue(emoji);
              return `
                <button class="utility-emoji-option" type="button" role="option" aria-selected="${value === selectedValue}" data-notification-emoji-option="${escapeHtml(value)}" data-emoji-name="${escapeHtml(emoji.name.toLowerCase())}">
                  ${emojiImageMarkup(emoji)}<span>${escapeHtml(emoji.name)}${emoji.animated ? ' <small>Animated</small>' : ''}</span>
                </button>`;
            }).join('')}
          </div>
        </div>
      </details>
      <input type="hidden" value="${escapeHtml(selectedValue)}" data-notification-field="emoji">
      ${error ? problemLine(error) : ''}
    </div>`;
}

function previewEmojiMarkup(snapshot, value) {
  const selected = String(value || '');
  if (!selected) return '';
  const emoji = serverEmojiForValue(snapshot, selected);
  if (emoji) {
    return `${emojiImageMarkup(emoji, 'utility-discord-button-emoji')}<span class="sr-only">:${escapeHtml(emoji.name)}:</span>`;
  }
  const parsed = parseCustomEmoji(selected);
  if (parsed) return `<span class="utility-discord-button-emoji-fallback">:${escapeHtml(parsed.name)}:</span>`;
  return `<span class="utility-discord-button-emoji-fallback">${escapeHtml(selected)}</span>`;
}

function notificationPanelChannelName(snapshot) {
  const resource = (snapshot?.resources || []).find(item => item?.key === 'role_panel');
  return String(resource?.name || '').trim() || 'role-panel';
}

function notificationPreviewButtonRows(buttons) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) rows.push(buttons.slice(index, index + 5));
  return rows;
}

function notificationPreviewBodyMarkup(panel, snapshot) {
  const title = String(panel?.title || '').trim();
  const description = String(panel?.description || '').trim();
  const buttons = panel?.buttons || [];
  const rows = notificationPreviewButtonRows(buttons);
  return `
    <div class="discord-preview-channel"><span class="discord-preview-channel-icon" aria-hidden="true">#</span><span>${escapeHtml(notificationPanelChannelName(snapshot))}</span></div>
    <div class="discord-preview-message">
      <img class="discord-preview-avatar" src="/rob-robin.jpg?v=1" alt="" aria-hidden="true">
      <div class="discord-preview-body">
        <div class="discord-preview-author"><strong>Rob-bot</strong><span class="discord-bot-label">APP</span><span class="discord-preview-timestamp" aria-hidden="true">Today at 12:00 PM</span></div>
        <div class="utility-discord-embed discord-embed" style="--embed-color:#5865f2">
          <h4 class="discord-embed-title">${escapeHtml(title || 'Panel title')}</h4>
          <p class="discord-embed-description">${escapeHtml(description || 'Panel description').replaceAll('\n', '<br>')}</p>
        </div>
        ${rows.length ? rows.map(row => `
          <div class="utility-discord-action-row">
            ${row.map(item => `
              <button class="utility-discord-button utility-discord-button-${escapeHtml(item.style || 'primary')}" type="button" data-notification-preview-button disabled>
                ${previewEmojiMarkup(snapshot, item.emoji)}<span>${escapeHtml(String(item.label || '').trim() || 'Button label')}</span>
              </button>`).join('')}
          </div>`).join('') : '<p class="utility-discord-no-buttons">No buttons yet</p>'}
      </div>
    </div>`;
}

function updateTicketDraftFromField(store, pageKey, field) {
  const row = field.closest?.('[data-ticket-row]');
  const index = Number(row?.dataset?.ticketRow);
  const name = field.dataset?.ticketField;
  if (!Number.isInteger(index) || !name) return false;

  store.updateDraft(pageKey, draft => {
    const item = draft.ticket_types[index];
    if (!item) return;
    item[name] = name === 'enabled' ? Boolean(field.checked) : String(field.value);
    if (name === 'key') item.key = String(field.value).trim().toLowerCase();
  });
  return true;
}

function updateNotificationDraftFromField(store, pageKey, field) {
  const panelField = field.dataset?.notificationPanelField;
  if (panelField) {
    store.updateDraft(pageKey, draft => {
      draft[panelField] = String(field.value);
    });
    return true;
  }

  const row = field.closest?.('[data-notification-row]');
  const index = Number(row?.dataset?.notificationRow);
  const name = field.dataset?.notificationField;
  if (!Number.isInteger(index) || !name) return false;
  store.updateDraft(pageKey, draft => {
    if (draft.buttons[index]) draft.buttons[index][name] = String(field.value);
  });
  return true;
}

function filterNotificationEmojiOptions(field) {
  const picker = field.closest?.('[data-notification-emoji-picker]');
  const query = String(field.value || '').trim().toLowerCase();
  const options = picker?.querySelectorAll?.('[data-notification-emoji-option]') || [];
  for (const option of options) {
    const isSelected = option.getAttribute?.('aria-selected') === 'true';
    const name = String(option.dataset?.emojiName || option.textContent || '').toLowerCase();
    const isNone = String(option.dataset?.notificationEmojiOption || '') === '';
    option.hidden = Boolean(query) && !isSelected && !isNone && !name.includes(query);
  }
}


function utilityFrame(pageKey, state, { lede = '', enabled = null, body, className = '' }) {
  return supportPageFrame({
    pageKey,
    className: `utility-page${className ? ` ${className}` : ''}`,
    title: UTILITY_PAGE_CONFIGS[pageKey].title,
    lede,
    enabled,
    body,
    state,
    save: 'data-utility-save',
    discard: 'data-utility-discard',
  });
}

function masterRows({ title, label, offHint, enabled }) {
  return settingsRows(masterSwitchRow({
    label,
    offHint,
    checked: enabled,
    field: 'enabled',
    attribute: 'data-utility-feature',
  }), { label: `${title} settings` });
}

function ticketTypeRow(item, index, state) {
  const error = field => state?.errors?.[`ticket_types.${index}.${field}`] || '';
  const errors = { key: error('key'), label: error('label'), description: error('description'), enabled: error('enabled') };
  const disabledCopy = !item.enabled && !item.isNew;
  const attrs = field => `data-ticket-field="${field}"`;
  const id = `ticket-type-${index}`;
  const body = `${fieldMarkup({ id: `${id}-key`, label: 'Key', problem: errors.key, control: textInput({ id: `${id}-key`, value: item.key, maxlength: 32, attributes: attrs('key'), readonly: !item.isNew, invalid: Boolean(errors.key) }) })}
    ${fieldMarkup({ id: `${id}-label`, label: 'Label', problem: errors.label, control: textInput({ id: `${id}-label`, value: item.label, maxlength: 80, attributes: attrs('label'), disabled: disabledCopy, invalid: Boolean(errors.label) }) })}
    ${fieldMarkup({ id: `${id}-description`, label: 'Description', problem: errors.description, control: textInput({ id: `${id}-description`, value: item.description, maxlength: 200, attributes: attrs('description'), disabled: disabledCopy, invalid: Boolean(errors.description) }) })}
    ${errors.enabled ? problemLine(errors.enabled) : ''}
    ${item.isNew ? '<div class="control-item-actions"><button class="control-button control-button-secondary" type="button" data-ticket-remove>Remove ticket type</button></div>' : ''}`;
  return itemRow({
    id,
    rowKey: item.isNew ? `ticket:new-${index}` : `ticket:${item.key}`,
    head: itemHead(item.label || 'New ticket type', item.key, { mono: true }),
    aside: switchMarkup({ id: `${id}-enabled`, checked: item.enabled, label: `${item.label || 'New ticket type'} enabled`, attributes: attrs('enabled') }),
    body,
    error: Object.values(errors).some(Boolean),
    dataAttributes: `data-ticket-row="${index}"`,
  });
}

function ticketPageMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const list = value.ticket_types.length
    ? `<div class="control-question-list">${value.ticket_types.map((item, index) => ticketTypeRow(item, index, state)).join('')}</div>`
    : '<p class="control-empty-line">No ticket types yet. Add one to start taking tickets.</p>';
  return utilityFrame(TICKET_PAGE, state, {
    enabled: value.enabled,
    body: `${masterRows({ title: 'Tickets', label: 'Open tickets from the panel', offHint: "Members can't open tickets from the panel.", enabled: value.enabled })}
      ${settingsSection({ id: 'ticket-types-heading', title: 'Ticket types', body: `${list}<div class="control-list-add"><button class="control-button control-button-secondary" type="button" data-ticket-add>Add ticket type</button></div>` })}
      ${supportResourceSection(TICKET_PAGE, state, snapshot, 'Channels and category')}`,
  });
}

function notificationPreviewMarkup(panel, snapshot) {
  return `<aside class="control-preview" aria-labelledby="notification-preview-heading">
    <h2 id="notification-preview-heading">Preview</h2>
    <div class="utility-discord-preview" data-notification-preview-body>${notificationPreviewBodyMarkup(panel, snapshot)}</div>
  </aside>`;
}

function notificationButtonRow(item, index, state, snapshot) {
  const error = field => state?.errors?.[`buttons.${index}.${field}`] || '';
  const errors = { role_id: error('role_id'), label: error('label'), emoji: error('emoji'), style: error('style') };
  const id = `notification-button-${index}`;
  const roleName = (snapshot?.roles || []).find(role => String(role.id) === String(item.role_id))?.name || '';
  const roleControl = `<select id="${id}-role" data-notification-field="role_id"${errors.role_id ? ' aria-invalid="true"' : ''}>${roleOptions(snapshot, item.role_id)}</select>`;
  const styleControl = `<select id="${id}-style" data-notification-field="style"${errors.style ? ' aria-invalid="true"' : ''}>${['primary', 'secondary', 'success', 'danger'].map(style => `<option value="${style}"${item.style === style ? ' selected' : ''}>${style[0].toUpperCase()}${style.slice(1)}</option>`).join('')}</select>`;
  const body = `${fieldMarkup({ id: `${id}-role`, label: 'Role', problem: errors.role_id, control: roleControl })}
    ${fieldMarkup({ id: `${id}-label`, label: 'Label', problem: errors.label, control: textInput({ id: `${id}-label`, value: item.label, maxlength: 80, attributes: 'data-notification-field="label"', invalid: Boolean(errors.label) }) })}
    ${emojiPickerMarkup(snapshot, item.emoji, index, errors.emoji)}
    ${fieldMarkup({ id: `${id}-style`, label: 'Style', problem: errors.style, control: styleControl })}
    <div class="control-item-actions"><button class="control-button control-button-secondary" type="button" data-notification-remove>Remove button</button></div>`;
  return itemRow({
    id,
    rowKey: `button:${index}`,
    head: itemHead(item.label || 'New button', roleName),
    body,
    error: Object.values(errors).some(Boolean),
    dataAttributes: `data-notification-row="${index}"`,
  });
}

function notificationPageMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const buttonError = state.errors?.buttons || '';
  const list = value.buttons.length
    ? `<div class="control-question-list">${value.buttons.map((item, index) => notificationButtonRow(item, index, state, snapshot)).join('')}</div>`
    : '<p class="control-empty-line">No buttons yet. Add one to build the panel.</p>';
  const panel = `<div class="control-fields">
      ${fieldMarkup({ id: 'notification-title', label: 'Panel title', problem: state.errors?.title, control: textInput({ id: 'notification-title', value: value.title, maxlength: 256, attributes: 'data-notification-panel-field="title"', invalid: Boolean(state.errors?.title) }) })}
      ${fieldMarkup({ id: 'notification-description', label: 'Panel description', problem: state.errors?.description, control: textArea({ id: 'notification-description', value: value.description, maxlength: 2000, rows: 4, attributes: 'data-notification-panel-field="description"', invalid: Boolean(state.errors?.description) }) })}
    </div>`;
  const buttons = settingsSection({
    id: 'notification-buttons-heading',
    title: 'Buttons',
    body: `${list}${buttonError ? `<div class="control-rows-note">${problemLine(buttonError)}</div>` : ''}<div class="control-list-add"><button class="control-button control-button-secondary" type="button" data-notification-add${value.buttons.length >= 25 ? ' disabled' : ''}>Add button</button></div>`,
  });
  return utilityFrame(NOTIFICATION_PAGE, state, {
    className: 'utility-notification-page',
    body: `<div class="control-composer-layout">
      <div class="control-composer-main">${panel}${buttons}${supportResourceSection(NOTIFICATION_PAGE, state, snapshot, 'Channels')}</div>
      ${notificationPreviewMarkup(value, snapshot)}
    </div>`,
  });
}

function anonymousPageMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  return utilityFrame(ANONYMOUS_PAGE, state, {
    lede: 'Members submit questions without their name, and staff review each one before it is posted.',
    enabled: value.enabled,
    body: `${masterRows({ title: 'Anonymous Questions', label: 'Accept anonymous questions', offHint: "Members can't submit anonymous questions.", enabled: value.enabled })}
      ${supportResourceSection(ANONYMOUS_PAGE, state, snapshot, 'Channels')}`,
  });
}

function updateNotificationEmojiFromOption(store, pageKey, option) {
  const row = option.closest?.('[data-notification-row]');
  const index = Number(row?.dataset?.notificationRow);
  if (!Number.isInteger(index)) return false;
  store.updateDraft(pageKey, draft => {
    if (draft.buttons[index]) draft.buttons[index].emoji = String(option.dataset?.notificationEmojiOption || '');
  });
  return true;
}

export function installUtilitiesPageInteractions({
  root,
  pageKey,
  store = controlState,
  onSave,
  rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const onClick = event => {
    if (event.target?.closest?.('[data-utility-save]')) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }
    if (event.target?.closest?.('[data-utility-discard]')) {
      store.discard(pageKey);
      rerender();
      return;
    }

    if (pageKey === TICKET_PAGE && event.target?.closest?.('[data-ticket-add]')) {
      let added = 0;
      store.updateDraft(pageKey, draft => {
        added = draft.ticket_types.push({ key: '', label: '', description: '', enabled: true, isNew: true }) - 1;
      });
      setDisclosureOpen(`ticket-type-${added}`, true);
      rerender();
      return;
    }
    const ticketRemove = event.target?.closest?.('[data-ticket-remove]');
    if (pageKey === TICKET_PAGE && ticketRemove) {
      const index = Number(ticketRemove.closest?.('[data-ticket-row]')?.dataset?.ticketRow);
      store.updateDraft(pageKey, draft => {
        if (Number.isInteger(index) && draft.ticket_types[index]?.isNew) draft.ticket_types.splice(index, 1);
      });
      rerender();
      return;
    }

    if (pageKey === NOTIFICATION_PAGE && event.target?.closest?.('[data-notification-add]')) {
      let added = 0;
      store.updateDraft(pageKey, draft => {
        if (draft.buttons.length < 25) added = draft.buttons.push({ role_id: '', label: '', emoji: '', style: 'primary' }) - 1;
      });
      setDisclosureOpen(`notification-button-${added}`, true);
      rerender();
      return;
    }
    const notificationRemove = event.target?.closest?.('[data-notification-remove]');
    if (pageKey === NOTIFICATION_PAGE && notificationRemove) {
      const index = Number(notificationRemove.closest?.('[data-notification-row]')?.dataset?.notificationRow);
      store.updateDraft(pageKey, draft => {
        if (Number.isInteger(index) && draft.buttons[index]) draft.buttons.splice(index, 1);
      });
      rerender();
      return;
    }
    const emojiOption = event.target?.closest?.('[data-notification-emoji-option]');
    if (pageKey === NOTIFICATION_PAGE && emojiOption && !emojiOption.disabled) {
      if (updateNotificationEmojiFromOption(store, pageKey, emojiOption)) rerender();
    }
  };

  // Typed text reaches the draft on every keystroke; the app re-render keeps focus by element id.
  const onInput = event => {
    const field = event.target;
    if (pageKey === NOTIFICATION_PAGE && field?.dataset?.notificationEmojiSearch !== undefined) {
      filterNotificationEmojiOptions(field);
      return;
    }
    if (pageKey === TICKET_PAGE && field?.dataset?.ticketField && field.type !== 'checkbox') {
      if (updateTicketDraftFromField(store, pageKey, field)) rerender();
    } else if (
      pageKey === NOTIFICATION_PAGE
      && (field?.dataset?.notificationPanelField || field?.dataset?.notificationField)
      && field.tagName !== 'SELECT'
      && field.type !== 'hidden'
    ) {
      if (updateNotificationDraftFromField(store, pageKey, field)) rerender();
    }
  };

  const onChange = event => {
    if (event.target?.dataset?.utilityFeature !== undefined) {
      store.updateDraft(pageKey, draft => { draft.enabled = Boolean(event.target.checked); });
      rerender();
      return;
    }
    if (pageKey === TICKET_PAGE && event.target?.dataset?.ticketField) {
      if (updateTicketDraftFromField(store, pageKey, event.target)) rerender();
      return;
    }
    if (
      pageKey === NOTIFICATION_PAGE
      && (event.target?.dataset?.notificationPanelField || event.target?.dataset?.notificationField)
      && event.target.type !== 'hidden'
    ) {
      if (updateNotificationDraftFromField(store, pageKey, event.target)) rerender();
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
  };
}
