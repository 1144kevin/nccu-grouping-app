// Read-only, offline checks. This does not build, upload, log in or change settings.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const config = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const { releaseProblems, IOS_CALLBACK } = require('./release-config.cjs');
const release = process.argv.includes('--release');
const errors = [];
const notes = [];
notes.push(
  'The project-local Apple intake module uses SDK 27 APIs; native builds require full Xcode 27+ (tested with 27.1).',
);
for (const asset of [config.icon, config.ios?.icon, config.web?.favicon]) {
  if (!asset || !existsSync(resolve(root, asset)))
    errors.push('A configured app/icon asset is missing.');
}
if (!manifest.dependencies['expo-web-browser'] || !manifest.dependencies['expo-secure-store'])
  errors.push('Native auth dependencies are missing.');
if (config.scheme !== 'nccugrouping') errors.push('App scheme and OAuth callback disagree.');
if (!eas.build?.production) errors.push('Missing production build profile.');
const readiness = releaseProblems(config, process.env);
if (release) errors.push(...readiness);
else notes.push(...readiness);
if (process.platform !== 'darwin')
  notes.push(
    'Native iOS compilation and signing must run on a Mac with Xcode; Windows can check JS/config only.',
  );
if (!process.env.EXPO_PUBLIC_EAS_PROJECT_ID && !config.extra?.eas?.projectId)
  notes.push(
    'No Expo project ID: EAS cloud builds/push need setup. A local Xcode archive does not require EAS.',
  );
notes.push(
  'Default backend is loopback-only. Opt-in device runner requires private TLS + exact client IPs. This check does not certify connectivity.',
);
notes.push(
  `Supabase Auth must allow the exact native redirect ${IOS_CALLBACK}; backend CORE_GOOGLE_IOS_ENABLED is opt-in.`,
);
notes.push(
  'Existing icon is an Expo placeholder; supply final team artwork before public distribution.',
);
notes.push(
  'Manual gates: Apple signing/team, App Store Connect record, real-device OAuth/session/API/deletion/blocking checks, privacy disclosures and content moderation.',
);
console.log(`Offline iOS ${release ? 'release' : 'development'} preflight`);
console.log(
  `Bundle: ${config.ios.bundleIdentifier}; version: ${config.version}; scheme: ${config.scheme}`,
);
for (const note of notes) console.log(`NOTE: ${note}`);
for (const error of errors) console.log(`BLOCKED: ${error}`);
console.log(
  errors.length
    ? 'Not ready. No build or upload was started.'
    : 'Local checks passed. This is not a signed iPhone build or TestFlight approval.',
);
process.exitCode = errors.length ? 1 : 0;
