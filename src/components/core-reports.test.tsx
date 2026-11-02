import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoreHelpScreen, ReportComposer } from './core-reports';
import { engagementApi, type Report } from '@/lib/engagement-api';
import { profileSocial } from '@/lib/profile-social';
jest.mock('@/lib/pick-personal-image', () => ({
  pickPersonalImage: jest.fn(async () => ({
    uri: 'data:image/jpeg;base64,c3ludGhldGlj',
    base64: 'c3ludGhldGlj',
    width: 10,
    height: 10,
  })),
}));
jest.mock('@/lib/profile-social', () => ({
  profileSocial: { upload: jest.fn(async () => ({ id: 'evidence-synthetic-image' })) },
}));
jest.mock('@/lib/engagement-api', () => ({
  engagementApi: { report: jest.fn(), reports: jest.fn() },
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(async () => ({ data: { can_review: true } })) },
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('@/lib/core-api', () => ({
  coreError: () => '暫時無法連線',
  newRequestKey: () => 'synthetic-report-retry-key',
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'fixture' } }),
    { getState: () => ({ user: { id: 'fixture' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
afterEach(async () => {
  await act(async () => {
    client.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
});
it('does not display success until saved, retains failed text and reuses the retry key', async () => {
  jest
    .mocked(engagementApi.report)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: 'fixture-report', status: 'received' } as Report);
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReportComposer kind="feedback" />
    </QueryClientProvider>,
  );
  await act(async () => {
    await fireEvent.changeText(
      screen.getByLabelText('回報說明'),
      '我遇到明確的操作問題，這是隔離測試內容。',
    );
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '上傳圖片' }));
  });
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認送出回報' }));
  });
  await waitFor(() => expect(screen.getByText(/內容已保留/)).toBeTruthy());
  expect(screen.queryByText(/已儲存並收到/)).toBeNull();
  const first = jest.mocked(engagementApi.report).mock.calls[0];
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '確認送出回報' }));
  });
  await waitFor(() => expect(screen.getByText(/已儲存並收到，尚待管理者查看/)).toBeTruthy());
  expect(jest.mocked(engagementApi.report).mock.calls[1]).toEqual(first);
  expect(first[0].evidence_image_id).toBe('evidence-synthetic-image');
  expect(profileSocial.upload).toHaveBeenCalledTimes(1);
});

it('does not submit a report without its required image', async () => {
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReportComposer kind="feedback" />
    </QueryClientProvider>,
  );
  await fireEvent.changeText(
    screen.getByLabelText('回報說明'),
    '這是一段足夠長的具體回報內容，但尚未選擇圖片。',
  );
  await fireEvent.press(screen.getByRole('button', { name: '確認送出回報' }));
  expect(engagementApi.report).not.toHaveBeenCalled();
});

it('shows the actual review outcome and public response without inventing a disposition', async () => {
  jest.mocked(engagementApi.reports).mockResolvedValueOnce({
    items: [
      {
        id: 'resolved-fixture',
        kind: 'feedback',
        target_id: null,
        reason: 'other',
        detail: '隔離回報，驗證管理者實際處理結果。',
        platform: 'web',
        app_version: '1.0.0',
        created_at: '2026-10-20T06:00:00Z',
        status: 'resolved',
        public_response: '已完成檢查並修正操作問題。',
        review_version: 3,
      },
    ],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <CoreHelpScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('問題回報 · 已結案')).toBeTruthy());
  expect(screen.getByText('處理回覆：已完成檢查並修正操作問題。')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: '管理回報' })).toBeTruthy());
  await act(async () => {
    queryClient.clear();
  });
});
