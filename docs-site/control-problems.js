import { FEATURE_RESOURCE_KEYS_BY_PAGE } from './control-resource-contract.js';

// Pure: snapshot to the list of things that stop a feature from working.
// A healthy snapshot returns []. Each problem names the page and the resource that fixes it.

// What stops working on each page, and which snapshot feature switch it follows.
const PAGE_PROFILES = Object.freeze({
  '/control/community/reputation': { feature: 'reputation', effect: "Reputation can't award roles." },
  '/control/community/quizzes': { feature: 'quizzes', effect: "Quizzes can't post." },
  '/control/community/voice-coworking': { feature: 'voice', effect: "Voice rooms can't be created." },
  '/control/community/showcase': { feature: 'showcase', effect: "Showcase can't post." },
  '/control/utilities/notification-roles': { feature: null, effect: "The role panel can't post." },
  '/control/content/feeds': { feature: 'ai_updates', effect: "Feed updates can't post." },
  '/control/content/announcements': { feature: 'announcements', effect: "Announcements can't post." },
  '/control/content/live': { feature: 'live_announcements', effect: "Live notices can't post." },
  '/control/utilities/ticket-configuration': { feature: 'tickets', effect: "Tickets can't open." },
  '/control/utilities/anonymous-questions': { feature: 'anonymous_questions', effect: "Anonymous questions can't be received." },
  '/control/workflows/moderation': { feature: 'moderation', effect: "Moderation can't be logged." },
  '/control/analytics': { feature: 'analytics', effect: "The weekly report can't post." },
});

// A feature works without these, so an unset binding is not a problem.
const OPTIONAL_KEYS = new Set([
  'live_ping_role',
  'compromised_account_trap',
  'coworking_lounge',
  'app_of_the_week',
  'collab_lfg',
  'ticket_logs',
]);

// Bindings Rob-bot only reads, so it needs no permission to post in them.
const READ_ONLY_KEYS = new Set(['compromised_account_trap']);

function featureEnabled(snapshot, name) {
  if (!name) return true;
  const feature = (snapshot?.features || []).find(item => item?.name === name);
  return feature ? feature.enabled !== false : true;
}

export function problemSentence(problem) {
  return problem ? `${problem.cause} ${problem.effect}` : '';
}

export function problemsFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const resources = new Map((snapshot.resources || []).map(item => [String(item?.key || ''), item]));
  const channels = new Map((snapshot.channels || []).map(item => [String(item?.id), item]));
  const problems = [];

  for (const [path, keys] of Object.entries(FEATURE_RESOURCE_KEYS_BY_PAGE)) {
    const profile = PAGE_PROFILES[path];
    if (!profile || !featureEnabled(snapshot, profile.feature)) continue;
    const title = profile.effect.replace(/\.$/, '');
    const add = (resourceKey, cause) => problems.push({
      pageKey: path, path, resourceKey, title, cause, effect: profile.effect,
    });

    for (const key of keys) {
      const row = resources.get(key);
      if (!row || row.id == null || row.id === '') {
        if (!OPTIONAL_KEYS.has(key)) add(key, 'Not connected.');
        continue;
      }
      if (row.exists === false) {
        // The bot posts Live notices to the announcements channel when the live channel is gone,
        // so this is a redirect to fix, not a failure.
        const fallback = key === 'live_announcements' ? resources.get('announcements') : null;
        const fallbackChannel = fallback?.exists ? channels.get(String(fallback.id)) : null;
        if (fallback?.exists && fallback.kind === 'text' && fallbackChannel?.send_messages !== false) {
          const name = `#${fallback.name || 'announcements'}`;
          problems.push({
            pageKey: path, path, resourceKey: key,
            title: `Live notices post to ${name}`,
            cause: 'Deleted in Discord.',
            effect: `Live notices post to ${name} instead.`,
          });
        } else {
          add(key, 'Deleted in Discord.');
        }
        continue;
      }
      if (row.kind !== 'text' || READ_ONLY_KEYS.has(key)) continue;
      const channel = channels.get(String(row.id));
      if (channel?.send_messages === false) add(key, "Rob-bot can't send messages there.");
      else if (channel?.embed_links === false) add(key, "Rob-bot can't embed links there.");
    }
  }
  return problems;
}

// Destination paths with at least one problem, for the navigation flags.
export function problemPaths(problems = []) {
  return new Set(problems.map(problem => problem.path));
}
