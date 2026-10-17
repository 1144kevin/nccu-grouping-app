import { expect, it } from '@jest/globals';
import { GOOGLE_CALLBACK, readGoogleCallback, validateGoogleStart } from './google-oauth';

const flow = 'f'.repeat(43);
const params = new URLSearchParams({ provider: 'google', redirect_to: GOOGLE_CALLBACK, code_challenge_method: 's256', code_challenge: 'c'.repeat(43) });
const authorize = `https://axdwbfhrkbovgrbngrrh.supabase.co/auth/v1/authorize?${params}`;

it('accepts only our project, callback, and PKCE Google provider', () => {
  expect(() => validateGoogleStart(authorize, flow)).not.toThrow();
  expect(() => validateGoogleStart(authorize.replace('axdwbfhrkbovgrbngrrh', 'other-project'), flow)).toThrow();
  expect(() => validateGoogleStart(authorize.replace('provider=google', 'provider=github'), flow)).toThrow();
  expect(() => validateGoogleStart(authorize.replace('s256', 'plain'), flow)).toThrow();
  expect(() => validateGoogleStart(authorize, 'short-flow')).toThrow();
});

it('requires a same-tab proof and a single authorization code', () => {
  expect(readGoogleCallback(`${GOOGLE_CALLBACK}?code=synthetic-code`, flow)).toEqual({ code: 'synthetic-code', flowId: flow });
  expect(() => readGoogleCallback(`${GOOGLE_CALLBACK}?code=synthetic-code`, null)).toThrow('google_login_expired_restart');
  expect(() => readGoogleCallback(`${GOOGLE_CALLBACK}?code=a&code=b`, flow)).toThrow();
  expect(() => readGoogleCallback('https://untrusted.invalid/auth/callback?code=x', flow)).toThrow();
  expect(() => readGoogleCallback(`${GOOGLE_CALLBACK}#access_token=never-trust-url-token`, flow)).toThrow();
});

it('does not expose provider error descriptions as UI text', () => {
  expect(() => readGoogleCallback(`${GOOGLE_CALLBACK}?error=access_denied&error_description=private-value`, flow)).toThrow('google_login_cancelled');
});
