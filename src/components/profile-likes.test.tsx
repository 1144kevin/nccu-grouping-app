import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, jest } from '@jest/globals';
import { ProfileLikes } from './profile-likes';
import { profileSocial } from '@/lib/profile-social';
jest.mock('@/lib/profile-social', () => ({
  profileSocial: {
    likes: jest.fn(async () => ({ likes: 9, liked: false })),
    like: jest.fn(async () => ({ likes: 10, liked: true })),
  },
}));
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (select: (state: { user: { id: string } }) => unknown) => select({ user: { id: 'self' } }),
    { getState: () => ({ user: { id: 'self' } }) },
  ),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: () => undefined },
}));
it('updates the visible like count and does not allow self likes', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <ProfileLikes id="other" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('9 個讚')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '按讚' }));
  await waitFor(() => expect(screen.getByText('10 個讚')).toBeTruthy());
  expect(profileSocial.like).toHaveBeenCalledWith('other', true);
  await screen.rerender(
    <QueryClientProvider client={client}>
      <ProfileLikes id="self" />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '收到的讚' })).toBeDisabled());
  await act(async () => {
    client.clear();
  });
});
