import { afterEach, expect, it, jest } from '@jest/globals';
import { connectionEndpoint, connectionErrorCode, probeApiTransport } from './connection-diagnostics';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
it('probes the configured HTTPS origin without cookies or authorization headers', async () => {
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({ status: 200 } as Response);
  global.fetch = fetchMock;
  await expect(probeApiTransport('https://172.20.10.2:8443/api/v1')).resolves.toBe(200);
  expect(fetchMock).toHaveBeenCalledWith('https://172.20.10.2:8443/health', expect.objectContaining({
    credentials: 'omit', headers: { Accept: 'application/json' },
  }));
});
it('distinguishes an HTTP denial from a native network failure', async () => {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({ status: 403 } as Response);
  await expect(probeApiTransport('https://172.20.10.2:8443/api/v1')).resolves.toBe(403);
  global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new TypeError('private internal details'));
  await expect(probeApiTransport('https://172.20.10.2:8443/api/v1')).rejects.toThrow();
  expect(connectionErrorCode({ response: { status: 403 } })).toBe('HTTP 403');
  expect(connectionErrorCode({ code: 'ERR_NETWORK' })).toBe('ERR_NETWORK');
  expect(connectionErrorCode(new Error('private internal details'))).not.toContain('private');
});
it('bounds transport wait and aborts the pending request', async () => {
  jest.useFakeTimers();
  const fetchMock = jest.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
  global.fetch = fetchMock;
  const pending = expect(probeApiTransport('https://172.20.10.2:8443/api/v1')).rejects.toThrow('Transport timeout');
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
it('does not display or send credentials in a malformed API URL', async () => {
  global.fetch = jest.fn<typeof fetch>();
  const unsafe = 'https://user:private@172.20.10.2:8443/api/v1?token=private';
  expect(connectionEndpoint(unsafe)).toBe('https://172.20.10.2:8443/api/v1');
  await expect(probeApiTransport(unsafe)).rejects.toThrow('Invalid API configuration');
  expect(global.fetch).not.toHaveBeenCalled();
});
