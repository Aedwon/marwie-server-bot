export function overlayCompletedFeatureActions(snapshot, actions) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.features)) return null;

  const next = {
    ...snapshot,
    features: snapshot.features.map(item => ({ ...item })),
  };
  const indexes = new Map(next.features.map((item, index) => [String(item.name), index]));

  for (const action of actions) {
    if (action?.action_type !== 'set_feature') return null;
    const result = action.result_json;
    if (!result || typeof result.feature !== 'string' || typeof result.enabled !== 'boolean') {
      return null;
    }
    const index = indexes.get(result.feature);
    if (index === undefined) return null;
    next.features[index] = { ...next.features[index], enabled: result.enabled };
  }

  return next;
}
