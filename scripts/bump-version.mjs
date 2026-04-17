import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageJsonPath = path.resolve(import.meta.dirname, '..', 'package.json');
const raw = await readFile(packageJsonPath, 'utf8');
const pkg = JSON.parse(raw);
const version = String(pkg.version || '0.0.0');
const parts = version.split('.').map((part) => Number(part));
while (parts.length < 3) parts.push(0);
parts[2] += 1;
pkg.version = `${parts[0]}.${parts[1]}.${parts[2]}`;
await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(pkg.version);
