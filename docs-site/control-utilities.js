import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';

const TICKET_PAGE = '/control/utilities/ticket-configuration';
const NOTIFICATION_PAGE = '/control/utilities/notification-roles';
const ANONYMOUS_PAGE = '/control/utilities/anonymous-questions';

export const UTILITY_PAGE_CONFIGS = Object.freeze({
  [TICKET_PAGE]: Object.freeze({
    title: 'Ticket configuration',
    description: 'Manage the ticket feature and ticket types.',
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

function resourceState(row) {
  if (row?.id && row.exists) return { label: 'Connected', tone: 'good' };
  if (row?.id) return { label: 'Unavailable / stale', tone: 'bad' };
  return { label: 'Not connected', tone: 'neutral' };
}

function resourceSummaryMarkup(snapshot, items) {
  return `
    <section class="utility-section" aria-labelledby="utility-mappings-heading">
      <div class="utility-section-heading">
        <div>
          <h2 id="utility-mappings-heading">Discord destinations</h2>
          <p>Mappings owns these resource connections. They are read-only here.</p>
        </div>
      </div>
      <div class="utility-resource-list">
        ${items.map(item => {
          const row = resourceFor(snapshot, item.key);
          const state = resourceState(row);
          const current = row?.id && row.exists
            ? (row.name || 'Connected Discord resource')
            : row?.id
              ? 'Previously connected resource is unavailable'
              : 'No resource connected';
          return `
            <div class="utility-resource-row">
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(current)}</span>
              </div>
              <div class="utility-resource-actions">
                <span class="utility-health" data-tone="${state.tone}">${escapeHtml(state.label)}</span>
                <a href="${escapeHtml(item.href)}">Manage in Mappings</a>
              </div>
            </div>`;
        }).join('')}
      </div>
    </section>`;
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
    if (emoji.length > 32) errors[`${prefix}.emoji`] = 'Emoji must be at most 32 characters.';
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
        return ticketPageMarkup({ state, snapshot });
      },
      install(context = {}) {
        return installUtilitiesPageInteractions({ ...context, pageKey });
      },
    };
  }

  if (pageKey === NOTIFICATION_PAGE) {
    return {
      pageKey,
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
        return notificationPageMarkup({ state, snapshot });
      },
      install(context = {}) {
        return installUtilitiesPageInteractions({ ...context, pageKey });
      },
    };
  }

  return {
    pageKey,
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
      return anonymousPageMarkup({ state, snapshot });
    },
    install(context = {}) {
      return installUtilitiesPageInteractions({ ...context, pageKey });
    },
  };
}

export function registerUtilitiesPages() {
  for (const pageKey of Object.keys(UTILITY_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) {
      registerControlPage(createUtilitiesPageDefinition(pageKey));
    }
  }
}

function pageFeedback(state) {
  if (state?.saveError) {
    return `<p class="utility-message" role="alert">${escapeHtml(state.saveError)}</p>`;
  }
  if (state?.status === 'conflict') {
    return '<p class="utility-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>';
  }
  if (state?.retryChanges?.length) {
    return '<p class="utility-message" role="alert">A Discord-side update did not finish. Your draft is preserved so you can retry it.</p>';
  }
  if (state?.status === 'saved') {
    return '<p class="utility-message" role="status">Changes saved.</p>';
  }
  return '';
}

function pageHeader(title, description, state) {
  const editing = state?.mode === 'edit';
  return `
    <header class="utility-page-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      ${editing ? '' : '<button class="control-button control-button-primary" type="button" data-utility-edit>Edit settings</button>'}
    </header>
    ${pageFeedback(state)}`;
}

function saveActions(state) {
  const errors = Object.keys(state?.errors || {}).length;
  const canSave = Boolean(state?.dirty && !errors && state?.status !== 'saving' && state?.revision);
  return `
    <div class="utility-save-bar">
      <span data-utility-save-state>${state?.status === 'saving' ? 'Saving changes…' : state?.dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
      <div>
        <button class="control-button control-button-primary" type="button" data-utility-save${canSave ? '' : ' disabled'}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button>
        <button class="control-button control-button-secondary" type="button" data-utility-discard${state?.status === 'saving' ? ' disabled' : ''}>Discard</button>
      </div>
    </div>`;
}

function toggleMarkup({ id, checked, label, help }) {
  return `
    <label class="utility-toggle" for="${escapeHtml(id)}">
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(help)}</small></span>
      <input id="${escapeHtml(id)}" type="checkbox"${checked ? ' checked' : ''}>
    </label>`;
}

function ticketReadRows(types) {
  if (!types.length) return '<p class="utility-empty">No ticket types are configured.</p>';
  return `
    <div class="utility-data-list">
      ${types.map(item => `
        <div class="utility-data-row">
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <span><code>${escapeHtml(item.key)}</code> · ${escapeHtml(item.description)}</span>
          </div>
          <span class="utility-health" data-tone="${item.enabled ? 'good' : 'neutral'}">${item.enabled ? 'Active' : 'Disabled'}</span>
        </div>`).join('')}
    </div>`;
}

function ticketError(state, index, field) {
  return state?.errors?.[`ticket_types.${index}.${field}`] || '';
}

function ticketEditRows(state) {
  const rows = state?.draft?.ticket_types || [];
  if (!rows.length) {
    return '<p class="utility-empty">No ticket types yet. Add one to configure ticket intake.</p>';
  }

  return rows.map((item, index) => {
    const disabledCopy = !item.enabled && !item.isNew;
    const keyError = ticketError(state, index, 'key');
    const labelError = ticketError(state, index, 'label');
    const descriptionError = ticketError(state, index, 'description');
    const enabledError = ticketError(state, index, 'enabled');
    return `
      <fieldset class="utility-editor-row" data-ticket-row="${index}">
        <legend>Ticket type ${index + 1}</legend>
        <div class="utility-ticket-grid">
          <label>
            <span>Key</span>
            <input type="text" maxlength="32" value="${escapeHtml(item.key)}" data-ticket-field="key"${item.isNew ? '' : ' readonly'} aria-invalid="${Boolean(keyError)}">
            ${keyError ? `<small class="utility-field-error" role="alert">${escapeHtml(keyError)}</small>` : ''}
          </label>
          <label>
            <span>Label</span>
            <input type="text" maxlength="80" value="${escapeHtml(item.label)}" data-ticket-field="label"${disabledCopy ? ' disabled' : ''} aria-invalid="${Boolean(labelError)}">
            ${labelError ? `<small class="utility-field-error" role="alert">${escapeHtml(labelError)}</small>` : ''}
          </label>
          <label class="utility-wide">
            <span>Description</span>
            <input type="text" maxlength="200" value="${escapeHtml(item.description)}" data-ticket-field="description"${disabledCopy ? ' disabled' : ''} aria-invalid="${Boolean(descriptionError)}">
            ${descriptionError ? `<small class="utility-field-error" role="alert">${escapeHtml(descriptionError)}</small>` : ''}
          </label>
        </div>
        <div class="utility-row-footer">
          <label class="utility-inline-check">
            <input type="checkbox" data-ticket-field="enabled"${item.enabled ? ' checked' : ''}>
            Active
          </label>
          ${item.isNew ? '<button class="control-button control-button-secondary" type="button" data-ticket-remove>Remove</button>' : ''}
        </div>
        ${enabledError ? `<p class="utility-field-error" role="alert">${escapeHtml(enabledError)}</p>` : ''}
      </fieldset>`;
  }).join('');
}

function ticketPageMarkup({ state, snapshot } = {}) {
  if (!state?.persisted) {
    return '<section class="control-page utility-page"><h1>Ticket configuration</h1><p>Load current server state to manage tickets.</p></section>';
  }
  const editing = state.mode === 'edit';
  return `
    <section class="control-page utility-page" data-page-key="${TICKET_PAGE}">
      ${pageHeader('Ticket configuration', 'Manage the ticket feature and ticket types.', state)}
      <section class="utility-section" aria-labelledby="ticket-feature-heading">
        <div class="utility-section-heading">
          <div><h2 id="ticket-feature-heading">Ticket system</h2><p>Disabled ticket types stay visible and can be re-enabled later.</p></div>
        </div>
        ${editing
          ? toggleMarkup({
            id: 'utility-tickets-enabled',
            checked: state.draft.enabled,
            label: 'Tickets enabled',
            help: 'Controls whether members can use the ticket system.',
          }).replace('<input ', '<input data-utility-feature="tickets" ')
          : `<p class="utility-state-line"><strong>${state.persisted.enabled ? 'Enabled' : 'Disabled'}</strong></p>`}
      </section>
      <section class="utility-section" aria-labelledby="ticket-types-heading">
        <div class="utility-section-heading">
          <div><h2 id="ticket-types-heading">Ticket types</h2><p>Create, edit, disable, or re-enable the choices shown to members.</p></div>
          ${editing ? '<button class="control-button control-button-secondary" type="button" data-ticket-add>Add ticket type</button>' : ''}
        </div>
        ${editing ? ticketEditRows(state) : ticketReadRows(state.persisted.ticket_types)}
      </section>
      ${resourceSummaryMarkup(snapshot, [
        { key: 'ticket_panel', label: 'Ticket panel', href: '/control/mappings/channels' },
        { key: 'ticket_category', label: 'Ticket category', href: '/control/mappings/categories' },
        { key: 'ticket_logs', label: 'Ticket logs', href: '/control/mappings/channels' },
      ])}
      ${editing ? saveActions(state) : ''}
    </section>`;
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

function notificationRead(state) {
  const panel = state.persisted;
  if (!panel.title && !panel.description && !panel.buttons.length) {
    return '<p class="utility-empty">No notification role panel is configured.</p>';
  }
  return `
    <dl class="utility-summary">
      <div><dt>Title</dt><dd>${escapeHtml(panel.title || 'Not configured')}</dd></div>
      <div><dt>Description</dt><dd>${escapeHtml(panel.description || 'Not configured')}</dd></div>
      <div><dt>Buttons</dt><dd>${panel.buttons.length}</dd></div>
    </dl>
    ${panel.buttons.length ? `
      <div class="utility-data-list">
        ${panel.buttons.map(item => `
          <div class="utility-data-row">
            <div><strong>${escapeHtml(item.label)}</strong><span>Role ID ${escapeHtml(item.role_id)} · ${escapeHtml(item.style)}</span></div>
            <span>${escapeHtml(item.emoji || '')}</span>
          </div>`).join('')}
      </div>` : ''}`;
}

function notificationButtonRows(state, snapshot) {
  const rows = state?.draft?.buttons || [];
  if (!rows.length) return '<p class="utility-empty">Add at least one button.</p>';

  return rows.map((item, index) => {
    const roleError = state?.errors?.[`buttons.${index}.role_id`] || '';
    const labelError = state?.errors?.[`buttons.${index}.label`] || '';
    const emojiError = state?.errors?.[`buttons.${index}.emoji`] || '';
    const styleError = state?.errors?.[`buttons.${index}.style`] || '';
    return `
      <fieldset class="utility-editor-row" data-notification-row="${index}">
        <legend>Button ${index + 1}</legend>
        <div class="utility-notification-grid">
          <label>
            <span>Role</span>
            <select data-notification-field="role_id" aria-invalid="${Boolean(roleError)}">
              ${roleOptions(snapshot, item.role_id)}
            </select>
            ${roleError ? `<small class="utility-field-error" role="alert">${escapeHtml(roleError)}</small>` : ''}
          </label>
          <label>
            <span>Label</span>
            <input type="text" maxlength="80" value="${escapeHtml(item.label)}" data-notification-field="label" aria-invalid="${Boolean(labelError)}">
            ${labelError ? `<small class="utility-field-error" role="alert">${escapeHtml(labelError)}</small>` : ''}
          </label>
          <label>
            <span>Emoji</span>
            <input type="text" maxlength="32" value="${escapeHtml(item.emoji)}" data-notification-field="emoji" aria-invalid="${Boolean(emojiError)}">
            ${emojiError ? `<small class="utility-field-error" role="alert">${escapeHtml(emojiError)}</small>` : ''}
          </label>
          <label>
            <span>Style</span>
            <select data-notification-field="style" aria-invalid="${Boolean(styleError)}">
              ${['primary', 'secondary', 'success', 'danger'].map(style => `<option value="${style}"${item.style === style ? ' selected' : ''}>${style[0].toUpperCase()}${style.slice(1)}</option>`).join('')}
            </select>
            ${styleError ? `<small class="utility-field-error" role="alert">${escapeHtml(styleError)}</small>` : ''}
          </label>
        </div>
        <div class="utility-row-footer">
          <button class="control-button control-button-secondary" type="button" data-notification-remove>Remove button</button>
        </div>
      </fieldset>`;
  }).join('');
}

function notificationPageMarkup({ state, snapshot } = {}) {
  if (!state?.persisted) {
    return '<section class="control-page utility-page"><h1>Notification roles</h1><p>Load current server state to manage notification roles.</p></section>';
  }
  const editing = state.mode === 'edit';
  const buttonError = state?.errors?.buttons || '';
  return `
    <section class="control-page utility-page" data-page-key="${NOTIFICATION_PAGE}">
      ${pageHeader('Notification roles', 'Manage the self-assignable role panel.', state)}
      <section class="utility-section" aria-labelledby="notification-panel-heading">
        <div class="utility-section-heading">
          <div><h2 id="notification-panel-heading">Panel</h2><p>Destination wiring stays in Mappings.</p></div>
        </div>
        ${editing ? `
          <div class="utility-form-stack">
            <label>
              <span>Title</span>
              <input type="text" maxlength="256" value="${escapeHtml(state.draft.title)}" data-notification-panel-field="title" aria-invalid="${Boolean(state.errors?.title)}">
              ${state.errors?.title ? `<small class="utility-field-error" role="alert">${escapeHtml(state.errors.title)}</small>` : ''}
            </label>
            <label>
              <span>Description</span>
              <textarea maxlength="2000" rows="4" data-notification-panel-field="description" aria-invalid="${Boolean(state.errors?.description)}">${escapeHtml(state.draft.description)}</textarea>
              ${state.errors?.description ? `<small class="utility-field-error" role="alert">${escapeHtml(state.errors.description)}</small>` : ''}
            </label>
          </div>
          <div class="utility-section-heading utility-subheading">
            <div><h3>Buttons</h3><p>Choose the role, label, emoji, and visual style for each button.</p></div>
            <button class="control-button control-button-secondary" type="button" data-notification-add${state.draft.buttons.length >= 25 ? ' disabled' : ''}>Add button</button>
          </div>
          ${buttonError ? `<p class="utility-field-error" role="alert">${escapeHtml(buttonError)}</p>` : ''}
          ${notificationButtonRows(state, snapshot)}
        ` : notificationRead(state)}
      </section>
      ${resourceSummaryMarkup(snapshot, [
        { key: 'role_panel', label: 'Role panel destination', href: '/control/mappings/channels' },
      ])}
      ${editing ? saveActions(state) : ''}
    </section>`;
}

function anonymousPageMarkup({ state, snapshot } = {}) {
  if (!state?.persisted) {
    return '<section class="control-page utility-page"><h1>Anonymous Questions</h1><p>Load current server state to manage anonymous questions.</p></section>';
  }
  const editing = state.mode === 'edit';
  return `
    <section class="control-page utility-page" data-page-key="${ANONYMOUS_PAGE}">
      ${pageHeader('Anonymous Questions', 'Manage anonymous question intake without exposing submitter identity.', state)}
      <section class="utility-section" aria-labelledby="anonymous-state-heading">
        <div class="utility-section-heading">
          <div><h2 id="anonymous-state-heading">Submission intake</h2><p>Submitter identity remains outside Control and is not rendered on this page.</p></div>
        </div>
        ${editing
          ? toggleMarkup({
            id: 'utility-anonymous-enabled',
            checked: state.draft.enabled,
            label: 'Anonymous Questions enabled',
            help: 'Controls whether anonymous question submissions are accepted.',
          }).replace('<input ', '<input data-utility-feature="anonymous_questions" ')
          : `<p class="utility-state-line"><strong>${state.persisted.enabled ? 'Enabled' : 'Disabled'}</strong></p>`}
      </section>
      ${resourceSummaryMarkup(snapshot, [
        { key: 'anon_questions', label: 'Anonymous questions destination', href: '/control/mappings/channels' },
      ])}
      ${editing ? saveActions(state) : ''}
    </section>`;
}

function updateActionBar(root, store, pageKey) {
  const state = store.get(pageKey);
  const save = root.querySelector?.('[data-utility-save]');
  if (save) {
    save.disabled = !store.canSave(pageKey);
  }
  const status = root.querySelector?.('[data-utility-save-state]');
  if (status) {
    status.textContent = state.status === 'saving'
      ? 'Saving changes…'
      : state.dirty
        ? 'Unsaved changes'
        : 'No unsaved changes';
  }
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

export function installUtilitiesPageInteractions({
  root,
  pageKey,
  store = controlState,
  onSave,
  rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const onClick = event => {
    if (event.target?.closest?.('[data-utility-edit]')) {
      store.beginEdit(pageKey);
      rerender();
      return;
    }

    if (event.target?.closest?.('[data-utility-save]')) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }

    if (event.target?.closest?.('[data-utility-discard]')) {
      store.discard(pageKey);
      store.get(pageKey).mode = 'read';
      rerender();
      return;
    }

    if (pageKey === TICKET_PAGE && event.target?.closest?.('[data-ticket-add]')) {
      store.updateDraft(pageKey, draft => {
        draft.ticket_types.push({
          key: '',
          label: '',
          description: '',
          enabled: true,
          isNew: true,
        });
      });
      rerender();
      return;
    }

    const ticketRemove = event.target?.closest?.('[data-ticket-remove]');
    if (pageKey === TICKET_PAGE && ticketRemove) {
      const row = ticketRemove.closest?.('[data-ticket-row]');
      const index = Number(row?.dataset?.ticketRow);
      store.updateDraft(pageKey, draft => {
        if (Number.isInteger(index) && draft.ticket_types[index]?.isNew) {
          draft.ticket_types.splice(index, 1);
        }
      });
      rerender();
      return;
    }

    if (pageKey === NOTIFICATION_PAGE && event.target?.closest?.('[data-notification-add]')) {
      store.updateDraft(pageKey, draft => {
        if (draft.buttons.length < 25) {
          draft.buttons.push({ role_id: '', label: '', emoji: '', style: 'primary' });
        }
      });
      rerender();
      return;
    }

    const notificationRemove = event.target?.closest?.('[data-notification-remove]');
    if (pageKey === NOTIFICATION_PAGE && notificationRemove) {
      const row = notificationRemove.closest?.('[data-notification-row]');
      const index = Number(row?.dataset?.notificationRow);
      store.updateDraft(pageKey, draft => {
        if (Number.isInteger(index) && draft.buttons[index]) draft.buttons.splice(index, 1);
      });
      rerender();
    }
  };

  const onInput = event => {
    const field = event.target;
    let changed = false;
    if (pageKey === TICKET_PAGE && field?.dataset?.ticketField && field.type !== 'checkbox') {
      changed = updateTicketDraftFromField(store, pageKey, field);
    } else if (
      pageKey === NOTIFICATION_PAGE
      && (field?.dataset?.notificationPanelField || field?.dataset?.notificationField)
      && field.tagName !== 'SELECT'
    ) {
      changed = updateNotificationDraftFromField(store, pageKey, field);
    }
    if (changed) updateActionBar(root, store, pageKey);
  };

  const onChange = event => {
    const feature = event.target?.dataset?.utilityFeature;
    if (feature) {
      store.updateDraft(pageKey, draft => {
        draft.enabled = Boolean(event.target.checked);
      });
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
