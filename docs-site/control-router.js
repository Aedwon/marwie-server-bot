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

function normalizePath(pathname) {
  const raw = String(pathname || '/control').split(/[?#]/, 1)[0] || '/control';
  if (raw === '/') return '/control';
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

export function destinationForPath(pathname) {
  return DESTINATION_BY_PATH.get(normalizePath(pathname)) || null;
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
    if (domain) return destinationForDomain(domain.key, lastByDomain);
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
