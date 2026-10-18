// No EAS, credentials, firewall, certificate installation, deployment or upload.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { validateProfile, profileEnv } = require('./apple-profile.cjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, '.local/apple-dev.json');
const [action, ...args] = process.argv.slice(2);
const option = (key) => (args.includes(key) ? args[args.indexOf(key) + 1] : undefined);
try {
  if (action === 'configure') {
    const profile = option('--profile') ?? 'simulator';
    const value = validateProfile({
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
      if (!['simulator', 'device', 'prepare-release'].includes(action))
        throw new Error('Unknown action.');
      if (process.platform !== 'darwin')
        throw new Error('This action requires Mac + full Xcode 26.4+. Nothing was started.');
      const expected = action === 'prepare-release' ? 'release' : action;
      if (value.profile !== expected && !(action === 'device' && value.profile === 'release'))
        throw new Error(`Configure the ${expected} profile first.`);
      const xcode = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
      const match = xcode.stdout?.match(/Xcode (\d+)\.(\d+)/);
      if (
        xcode.status !== 0 ||
        !match ||
        Number(match[1]) < 26 ||
        (Number(match[1]) === 26 && Number(match[2]) < 4)
      )
        throw new Error('Install/select full Xcode 26.4+ and complete its first launch.');
      const cli = resolve(root, 'node_modules/expo/bin/cli');
      if (!existsSync(cli)) throw new Error('Install locked dependencies with npm ci first.');
      const command =
        action === 'prepare-release'
          ? ['prebuild', '--platform', 'ios']
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
