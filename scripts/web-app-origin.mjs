import { isIP } from 'node:net';

// This value comes from local operator configuration, never request headers.
// The gateway still compares every request against this one exact origin.
export function webAppOrigin(value) {
  const url = new URL(value);
  const hostname = url.hostname;
  const labels = hostname.split('.');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    isIP(hostname) ||
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    /\.(?:localhost|local|internal|test|invalid|example)$/.test(hostname)
  )
    throw new Error('Configure one exact public HTTPS hostname without a path or custom port.');
  return url.origin;
}
