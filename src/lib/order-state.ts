import type { CorePost } from './core-api';
export function orderStateLabel(
  post: Pick<CorePost, 'status' | 'my_status' | 'joined' | 'capacity' | 'completed'>,
  completed = post.completed,
) {
  if (completed || post.completed) return '已完成';
  if (post.status === 'cancelled') return '已取消';
  if (post.status === 'expired') return '已截止';
  if (post.my_status === 'pending') return '審核中';
  return post.joined >= post.capacity ? '進行中' : '待成團';
}
