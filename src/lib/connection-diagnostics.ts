export function connectionEndpoint(baseURL?: string): string {
  try {
    const url = new URL(baseURL ?? '');
    if (!['http:', 'https:'].includes(url.protocol)) return '未設定有效 API 網址';
    return url.origin + '/api/v1';
  } catch { return '未設定有效 API 網址'; }
}

export function connectionErrorCode(error: unknown): string {
  const value = error as { response?: { status?: number }; code?: string } | null;
  const status = value?.response?.status;
  if (Number.isInteger(status) && status! >= 100 && status! <= 599) return `HTTP ${status}`;
  if (['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(value?.code ?? ''))
    return value!.code!;
  return 'NETWORK_OR_CLIENT_ERROR';
}

// Credential-free native transport check; bypass Axios and SecureStore without
// changing how real authenticated requests verify identity or TLS.
export async function probeApiTransport(baseURL?: string): Promise<number> {
  const url = new URL(baseURL ?? '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/api/v1') throw new Error('Invalid API configuration');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(url.origin + '/health', {
        method: 'GET', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Transport timeout')); }, 10_000);
      }),
    ]);
    return response.status;
  } finally { clearTimeout(timer); }
}
