import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Location from 'expo-location';
import { useLocationStore } from './location-store';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const permission = jest.mocked(Location.requestForegroundPermissionsAsync);
const position = jest.mocked(Location.getCurrentPositionAsync);

beforeEach(() => {
  jest.resetAllMocks();
  useLocationStore.setState({ coordinates: undefined, updatedAt: undefined, loading: false, error: undefined });
});

describe('viewer location', () => {
  it('does not request a position if permission is denied', async () => {
    permission.mockResolvedValue({ status: 'denied' } as Location.LocationPermissionResponse);
    expect(await useLocationStore.getState().requestLocation()).toBeUndefined();
    expect(position).not.toHaveBeenCalled();
    expect(useLocationStore.getState().error).toContain('未允許定位');
    expect(useLocationStore.getState().loading).toBe(false);
  });

  it('stores only coordinates after permission is granted', async () => {
    permission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
    position.mockResolvedValue({ coords: { latitude: 25, longitude: 121 } } as Location.LocationObject);
    expect(await useLocationStore.getState().requestLocation()).toEqual({ latitude: 25, longitude: 121 });
    expect(useLocationStore.getState().coordinates).toEqual({ latitude: 25, longitude: 121 });
    expect(useLocationStore.getState().loading).toBe(false);
  });

  it('clears stale coordinates and shows a recoverable error when location fails', async () => {
    useLocationStore.setState({ coordinates: { latitude: 25, longitude: 121 } });
    permission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
    position.mockRejectedValue(new Error('unavailable'));
    await useLocationStore.getState().requestLocation();
    expect(useLocationStore.getState().coordinates).toBeUndefined();
    expect(useLocationStore.getState().error).toContain('暫時無法取得位置');
    expect(useLocationStore.getState().loading).toBe(false);
  });

  it('times out a stalled location request', async () => {
    jest.useFakeTimers();
    try {
      permission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse);
      position.mockImplementation(() => new Promise(() => {}));
      const request = useLocationStore.getState().requestLocation();
      await jest.advanceTimersByTimeAsync(15000);
      await request;
      expect(useLocationStore.getState().loading).toBe(false);
      expect(useLocationStore.getState().coordinates).toBeUndefined();
      expect(useLocationStore.getState().error).toBeDefined();
    } finally { jest.useRealTimers(); }
  });
});
