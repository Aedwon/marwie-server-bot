export function visibleActionStatus({ status, actionType, finishedAt, snapshotUpdatedAt }) {
  if (status !== 'completed' || actionType === 'refresh_snapshot' || !finishedAt) return status;

  const finishedMs = new Date(finishedAt).getTime();
  const snapshotMs = snapshotUpdatedAt ? new Date(snapshotUpdatedAt).getTime() : Number.NaN;
  if (!Number.isFinite(finishedMs) || !Number.isFinite(snapshotMs) || snapshotMs < finishedMs) {
    return 'claimed';
  }
  return status;
}
