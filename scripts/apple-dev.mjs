// No EAS, credentials, firewall, certificate installation, deployment or upload.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { validateProfile, profileEnv, appleXcodeProblem } = require('./apple-profile.cjs');
const { readDeviceConnection } = require('./device-connection.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, '.local/apple-dev.json');
const [action, ...args] = process.argv.slice(2);
const option = (key) => (args.includes(key) ? args[args.indexOf(key) + 1] : undefined);
try {
  if (action === 'configure') {
    const profile = option('--profile') ?? 'simulator';
    if (option('--connection') && (option('--profile') || option('--api')))
      throw new Error('Use --connection alone, or explicit --profile/--api; not both.');
    const value = option('--connection') ? readDeviceConnection(resolve(option('--connection'))) : validateProfile({
      profile,
      api: option('--api') ?? 'http://127.0.0.1:8000/api/v1',
    });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
    console.log(
      `Saved ${value.profile} connection in .local/apple-dev.json. No build/network action started.`,
    );
  } else {
    if (!existsSync(file))
      throw new Error('Run npm run apple:configure -- --profile simulator first.');
    const value = validateProfile(JSON.parse(readFileSync(file, 'utf8')));
    const env = { ...process.env, ...profileEnv(value) };
    if (action === 'check') {
      console.log(`Profile: ${value.profile}; API: ${value.api}`);
      console.log('Normal app: Apple interview enabled; trial disabled; login/storage/matching retained.');
      console.log(
        'This validates configuration only, not network, certificate trust or cloud readiness.',
      );
      if (process.platform !== 'darwin')
        console.log('Windows: native build/signing unavailable; configuration can be prepared.');
      const result = spawnSync(
        process.execPath,
        ['scripts/ios-preflight.mjs', ...(value.profile === 'release' ? ['--release'] : [])],
        { cwd: root, env, stdio: 'inherit' },
      );
      process.exitCode = result.status ?? 1;
    } else {
      if (!['simulator', 'device', 'prepare-device', 'prepare-release'].includes(action))
        throw new Error('Unknown action.');
      if (process.platform !== 'darwin')
        throw new Error('This action requires Mac + full Xcode 27+. Nothing was started.');
      const expected = action === 'prepare-release' ? 'release' : action === 'prepare-device' ? 'device' : action;
      if (value.profile !== expected && !(action === 'device' && value.profile === 'release'))
        throw new Error(`Configure the ${expected} profile first.`);
      const xcode = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
      const xcodeProblem = appleXcodeProblem(xcode.stdout);
      if (xcode.status !== 0 || xcodeProblem)
        throw new Error(xcodeProblem ?? 'Select full Xcode 27+ and complete its first launch.');
      const cli = resolve(root, 'node_modules/expo/bin/cli');
      if (!existsSync(cli)) throw new Error('Install locked dependencies with npm ci first.');
      const command =
        action === 'prepare-release'
          ? ['prebuild', '--platform', 'ios']
          : action === 'prepare-device'
          ? ['prebuild', '--platform', 'ios', '--no-install']
          : ['run:ios', '--configuration', 'Release', ...(action === 'device' ? ['--device'] : [])];
      const result = spawnSync(process.execPath, [cli, ...command], {
        cwd: root,
        env,
        stdio: 'inherit',
      });
      process.exitCode = result.status ?? 1;
      if (action === 'prepare-release' && result.status === 0)
        console.log(
          'Open ios/*.xcworkspace in Xcode; select Team/build number, then Archive manually. No upload performed.',
        );
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
