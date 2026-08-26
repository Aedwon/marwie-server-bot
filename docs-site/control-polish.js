(() => {
  const style = document.createElement('style');
  style.textContent = `
    #setup .resource-disclosure:not([open]) {
      margin-top: 10px;
      overflow: visible;
    }
    #setup .resource-disclosure:not([open]) > summary {
      min-height: 46px;
      padding: 0 12px;
      border: 0;
      border-radius: 11px;
      background: color-mix(in srgb, var(--page-surface) 76%, transparent);
    }
    #setup .resource-disclosure:not([open]) > summary > span {
      line-height: 1.15;
    }
    #setup .resource-disclosure:not([open]) > summary > small {
      margin-left: auto;
      line-height: 1.15;
    }
    #setup .resource-disclosure:not([open]) > summary::after {
      margin-left: 2px;
    }
    .action-add > span:first-child {
      width: auto;
      height: auto;
      display: inline;
      border-radius: 0;
      background: none;
      color: inherit;
      font-size: inherit;
      line-height: inherit;
    }
  `;
  document.head.appendChild(style);

  const refinement = document.createElement('script');
  refinement.src = '/control-refine.js?v=1';
  refinement.addEventListener('load', waitForPublishingRefinement);
  document.head.appendChild(refinement);

  let liveLoaded = false;
  function loadLiveControl() {
    if (liveLoaded) return;
    liveLoaded = true;
    const live = document.createElement('script');
    live.src = '/control-live.js?v=1';
    document.head.appendChild(live);
  }

  function waitForPublishingRefinement() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const announcementBtn = document.querySelector('#announcementReviewBtn');
      const liveBtn = document.querySelector('#liveReviewBtn');
      const announcementStatus = document.querySelector('#announcementStatus');
      const liveStatus = document.querySelector('#liveStatus');
      const notificationPanel = document.querySelector('.notification-panel-editor');

      if (announcementBtn && liveBtn && announcementStatus && liveStatus && notificationPanel && announcementBtn.textContent.includes('Send')) {
        clearInterval(timer);
        simplifyAction(announcementBtn, announcementStatus, 'announcement');
        simplifyAction(liveBtn, liveStatus, 'live');
        document.querySelectorAll('.publish-final-note').forEach(note => note.remove());
        loadLiveControl();
      } else if (attempts >= 100) {
        clearInterval(timer);
        loadLiveControl();
      }
    }, 25);
  }

  function simplifyAction(button, status, type) {
    button.textContent = type === 'announcement' ? 'Send' : 'Post';

    const translate = () => {
      const current = status.textContent.trim();
      let next = current;

      if (type === 'announcement') {
        if (current === 'Write a body to review.') next = 'Write a body to send.';
        if (current === 'Ready to review.') next = 'Ready to send. Final confirmation follows.';
      } else {
        if (current === 'Change a field to review.') next = 'Change a field to post.';
        if (current === 'Ready to review.') next = 'Ready to post. Final confirmation follows.';
      }

      if (next !== current) status.textContent = next;
    };

    translate();
    const observer = new MutationObserver(translate);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }
})();
