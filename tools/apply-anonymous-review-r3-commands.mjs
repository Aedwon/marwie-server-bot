import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs-site/commands.js';
let source = readFileSync(path, 'utf8');

const workflowBefore = "  { id: 'workflow-learning', title: 'Quizzes & anonymous Q&A', intro: 'Manage quizzes and anonymous questions for the community.', commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask'] },";
const workflowAfter = "  { id: 'workflow-learning', title: 'Quizzes & anonymous features', intro: 'Manage quizzes, anonymous questions, and the anonymous message panel.', commands: ['/quiz add', '/quiz start', '/quiz schedule', '/anonask', '/anon deploy', '/anon sync'] },";
if (!source.includes(workflowBefore)) {
  throw new Error('Anonymous review workflow anchor not found in current Commands UI.');
}
source = source.replace(workflowBefore, workflowAfter);

const previewBefore = "  '/anonwho': Object.freeze({ permission: 'Moderate Members', description: 'Resolve the author of an anonymous question for a deliberate staff audit.' }),";
const previewAfter = `${previewBefore}\n  '/anon deploy': Object.freeze({ permission: 'Administrator', description: 'Post or refresh the persistent anonymous-message panel using the current mapped destinations.' }),\n  '/anon sync': Object.freeze({ permission: 'Administrator', description: 'Reconcile deleted anonymous messages and restore contiguous public numbering.' }),`;
if (!source.includes(previewBefore)) {
  throw new Error('Anonymous review preview-metadata anchor not found in current Commands UI.');
}
source = source.replace(previewBefore, previewAfter);

writeFileSync(path, source);
console.log('Integrated anonymous commands with the current Commands UI.');
