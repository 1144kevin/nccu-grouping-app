const { createHash } = require('node:crypto');
const { readFileSync, statSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { validateProfile } = require('./apple-profile.cjs');

function validateDeviceConnection(value, certificate, now = Date.now()) {
  const keys = ['format', 'api', 'google_callback', 'ca_file', 'ca_sha256', 'leaf_expires'];
  if (!value || Object.keys(value).some((key) => !keys.includes(key)) ||
      value.format !== 'nccu-device-link-v1' || value.ca_file !== 'ca.cer' ||
      value.google_callback !== 'nccugrouping://auth/callback' ||
      !/^[a-f0-9]{64}$/.test(value.ca_sha256 ?? '') ||
      !Number.isFinite(Date.parse(value.leaf_expires)) || Date.parse(value.leaf_expires) <= now) {
    throw new Error('Invalid/expired public Windows device connection; export a fresh handoff.');
  }
  if (createHash('sha256').update(certificate).digest('hex') !== value.ca_sha256)
    throw new Error('Public CA fingerprint differs from the Windows connection manifest.');
  return validateProfile({ profile: 'device', api: value.api });
}

function readDeviceConnection(file) {
  const ca = resolve(dirname(file), 'ca.cer');
  if (statSync(file).size > 16384 || statSync(ca).size > 16384)
    throw new Error('Public connection/CA file exceeds safe size.');
  return validateDeviceConnection(JSON.parse(readFileSync(file, 'utf8')), readFileSync(ca));
}
module.exports = { validateDeviceConnection, readDeviceConnection };
