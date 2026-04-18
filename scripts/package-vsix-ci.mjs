import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '..');
const stageRoot = path.join(packageRoot, '.vsix-stage');

await run('node', [path.join(packageRoot, 'scripts', 'clean.mjs')], packageRoot);
await run('bunx', ['tsc', '-p', './tsconfig.json'], packageRoot);
await prepareStage();
await run('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-package-lock'], stageRoot);
await run(
  'bunx',
  [
    '@vscode/vsce',
    'package',
    '--allow-missing-repository',
    '--skip-license',
    '--out',
    path.join(packageRoot, `nplugins-${(await readPackageVersion()).trim()}.vsix`),
  ],
  stageRoot,
);
await rm(stageRoot, { recursive: true, force: true });

async function prepareStage() {
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });

  await copyIfExists('out');
  await copyIfExists('media');
  await copyIfExists('plugin.json');
  await copyIfExists('README.md');

  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  delete packageJson.devDependencies;
  await writeFile(path.join(stageRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function copyIfExists(relativePath) {
  const source = path.join(packageRoot, relativePath);
  const target = path.join(stageRoot, relativePath);
  await cp(source, target, { recursive: true, force: true }).catch((error) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  });
}

async function readPackageVersion() {
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? -1}`));
    });
    child.on('error', reject);
  });
}