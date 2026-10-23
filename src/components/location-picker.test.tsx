import { useState } from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';
import { LocationPicker } from './location-picker';
import { pickupFavorites } from '@/lib/pickup-favorites-storage';
import { searchPlaces } from '@/lib/place-search';
import type { PostLocation } from '@/types/domain';

let mockActor = 'alice';
const mockLocation = jest.fn<() => Promise<{ latitude: number; longitude: number } | undefined>>();
jest.mock('@/store/auth-store', () => ({
  useAuthStore: Object.assign(
    (s: (state: { user: { id: string } }) => unknown) => s({ user: { id: mockActor } }),
    { getState: () => ({ user: { id: mockActor } }) },
  ),
}));
jest.mock('@/store/location-store', () => ({
  useLocationStore: () => ({ requestLocation: mockLocation, loading: false }),
}));
jest.mock('@/lib/font-size-storage', () => ({
  fontSizeStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('@/lib/place-search', () => ({ searchPlaces: jest.fn() }));
jest.mock('@/lib/pickup-favorites-storage', () => ({
  pickupFavorites: { list: jest.fn(), add: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/components/pickup-map', () => ({
  PickupMap: ({ onPick }: { onPick: (p: { latitude: number; longitude: number }) => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPick({ latitude: 24.986, longitude: 121.576 })}
      >
        <Text>測試移動圖釘</Text>
      </Pressable>
    );
  },
}));
const place = { name: '新的取餐點', latitude: 24.986, longitude: 121.576 };
beforeEach(() => {
  jest.clearAllMocks();
  mockActor = 'alice';
  jest.mocked(pickupFavorites.list).mockResolvedValue([]);
  jest.mocked(pickupFavorites.add).mockResolvedValue([{ id: 'saved', location: place }]);
  jest.mocked(pickupFavorites.remove).mockResolvedValue([]);
  mockLocation.mockResolvedValue({ latitude: 24.987, longitude: 121.577 });
  jest
    .mocked(searchPlaces)
    .mockResolvedValue([{ ...place, id: 'search', address: '街道地址', source: 'openstreetmap' }]);
});
function Form({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<PostLocation>();
  return (
    <>
      <LocationPicker value={value} onChange={setValue} disabled={disabled} />
      <Text testID="location">{JSON.stringify(value) ?? 'unconfirmed'}</Text>
    </>
  );
}
it('selects a campus reference and preserves notes only after explicit confirmation', async () => {
  const s = await render(<Form />);
  await fireEvent.press(s.getByRole('button', { name: '正門' }));
  expect(s.getByTestId('location').props.children).toContain('正門');
  await fireEvent.press(s.getByRole('button', { name: '編輯取餐地點說明' }));
  await fireEvent.changeText(s.getByLabelText('補充取餐地點說明'), '一樓右側桌子');
  await fireEvent.press(s.getByRole('button', { name: '確認取餐地點' }));
  expect(s.getByTestId('location').props.children).toContain('取餐說明：一樓右側桌子');
  expect(s.queryByText(/要將/)).toBeNull();
  await fireEvent.press(s.getByRole('button', { name: '編輯取餐地點說明' }));
  await fireEvent.changeText(s.getByLabelText('取餐地點名稱'), '正門另一側');
  expect(s.getByTestId('location').props.children).toBe('unconfirmed');
});
it('lets a user drag a custom point and explicitly opt in to saving it', async () => {
  const s = await render(<Form />);
  await fireEvent.press(s.getByRole('button', { name: '在地圖上選點／微調' }));
  expect(s.getByRole('button', { name: '使用此位置' }).props.accessibilityState.disabled).toBe(
    true,
  );
  await fireEvent.press(s.getByRole('button', { name: '測試移動圖釘' }));
  await fireEvent.press(s.getByRole('button', { name: '使用此位置' }));
  await fireEvent.changeText(s.getByLabelText('取餐地點名稱'), '新的取餐點');
  await fireEvent.press(s.getByRole('button', { name: '確認取餐地點' }));
  expect(s.getByText(/加入我的常用地點嗎/)).toBeTruthy();
  expect(pickupFavorites.add).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      s.getByRole('button', { name: '加入我的常用地點' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  await fireEvent.press(s.getByRole('button', { name: '加入我的常用地點' }));
  await waitFor(() =>
    expect(pickupFavorites.add).toHaveBeenCalledWith('alice', expect.objectContaining(place)),
  );
  expect(s.getByTestId('location').props.children).toContain('24.986');
});
it('does not save a location when the user declines, and cancellation preserves an old selection', async () => {
  const s = await render(<Form />);
  await fireEvent.press(s.getByRole('button', { name: '使用目前位置' }));
  await waitFor(() => expect(s.getByLabelText('取餐地點名稱')).toBeTruthy());
  await fireEvent.press(s.getByRole('button', { name: '確認取餐地點' }));
  await fireEvent.press(s.getByRole('button', { name: '暫時不用' }));
  expect(pickupFavorites.add).not.toHaveBeenCalled();
  const old = s.getByTestId('location').props.children;
  await fireEvent.press(s.getByRole('button', { name: '在地圖上選點／微調' }));
  await fireEvent.press(s.getByRole('button', { name: '測試移動圖釘' }));
  await fireEvent.press(s.getByRole('button', { name: '取消選點' }));
  expect(s.getByTestId('location').props.children).toBe(old);
});
it('retains search and navigation and invalidates an edited selection', async () => {
  const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const s = await render(<Form />);
  await fireEvent.changeText(s.getByLabelText('地點名稱或地址'), '取餐點');
  await fireEvent.press(s.getByRole('button', { name: '搜尋地點' }));
  await waitFor(() => expect(s.getByRole('button', { name: '選擇地點 新的取餐點' })).toBeTruthy());
  await fireEvent.press(s.getByRole('button', { name: '選擇地點 新的取餐點' }));
  await fireEvent.press(s.getByRole('button', { name: '確認取餐地點' }));
  await fireEvent.press(s.getByRole('link', { name: '用 Google Maps 導航' }));
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('destination=24.986%2C121.576'));
  await fireEvent.press(s.getByRole('button', { name: '編輯取餐地點說明' }));
  await fireEvent.changeText(s.getByLabelText('補充取餐地點說明'), '另一張桌子');
  expect(s.getByTestId('location').props.children).toBe('unconfirmed');
  spy.mockRestore();
});
it('does not accept a late search response after account change', async () => {
  let finish!: (p: Awaited<ReturnType<typeof searchPlaces>>) => void;
  jest.mocked(searchPlaces).mockReturnValue(
    new Promise((r) => {
      finish = r;
    }),
  );
  const s = await render(<Form />);
  await fireEvent.changeText(s.getByLabelText('地點名稱或地址'), '測試搜尋');
  await fireEvent.press(s.getByRole('button', { name: '搜尋地點' }));
  mockActor = 'bob';
  await s.rerender(<Form />);
  await act(async () => {
    finish([{ ...place, id: 'old', address: '舊帳號', source: 'openstreetmap' }]);
  });
  expect(s.queryByText('舊帳號')).toBeNull();
});
it('does not show another account favorites and blocks edits while publishing', async () => {
  const s = await render(<Form disabled />);
  expect(s.getByRole('button', { name: '正門' }).props.accessibilityState.disabled).toBe(true);
  expect(
    s.getByRole('button', { name: '在地圖上選點／微調' }).props.accessibilityState.disabled,
  ).toBe(true);
});

it('loads older server locations with null optional fields without losing coordinates', async () => {
  const onChange = jest.fn();
  const s = await render(
    <LocationPicker
      value={{ ...place, address: null, source: null } as unknown as PostLocation}
      onChange={onChange}
    />,
  );
  await fireEvent.press(s.getByRole('button', { name: '編輯取餐地點說明' }));
  await fireEvent.press(s.getByRole('button', { name: '確認取餐地點' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining(place));
});

it('preserves the address and note if the map is opened and confirmed without moving the pin', async () => {
  const onChange = jest.fn();
  const s = await render(
    <LocationPicker
      value={{ ...place, address: '原地址\n取餐說明：一樓桌子' }}
      onChange={onChange}
    />,
  );
  await fireEvent.press(s.getByRole('button', { name: '在地圖上選點／微調' }));
  await fireEvent.press(s.getByRole('button', { name: '使用此位置' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(s.getByText('一樓桌子')).toBeTruthy();
});
