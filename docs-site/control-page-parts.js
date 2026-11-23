// Stage 2b shared parts: a segmented control with a sliding thumb, and the staged save bar.
import { saveBarStatusMarkup } from './control-components.js?v=25';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const lastIndex = new Map();

// options: [{ key, label, disabled, href, attributes }]. Anchors when href is set, buttons otherwise.
// The thumb renders at the previous position and moves to data-seg-target when the page installs.
export function segmentedControlMarkup({ id, label = '', options = [], selected = '', navigation = false } = {}) {
  const selectedIndex = Math.max(0, options.findIndex(option => option.key === selected));
  const from = lastIndex.has(id) ? lastIndex.get(id) : selectedIndex;
  const items = options.map((option, index) => {
    const isSelected = index === selectedIndex;
    const attributes = option.attributes ? ` ${option.attributes}` : '';
    if (option.href) {
      return `<a class="control-segn-item" href="${escapeHtml(option.href)}" data-nav-path="${escapeHtml(option.href)}"${isSelected ? ' aria-current="page"' : ''}${attributes}>${escapeHtml(option.label)}</a>`;
    }
    return `<button type="button" class="control-segn-item" aria-pressed="${isSelected}"${option.disabled ? ' disabled' : ''}${attributes}>${escapeHtml(option.label)}</button>`;
  }).join('');
  const tag = navigation ? 'nav' : 'div';
  const role = navigation ? '' : ' role="group"';
  return `<${tag} class="control-segn" data-segn="${escapeHtml(id)}"${role} aria-label="${escapeHtml(label)}" data-count="${options.length}" data-index="${from}" data-seg-target="${selectedIndex}"><span class="control-segn-thumb" aria-hidden="true"></span>${items}</${tag}>`;
}

// Moves each thumb to its target so the CSS transition plays. Safe to call without a DOM animation frame.
export function animateSegmentedThumbs(root) {
  const controls = root?.querySelectorAll?.('[data-segn]') || [];
  for (const control of controls) {
    const target = control.getAttribute('data-seg-target');
    const id = control.getAttribute('data-segn');
    const apply = () => {
      control.setAttribute('data-index', target);
      lastIndex.set(id, Number(target));
    };
    if (control.getAttribute('data-index') === target) { apply(); continue; }
    if (typeof requestAnimationFrame === 'function') {
      void control.offsetWidth;
      requestAnimationFrame(apply);
    } else apply();
  }
}

// The page's staged save bar. The app moves it into the shared floating bar.
export function stagedSaveBarMarkup(state, { saveAttribute, discardAttribute }) {
  const invalid = Boolean(Object.keys(state?.errors || {}).length);
  const disabled = !state?.dirty || invalid || state?.status === 'saving';
  return `<div class="control-save-bar">${saveBarStatusMarkup(state)}<button class="control-button control-button-primary" type="button" ${saveAttribute}${disabled ? ' disabled' : ''}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" ${discardAttribute}${state?.status === 'saving' ? ' disabled' : ''}>Discard</button></div>`;
}
