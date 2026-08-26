(() => {
  const refinement = document.createElement('script');
  refinement.src = '/control-refine.js?v=1';
  refinement.addEventListener('load', waitForPublishingRefinement);
  document.head.appendChild(refinement);

  function waitForPublishingRefinement() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const announcementBtn = document.querySelector('#announcementReviewBtn');
      const liveBtn = document.querySelector('#liveReviewBtn');
      const announcementStatus = document.querySelector('#announcementStatus');
      const liveStatus = document.querySelector('#liveStatus');

      if (announcementBtn && liveBtn && announcementStatus && liveStatus && announcementBtn.textContent.includes('Send')) {
        clearInterval(timer);
        simplifyAction(announcementBtn, announcementStatus, 'announcement');
        simplifyAction(liveBtn, liveStatus, 'live');
        document.querySelectorAll('.publish-final-note').forEach(note => note.remove());
      } else if (attempts >= 100) {
        clearInterval(timer);
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
