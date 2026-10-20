import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StealthFormation } from './core-stealth-formation';
import { stealthApi, type StealthAgentTermsDraft, type StealthMatch } from '@/lib/stealth-api';
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/stealth-api', () => ({ stealthApi: { consent: jest.fn(), terms: jest.fn() } }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗' }));
jest.mock('@/lib/font-size-storage', () => ({ fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
const match = { id: 'proposal', created_at: '2026-10-18T07:00:00Z', ends_at: '2026-10-18T11:00:00Z', status: 'pending', is_demo: false, member_count: 3, my_member_number: 2, host_member_number: 1, terms_revision: 2, confirmed_count: 1, my_terms_accepted: false,
  terms: { content: '大家一起分享披薩與已協調的費用。', cost_per_person_twd: 90, order_member: 2, pickup_member: 3, deadline_at: '2026-10-18T10:00:00Z' } } as StealthMatch;
const draft: StealthAgentTermsDraft = { provider: 'offline_rules_v1', is_llm: false, content: '一起分享披薩，依全員最後確認的費用與分工處理。', cost_per_person_twd: 90, total_cost_twd: 270, cost_basis: 'known_cost', budget_limit_twd: 120, deadline_at: match.ends_at, order_member: 1, pickup_member: 3, role_suggestions: [{ role: 'order', member_number: 1, candidates: [1], reason: '成員 1 願意下單。' }, { role: 'pickup', member_number: 3, candidates: [3], reason: '成員 3 願意取餐。' }], missing_fields: [], needs_confirmation: ['每個人仍須確認同一版方案。'], ready_to_submit: true };
afterEach(async () => { await act(async () => { client.clear(); await new Promise((r) => setTimeout(r,0)); }); jest.clearAllMocks(); });
it('preserves a losing proposal after a conflict refresh and requires explicit reload', async () => {
  jest.mocked(stealthApi.terms).mockRejectedValueOnce(new Error('terms_revision_conflict'));
  const refresh = jest.fn(async () => undefined);
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms: null, terms_revision: 0, agent_draft: draft }} refresh={refresh} /></QueryClientProvider>);
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團公開說明'), '另一人同時送出時，我的草稿必須保留。'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  await screen.rerender(<QueryClientProvider client={client}><StealthFormation match={match} refresh={refresh} /></QueryClientProvider>);
  expect(screen.getByDisplayValue('另一人同時送出時，我的草稿必須保留。')).toBeTruthy();
  expect(screen.getByText('操作失敗')).toBeTruthy();
  expect(screen.getByText('最新方案已更新，保留你的未送出修改。請先核對新版，再重新編輯；不會自動覆蓋他人方案。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  expect(stealthApi.terms).toHaveBeenCalledTimes(1);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '捨棄我的草稿，載入最新方案' })); });
  expect(screen.getByDisplayValue(match.terms!.content)).toBeTruthy();
  jest.mocked(stealthApi.terms).mockResolvedValueOnce({ ...match, terms_revision: 3 });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  await waitFor(() => expect(stealthApi.terms).toHaveBeenLastCalledWith('proposal', 2, expect.objectContaining({ content: match.terms!.content })));
});

it('does not reuse a checked acknowledgement when polling reveals a new revision', async () => {
  const refresh = async () => undefined;
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={match} refresh={refresh} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('checkbox')); });
  await screen.rerender(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms_revision: 3, terms: { ...match.terms!, cost_per_person_twd: 95 } }} refresh={refresh} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '同意第 3 版並等待成團' })); });
  expect(stealthApi.consent).not.toHaveBeenCalled();
});

it('keeps in-progress edits on remote revision changes but loads current terms when explicitly editing anew', async () => {
  const refresh = async () => undefined;
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={match} refresh={refresh} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '修改方案（清除所有舊同意）' })); });
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團公開說明'), '保留我的尚未送出修改，不可默默覆蓋。'); });
  const updated = { ...match, terms_revision: 3, terms: { ...match.terms!, content: '別人已更新的公開方案內容。', cost_per_person_twd: 95 } };
  await screen.rerender(<QueryClientProvider client={client}><StealthFormation match={updated} refresh={refresh} /></QueryClientProvider>);
  expect(screen.getByDisplayValue('保留我的尚未送出修改，不可默默覆蓋。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  expect(stealthApi.terms).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '取消編輯' })); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '修改方案（清除所有舊同意）' })); });
  expect(screen.getByDisplayValue(updated.terms.content)).toBeTruthy();
  expect(screen.getByDisplayValue('95')).toBeTruthy();
});

it('requires explicit cost and role acknowledgement and binds consent to the displayed revision', async () => {
  jest.mocked(stealthApi.consent).mockResolvedValue({ ...match, my_terms_accepted: true });
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={match} refresh={async () => undefined} /></QueryClientProvider>);
  expect(screen.getByText('我的分工：下單。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '同意第 2 版並等待成團' })); });
  expect(stealthApi.consent).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.press(screen.getByRole('checkbox')); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '同意第 2 版並等待成團' })); });
  await waitFor(() => expect(stealthApi.consent).toHaveBeenCalledWith('proposal', 2));
});
it('never offers formation to inert demo actors', async () => {
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, is_demo: true }} refresh={async () => undefined} /></QueryClientProvider>);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});
it('opens existing post and chat routes after formation without another write', async () => {
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, status: 'formed', formed_post_id: 'formed-post' }} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '查看正式拼單' })); await fireEvent.press(screen.getByRole('button', { name: '進入成團聊天室' })); });
  expect(router.push).toHaveBeenCalledWith({ pathname: '/order/[id]', params: { id: 'formed-post' } });
  expect(router.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'formed-post' } });
  expect(stealthApi.consent).not.toHaveBeenCalled();
});

it('uses service time and rejects a deadline outside the shared availability window', async () => {
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms: null, terms_revision: 0 }} now={() => Date.parse('2026-10-18T07:00:00Z')} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '選擇成團截止時間' })); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '選擇 10 月 19 日' })); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '套用時間' })); });
  expect(screen.getByText('截止需晚於服務時間，且不超過配合區間結束。')).toBeTruthy();
  expect(stealthApi.terms).not.toHaveBeenCalled();
});

it('prefills the automatic draft but saves only after explicit review and editing', async () => {
  jest.mocked(stealthApi.terms).mockResolvedValue(match);
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms: null, terms_revision: 0, agent_draft: draft }} refresh={async () => undefined} /></QueryClientProvider>);
  expect(screen.getByDisplayValue('90')).toBeTruthy();
  expect(screen.getByDisplayValue(draft.content)).toBeTruthy();
  expect(stealthApi.terms).not.toHaveBeenCalled();
  expect(stealthApi.consent).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團公開說明'), '大家修正後一起分享披薩並確認費用。'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  await waitFor(() => expect(stealthApi.terms).toHaveBeenCalledWith('proposal', 0, expect.objectContaining({ content: '大家修正後一起分享披薩並確認費用。', cost_per_person_twd: 90, order_member: 1, pickup_member: 3 })));
  expect(stealthApi.consent).not.toHaveBeenCalled();
});

it('does not treat the budget as a price or assign unfilled work to the viewer', async () => {
  const unknown = { ...draft, cost_per_person_twd: null, total_cost_twd: null, cost_basis: 'unknown' as const, order_member: null, pickup_member: null, missing_fields: ['cost','order','pickup'] as StealthAgentTermsDraft['missing_fields'], ready_to_submit: false };
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms: null, terms_revision: 0, agent_draft: unknown }} refresh={async () => undefined} /></QueryClientProvider>);
  expect(screen.getByLabelText('成團每人費用').props.value).toBe('');
  expect(screen.getByText('尚未指定下單者，請協調後選擇，並由本人確認。')).toBeTruthy();
  expect(screen.getByText('尚未指定取餐者，請協調後選擇，並由本人確認。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  expect(stealthApi.terms).not.toHaveBeenCalled();
  expect(stealthApi.consent).not.toHaveBeenCalled();
});

it('keeps a human proposal and unsaved edits when fresh agent suggestions arrive', async () => {
  const refresh = async () => undefined;
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, agent_draft: draft }} refresh={refresh} /></QueryClientProvider>);
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '修改方案（清除所有舊同意）' })); });
  expect(screen.getByDisplayValue(match.terms!.content)).toBeTruthy();
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團公開說明'), '我的尚未儲存修改應該保留。'); });
  await screen.rerender(<QueryClientProvider client={client}><StealthFormation match={{ ...match, agent_draft: { ...draft, content: '更新的分身建議不能覆蓋人工輸入。' } }} refresh={refresh} /></QueryClientProvider>);
  expect(screen.getByDisplayValue('我的尚未儲存修改應該保留。')).toBeTruthy();
  expect(stealthApi.terms).not.toHaveBeenCalled();
});

it('requires a visible explanation for changing the known price and stays within the shared budget', async () => {
  jest.mocked(stealthApi.terms).mockResolvedValue(match);
  const screen = await render(<QueryClientProvider client={client}><StealthFormation match={{ ...match, terms: null, terms_revision: 0, known_cost_twd: 90, budget_max_twd: 120, agent_draft: draft }} refresh={async () => undefined} /></QueryClientProvider>);
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團每人費用'), '100'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  expect(stealthApi.terms).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('費用調整原因（本組成員可見）'), '補上每人十元已協調運費'); });
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團每人費用'), '130'); });
  expect(screen.getByText('每人費用超過共同預算 NT$ 120，請協調後調整。')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  expect(stealthApi.terms).not.toHaveBeenCalled();
  await act(async () => { await fireEvent.changeText(screen.getByLabelText('成團每人費用'), '100'); });
  await act(async () => { await fireEvent.press(screen.getByRole('button', { name: '提出方案，請全員確認' })); });
  await waitFor(() => expect(stealthApi.terms).toHaveBeenCalledWith('proposal', 0, expect.objectContaining({ cost_per_person_twd: 100, cost_change_note: '補上每人十元已協調運費' })));
  expect(stealthApi.consent).not.toHaveBeenCalled();
});
