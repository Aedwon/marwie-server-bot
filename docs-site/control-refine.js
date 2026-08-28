(() => {
  refineControlPrototype();

  function refineControlPrototype() {
    const style = document.createElement('style');
    style.textContent = `
      /* Control prototype refinement: compact setup, mention-aware publishing, notification panel editor. */
      #setup .setup-statusbar {
        min-height: 82px;
        padding: 16px 18px;
      }
      #setup .setup-status-items { gap: 24px; }
      #setup .setup-metric { gap: 7px; }
      #setup .setup-metric strong { font-size: 21px; }
      #setup .setup-preview { display: none !important; }
      #setup .resource-disclosure { margin-top: 12px; }
      #setup .resource-disclosure:not([open]) > summary {
        border-radius: 14px;
        background: var(--page-surface);
      }

      .field-helper {
        margin-top: 3px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
      }
      .discord-content {
        margin: 2px 0 8px;
        color: #dbdee1;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .discord-mention {
        padding: 0 2px;
        border-radius: 3px;
        color: #c9cdfb;
        background: rgba(88,101,242,.28);
        font-weight: 600;
      }

      .notification-panel-editor {
        margin-top: 24px;
        padding-top: 26px;
        border-top: 1px solid var(--hairline);
      }
      .notification-panel-head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 20px;
        margin-bottom: 16px;
      }
      .notification-panel-head h3 { margin: 0; }
      .notification-panel-head p {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 13px;
      }
      .runtime-note {
        flex: none;
        color: var(--muted);
        font-size: 11px;
      }
      .notification-panel-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(320px, .92fr);
        gap: 28px;
        align-items: start;
      }
      .notification-controls { min-width: 0; }
      .notification-controls > .control-field { margin-top: 12px; }
      .notification-role-head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin: 22px 0 8px;
      }
      .notification-role-head h4 { margin: 0; font-size: 14px; }
      .notification-role-head small { color: var(--muted); }
      .notification-role-list {
        display: grid;
        gap: 8px;
      }
      .notification-role-row {
        display: grid;
        grid-template-columns: minmax(150px, 1.1fr) minmax(135px, 1fr) 78px 112px 34px;
        gap: 8px;
        align-items: end;
        padding: 10px;
        border-radius: 13px;
        background: color-mix(in srgb, var(--page-surface) 92%, transparent);
      }
      .notification-role-row .control-field > span { font-size: 10.5px; }
      .notification-role-row input,
      .notification-role-row select { min-height: 42px; }
      .notification-remove {
        width: 34px;
        height: 42px;
        border-radius: 10px;
        background: transparent;
        color: var(--muted);
        font-size: 18px;
      }
      .notification-remove:hover:not(:disabled) {
        background: color-mix(in srgb, var(--page-surface-strong) 82%, transparent);
        color: var(--text);
      }
      .notification-remove:disabled { opacity: .25; cursor: default; }
      .notification-preview-description {
        color: #b5bac1;
        font-size: 13px;
        line-height: 1.45;
        margin-top: 4px;
      }
      .discord-component-row {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .discord-role-button {
        min-height: 34px;
        padding: 0 13px;
        border-radius: 4px;
        color: #fff;
        background: #5865f2;
        font-size: 13px;
        font-weight: 650;
      }
      .discord-role-button.secondary { background: #4e5058; }
      .discord-role-button.success { background: #248046; }
      .discord-role-button.danger { background: #da373c; }
      .notification-panel-editor .editor-action { margin-top: 14px; }

      .publish-final-note {
        max-width: 260px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }

      @media (max-width: 980px) {
        .notification-panel-grid { grid-template-columns: 1fr; }
        .notification-role-row {
          grid-template-columns: 1fr 1fr 72px 104px 34px;
        }
      }
      @media (max-width: 680px) {
        #setup .setup-statusbar { align-items: stretch; }
        #setup .setup-status-items { gap: 14px; }
        .notification-panel-head { flex-direction: column; gap: 5px; }
        .notification-role-row {
          grid-template-columns: 1fr 1fr;
        }
        .notification-role-row .emoji-field,
        .notification-role-row .style-field { grid-column: span 1; }
        .notification-remove { grid-column: 2; justify-self: end; }
      }
    `;
    document.head.appendChild(style);

    compactSetup();
    addNotificationRolePanelEditor();
    enhancePublishing();
  }

  function compactSetup() {
    document.querySelector('#setup .setup-preview')?.remove();
    const resources = document.querySelector('#setup .resource-disclosure');
    resources?.removeAttribute('open');
    const review = document.querySelector('#setupReviewBtn');
    if (review) review.textContent = 'Review 4 items';
  }

  function optionList(values, selected) {
    return values.map(value => `<option${value === selected ? ' selected' : ''}>${escapeMarkup(value)}</option>`).join('');
  }

  function escapeMarkup(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function addNotificationRolePanelEditor() {
    const oldAction = document.querySelector('#rolePanelBtn')?.closest('.dependent-action');
    if (!oldAction) return;

    const editor = document.createElement('div');
    editor.className = 'notification-panel-editor';
    editor.innerHTML = `
      <div class="notification-panel-head">
        <div><h3>Notification role panel</h3><p>Let members toggle optional notification roles from one message.</p></div>
        <span class="runtime-note">Prototype · generic roles need a runtime extension</span>
      </div>
      <div class="notification-panel-grid">
        <div class="notification-controls">
          <div class="field-grid two">
            <label class="control-field"><span>Channel</span><select id="notificationPanelChannel"><option>#roles</option><option>#announcements</option><option>#bot-cmd</option></select></label>
            <label class="control-field"><span>Title</span><input id="notificationPanelTitle" maxlength="256" value="Notification roles"></label>
          </div>
          <label class="control-field"><span>Description</span><textarea id="notificationPanelDescription" rows="2" maxlength="1000">Choose the notifications you want. Press a button again to remove the role.</textarea></label>
          <div class="notification-role-head">
            <div><h4>Role buttons</h4><small>One button toggles one self-assignable role.</small></div>
            <button class="action-add" id="addNotificationRoleBtn" type="button"><span aria-hidden="true">+</span> Add role</button>
          </div>
          <div class="notification-role-list" id="notificationRoleList"></div>
          <div class="editor-action"><span id="notificationPanelStatus">No changes</span><button class="secondary" id="notificationPanelSaveBtn" type="button" disabled>Save panel</button></div>
        </div>
        <div class="preview-shell" aria-label="Notification role panel Discord preview">
          <div class="preview-heading"><span>Discord preview</span><b id="notificationPreviewChannel">#roles</b></div>
          <div class="discord-canvas">
            <div class="discord-message">
              <img src="/rob-robin.jpg?v=1" alt="" class="discord-avatar">
              <div class="discord-message-body">
                <div class="discord-author"><b>Rob-bot</b><span class="bot-badge">APP</span><small>Today at 8:15 PM</small></div>
                <div class="discord-embed">
                  <div class="discord-embed-title" id="notificationPreviewTitle">Notification roles</div>
                  <div class="notification-preview-description" id="notificationPreviewDescription">Choose the notifications you want. Press a button again to remove the role.</div>
                </div>
                <div class="discord-component-row" id="notificationPreviewButtons"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    oldAction.replaceWith(editor);

    const state = {
      initial: JSON.stringify({
        channel: '#roles',
        title: 'Notification roles',
        description: 'Choose the notifications you want. Press a button again to remove the role.',
        rows: [{ role: 'Live Notifications', label: 'Live Notifications', emoji: '', style: 'Primary' }],
      }),
      rows: [{ role: 'Live Notifications', label: 'Live Notifications', emoji: '', style: 'Primary' }],
    };

    const roleOptions = ['Live Notifications', 'Event Notifications', 'AI Updates', 'Announcements'];
    const styleOptions = ['Primary', 'Secondary', 'Success'];
    const list = editor.querySelector('#notificationRoleList');
    const channel = editor.querySelector('#notificationPanelChannel');
    const title = editor.querySelector('#notificationPanelTitle');
    const description = editor.querySelector('#notificationPanelDescription');
    const status = editor.querySelector('#notificationPanelStatus');
    const save = editor.querySelector('#notificationPanelSaveBtn');

    function renderRows() {
      if (!list) return;
      list.innerHTML = state.rows.map((row, index) => `
        <div class="notification-role-row" data-role-index="${index}">
          <label class="control-field"><span>Role</span><select data-field="role">${optionList(roleOptions, row.role)}</select></label>
          <label class="control-field"><span>Button label</span><input data-field="label" maxlength="80" value="${escapeMarkup(row.label)}"></label>
          <label class="control-field emoji-field"><span>Emoji</span><input data-field="emoji" maxlength="8" value="${escapeMarkup(row.emoji)}" placeholder="Optional"></label>
          <label class="control-field style-field"><span>Style</span><select data-field="style">${optionList(styleOptions, row.style)}</select></label>
          <button class="notification-remove" type="button" aria-label="Remove role button" ${state.rows.length === 1 ? 'disabled' : ''}>×</button>
        </div>`).join('');

      list.querySelectorAll('.notification-role-row').forEach(rowNode => {
        const index = Number(rowNode.dataset.roleIndex);
        rowNode.querySelectorAll('[data-field]').forEach(control => {
          const event = control.tagName === 'SELECT' ? 'change' : 'input';
          control.addEventListener(event, () => {
            state.rows[index][control.dataset.field] = control.value;
            update();
          });
        });
        rowNode.querySelector('.notification-remove')?.addEventListener('click', () => {
          if (state.rows.length <= 1) return;
          state.rows.splice(index, 1);
          renderRows();
          update();
        });
      });
    }

    function snapshot() {
      return JSON.stringify({
        channel: channel?.value || '',
        title: title?.value || '',
        description: description?.value || '',
        rows: state.rows,
      });
    }

    function update() {
      const valid = Boolean(channel?.value)
        && Boolean(title?.value.trim())
        && state.rows.length > 0
        && state.rows.every(row => row.role && row.label.trim());
      const dirty = snapshot() !== state.initial;
      if (status) status.textContent = !valid ? 'Add a title and complete each role button.' : dirty ? 'Panel changed.' : 'No changes';
      if (save) {
        save.disabled = !(valid && dirty);
        save.classList.toggle('is-ready', valid && dirty);
      }
      const previewChannel = editor.querySelector('#notificationPreviewChannel');
      const previewTitle = editor.querySelector('#notificationPreviewTitle');
      const previewDescription = editor.querySelector('#notificationPreviewDescription');
      if (previewChannel) previewChannel.textContent = channel?.value || '#roles';
      if (previewTitle) previewTitle.textContent = title?.value.trim() || 'Notification roles';
      if (previewDescription) previewDescription.textContent = description?.value.trim() || '';
      const previewButtons = editor.querySelector('#notificationPreviewButtons');
      if (previewButtons) previewButtons.innerHTML = state.rows.map(row => {
        const styleName = row.style.toLowerCase();
        const emoji = row.emoji.trim();
        return `<button type="button" class="discord-role-button ${styleName === 'primary' ? '' : styleName}" tabindex="-1">${escapeMarkup(emoji ? `${emoji} ${row.label}` : row.label)}</button>`;
      }).join('');
    }

    [channel, title, description].forEach(control => {
      control?.addEventListener('input', update);
      control?.addEventListener('change', update);
    });
    editor.querySelector('#addNotificationRoleBtn')?.addEventListener('click', () => {
      state.rows.push({ role: 'Event Notifications', label: 'Event Notifications', emoji: '', style: 'Secondary' });
      renderRows();
      update();
    });
    save?.addEventListener('click', () => {
      if (save.disabled) return;
      openPrototype('Save notification role panel', 'The live version will show the channel, panel copy, and each role/button mapping before updating Discord. This prototype does not write anything.');
    });

    renderRows();
    update();
  }

  function renderMentions(value) {
    const escaped = escapeMarkup(value || '');
    return escaped.replace(/(^|\s)(@(everyone|here|[A-Za-z0-9_.-]+))/g, '$1<span class="discord-mention">$2</span>');
  }

  function enhancePublishing() {
    const announcementEditor = document.querySelector('#announcementWorkflow .publish-editor');
    const channelField = announcementEditor?.querySelector('#announcementChannel')?.closest('.control-field');
    if (announcementEditor && channelField && !document.querySelector('#announcementMessage')) {
      const field = document.createElement('label');
      field.className = 'control-field';
      field.innerHTML = `<span>Message <small>optional</small></span><textarea id="announcementMessage" rows="2" maxlength="2000" placeholder="Plain text or mentions, e.g. @everyone @Moderators @Aerol"></textarea><small class="field-helper">Use this for pings or text outside the embed. The live backend will resolve explicit user/role mentions safely.</small>`;
      channelField.insertAdjacentElement('afterend', field);

      const embed = document.querySelector('#announcementEmbed');
      if (embed) {
        const message = document.createElement('div');
        message.id = 'announcementPreviewMessage';
        message.className = 'discord-content';
        message.hidden = true;
        embed.insertAdjacentElement('beforebegin', message);
      }
      const input = field.querySelector('#announcementMessage');
      const update = () => {
        const preview = document.querySelector('#announcementPreviewMessage');
        const value = input?.value.trim() || '';
        if (preview) {
          preview.hidden = !value;
          preview.innerHTML = renderMentions(value);
        }
      };
      input?.addEventListener('input', update);
      update();
    }

    const announcementBtn = document.querySelector('#announcementReviewBtn');
    const liveBtn = document.querySelector('#liveReviewBtn');
    const announcementStatus = document.querySelector('#announcementStatus');
    const liveStatus = document.querySelector('#liveStatus');

    if (announcementBtn) {
      announcementBtn.textContent = 'Send announcement…';
      announcementBtn.title = 'Opens the final send confirmation. The prototype will not send.';
      announcementBtn.addEventListener('click', event => {
        if (announcementBtn.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openPrototype('Send announcement?', 'The live control panel will use this step as the final confirmation: destination, message mentions, and embed are already visible in the preview. Confirming there will send once; this prototype sends nothing.');
      }, true);
      announcementStatus?.insertAdjacentHTML('afterend', '<span class="publish-final-note">Opens final confirmation; no second preview.</span>');
    }

    if (liveBtn) {
      liveBtn.textContent = 'Post live notice…';
      liveBtn.title = 'Opens the final post confirmation. The prototype will not post.';
      liveBtn.addEventListener('click', event => {
        if (liveBtn.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openPrototype('Post live notice?', 'The live control panel will use this step as the final confirmation after you have already seen the destination, ping, topic, and TikTok button in the Discord preview. This prototype posts nothing.');
      }, true);
      liveStatus?.insertAdjacentHTML('afterend', '<span class="publish-final-note">Opens final confirmation; no second preview.</span>');
    }
  }

  function openPrototype(title, copy) {
    const dialog = document.querySelector('#prototypeDialog');
    const heading = document.querySelector('#prototypeDialogTitle');
    const body = document.querySelector('#prototypeDialogCopy');
    if (heading) heading.textContent = title;
    if (body) body.textContent = copy;
    if (dialog?.showModal) dialog.showModal();
  }
})();
