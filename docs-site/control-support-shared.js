import {
  controlPageHeaderMarkup,
  disclosure,
  problemLine,
  saveBarStatusMarkup,
  settingRow,
  settingsRows,
  settingsSection,
} from './control-components.js?v=29';
import { featureResourceKeys } from './control-resource-contract.js';
import { resourceSelectMarkup } from './control-resource-bindings.js?v=7';
import { MAPPING_RESOURCE_DEFINITIONS } from './control-mappings.js';
import { problemsFromSnapshot } from './control-problems.js?v=2';

// Shared frame for the Stage 2b pages: header, rows and sections, then the save bar the app docks.

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function supportSaveBar(state, { save, discard }) {
  const invalid = Boolean(Object.keys(state?.errors || {}).length);
  const disabled = !state?.dirty || invalid || state?.status === 'saving';
  return `<div class="support-page-actions control-save-bar">${saveBarStatusMarkup(state)}<button class="control-button control-button-primary" type="button" ${save}${disabled ? ' disabled' : ''}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" ${discard}${state?.status === 'saving' ? ' disabled' : ''}>Discard</button></div>`;
}

// `enabled` null means the page has no master switch.
export function supportPageFrame({ pageKey, className = '', title, lede = '', enabled = null, body, state, save, discard }) {
  const master = enabled === null ? '' : ` data-master="${enabled ? 'on' : 'off'}"`;
  return `<section class="control-page support-page${className ? ` ${className}` : ''}" data-page-key="${escapeHtml(pageKey)}"${master}>
    ${controlPageHeaderMarkup({ title, lede, editable: false })}
    ${body}
    ${supportSaveBar(state, { save, discard })}
  </section>`;
}

// Select rows for a page's bindings. `after` adds markup directly under one key's row.
export function supportResourceRows({ snapshot, state, keys, problems, labels = {}, hints = {}, after = {} }) {
  const draft = state?.draft || state?.persisted || {};
  const rows = keys.map(key => {
    const definition = MAPPING_RESOURCE_DEFINITIONS[key];
    if (!definition) return '';
    const selected = draft?.resourceBindings?.[key] ?? null;
    const saved = state?.persisted?.resourceBindings?.[key] ?? null;
    const found = problems.find(item => item.resourceKey === key);
    const sentence = found && String(saved ?? '') === String(selected ?? '') ? `${found.cause} ${found.effect}` : '';
    const text = sentence || state?.errors?.[`resource_${key}`] || '';
    const id = `resource-${key}`;
    return settingRow({
      label: labels[key] || definition.label,
      hint: hints[key] || '',
      problem: text,
      rowKey: key,
      controlId: id,
      control: resourceSelectMarkup({ snapshot, key, value: selected, problem: Boolean(text), id }),
    }) + (after[key] || '');
  }).join('');
  return settingsRows(rows);
}

export function supportResourceSection(pageKey, state, snapshot, title, options = {}) {
  const keys = featureResourceKeys(pageKey);
  const problems = problemsFromSnapshot(snapshot).filter(problem => problem.pageKey === pageKey);
  return settingsSection({
    id: `${pageKey.split('/').pop()}-resources-heading`,
    title,
    body: supportResourceRows({ snapshot, state, keys, problems, ...options }),
  });
}

// A labeled field: label above, bordered control, problem line below.
export function fieldMarkup({ id, label, control, problem = '', hint = '', className = '' }) {
  return `<div class="control-field${className ? ` ${className}` : ''}"${problem ? ' data-problem' : ''}>
    <label class="control-field-label" for="${escapeHtml(id)}">${escapeHtml(label)}</label>
    ${control}
    ${problem ? problemLine(problem) : (hint ? `<p class="control-setting-hint">${escapeHtml(hint)}</p>` : '')}
  </div>`;
}

export function textInput({ id, value = '', attributes = '', maxlength = null, type = 'text', placeholder = '', disabled = false, readonly = false, invalid = false }) {
  return `<input id="${escapeHtml(id)}" type="${type}"${maxlength ? ` maxlength="${maxlength}"` : ''}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''} value="${escapeHtml(value)}"${attributes ? ` ${attributes}` : ''}${disabled ? ' disabled' : ''}${readonly ? ' readonly' : ''}${invalid ? ' aria-invalid="true"' : ''} autocomplete="off">`;
}

export function textArea({ id, value = '', attributes = '', maxlength = null, rows = 4, invalid = false, placeholder = '' }) {
  return `<textarea id="${escapeHtml(id)}" rows="${rows}"${maxlength ? ` maxlength="${maxlength}"` : ''}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}${attributes ? ` ${attributes}` : ''}${invalid ? ' aria-invalid="true"' : ''}>${escapeHtml(value)}</textarea>`;
}

// One list row that discloses its fields. `head` is the title line, `aside` sits left of the chevron (a switch).
export function itemRow({ id, rowKey = '', head, aside = '', body, error = false, dataAttributes = '' }) {
  const trigger = `<span class="control-question-copy">${head}</span>`;
  return `<article class="control-question control-item" data-row-key="${escapeHtml(rowKey)}"${dataAttributes ? ` ${dataAttributes}` : ''}${error ? ' data-problem' : ''}>
    ${disclosure({ id, trigger, body: `<div class="control-item-fields">${body}</div>`, open: error ? true : null })}
    ${aside ? `<div class="control-item-aside">${aside}</div>` : ''}
  </article>`;
}

export function itemHead(title, muted = '', { mono = false } = {}) {
  return `<span class="control-question-prompt">${escapeHtml(title)}</span>${muted ? `<span class="control-question-status${mono ? ' control-mono' : ''}">${escapeHtml(muted)}</span>` : ''}`;
}

export function installSupportSaveHandlers({ root, pageKey, store, onSave, rerender, saveSelector, discardSelector }) {
  const onClick = event => {
    if (event.target?.closest?.(saveSelector)) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return true;
    }
    if (event.target?.closest?.(discardSelector)) {
      store.discard(pageKey);
      rerender?.();
      return true;
    }
    return false;
  };
  return onClick;
}
