import type { CoreOrderActivity } from './core-api';

export function pendingOrderGroups(items: CoreOrderActivity[]) {
  const groups = new Map<
    string,
    { postId: string; content: string; names: string[]; count: number }
  >();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (
      item.kind !== 'hosted_request' ||
      item.status !== 'pending' ||
      item.post_cancelled ||
      item.post_expired
    )
      continue;
    const group = groups.get(item.post_id) ?? {
      postId: item.post_id,
      content: item.post_content,
      names: [],
      count: 0,
    };
    group.count += 1;
    group.names.push(item.requester_name);
    groups.set(item.post_id, group);
  }
  return [...groups.values()];
}
