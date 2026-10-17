export const GOOGLE_CALLBACK = 'http://localhost:8081/auth/callback';
const AUTHORIZE = 'https://axdwbfhrkbovgrbngrrh.supabase.co/auth/v1/authorize';

export function validateGoogleStart(url: string, flowId: string): void {
  const parsed = new URL(url);
  if (parsed.origin + parsed.pathname !== AUTHORIZE || parsed.username || parsed.password || parsed.hash
    || parsed.searchParams.get('provider') !== 'google'
    || parsed.searchParams.get('redirect_to') !== GOOGLE_CALLBACK
    || parsed.searchParams.get('code_challenge_method') !== 's256'
    || !/^[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get('code_challenge') ?? '')
    || !/^[A-Za-z0-9_-]{43}$/.test(flowId)) throw new Error('google_login_invalid_response');
}

export function readGoogleCallback(url: string, flowId: string | null): { code: string; flowId: string } {
  const parsed = new URL(url);
  if (parsed.origin + parsed.pathname !== GOOGLE_CALLBACK || parsed.hash) throw new Error('google_login_invalid_response');
  if (parsed.searchParams.has('error') || parsed.searchParams.has('error_code')) throw new Error('google_login_cancelled');
  const codes = parsed.searchParams.getAll('code');
  if (!flowId || !/^[A-Za-z0-9_-]{43}$/.test(flowId) || codes.length !== 1 || !codes[0] || codes[0].length > 2048) throw new Error('google_login_expired_restart');
  return { code: codes[0], flowId };
}
