// Suite BASE — helpers semver OTA del kiosco (sin framework, solo node:assert).
//
// Compila al vuelo web/kiosco/src/lib/version.ts con el esbuild local
// (web/kiosco/node_modules/.bin/esbuild) y lo importa como ESM.
// Ejecutar: `npm test` desde web/kiosco (o `node tests/version.test.mjs`).

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kioscoDir = path.resolve(here, '..');
const entry = path.join(kioscoDir, 'src', 'lib', 'version.ts');
const esbuildBin = realpathSync(path.join(kioscoDir, 'node_modules', '.bin', 'esbuild'));
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kiosco-version-test-'));
const outFile = path.join(tmpDir, 'version.compiled.mjs');

try {
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error'], {
    stdio: 'pipe',
  });
} catch (e) {
  console.error(`FAIL - compilar version.ts con esbuild: ${e.message}`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

const { parseVersion, isNewer, gte, shouldInstall } = await import(pathToFileURL(outFile).href);

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

// --- parseVersion -----------------------------------------------------------

test('parse: version completa "1.3.0"', () => {
  assert.deepEqual(parseVersion('1.3.0'), [1, 3, 0]);
});

test('parse: patch mayor (1.3.1)', () => {
  assert.deepEqual(parseVersion('1.3.1'), [1, 3, 1]);
});

test('parse: minor mayor (1.4.0)', () => {
  assert.deepEqual(parseVersion('1.4.0'), [1, 4, 0]);
});

test('parse: major mayor (2.0.0)', () => {
  assert.deepEqual(parseVersion('2.0.0'), [2, 0, 0]);
});

test('parse: prefijo "v" minuscula', () => {
  assert.deepEqual(parseVersion('v1.3.0'), [1, 3, 0]);
});

test('parse: prefijo "V" mayuscula + espacios', () => {
  assert.deepEqual(parseVersion('  V2.0.1  '), [2, 0, 1]);
});

test('parse: segmento patch faltante "1.2" -> [1,2,0]', () => {
  assert.deepEqual(parseVersion('1.2'), [1, 2, 0]);
});

test('parse: solo major "1" -> [1,0,0]', () => {
  assert.deepEqual(parseVersion('1'), [1, 0, 0]);
});

test('parse: segmentos no numericos -> 0', () => {
  assert.deepEqual(parseVersion('x.y.z'), [0, 0, 0]);
});

test('parse: cadena vacia -> [0,0,0]', () => {
  assert.deepEqual(parseVersion(''), [0, 0, 0]);
});

test('parse: sufijo -beta/+build no participa del orden', () => {
  assert.deepEqual(parseVersion('1.3.0-beta+build'), [1, 3, 0]);
});

// --- isNewer ----------------------------------------------------------------

test('isNewer: patch mayor es newer', () => {
  assert.equal(isNewer('1.3.1', '1.3.0'), true);
  assert.equal(isNewer('1.3.0', '1.3.1'), false);
});

test('isNewer: minor mayor es newer aunque patch sea menor', () => {
  assert.equal(isNewer('1.4.0', '1.3.9'), true);
});

test('isNewer: major mayor es newer', () => {
  assert.equal(isNewer('2.0.0', '1.9.9'), true);
});

test('isNewer: versiones iguales no son newer', () => {
  assert.equal(isNewer('1.3.0', '1.3.0'), false);
  assert.equal(isNewer('v1.3.0', '1.3.0'), false);
});

test('isNewer: orden numerico, no lexicografico (10.0.0 > 2.0.0)', () => {
  assert.equal(isNewer('10.0.0', '2.0.0'), true);
  assert.equal(isNewer('2.0.0', '10.0.0'), false);
});

test('isNewer: acepta prefijo v y segmentos faltantes', () => {
  assert.equal(isNewer('v1.3.1', '1.3.0'), true);
  assert.equal(isNewer('1.3', '1.2.9'), true);
});

// --- gte --------------------------------------------------------------------

test('gte: igual (con v y segmentos faltantes) es true', () => {
  assert.equal(gte('1.3.0', '1.3.0'), true);
  assert.equal(gte('v1.3.0', '1.3.0'), true);
  assert.equal(gte('1.2', '1.2.0'), true);
});

test('gte: mayor true, menor false', () => {
  assert.equal(gte('1.3.1', '1.3.0'), true);
  assert.equal(gte('1.3.0', '1.3.1'), false);
  assert.equal(gte('10.0.0', '2.0.0'), true);
});

// --- shouldInstall ----------------------------------------------------------

test('shouldInstall: remoto newer sin minVersion se instala', () => {
  assert.equal(shouldInstall('1.3.1', '1.3.0'), true);
});

test('shouldInstall: misma version no se instala', () => {
  assert.equal(shouldInstall('1.3.0', '1.3.0'), false);
});

test('shouldInstall: downgrade dirigido permitido por defecto (floor 0.0.0)', () => {
  assert.equal(shouldInstall('1.2.0', '1.3.0'), true);
});

test('shouldInstall: minVersion bloquea remoto newer pero bajo el minimo', () => {
  assert.equal(shouldInstall('1.4.0', '1.3.0', '1.5.0'), false);
});

test('shouldInstall: minVersion permite remoto que la alcanza', () => {
  assert.equal(shouldInstall('1.6.0', '1.3.0', '1.5.0'), true);
});

test('shouldInstall: downgrade dirigido sobre el minimo permitido', () => {
  assert.equal(shouldInstall('1.4.0', '1.6.0', '1.0.0'), true);
});

test('shouldInstall: downgrade bajo el minimo bloqueado', () => {
  assert.equal(shouldInstall('0.9.0', '1.6.0', '1.0.0'), false);
});

test('shouldInstall: minVersion null equivale al defecto', () => {
  assert.equal(shouldInstall('1.4.0', '1.3.0', null), true);
  assert.equal(shouldInstall('1.3.0', '1.3.0', null), false);
});

// --- reporte ----------------------------------------------------------------

rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nversion.test.mjs: ${passed} pasados, ${failed} fallados, ${passed + failed} totales`);
if (failed > 0) {
  console.error(`Fallidos: ${failedNames.join(', ')}`);
  process.exit(1);
}
