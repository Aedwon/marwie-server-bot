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
    commandsOnlyControls: Object.freeze([
      Object.freeze({ controlSelector: '#repReviewBtn', ownerSelector: 'details' }),
    ]),
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
    commandsOnlyControls: Object.freeze([
      Object.freeze({
        controlSelector: '[data-prototype-action="Poll feeds"]',
        ownerSelector: '.row-action',
      }),
    ]),
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
    commandsOnlyControls: Object.freeze([
      Object.freeze({
        controlSelector: '[data-prototype-action="Post ticket panel"]',
        ownerSelector: '.row-action',
      }),
    ]),
  }),
  '/control/utilities/notification-roles': Object.freeze({
    sections: Object.freeze(['setup']),
    setupMode: 'notification-roles',
  }),
  '/control/utilities/anonymous-questions': Object.freeze({
    sections: Object.freeze(['features']),
    featureKeys: Object.freeze(['anonymous_questions']),
  }),
});

const mountedByMain = new WeakMap();

export function legacySectionForPath(path) {
  return LEGACY_SECTION_BY_PATH[path] || null;
}

export function legacyMountPlanForPath(path) {
  return LEGACY_MOUNT_PLAN_BY_PATH[path] || null;
}

function restoreDetachedControls(detachedControls) {
  for (const detached of detachedControls || []) {
    const { node, parent, nextSibling } = detached;
    if (!node || !parent?.insertBefore) continue;
    const reference = nextSibling?.parentNode === parent ? nextSibling : null;
    parent.insertBefore(node, reference);
  }
}

function restoreMounted(main, legacyRoot) {
  const mounted = mountedByMain.get(main);
  if (!mounted) return;

  mountedByMain.delete(main);
  restoreDetachedControls(mounted.detachedControls);
  for (const section of mounted.sections) {
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

function detachCommandsOnlyControls(section, plan) {
  const detachedControls = [];

  for (const ownership of plan.commandsOnlyControls || []) {
    const control = section?.querySelector?.(ownership.controlSelector);
    if (!control) continue;

    const ownedNode = ownership.ownerSelector
      ? control.closest?.(ownership.ownerSelector) || control
      : control;
    const parent = ownedNode?.parentNode;
    if (!parent) continue;

    const nextSibling = ownedNode.nextSibling || null;
    if (typeof ownedNode.remove === 'function') {
      ownedNode.remove();
    } else {
      parent.removeChild?.(ownedNode);
    }

    if (ownedNode.parentNode === parent) continue;
    detachedControls.push({ node: ownedNode, parent, nextSibling });
  }

  return detachedControls;
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

    const detachedControls = [];
    for (const section of legacySections) {
      configureSection(section, plan);
      detachedControls.push(...detachCommandsOnlyControls(section, plan));
    }

    mountedByMain.set(main, { sections: legacySections, detachedControls });
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
