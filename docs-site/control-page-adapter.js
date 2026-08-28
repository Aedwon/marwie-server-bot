const LEGACY_SECTION_BY_PATH = Object.freeze({
  '/control/community/reputation': 'reputation',
  '/control/community/quizzes': 'quizzes',
  '/control/content/feeds': 'feeds',
  '/control/content/announcements': 'publishing',
  '/control/content/live': 'publishing',
  '/control/utilities/ticket-configuration': 'tickets',
});

const LEGACY_MOUNT_PLAN_BY_PATH = Object.freeze({
  '/control/community/reputation': Object.freeze({
    sections: Object.freeze(['features', 'reputation']),
    featureKeys: Object.freeze(['reputation']),
  }),
  '/control/community/quizzes': Object.freeze({
    sections: Object.freeze(['features', 'quizzes']),
    featureKeys: Object.freeze(['quizzes']),
  }),
  '/control/community/voice-coworking': Object.freeze({
    sections: Object.freeze(['features']),
    featureKeys: Object.freeze(['voice', 'coworking']),
  }),
  '/control/community/showcase': Object.freeze({
    sections: Object.freeze(['features']),
    featureKeys: Object.freeze(['showcase']),
  }),
  '/control/content/feeds': Object.freeze({
    sections: Object.freeze(['features', 'feeds']),
    featureKeys: Object.freeze(['ai_updates']),
  }),
  '/control/content/announcements': Object.freeze({
    sections: Object.freeze(['features', 'publishing']),
    featureKeys: Object.freeze(['announcements']),
  }),
  '/control/content/live': Object.freeze({
    sections: Object.freeze(['features', 'publishing']),
    featureKeys: Object.freeze(['live_announcements']),
  }),
  '/control/utilities/ticket-configuration': Object.freeze({
    sections: Object.freeze(['features', 'tickets']),
    featureKeys: Object.freeze(['tickets']),
  }),
  '/control/utilities/notification-roles': Object.freeze({
    sections: Object.freeze(['setup']),
    setupMode: 'notification-roles',
  }),
  '/control/utilities/anonymous-questions': Object.freeze({
    sections: Object.freeze(['features']),
    featureKeys: Object.freeze(['anonymous_questions']),
  }),
  '/control/analytics': Object.freeze({
    sections: Object.freeze(['features']),
    featureKeys: Object.freeze(['analytics']),
  }),
  '/control/mappings/channels': Object.freeze({
    sections: Object.freeze(['setup']),
    setupMode: 'mappings',
    resourceKeys: Object.freeze([
      'moderation_log',
      'ticket_panel',
      'ticket_logs',
      'create_workspace_voice',
      'coworking_lounge',
      'announcements',
      'live_announcements',
      'role_panel',
      'ai_updates',
      'quiz_channel',
      'anon_questions',
      'analytics',
      'showcase_forum',
      'app_of_the_week',
      'collab_lfg',
    ]),
  }),
  '/control/mappings/roles': Object.freeze({
    sections: Object.freeze(['setup']),
    setupMode: 'mappings',
    resourceKeys: Object.freeze([
      'live_ping_role',
      'builder_role',
      'contributor_role',
      'mentor_role',
    ]),
  }),
  '/control/mappings/categories': Object.freeze({
    sections: Object.freeze(['setup']),
    setupMode: 'mappings',
    resourceKeys: Object.freeze([
      'ticket_category',
      'temp_voice_category',
    ]),
  }),
});

const mountedByMain = new WeakMap();

export function legacySectionForPath(path) {
  return LEGACY_SECTION_BY_PATH[path] || null;
}

export function legacyMountPlanForPath(path) {
  return LEGACY_MOUNT_PLAN_BY_PATH[path] || null;
}

function restoreMounted(main, legacyRoot) {
  const mounted = mountedByMain.get(main);
  if (!mounted) return;

  mountedByMain.delete(main);
  for (const section of mounted) {
    legacyRoot?.append?.(section);
  }
}

function filterKeyedRows(section, selector, datasetKey, allowedKeys) {
  if (!section?.querySelectorAll) return;
  const allowed = new Set(allowedKeys || []);

  for (const row of section.querySelectorAll(selector)) {
    row.hidden = !allowed.has(row.dataset?.[datasetKey]);
  }
}

function configureFeatureSection(section, plan) {
  filterKeyedRows(
    section,
    '.feature-row[data-feature-key]',
    'featureKey',
    plan.featureKeys,
  );
}

function configureSetupSection(section, plan) {
  if (!section?.querySelector) return;

  const setupMode = plan.setupMode || null;
  const statusbar = section.querySelector('.setup-statusbar');
  const preview = section.querySelector('.setup-preview');
  const resources = section.querySelector('.resource-disclosure');
  const notificationEditor = section.querySelector('.notification-panel-editor');

  if (setupMode === 'mappings') {
    if (statusbar) statusbar.hidden = true;
    if (preview) preview.hidden = true;
    if (resources) resources.hidden = false;
    if (notificationEditor) notificationEditor.hidden = true;

    for (const dependent of section.querySelectorAll?.('.dependent-action') || []) {
      dependent.hidden = true;
    }

    filterKeyedRows(
      section,
      '.resource-row[data-resource-key]',
      'resourceKey',
      plan.resourceKeys,
    );
    return;
  }

  if (setupMode === 'notification-roles') {
    if (statusbar) statusbar.hidden = true;
    if (preview) preview.hidden = true;
    if (resources) resources.hidden = true;
    if (notificationEditor) notificationEditor.hidden = false;

    for (const dependent of section.querySelectorAll?.('.dependent-action') || []) {
      dependent.hidden = true;
    }
  }
}

function configureSection(section, plan) {
  if (section?.id === 'features') configureFeatureSection(section, plan);
  if (section?.id === 'setup') configureSetupSection(section, plan);
}

export function mountControlDestination({
  main,
  destination,
  legacyRoot,
  renderFallback,
  allowLegacy = true,
}) {
  if (!main || !destination) {
    throw new Error('Control mounting requires a main outlet and destination.');
  }

  restoreMounted(main, legacyRoot);

  const plan = allowLegacy
    ? legacyMountPlanForPath(destination.path)
    : null;

  const legacySections = plan
    ? plan.sections
      .map(sectionId => legacyRoot?.querySelector?.(`#${sectionId}`) || null)
      .filter(Boolean)
    : [];

  if (legacySections.length) {
    main.innerHTML = '';
    main.replaceChildren?.(...legacySections);

    for (const section of legacySections) {
      configureSection(section, plan);
    }

    mountedByMain.set(main, legacySections);
    main.dataset.pageKey = destination.path;

    return {
      kind: 'legacy-adapter',
      section: legacySections[0],
      sections: legacySections,
      plan,
    };
  }

  main.replaceChildren?.();
  main.innerHTML = renderFallback?.(destination) || '';
  main.dataset.pageKey = destination.path;

  return {
    kind: 'canonical',
    section: null,
    sections: [],
    plan: null,
  };
}
