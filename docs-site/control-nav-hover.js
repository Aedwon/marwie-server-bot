const DEFAULT_OPEN_DELAY = 150;
const DEFAULT_CLOSE_DELAY = 200;

const DEFAULT_TIMERS = {
  setTimeout: (handler, delay) => setTimeout(handler, delay),
  clearTimeout: handle => clearTimeout(handle),
};

function noopController() {
  return { isExpanded: () => false, open() {}, reset() {}, destroy() {} };
}

export function installNavHoverExpand({
  rail,
  getMode = () => 'expanded',
  isHoverCapable = () => true,
  hasFocusInside = () => false,
  expand = () => {},
  collapse = () => {},
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  timers = DEFAULT_TIMERS,
} = {}) {
  if (!rail?.addEventListener) return noopController();

  let openTimer = null;
  let closeTimer = null;
  let expanded = false;

  const clearOpen = () => {
    if (openTimer === null) return;
    timers.clearTimeout(openTimer);
    openTimer = null;
  };

  const clearClose = () => {
    if (closeTimer === null) return;
    timers.clearTimeout(closeTimer);
    closeTimer = null;
  };

  const canExpand = () => getMode() === 'rail' && isHoverCapable();

  const scheduleOpen = () => {
    clearClose();
    clearOpen();
    if (expanded || !canExpand()) return;
    openTimer = timers.setTimeout(() => {
      openTimer = null;
      if (expanded || !canExpand()) return;
      expanded = true;
      expand();
    }, openDelay);
  };

  const scheduleClose = () => {
    clearOpen();
    clearClose();
    if (!expanded || hasFocusInside()) return;
    closeTimer = timers.setTimeout(() => {
      closeTimer = null;
      if (!expanded) return;
      expanded = false;
      collapse();
    }, closeDelay);
  };

  const onEnter = () => scheduleOpen();
  const onLeave = () => scheduleClose();
  const onFocusOut = () => {
    if (expanded) scheduleClose();
  };

  rail.addEventListener('mouseenter', onEnter);
  rail.addEventListener('mouseleave', onLeave);
  rail.addEventListener('focusout', onFocusOut);

  return {
    isExpanded: () => expanded,
    // Immediate open for keyboard focus.
    open() {
      clearOpen();
      clearClose();
      if (expanded || !canExpand()) return;
      expanded = true;
      expand();
    },
    reset() {
      clearOpen();
      clearClose();
      expanded = false;
    },
    destroy() {
      clearOpen();
      clearClose();
      rail.removeEventListener('mouseenter', onEnter);
      rail.removeEventListener('mouseleave', onLeave);
      rail.removeEventListener('focusout', onFocusOut);
    },
  };
}
