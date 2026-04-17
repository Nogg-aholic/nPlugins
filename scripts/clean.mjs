import { rm } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dirname, '..');
const outDir = path.join(packageRoot, 'out');

await rm(outDir, { recursive: true, force: true });
