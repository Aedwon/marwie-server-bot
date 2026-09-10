import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Review overlay anchor not found in ${path}: ${before.slice(0, 80)}`);
  }
  writeFileSync(path, source.replace(before, after));
}

function replaceAllRequired(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Review overlay anchor not found in ${path}: ${before.slice(0, 80)}`);
  }
  writeFileSync(path, source.replaceAll(before, after));
}

replaceOnce(
  'docs-site/control-mappings.js',
  "  'quiz_channel',\n  'anon_questions',\n  'analytics',",
  "  'quiz_channel',\n  'anon_questions',\n  'anon_messages_panel',\n  'anon_messages_submissions',\n  'anon_messages_audit_log',\n  'analytics',",
);
replaceOnce(
  'docs-site/control-mappings.js',
  "  anon_questions: Object.freeze({ label: 'Anonymous questions', group: 'channels', kind: 'text' }),\n  analytics:",
  "  anon_questions: Object.freeze({ label: 'Anonymous questions', group: 'channels', kind: 'text' }),\n  anon_messages_panel: Object.freeze({ label: 'Anonymous message panel', group: 'channels', kind: 'text' }),\n  anon_messages_submissions: Object.freeze({ label: 'Anonymous submissions', group: 'channels', kind: 'text' }),\n  anon_messages_audit_log: Object.freeze({ label: 'Anonymous audit log', group: 'channels', kind: 'text' }),\n  analytics:",
);

replaceOnce(
  'api/_lib/actions.js',
  "  'anon_questions', 'analytics', 'showcase_forum',",
  "  'anon_questions', 'anon_messages_panel', 'anon_messages_submissions',\n  'anon_messages_audit_log', 'analytics', 'showcase_forum',",
);
replaceOnce(
  'api/_lib/actions.js',
  "  'anon_questions', 'analytics', 'showcase_forum', 'app_of_the_week', 'collab_lfg',",
  "  'anon_questions', 'anon_messages_panel', 'anon_messages_submissions',\n  'anon_messages_audit_log', 'analytics', 'showcase_forum', 'app_of_the_week', 'collab_lfg',",
);
replaceOnce(
  'api/_lib/actions.js',
  "  'reputation', 'quizzes', 'anonymous_questions', 'coworking', 'ai_updates',",
  "  'reputation', 'quizzes', 'anonymous_questions', 'anonymous_messages', 'coworking', 'ai_updates',",
);

function patchManual(path) {
  replaceOnce(path, 'Rob-bot currently registers **43 slash commands**.', 'Rob-bot currently registers **45 slash commands**.');
  replaceAllRequired(path, 'Quizzes and anonymous questions', 'Quizzes and anonymous features');
  replaceOnce(
    path,
    "29. `/quiz add`\n30. `/quiz start`\n31. `/quiz schedule`\n32. `/anonask`\n33. `/anonwho`\n\n### Coworking and collaboration\n\n34. `/pomodoro start`\n35. `/pomodoro status`\n36. `/pomodoro stop`\n37. `/lfg`\n\n### AI updates, analytics, and showcase\n\n38. `/ai-source add`\n39. `/ai-source list`\n40. `/ai-source disable`\n41. `/ai-source poll`\n42. `/analytics`\n43. `/app-of-week`",
    "29. `/quiz add`\n30. `/quiz start`\n31. `/quiz schedule`\n32. `/anonask`\n33. `/anonwho`\n34. `/anon deploy`\n35. `/anon sync`\n\n### Coworking and collaboration\n\n36. `/pomodoro start`\n37. `/pomodoro status`\n38. `/pomodoro stop`\n39. `/lfg`\n\n### AI updates, analytics, and showcase\n\n40. `/ai-source add`\n41. `/ai-source list`\n42. `/ai-source disable`\n43. `/ai-source poll`\n44. `/analytics`\n45. `/app-of-week`",
  );
  replaceOnce(
    path,
    '**Recommended text-channel keys:** `moderation_log`, `message_log`, `ticket_panel`, `ticket_logs`, `announcements`, `live_announcements`, `role_panel`, `ai_updates`, `quiz_channel`, `anon_questions`, `analytics`, `app_of_the_week`, `collab_lfg`, and `bot_log`.',
    '**Recommended text-channel keys:** `moderation_log`, `message_log`, `ticket_panel`, `ticket_logs`, `announcements`, `live_announcements`, `role_panel`, `ai_updates`, `quiz_channel`, `anon_questions`, `anon_messages_panel`, `anon_messages_submissions`, `anon_messages_audit_log`, `analytics`, `app_of_the_week`, `collab_lfg`, and `bot_log`.\n\n**Anonymous audit mapping:** When binding `anon_messages_audit_log` manually, choose a separate private text channel that `@everyone` cannot view. It must not be the same channel as `anon_messages_panel` or `anon_messages_submissions`; the anonymous-message feature fails closed if this privacy requirement is not met.',
  );
  replaceOnce(
    path,
    '`moderation`, `message_logs`, `tickets`, `voice`, `announcements`, `live_announcements`, `reputation`, `quizzes`, `anonymous_questions`, `coworking`, `ai_updates`, `analytics`, or `showcase`.',
    '`moderation`, `message_logs`, `tickets`, `voice`, `announcements`, `live_announcements`, `reputation`, `quizzes`, `anonymous_questions`, `anonymous_messages`, `coworking`, `ai_updates`, `analytics`, or `showcase`.',
  );

  const anonymousSection = `## Anonymous message panel and replies\n\nThe anonymous-message system is a persistent button/modal workflow rather than a member slash command. It is separate from \`/anonask\` and uses three independently configurable text-channel mappings:\n\n- \`anon_messages_panel\` — where the persistent **Send Message** panel is kept;\n- \`anon_messages_submissions\` — where numbered anonymous messages and anonymous replies are posted;\n- \`anon_messages_audit_log\` — the private staff destination that receives the submitter identity and submitted content for abuse and safety review.\n\nThe panel and submissions mappings may point to the same Discord channel to reproduce the original single-channel layout, or to different channels. The audit mapping must point to a separate private text channel that \`@everyone\` cannot view; it cannot share the panel or submissions destination. Rob-bot fails closed if that privacy requirement is not met. The \`anonymous_messages\` feature flag must be enabled. A member must be able to view both the current panel and submissions channels; a persistent button left behind in an old mapping is rejected.\n\nMember flow:\n\n1. Press **Send Message** on the current anonymous-message panel.\n2. Enter 10 to 2000 characters in the modal. Leading and trailing whitespace is removed before validation.\n3. Rob-bot posts a public embed titled \`Anonymous Message #N\` in the mapped submissions channel with no member identity and with mention parsing disabled.\n4. Rob-bot stores the durable message record and writes the private staff audit entry. Public anonymity therefore means hidden from other members, not hidden from authorized staff.\n5. Any anonymous top-level message or anonymous reply has a persistent **Reply Anonymously** button. Replies accept 5 to 2000 characters, are posted as Discord replies, are not numbered, and also disable mention parsing.\n\nWith background tasks enabled, Rob-bot checks the panel every 10 minutes. If the tracked panel is no longer the newest message in its mapped panel channel, Rob-bot removes the old tracked panel when possible and posts a fresh one at the bottom. If the panel mapping moves, Rob-bot uses durable panel state to clean up the previously tracked panel before posting in the new channel.\n\nWhen a tracked top-level anonymous message is deleted, Rob-bot soft-deletes its durable record and queues a renumber pass. Active top-level messages are kept contiguous as \`#1\`, \`#2\`, and so on. Anonymous replies do not affect numbering. \`/anon sync\` can also reconcile messages that were deleted while Rob-bot was offline.\n\n---\n\n## \`/anon deploy\`\n\n**Syntax:** \`/anon deploy\`\n\n**Permission:** Administrator.\n\n**What happens:** Forces an immediate anonymous-message panel deployment. Rob-bot resolves all three anonymous-message mappings, removes the previously tracked panel when possible, posts a fresh persistent panel in \`anon_messages_panel\`, saves its Discord message ID, and privately confirms the current panel, submissions, and staff-audit destinations.\n\n**Parameters:** None.\n\n**Prerequisites:**\n\n- \`anon_messages_panel\`, \`anon_messages_submissions\`, and \`anon_messages_audit_log\` must each resolve to an existing text channel;\n- \`anon_messages_audit_log\` must be a separate private channel from the panel and submissions destinations, and \`@everyone\` must not be able to view it;\n- in the panel channel, Rob-bot needs View Channel, Send Messages, Embed Links, Read Message History, and Manage Messages so it can keep the panel sticky and replace the previous tracked panel;\n- members who use the panel must have access to both the mapped panel and submissions channels;\n- actual anonymous posting also requires Rob-bot to be able to View Channel, Send Messages, and Embed Links in both the submissions and audit destinations.\n\nIf a required mapping is missing or the audit mapping is public/shared with a public anonymous-message destination, Rob-bot fails closed and asks the administrator to correct the mappings. If panel permissions are insufficient, deployment fails closed and reports that the panel could not be deployed.\n\n**Example usage:**\n\n\`/anon deploy\`\n\n---\n\n## \`/anon sync\`\n\n**Syntax:** \`/anon sync\`\n\n**Permission:** Administrator.\n\n**What happens:** Reconciles durable top-level anonymous-message records against the currently mapped \`anon_messages_submissions\` channel. Rob-bot checks each tracked Discord message, marks missing messages deleted, rebuilds the contiguous number sequence, and edits only embeds whose \`Anonymous Message #N\` title needs correction. Replies are ignored by the numbering pass.\n\nThe sync is restart-safe because numbering state is stored in the database. When a missing Discord message is discovered, Rob-bot performs another pass so later messages can close the numbering gap. Corrected display numbers are persisted after successful Discord edits.\n\n**Parameters:** None.\n\n**Prerequisite:** \`anon_messages_submissions\` must resolve to an existing text channel. Rob-bot also needs normal message-history/fetch and edit access in that destination for reconciliation to succeed.\n\nIf no tracked top-level anonymous messages remain, Rob-bot reports that there is nothing to sync. Individual Discord fetch/edit failures are logged and do not cause Rob-bot to invent message state.\n\n**Example usage:**\n\n\`/anon sync\`\n\n---\n\n`;
  replaceOnce(path, '# Coworking and collaboration', `${anonymousSection}# Coworking and collaboration`);
}

patchManual('docs/commands.md');
patchManual('docs-site/commands.md');

replaceOnce(
  'web-tests/control-mappings.test.js',
  "  'quiz_channel',\n  'anon_questions',\n  'analytics',",
  "  'quiz_channel',\n  'anon_questions',\n  'anon_messages_panel',\n  'anon_messages_submissions',\n  'anon_messages_audit_log',\n  'analytics',",
);
replaceOnce(
  'web-tests/control-secondary-surfaces.test.js',
  'Commands reuses the synchronized 43-command canonical manual without duplicating its catalog',
  'Commands reuses the synchronized 45-command canonical manual without duplicating its catalog',
);
replaceOnce(
  'web-tests/control-secondary-surfaces.test.js',
  ").length, 43);",
  ").length, 45);",
);

console.log('Applied anonymous-message review overlay to current site baseline.');
