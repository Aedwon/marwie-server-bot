export function normalizeSnapshotChannelCapabilities(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  if (snapshot?.bot?.permissions?.administrator !== true || !Array.isArray(snapshot.channels)) {
    return snapshot;
  }

  let changed = false;
  const channels = snapshot.channels.map(channel => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel) || channel.kind !== 'text') {
      return channel;
    }

    const missingSendMessages = channel.send_messages === undefined;
    const missingEmbedLinks = channel.embed_links === undefined;
    if (!missingSendMessages && !missingEmbedLinks) return channel;

    changed = true;
    return {
      ...channel,
      ...(missingSendMessages ? { send_messages: true } : {}),
      ...(missingEmbedLinks ? { embed_links: true } : {}),
    };
  });

  return changed ? { ...snapshot, channels } : snapshot;
}
