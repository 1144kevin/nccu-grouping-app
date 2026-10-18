import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { coreApi, type CoreSession } from '@/lib/core-api';
import { GOOGLE_IOS_CALLBACK, readGoogleCallback, validateGoogleStart } from '@/lib/google-oauth';

// Keep proofs in this process only. No URL code or PKCE proof is written to disk.
let callback: Promise<CoreSession> | null = null;
let running = false;

export async function beginGoogleSignIn(): Promise<CoreSession> {
  if (Platform.OS !== 'ios') throw new Error('google_web_only');
  if (Constants.executionEnvironment === 'storeClient')
    throw new Error('google_native_build_required');
  if (running) throw new Error('too_many_auth_attempts');
  running = true;
  callback = null;
  try {
    const flow = await coreApi.googleStart('ios');
    validateGoogleStart(flow.authorize_url, flow.flow_id, GOOGLE_IOS_CALLBACK);
    callback = (async () => {
      const result = await WebBrowser.openAuthSessionAsync(flow.authorize_url, GOOGLE_IOS_CALLBACK);
      if (result.type !== 'success') throw new Error('google_login_cancelled');
      const value = readGoogleCallback(result.url, flow.flow_id, GOOGLE_IOS_CALLBACK);
      return coreApi.googleFinish(value.flowId, value.code);
    })();
    return await callback;
  } finally {
    running = false;
  }
}

export function finishGoogleSignIn(): Promise<CoreSession> {
  return callback ?? Promise.reject(new Error('google_login_expired_restart'));
}

export function clearGoogleCallback(): void {
  callback = null;
}
