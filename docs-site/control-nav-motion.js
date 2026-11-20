export const NAV_MOTION_MS = 200;
export const NAV_ENTER_MS = 200;

const DEFAULT_TIMERS = {
  setTimeout: (handler, delay) => setTimeout(handler, delay),
  clearTimeout: handle => clearTimeout(handle),
};

function noop() {}

export function installNavMotion({
  shell,
  nav,
  render,
  timers = DEFAULT_TIMERS,
  duration = NAV_MOTION_MS,
  enterDuration = NAV_ENTER_MS,
} = {}) {
  if (!shell?.dataset || !nav?.dataset || !nav?.classList || typeof render !== 'function') {
    return { sync: noop, destroy: noop };
  }

  let renderedMode = nav.dataset.navMode || '';
  let motionTimer = null;
  let swapTimer = null;
  let enterTimer = null;

  const clear = handle => {
    if (handle === null) return;
    timers.clearTimeout(handle);
  };

  const clearMotion = () => {
    clear(motionTimer);
    motionTimer = null;
  };

  const clearSwap = () => {
    clear(swapTimer);
    swapTimer = null;
  };

  const clearEnter = () => {
    clear(enterTimer);
    enterTimer = null;
  };

  const startMotion = () => {
    shell.dataset.navMotion = 'true';
    clearMotion();
    motionTimer = timers.setTimeout(() => {
      motionTimer = null;
      delete shell.dataset.navMotion;
    }, duration);
  };

  const renderNow = ({ animate = true } = {}) => {
    render();
    renderedMode = nav.dataset.navMode || '';
    if (!animate) return;
    nav.classList.add('control-nav-enter');
    clearEnter();
    enterTimer = timers.setTimeout(() => {
      enterTimer = null;
      nav.classList.remove('control-nav-enter');
    }, enterDuration);
  };

  const sync = mode => {
    if (!mode) return;
    if (mode === renderedMode) {
      if (mode === 'rail') clearSwap();
      return;
    }
    clearSwap();
    if (!renderedMode) {
      renderNow({ animate: false });
      return;
    }
    startMotion();
    if (mode !== 'expanded') {
      renderNow();
      return;
    }
    swapTimer = timers.setTimeout(() => {
      swapTimer = null;
      if (shell.dataset.navMode !== 'expanded') return;
      renderNow();
    }, duration);
  };

  return {
    sync,
    destroy() {
      clearMotion();
      clearSwap();
      clearEnter();
      nav.classList.remove('control-nav-enter');
      delete shell.dataset.navMotion;
    },
  };
}
