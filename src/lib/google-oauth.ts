export const GOOGLE_CALLBACK = process.env.EXPO_PUBLIC_ACCOUNT_WEB === 'true'
  ? 'http://localhost:8082/auth/callback' : 'http://localhost:8081/auth/callback';
export const GOOGLE_IOS_CALLBACK = 'nccugrouping://auth/callback';
const AUTHORIZE = 'https://axdwbfhrkbovgrbngrrh.supabase.co/auth/v1/authorize';

export function validateGoogleStart(url: string, flowId: string, callback = GOOGLE_CALLBACK): void {
  const parsed = new URL(url);
  if (
    parsed.origin + parsed.pathname !== AUTHORIZE ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.searchParams.get('provider') !== 'google' ||
    ![GOOGLE_CALLBACK, GOOGLE_IOS_CALLBACK].includes(callback) ||
    parsed.searchParams.get('redirect_to') !== callback ||
    parsed.searchParams.get('code_challenge_method') !== 's256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get('code_challenge') ?? '') ||
    !/^[A-Za-z0-9_-]{43}$/.test(flowId)
  )
    throw new Error('google_login_invalid_response');
}

export function readGoogleCallback(
  url: string,
  flowId: string | null,
  callback = GOOGLE_CALLBACK,
): { code: string; flowId: string } {
  const parsed = new URL(url);
  const expected = new URL(callback);
  if (
    ![GOOGLE_CALLBACK, GOOGLE_IOS_CALLBACK].includes(callback) ||
    parsed.protocol !== expected.protocol ||
    parsed.hostname !== expected.hostname ||
    parsed.port !== expected.port ||
    parsed.pathname !== expected.pathname ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  )
    throw new Error('google_login_invalid_response');
  if (parsed.searchParams.has('error') || parsed.searchParams.has('error_code'))
    throw new Error('google_login_cancelled');
  const codes = parsed.searchParams.getAll('code');
  if (
    !flowId ||
    !/^[A-Za-z0-9_-]{43}$/.test(flowId) ||
    codes.length !== 1 ||
    !codes[0] ||
    codes[0].length > 2048
  )
    throw new Error('google_login_expired_restart');
  return { code: codes[0], flowId };
}
