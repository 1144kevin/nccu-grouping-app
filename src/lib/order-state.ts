import type { CorePost } from './core-api';
export function orderStateLabel(
  post: Pick<
    CorePost,
    'status' | 'my_status' | 'joined' | 'capacity' | 'completed' | 'workflow_stage'
  >,
  completed = post.completed,
) {
  if (completed || post.completed) return '已完成';
  if (post.status === 'cancelled') return '已取消';
  if (post.my_status === 'pending') return '審核中';
  if (post.workflow_stage && post.workflow_stage !== 'waiting')
    return {
      formed: '已成團',
      en_route: '前往中',
      delivering: '交貨中',
      completed: '已完成',
    }[post.workflow_stage];
  if (post.status === 'expired') return '已截止';
  return post.joined >= post.capacity ? '進行中' : '待成團';
}
