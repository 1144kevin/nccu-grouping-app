import { coreApi, type CoreSession } from '@/lib/core-api';
import { GOOGLE_CALLBACK, readGoogleCallback, validateGoogleStart } from '@/lib/google-oauth';

const KEY = 'nccu-grouping.google-web.flow';
let callback: Promise<CoreSession> | null = null;

export async function beginGoogleSignIn(): Promise<void> {
  callback = null;
  if (window.location.origin !== new URL(GOOGLE_CALLBACK).origin) throw new Error('google_login_invalid_response');
  window.sessionStorage.removeItem(KEY);
  const flow = await coreApi.googleStart(process.env.EXPO_PUBLIC_ACCOUNT_WEB === 'true' ? 'web_account' : 'web');
  validateGoogleStart(flow.authorize_url, flow.flow_id);
  window.sessionStorage.setItem(KEY, flow.flow_id);
  window.location.assign(flow.authorize_url);
}

export function clearGoogleCallback(): void { callback = null; }

export function finishGoogleSignIn(): Promise<CoreSession> {
  // Share code exchange across React StrictMode effect replays; codes are single-use.
  if (callback) return callback;
  const url = window.location.href;
  callback = Promise.resolve().then(() => {
    const flowId = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (window.location.origin !== new URL(GOOGLE_CALLBACK).origin) throw new Error('google_login_invalid_response');
    // Remove the authorization code/error from history before rendering other content.
    window.history.replaceState(null, '', GOOGLE_CALLBACK);
    const value = readGoogleCallback(url, flowId);
    return coreApi.googleFinish(value.flowId, value.code);
  });
  return callback;
}
