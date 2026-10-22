function feature(name, enabled = true) {
  return { name, enabled, config: {} };
}

export function controlRouteSnapshot() {
  return {
    fresh: true,
    bot: { top_role_position: 100 },
    features: [
      feature('reputation'),
      feature('quizzes'),
      feature('voice'),
      feature('showcase'),
      feature('ai_updates'),
      feature('announcements'),
      feature('live_announcements'),
      feature('tickets'),
      feature('anonymous_questions'),
      feature('moderation'),
      feature('analytics'),
    ],
    reputation: {
      thresholds: { builder: 50, contributor: 150, mentor: 500 },
    },
    quiz: {
      interval_hours: 24,
      last_posted_at: '2026-10-19T10:00:00+00:00',
      questions: [
        {
          id: 7,
          category: 'Python',
          prompt: 'What does len return?',
          options: ['A count', 'A string', 'A bool', 'None'],
          correct: 1,
          explanation: 'It returns an integer count.',
          enabled: true,
        },
        {
          id: 8,
          category: 'Discord',
          prompt: 'Which permission gates kick?',
          options: ['Kick Members', 'Manage Roles', 'Ban Members', 'View Audit Log'],
          correct: 1,
          explanation: 'Kick Members is required.',
          enabled: false,
        },
      ],
    },
    notification_panel: {
      title: 'Notification roles',
      description: 'Choose the updates you want to receive.',
      buttons: [
        { role_id: '202', label: 'Builder updates', emoji: '<:grok:1234>', style: 'primary' },
        { role_id: '203', label: 'Mentor digest', emoji: '', style: 'secondary' },
      ],
    },
    ticket_types: [
      { key: 'support', label: 'Support', description: 'Get help from staff', enabled: true },
      { key: 'report', label: 'Report', description: 'Send a private report', enabled: false },
    ],
    ai_sources: [
      {
        id: 1,
        name: 'OpenAI',
        url: 'https://example.com/openai.xml',
        category: 'AI',
        enabled: true,
        last_checked_at: '2026-10-20T09:30:00+00:00',
      },
      {
        id: 2,
        name: 'Research',
        url: 'https://example.com/research.xml',
        category: 'Research',
        enabled: false,
        last_checked_at: null,
      },
    ],
    resources: [
      { key: 'builder_role', id: '201', name: 'Builder', exists: true, kind: 'role' },
      { key: 'contributor_role', id: '202', name: 'Contributor', exists: true, kind: 'role' },
      { key: 'mentor_role', id: '203', name: 'Mentor', exists: true, kind: 'role' },
      { key: 'quiz_channel', id: '210', name: 'quiz', exists: true, kind: 'text' },
      { key: 'create_workspace_voice', id: '211', name: 'Create Voice', exists: true, kind: 'voice' },
      { key: 'coworking_lounge', id: '212', name: 'Coworking Lounge', exists: true, kind: 'voice' },
      { key: 'temp_voice_category', id: '213', name: 'Temporary Voice', exists: true, kind: 'category' },
      { key: 'showcase_forum', id: '214', name: 'Showcase', exists: true, kind: 'forum' },
      { key: 'app_of_the_week', id: '215', name: 'App of the Week', exists: true, kind: 'text' },
      { key: 'collab_lfg', id: '216', name: 'Collab LFG', exists: true, kind: 'text' },
      { key: 'role_panel', id: '220', name: 'notification-roles', exists: true, kind: 'text' },
      { key: 'ai_updates', id: '221', name: 'ai-updates', exists: true, kind: 'text' },
      { key: 'announcements', id: '222', name: 'announcements', exists: true, kind: 'text' },
      { key: 'live_announcements', id: '223', name: 'live', exists: true, kind: 'text' },
      { key: 'live_ping_role', id: '224', name: 'Live Notifications', exists: true, kind: 'role' },
      { key: 'ticket_panel', id: '230', name: 'open-a-ticket', exists: true, kind: 'text' },
      { key: 'ticket_logs', id: '231', name: 'ticket-logs', exists: true, kind: 'text' },
      { key: 'ticket_category', id: '232', name: 'Tickets', exists: true, kind: 'category' },
      { key: 'anon_questions', id: '233', name: 'anonymous-questions', exists: true, kind: 'text' },
      { key: 'moderation_log', id: '240', name: 'moderation-log', exists: true, kind: 'text' },
      { key: 'compromised_account_trap', id: '241', name: 'trap-channel', exists: true, kind: 'text' },
      { key: 'analytics', id: '250', name: 'weekly-analytics', exists: true, kind: 'text' },
    ],
    channels: [
      { id: '210', name: 'quiz', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '211', name: 'Create Voice', kind: 'voice', category_id: '213', send_messages: false, embed_links: false },
      { id: '220', name: 'notification-roles', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '221', name: 'ai-updates', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '222', name: 'announcements', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '223', name: 'live', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '230', name: 'open-a-ticket', kind: 'text', category_id: null, send_messages: true, embed_links: true },
      { id: '233', name: 'anonymous-questions', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    ],
    roles: [
      { id: '201', name: 'Builder', position: 30, managed: false },
      { id: '202', name: 'Contributor', position: 40, managed: false },
      { id: '203', name: 'Mentor', position: 50, managed: false },
      { id: '224', name: 'Live Notifications', position: 60, managed: false },
    ],
    categories: [
      { id: '213', name: 'Temporary Voice' },
      { id: '232', name: 'Tickets' },
    ],
    members: [
      { id: '301', name: 'Aedwon' },
    ],
    emojis: [
      {
        id: '1234',
        name: 'grok',
        animated: false,
        available: true,
        url: 'https://cdn.discordapp.com/emojis/1234.webp',
      },
    ],
    analytics: {
      default_range: '7d',
      ranges: {
        '7d': {
          period_start: '2026-10-14T00:00:00+00:00',
          period_end: '2026-10-21T00:00:00+00:00',
          moderation_cases: 4,
          tickets_opened: 5,
          tickets_closed: 3,
          quiz_answers: 20,
          quiz_accuracy: 0.75,
          anonymous_questions: 2,
          reputation_events: 9,
          series: [
            {
              period_start: '2026-10-14T00:00:00+00:00',
              period_end: '2026-10-15T00:00:00+00:00',
              moderation_cases: 1,
              tickets_opened: 1,
              tickets_closed: 0,
              quiz_answers: 4,
              anonymous_questions: 0,
              reputation_events: 2,
            },
            {
              period_start: '2026-10-20T00:00:00+00:00',
              period_end: '2026-10-21T00:00:00+00:00',
              moderation_cases: 3,
              tickets_opened: 4,
              tickets_closed: 3,
              quiz_answers: 16,
              anonymous_questions: 2,
              reputation_events: 7,
            },
          ],
        },
      },
    },
  };
}

export function controlRouteRevisions() {
  return Object.fromEntries([
    '/control/community/reputation',
    '/control/community/quizzes',
    '/control/community/voice-coworking',
    '/control/community/showcase',
    '/control/utilities/notification-roles',
    '/control/content/feeds',
    '/control/content/announcements',
    '/control/content/live',
    '/control/utilities/ticket-configuration',
    '/control/utilities/anonymous-questions',
    '/control/workflows/moderation',
    '/control/analytics',
    '/control/mappings/channels',
    '/control/mappings/roles',
    '/control/mappings/categories',
  ].map((path) => [path, 'a'.repeat(64)]));
}

export const CONTROL_FEATURE_ROUTES = Object.freeze([
  '/control/community/reputation',
  '/control/community/quizzes',
  '/control/community/voice-coworking',
  '/control/community/showcase',
  '/control/utilities/notification-roles',
  '/control/content/feeds',
  '/control/content/announcements',
  '/control/content/live',
  '/control/utilities/ticket-configuration',
  '/control/utilities/anonymous-questions',
  '/control/workflows/moderation',
  '/control/analytics',
]);
