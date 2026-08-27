const SNAPSHOT_INDEPENDENT_COMPLETIONS = new Set(['refresh_snapshot', 'set_feature']);

export function visibleActionStatus({ status, actionType, finishedAt, snapshotUpdatedAt }) {
  if (status !== 'completed' || SNAPSHOT_INDEPENDENT_COMPLETIONS.has(actionType) || !finishedAt) {
    return status;
  }

  const finishedMs = new Date(finishedAt).getTime();
  const snapshotMs = snapshotUpdatedAt ? new Date(snapshotUpdatedAt).getTime() : Number.NaN;
  if (!Number.isFinite(finishedMs) || !Number.isFinite(snapshotMs) || snapshotMs < finishedMs) {
    return 'claimed';
  }
  return status;
}
