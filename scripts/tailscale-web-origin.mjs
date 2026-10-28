import { webAppOrigin } from './web-app-origin.mjs';

export function tailscaleWebOrigin(status) {
  if (status?.BackendState !== 'Running')
    throw new Error('Install Tailscale and sign in on this computer before configuring Funnel.');
  const hostname = status.Self?.DNSName;
  if (typeof hostname !== 'string' || !hostname.endsWith('.ts.net.'))
    throw new Error('The connected Tailscale device has no assigned ts.net DNS name.');
  return webAppOrigin(`https://${hostname.slice(0, -1)}`);
}
