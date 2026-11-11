import { afterEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { OrderWorkflowControls } from './order-workflow-controls';
import { queryClient } from '@/lib/query-client';
import { socialApi } from '@/lib/social-api';
import { profileSocial } from '@/lib/profile-social';
import { captureOrderPhoto } from '@/lib/capture-order-photo';

jest.mock('@/lib/social-api', () => ({ socialApi: { workflow: jest.fn(), workflowAction: jest.fn() } }));
jest.mock('@/lib/profile-social', () => ({ profileSocial: { upload: jest.fn() } }));
jest.mock('@/lib/capture-order-photo', () => ({ captureOrderPhoto: jest.fn() }));
jest.mock('@/lib/core-hooks', () => ({ invalidateCore: jest.fn() }));
jest.mock('@/lib/core-api', () => ({ coreError: () => '操作失敗', newRequestKey: () => 'test-request-key' }));
jest.mock('@/store/auth-store', () => ({ useAuthStore: Object.assign(jest.fn(), { getState: () => ({ user: { id: 'actor' } }) }) }));
const state = { stage: 'en_route' as const, member_count: 2, formation_votes: 0, my_vote: false, host_vote: false, is_host: true, completed_count: 0, my_completed: false };
afterEach(() => { queryClient.clear(); jest.clearAllMocks(); });
it('takes a live photo and uploads it before the host confirms purchase', async () => {
  jest.mocked(socialApi.workflow).mockResolvedValue(state);
  jest.mocked(captureOrderPhoto).mockResolvedValue({ uri: 'data:image/jpeg;base64,YWJj', base64: 'YWJj', width: 1, height: 1 });
  jest.mocked(profileSocial.upload).mockResolvedValue({ id: 'photo', width: 1, height: 1, state: 'ready' });
  jest.mocked(socialApi.workflowAction).mockResolvedValue({ ...state, stage: 'delivering' });
  const screen = await render(<QueryClientProvider client={queryClient}><OrderWorkflowControls id="order" actor="actor" active /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: '購買完成' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '購買完成' }));
  await waitFor(() => expect(socialApi.workflowAction).toHaveBeenCalledWith('order', 'purchase', 'photo'));
  expect(captureOrderPhoto).toHaveBeenCalledTimes(1);
});
it('does not change the order if the camera is cancelled', async () => {
  jest.mocked(socialApi.workflow).mockResolvedValue({ ...state, stage: 'delivering', is_host: false });
  jest.mocked(captureOrderPhoto).mockResolvedValue(null);
  const screen = await render(<QueryClientProvider client={queryClient}><OrderWorkflowControls id="order" actor="actor" active /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: '完成訂單' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '完成訂單' }));
  await waitFor(() => expect(captureOrderPhoto).toHaveBeenCalledTimes(1));
  expect(socialApi.workflowAction).not.toHaveBeenCalled();
});
