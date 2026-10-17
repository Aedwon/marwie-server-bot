const definition = [
  ['community', 'Community', [
    ['reputation', 'Reputation'],
    ['quizzes', 'Quizzes'],
    ['voice-coworking', 'Voice & Coworking'],
    ['showcase', 'Showcase'],
  ]],
  ['content', 'Content', [
    ['feeds', 'Feeds'],
    ['announcements', 'Announcements'],
    ['live', 'Live'],
  ]],
  ['utilities', 'Utilities', [
    ['ticket-configuration', 'Ticket configuration'],
    ['notification-roles', 'Notification roles'],
    ['anonymous-questions', 'Anonymous Questions'],
  ]],
  ['analytics', 'Analytics', null],
  ['workflows', 'Workflows', [
    ['moderation', 'Moderation'],
    ['ticket-handling', 'Ticket handling'],
    ['events', 'Events'],
  ]],
  ['mappings', 'Mappings', [
    ['channels', 'Channels'],
    ['roles', 'Roles'],
    ['categories', 'Categories'],
  ]],
];

function pathFor(domain, child = null) {
  return child ? `/control/${domain}/${child}` : `/control/${domain}`;
}

export const CONTROL_DOMAINS = Object.freeze(definition.map(([key, label, children]) => Object.freeze({
  key,
  label,
  path: pathFor(key),
  children: children ? Object.freeze(children.map(([childKey, childLabel]) => Object.freeze({
    key: childKey,
    label: childLabel,
    domain: key,
    path: pathFor(key, childKey),
    kind: 'primary-child',
  }))) : Object.freeze([]),
  direct: !children,
})));

export const SECONDARY_DESTINATIONS = Object.freeze([
  Object.freeze({ key: 'commands', label: 'Commands', path: '/control/commands', domain: null, kind: 'secondary' }),
  Object.freeze({ key: 'activity', label: 'Activity', path: '/control/activity', domain: null, kind: 'secondary' }),
]);

export const CONTROL_DESTINATIONS = Object.freeze([
  ...CONTROL_DOMAINS.flatMap(domain => domain.direct
    ? [Object.freeze({ key: domain.key, label: domain.label, path: domain.path, domain: domain.key, kind: 'primary-direct' })]
    : domain.children),
  ...SECONDARY_DESTINATIONS,
]);

export const CONTROL_FALLBACK_PATH = '/control/community/reputation';

const DESTINATION_BY_PATH = new Map(CONTROL_DESTINATIONS.map(item => [item.path, item]));
const DOMAIN_BY_KEY = new Map(CONTROL_DOMAINS.map(item => [item.key, item]));

function navItem(path, label, options = {}) {
  const destination = DESTINATION_BY_PATH.get(path);
  if (!destination) throw new Error(`Unknown Control navigation path: ${path}`);
  return Object.freeze({ ...destination, label, ...options });
}

const MAPPING_PATHS = Object.freeze([
  '/control/mappings/channels',
  '/control/mappings/roles',
  '/control/mappings/categories',
]);

export const CONTROL_NAV_GROUPS = Object.freeze([
  Object.freeze({ key: 'engagement', label: 'Engagement', items: Object.freeze([
    navItem('/control/community/reputation', 'Reputation'),
    navItem('/control/community/quizzes', 'Quizzes'),
    navItem('/control/community/voice-coworking', 'Voice & Coworking'),
    navItem('/control/community/showcase', 'Showcase'),
    navItem('/control/utilities/notification-roles', 'Notification roles'),
  ]) }),
  Object.freeze({ key: 'publishing', label: 'Publishing', items: Object.freeze([
    navItem('/control/content/feeds', 'Feeds'),
    navItem('/control/content/announcements', 'Announcements'),
    navItem('/control/content/live', 'Live'),
  ]) }),
  Object.freeze({ key: 'support-safety', label: 'Support & Safety', items: Object.freeze([
    navItem('/control/utilities/ticket-configuration', 'Tickets'),
    navItem('/control/utilities/anonymous-questions', 'Anonymous Questions'),
    navItem('/control/workflows/moderation', 'Moderation'),
  ]) }),
  Object.freeze({ key: 'insights', label: 'Insights', items: Object.freeze([
    navItem('/control/analytics', 'Analytics'),
    navItem('/control/activity', 'Activity'),
  ]) }),
  Object.freeze({ key: 'system', label: 'System', items: Object.freeze([
    navItem('/control/mappings/channels', 'Resources', { key: 'resources', matchPaths: MAPPING_PATHS, matchDomain: 'mappings' }),
    navItem('/control/commands', 'Commands'),
  ]) }),
]);

export const CONTROL_PLAYBOOKS = Object.freeze([
  navItem('/control/workflows/ticket-handling', 'Ticket handling', { kind: 'playbook' }),
  navItem('/control/workflows/events', 'Events', { kind: 'playbook' }),
]);

const NAV_GROUP_BY_PATH = new Map();
for (const group of CONTROL_NAV_GROUPS) {
  for (const item of group.items) {
    for (const path of item.matchPaths || [item.path]) NAV_GROUP_BY_PATH.set(path, group);
  }
}

function normalizePath(pathname) {
  const raw = String(pathname || '/control').split(/[?#]/, 1)[0] || '/control';
  if (raw === '/') return '/control';
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

export function destinationForPath(pathname) {
  return DESTINATION_BY_PATH.get(normalizePath(pathname)) || null;
}

export function navGroupForPath(pathname) {
  return NAV_GROUP_BY_PATH.get(normalizePath(pathname)) || null;
}

export function firstDestinationForDomain(domainKey) {
  const domain = DOMAIN_BY_KEY.get(domainKey);
  if (!domain) return null;
  if (domain.direct) return DESTINATION_BY_PATH.get(domain.path) || null;
  return domain.children[0] || null;
}

export function destinationForDomain(domainKey, lastByDomain = {}) {
  const domain = DOMAIN_BY_KEY.get(domainKey);
  if (!domain) return null;
  if (domain.direct) return DESTINATION_BY_PATH.get(domain.path) || null;
  const remembered = destinationForPath(lastByDomain?.[domainKey]);
  if (remembered?.domain === domainKey) return remembered;
  return domain.children[0] || null;
}

export function resolveControlRoute(pathname, lastDestination = null, lastByDomain = {}) {
  const normalized = normalizePath(pathname);
  const exact = destinationForPath(normalized);
  if (exact) return exact;

  if (normalized === '/control') {
    return destinationForPath(lastDestination) || DESTINATION_BY_PATH.get(CONTROL_FALLBACK_PATH);
  }

  const match = normalized.match(/^\/control\/([^/]+)(?:\/.*)?$/);
  if (match) {
    const domain = DOMAIN_BY_KEY.get(match[1]);
    if (domain) return firstDestinationForDomain(domain.key);
  }
  return DESTINATION_BY_PATH.get(CONTROL_FALLBACK_PATH);
}

export function createRouteMemory(initial = {}) {
  const lastByDomain = { ...(initial.lastByDomain || {}) };
  let lastDestination = destinationForPath(initial.lastDestination)?.path || null;

  return {
    remember(destination) {
      const resolved = typeof destination === 'string' ? destinationForPath(destination) : destination;
      if (!resolved) return;
      lastDestination = resolved.path;
      if (resolved.domain) lastByDomain[resolved.domain] = resolved.path;
    },
    resolve(pathname) {
      return resolveControlRoute(pathname, lastDestination, lastByDomain);
    },
    snapshot() {
      return { lastDestination, lastByDomain: { ...lastByDomain } };
    },
  };
}
