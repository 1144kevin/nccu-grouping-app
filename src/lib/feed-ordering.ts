import type { CorePost } from './core-api';
const score = (post: CorePost) =>
  post.semantic_recommendation?.combined_score ?? post.recommendation?.score ?? 0;
export function orderFeedPosts(posts: CorePost[], refresh = 0) {
  const result: CorePost[] = [];
  for (const touched of [false, true]) {
    const tier = posts.filter(
      (post) => (!!post.my_status && post.my_status !== 'none') === touched,
    );
    if (!refresh) {
      result.push(...tier);
      continue;
    }
    for (let start = 0; start < tier.length;) {
      let end = start + 1;
      while (end < tier.length && Math.abs(score(tier[start]) - score(tier[end])) <= 5) end++;
      const similar = tier.slice(start, end);
      const offset = refresh % similar.length;
      result.push(...similar.slice(offset), ...similar.slice(0, offset));
      start = end;
    }
  }
  return result;
}
