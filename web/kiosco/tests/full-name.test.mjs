// Suite BASE — regla nombre+apellido del check-in (sin framework, solo node:assert).
//
// Compila al vuelo packages/shared/src/validation.ts con el esbuild local
// (web/kiosco/node_modules/.bin/esbuild) y lo importa como ESM.
// Ejecutar: `npm test` desde web/kiosco (o `node tests/full-name.test.mjs`).

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kioscoDir = path.resolve(here, '..');
const entry = path.resolve(kioscoDir, '..', '..', 'packages', 'shared', 'src', 'validation.ts');
const esbuildBin = realpathSync(path.join(kioscoDir, 'node_modules', '.bin', 'esbuild'));
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kiosco-fullname-test-'));
const outFile = path.join(tmpDir, 'validation.compiled.mjs');

try {
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
    stdio: 'pipe',
  });
} catch (e) {
  console.error(`FAIL - compilar validation.ts con esbuild: ${e.message}`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

const { fullNameSchema } = await import(pathToFileURL(outFile).href);

let passed = 0;
let failed = 0;
const failedNames = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    failed++;
    failedNames.push(name);
    console.error(`FAIL - ${name}: ${e && e.message ? e.message : e}`);
  }
}

const ok = v => fullNameSchema.safeParse(v).success;

// --- casos que deben pasar --------------------------------------------------
test('nombre + apellido pasa ("Susana Maria")', () => assert.equal(ok('Susana Maria'), true));
test('tres palabras pasan ("Susana Maria Chango")', () => assert.equal(ok('Susana Maria Chango'), true));
test('cuatro palabras pasan ("Susana Maribel Maria Chango")', () => assert.equal(ok('Susana Maribel Maria Chango'), true));
test('minúsculas y espacios extra pasan ("  susana   maria  ")', () => assert.equal(ok('  susana   maria  '), true));
test('nombres compuestos con guion pasan ("Maria Jose Perez")', () => assert.equal(ok('Maria Jose Perez'), true));

// --- casos que deben fallar -------------------------------------------------
test('un solo nombre falla ("Susana")', () => assert.equal(ok('Susana'), false));
test('vacío falla', () => assert.equal(ok(''), false));
test('solo espacios falla', () => assert.equal(ok('   '), false));
test('iniciales de 1 letra fallan ("A B")', () => assert.equal(ok('A B'), false));
test('una palabra de 1 letra + apellido falla ("A Chango")', () => assert.equal(ok('A Chango'), false));
test('más de 60 caracteres falla', () => assert.equal(ok('Maria Fernanda Del Rosario De Los Angeles Montserrat Villavicencio'), false));

console.log(`\nfull-name.test.mjs: ${passed} pasados, ${failed} fallados, ${passed + failed} totales`);
rmSync(tmpDir, { recursive: true, force: true });
if (failed > 0) {
  console.error('Fallidos:', failedNames.join(', '));
  process.exit(1);
}
