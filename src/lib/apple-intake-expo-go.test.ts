import { expect, it, jest } from '@jest/globals';
jest.mock('@/lib/app-runtime', () => ({ isExpoGo: () => true }));
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => {
  throw new Error('Expo Go must never try to load the custom Apple module');
}) }));

it('Expo Go ignores stale trial flags and safely leaves Apple AI for native builds', async () => {
  const oldEnabled = process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED;
  const oldTrial = process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL;
  process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED = 'true';
  process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL = 'true';
  try {
    const module = jest.requireActual<typeof import('./apple-intake')>('./apple-intake');
    expect(module.APPLE_INTAKE_ENABLED).toBe(false);
    expect(module.APPLE_INTAKE_TRIAL).toBe(false);
    await expect(module.appleIntakeAvailability()).resolves.toBe('native_module_missing');
  } finally {
    if (oldEnabled === undefined) delete process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED;
    else process.env.EXPO_PUBLIC_APPLE_INTAKE_ENABLED = oldEnabled;
    if (oldTrial === undefined) delete process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL;
    else process.env.EXPO_PUBLIC_APPLE_INTAKE_TRIAL = oldTrial;
  }
});
