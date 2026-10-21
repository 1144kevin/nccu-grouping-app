import { afterEach, expect, it, jest } from '@jest/globals';
import { connectionEndpoint, connectionErrorCode, nativeTransportMessage, probeApiTransport } from './connection-diagnostics';
function fixture(status = 200, failure?: string, pending = false) {
  const request = {
    status, withCredentials: true, timeout: 0, _response: failure,
    open: jest.fn(), setRequestHeader: jest.fn(), abort: jest.fn(),
    onload: () => {}, onerror: () => {}, ontimeout: () => {},
    send: () => {
      if (pending) return;
      if (failure) request.onerror();
      else request.onload();
    },
  };
  return { request, create: () => request as unknown as XMLHttpRequest };
}
afterEach(() => { jest.useRealTimers(); });
it('probes native HTTPS without cookies, authorization or credential storage', async () => {
  const { request, create } = fixture();
  await expect(probeApiTransport('https://172.20.10.2:8443/api/v1', create)).resolves.toBe(200);
  expect(request.open).toHaveBeenCalledWith('GET', 'https://172.20.10.2:8443/health');
  expect(request.withCredentials).toBe(false);
  expect(request.setRequestHeader).toHaveBeenCalledTimes(1);
  expect(request.setRequestHeader).toHaveBeenCalledWith('Accept', 'application/json');
});
it('distinguishes HTTP denial and preserves a bounded native TLS failure reason', async () => {
  await expect(probeApiTransport('https://172.20.10.2:8443/api/v1', fixture(403).create)).resolves.toBe(403);
  const failure = await probeApiTransport('https://172.20.10.2:8443/api/v1', fixture(0, 'SSL certificate validation failed').create).catch(e => e);
  expect(connectionErrorCode(failure)).toBe('NATIVE_TRANSPORT_ERROR');
  expect(nativeTransportMessage(failure)).toBe('SSL certificate validation failed');
  expect(nativeTransportMessage(new Error('private server response'))).toBe('');
});
it('bounds wait and aborts a pending native request', async () => {
  jest.useFakeTimers();
  const { request, create } = fixture(0, undefined, true);
  const pending = expect(probeApiTransport('https://172.20.10.2:8443/api/v1', create)).rejects.toThrow('Transport timeout');
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
  expect(request.abort).toHaveBeenCalled();
});
it('does not send or display credentials in a malformed URL', async () => {
  const { request, create } = fixture();
  const unsafe = 'https://user:private@172.20.10.2:8443/api/v1?token=private';
  expect(connectionEndpoint(unsafe)).toBe('https://172.20.10.2:8443/api/v1');
  await expect(probeApiTransport(unsafe, create)).rejects.toThrow('Invalid API configuration');
  expect(request.open).not.toHaveBeenCalled();
});
