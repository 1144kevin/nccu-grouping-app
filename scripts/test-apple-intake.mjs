// Portable deterministic checks. No Xcode, phone, backend, network or model is started.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'node_modules/jest/bin/jest.js'))) {
  console.error('Run npm ci with Node 24 first.');
  process.exit(1);
}
const startedAt = new Date().toISOString();
const local = resolve(root, '.local');
mkdirSync(local, { recursive: true });
const jestReport = resolve(local, 'apple-intake-jest.json');
const files = [
  'src/lib/apple-intake-contract.ts',
  'src/lib/apple-intake-contract.test.ts',
  'src/lib/apple-intake.ts',
  'src/lib/apple-intake.test.ts',
  'src/components/apple-stealth-intake.tsx',
  'src/components/apple-stealth-intake.test.tsx',
  'src/components/apple-signal-editor.test.tsx',
  'src/components/apple-intake-trial.tsx',
  'src/components/core-stealth-intake.tsx',
  'src/components/core-stealth.tsx',
  'src/components/core-auth-gate.tsx',
  'scripts/apple-dev.mjs',
  'scripts/apple-profile.cjs',
  'scripts/apple-profile.test.cjs',
  'scripts/ios-preflight.mjs',
  'scripts/test-apple-intake.mjs',
  'scripts/apple-intake-config.test.cjs',
];
const env = {
  ...process.env,
  EXPO_PUBLIC_APPLE_INTAKE_ENABLED: 'false',
  EXPO_PUBLIC_APPLE_INTAKE_TRIAL: 'false',
  CI: '1',
  EXPO_NO_TELEMETRY: '1',
};
// Unit fixtures manage these build settings themselves; a developer's release
// shell must not change which App branch the deterministic checks exercise.
for (const name of [
  'CORE_RELEASE_CHECK',
  'EAS_BUILD_PROFILE',
  'EXPO_PUBLIC_APP_PROFILE',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
])
  delete env[name];
const checks = [];
for (const [name, args] of [
  ['TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['ESLint', ['node_modules/eslint/bin/eslint.js', ...files]],
  [
    'Interview Jest',
    [
      'node_modules/jest/bin/jest.js',
      '--no-watchman',
      '--runInBand',
      '--json',
      '--outputFile',
      jestReport,
      'src/lib/apple-intake-contract.test.ts',
      'src/lib/apple-intake.test.ts',
      'src/components/apple-stealth-intake.test.tsx',
      'src/components/apple-signal-editor.test.tsx',
      'src/components/core-stealth-intake.test.tsx',
      'src/components/core-stealth.test.tsx',
    ],
  ],
  [
    'Build configuration',
    [
      '--test',
      'scripts/apple-intake-config.test.cjs',
      'scripts/apple-profile.test.cjs',
      'scripts/release-config.test.cjs',
    ],
  ],
]) {
  console.log(`\n${name}`);
  const start = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  checks.push({ name, status: result.status ?? 1, elapsedMs: Date.now() - start });
  if (result.error) console.error(result.error.message);
}
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  platform: process.platform,
  node: process.version,
  checks,
};
if (checks.find((check) => check.name === 'Interview Jest')?.status === 0) {
  const result = JSON.parse(readFileSync(jestReport, 'utf8'));
  report.jest = {
    suites: result.numTotalTestSuites,
    passed: result.numPassedTests,
    failed: result.numFailedTests,
  };
}
writeFileSync(resolve(local, 'apple-intake-checks.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = checks.some((check) => check.status !== 0) ? 1 : 0;
console.log(
  `\nApple intake checks ${process.exitCode ? 'failed' : 'passed'}. Report: .local/apple-intake-checks.json`,
);
