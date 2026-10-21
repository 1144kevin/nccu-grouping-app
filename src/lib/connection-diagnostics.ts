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
  if (['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED', 'NATIVE_TRANSPORT_ERROR'].includes(value?.code ?? ''))
    return value!.code!;
  return 'NETWORK_OR_CLIENT_ERROR';
}

// Credential-free native transport check; bypass Axios and SecureStore without
// changing how real authenticated requests verify identity or TLS.
export async function probeApiTransport(
  baseURL?: string,
  createRequest: () => XMLHttpRequest = () => new XMLHttpRequest(),
): Promise<number> {
  const url = new URL(baseURL ?? '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/api/v1') throw new Error('Invalid API configuration');
  return new Promise((resolve, reject) => {
    const request = createRequest();
    let finished = false;
    const fail = (code: string, message = 'Transport failed') => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(Object.assign(new Error(message), { code }));
    };
    const timer = setTimeout(() => {
      fail('ETIMEDOUT', 'Transport timeout');
      request.abort();
    }, 10_000);
    try {
      request.open('GET', url.origin + '/health');
      request.withCredentials = false;
      request.timeout = 10_000;
      request.setRequestHeader('Accept', 'application/json');
      request.onload = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(request.status);
      };
      request.onerror = () => {
        // RN exposes the native NSURLSession failure here; never inspect an
        // authenticated request or display arbitrary server response bodies.
        const raw = (request as XMLHttpRequest & { _response?: unknown })._response;
        const message = typeof raw === 'string' &&
          /SSL|certificate|App Transport|NSURLError|network|connect|伺服器|憑證|網路|連線|安全/i.test(raw)
          ? raw.slice(0, 300) : 'Native transport failed';
        fail('NATIVE_TRANSPORT_ERROR', message);
      };
      request.ontimeout = () => fail('ETIMEDOUT', 'Transport timeout');
      request.send();
    } catch { fail('NATIVE_TRANSPORT_ERROR'); }
  });
}

export function nativeTransportMessage(error: unknown): string {
  return (error as { code?: string })?.code === 'NATIVE_TRANSPORT_ERROR' && error instanceof Error
    ? error.message.slice(0, 300) : '';
}
