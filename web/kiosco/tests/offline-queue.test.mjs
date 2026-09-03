// Suite P2 — cola offline unificada (node:assert, sin framework).
//
// Compila al vuelo packages/shared (queue-store, api-client) y el adaptador
// web/kiosco/src/api.ts con el esbuild local y los ejercita con stubs de
// localStorage/fetch en memoria (sin indexedDB → path de fallback).
// Ejecutar: `npm test` desde web/kiosco (o `node tests/offline-queue.test.mjs`).

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kioscoDir = path.resolve(here, '..');
const sharedDir = path.resolve(kioscoDir, '..', '..', 'packages', 'shared', 'src');
const esbuildBin = realpathSync(path.join(kioscoDir, 'node_modules', '.bin', 'esbuild'));
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kiosco-queue-test-'));

function bundle(entry, outName, extraArgs = []) {
  const outFile = path.join(tmpDir, outName);
  execFileSync(esbuildBin, [entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${outFile}`, '--log-level=error', ...extraArgs], {
    stdio: 'pipe',
  });
  return outFile;
}

let storeFile;
let clientFile;
let kioscoFile;
try {
  storeFile = bundle(path.join(sharedDir, 'queue-store.ts'), 'queue-store.compiled.mjs');
  clientFile = bundle(path.join(sharedDir, 'api-client.ts'), 'api-client.compiled.mjs');
  kioscoFile = bundle(path.join(kioscoDir, 'src', 'api.ts'), 'kiosco-api.compiled.mjs', [
    `--alias:@cyhotel/shared=${sharedDir}`,
  ]);
} catch (e) {
  console.error(`FAIL - compilar con esbuild: ${e.message}`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

// --- stubs globales (antes de importar: API_BASE se evalúa al importar) ---

function memStorage(failOnWrite = false) {
  const data = new Map();
  return {
    _data: data,
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) {
      if (failOnWrite) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem(k) { data.delete(k); },
  };
}

let mem = memStorage();
globalThis.localStorage = mem;
// Sin IndexedDB en este entorno → se ejercita el fallback a localStorage.
delete globalThis.indexedDB;

function jsonRes(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let fetchImpl = async () => jsonRes(200, {});
let fetchCalls = 0;
globalThis.fetch = async (...args) => {
  fetchCalls++;
  return fetchImpl(...args);
};

const QUEUE_KEY = 'kiosko_offline_queue';

const store = await import(pathToFileURL(storeFile).href);
const client = await import(pathToFileURL(clientFile).href);
const kiosco = await import(pathToFileURL(kioscoFile).href);

function resetStorage(failOnWrite = false) {
  mem = memStorage(failOnWrite);
  globalThis.localStorage = mem;
  fetchCalls = 0;
}

function payload(ref, extra = {}) {
  return { product: 'momento', room_type: 'estandar', guest_name: 'Test', client_ref: ref, ...extra };
}

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

async function atest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    failed++;
    failedNames.push(name);
    console.error(`FAIL - ${name}: ${e && e.message ? e.message : e}`);
  }
}

// --- queue-store: lectura/escritura defensiva --------------------------------

test('readQueue: JSON corrupto -> [] sin lanzar', () => {
  resetStorage();
  mem._data.set(QUEUE_KEY, '%%%');
  assert.deepEqual(store.readQueue(mem), []);
});

test('readQueue: no-array -> []', () => {
  resetStorage();
  mem._data.set(QUEUE_KEY, '{"a":1}');
  assert.deepEqual(store.readQueue(mem), []);
});

test('readQueue: filtra entradas inválidas, conserva válidas', () => {
  resetStorage();
  const now = Date.now();
  mem._data.set(QUEUE_KEY, JSON.stringify([
    null, 42, 'x',
    { product: 'momento', room_type: 'x', guest_name: 'g' }, // sin client_ref/queuedAt
    { ...payload('bueno'), queuedAt: now },
  ]));
  const q = store.readQueue(mem);
  assert.equal(q.length, 1);
  assert.equal(q[0].client_ref, 'bueno');
});

test('writeQueue: roundtrip true; quota -> false sin lanzar', () => {
  resetStorage();
  assert.equal(store.writeQueue([{ ...payload('a'), queuedAt: Date.now() }], mem), true);
  assert.equal(store.readQueue(mem).length, 1);
  const bad = memStorage(true);
  assert.equal(store.writeQueue([{ ...payload('a'), queuedAt: Date.now() }], bad), false);
});

test('enqueueOrder(shared): cap 50 FIFO', () => {
  resetStorage();
  for (let i = 0; i < 52; i++) store.enqueueOrder(payload(`r-${i}`), mem);
  const q = store.readQueue(mem);
  assert.equal(q.length, 50);
  assert.equal(q[0].client_ref, 'r-2');
  assert.equal(q[49].client_ref, 'r-51');
});

test('enqueueOrder(shared): poda expirados (>24h)', () => {
  resetStorage();
  const old = Date.now() - 25 * 60 * 60 * 1000;
  mem._data.set(QUEUE_KEY, JSON.stringify([{ ...payload('viejo'), queuedAt: old }]));
  store.enqueueOrder(payload('nuevo'), mem);
  const q = store.readQueue(mem);
  assert.equal(q.length, 1);
  assert.equal(q[0].client_ref, 'nuevo');
});

test('mergeQueues: dedup por client_ref (gana más reciente), orden y cap', () => {
  const now = Date.now();
  const a = [{ ...payload('x'), queuedAt: now - 2000 }];
  const b = [{ ...payload('x'), queuedAt: now }, { ...payload('y'), queuedAt: now - 1000 }];
  const m = store.mergeQueues(a, b);
  assert.deepEqual(m.map(q => q.client_ref), ['y', 'x']);
  const big = Array.from({ length: 60 }, (_, i) => ({ ...payload(`k-${i}`), queuedAt: now + i }));
  assert.equal(store.mergeQueues(big, []).length, 50);
});

// --- queue-store: IndexedDB fallback (sin indexedDB) --------------------------

await atest('loadQueue/saveQueue: roundtrip vía fallback localStorage', async () => {
  resetStorage();
  assert.deepEqual(await store.loadQueue(mem), []);
  const items = [{ ...payload('a'), queuedAt: Date.now() }];
  assert.equal(await store.saveQueue(items, mem), true);
  assert.deepEqual(await store.loadQueue(mem), items);
});

test('mirrorQueueToIdb: sin indexedDB no hace nada ni lanza', () => {
  resetStorage();
  store.mirrorQueueToIdb([{ ...payload('a'), queuedAt: Date.now() }]);
  assert.equal(typeof globalThis.indexedDB, 'undefined');
});

// --- api-client: reintentos ----------------------------------------------------

test('isRetryableStatus: 4xx definitivo salvo 408/429', () => {
  assert.equal(client.isRetryableStatus(400), false);
  assert.equal(client.isRetryableStatus(404), false);
  assert.equal(client.isRetryableStatus(422), false);
  assert.equal(client.isRetryableStatus(408), true);
  assert.equal(client.isRetryableStatus(429), true);
  assert.equal(client.isRetryableStatus(500), true);
  assert.equal(client.isRetryableStatus(503), true);
  assert.equal(client.isRetryableStatus(undefined), true); // red/timeout
});

await atest('retryFetch: 4xx se retorna sin reintentar (1 llamada)', async () => {
  fetchImpl = async () => jsonRes(422);
  fetchCalls = 0;
  const res = await client.retryFetch('http://x/api/orders', { method: 'POST' }, 3);
  assert.equal(res.status, 422);
  assert.equal(fetchCalls, 1);
});

await atest('retryFetch: 5xx reintenta y retorna última respuesta', async () => {
  fetchImpl = async () => jsonRes(503);
  fetchCalls = 0;
  const res = await client.retryFetch('http://x/api/t', {}, 2);
  assert.equal(res.status, 503);
  assert.equal(fetchCalls, 2);
});

await atest('retryFetch: 408/429 sí reintentan', async () => {
  fetchImpl = async () => jsonRes(429);
  fetchCalls = 0;
  await client.retryFetch('http://x/api/t', {}, 2);
  assert.equal(fetchCalls, 2);
});

await atest('retryFetch: fallo de red reintenta y luego responde', async () => {
  let n = 0;
  fetchImpl = async () => {
    n++;
    if (n === 1) throw new Error('boom');
    return jsonRes(200, { ok: true });
  };
  fetchCalls = 0;
  const res = await client.retryFetch('http://x/api/t', {}, 3);
  assert.equal(res.status, 200);
  assert.equal(fetchCalls, 2);
});

// --- api-client: syncPending con createOrder inyectado -------------------------

function throwingApiError(status) {
  const e = new client.ApiError(`Error ${status}`, status);
  return e;
}

await atest('syncPending: envía en orden y vacía la cola', async () => {
  resetStorage();
  const sent = [];
  store.enqueueOrder(payload('a'), mem);
  store.enqueueOrder(payload('b'), mem);
  await client.syncPending(async p => { sent.push(p.client_ref); }, { storage: mem });
  assert.deepEqual(sent, ['a', 'b']);
  assert.deepEqual(store.readQueue(mem), []);
});

await atest('syncPending: stop-on-first-failure conserva orden restante', async () => {
  resetStorage();
  const sent = [];
  store.enqueueOrder(payload('a'), mem);
  store.enqueueOrder(payload('b'), mem);
  store.enqueueOrder(payload('c'), mem);
  await client.syncPending(async p => {
    if (p.client_ref === 'b') throw new Error('red caída');
    sent.push(p.client_ref);
  }, { storage: mem });
  assert.deepEqual(sent, ['a']);
  assert.deepEqual(store.readQueue(mem).map(q => q.client_ref), ['b', 'c']);
});

await atest('syncPending: dead-letter 4xx no bloquea (salvo 408/429)', async () => {
  resetStorage();
  const sent = [];
  store.enqueueOrder(payload('mala'), mem);
  store.enqueueOrder(payload('buena'), mem);
  await client.syncPending(async p => {
    if (p.client_ref === 'mala') throw throwingApiError(422);
    sent.push(p.client_ref);
  }, { storage: mem });
  assert.deepEqual(sent, ['buena']);
  assert.deepEqual(store.readQueue(mem), []);
});

await atest('syncPending: 429 conserva el ítem (reintentable)', async () => {
  resetStorage();
  store.enqueueOrder(payload('r'), mem);
  await client.syncPending(async () => { throw throwingApiError(429); }, { storage: mem });
  assert.deepEqual(store.readQueue(mem).map(q => q.client_ref), ['r']);
});

await atest('syncPending: poda expirados y persiste aunque no haya envíos', async () => {
  resetStorage();
  const old = Date.now() - 25 * 60 * 60 * 1000;
  mem._data.set(QUEUE_KEY, JSON.stringify([{ ...payload('viejo'), queuedAt: old }]));
  let called = 0;
  await client.syncPending(async () => { called++; }, { storage: mem });
  assert.equal(called, 0);
  assert.deepEqual(store.readQueue(mem), []);
});

// --- adaptador kiosco: misma API pública ---------------------------------------

test('kiosco enqueueOrder->boolean true y persiste + verifica', () => {
  resetStorage();
  assert.equal(kiosco.enqueueOrder(payload('k1')), true);
  const raw = JSON.parse(mem._data.get(QUEUE_KEY));
  assert.equal(raw.length, 1);
  assert.equal(typeof raw[0].queuedAt, 'number');
});

test('kiosco enqueueOrder->boolean false si no persiste (quota)', () => {
  resetStorage(true);
  // localStorage global falla en escritura → false (avisa, no falso éxito)
  assert.equal(kiosco.enqueueOrder(payload('k2')), false);
});

test('kiosco enqueueOrder regenera cola corrupta', () => {
  resetStorage();
  mem._data.set(QUEUE_KEY, '%%%');
  assert.equal(kiosco.enqueueOrder(payload('k3')), true);
  assert.deepEqual(store.readQueue(mem).map(q => q.client_ref), ['k3']);
});

await atest('kiosco syncPending(): dead-letter 4xx + envía resto (vía fetch)', async () => {
  resetStorage();
  assert.equal(kiosco.enqueueOrder(payload('mala')), true);
  assert.equal(kiosco.enqueueOrder(payload('buena')), true);
  let n = 0;
  fetchImpl = async (_url, opts) => {
    n++;
    const body = JSON.parse(opts.body);
    if (body.client_ref === 'mala') return jsonRes(400);
    return jsonRes(200, { order: { id: '1', room_number: '101', check_in: 'x', check_out: 'y', subtotal: 10 } });
  };
  await kiosco.syncPending();
  assert.equal(n, 2);
  assert.deepEqual(store.readQueue(mem), []);
});

await atest('kiosco syncPending(): fallo de red conserva la cola', async () => {
  resetStorage();
  assert.equal(kiosco.enqueueOrder(payload('off1')), true);
  fetchImpl = async () => { throw new Error('sin red'); };
  await kiosco.syncPending();
  assert.deepEqual(store.readQueue(mem).map(q => q.client_ref), ['off1']);
});

test('kiosco re-exporta fuente única: ApiError con status + API_BASE string', () => {
  assert.equal(typeof kiosco.API_BASE, 'string');
  const e = new kiosco.ApiError('Error 400', 400);
  assert.equal(e.status, 400);
  assert.equal(e.name, 'ApiError');
  // Equivalencia estructural con shared (cada bundle de este harness trae su
  // copia de la clase; en producción Vite instancia el módulo una sola vez).
  const s = new client.ApiError('Error 400', 400);
  assert.equal(e.constructor.name, s.constructor.name);
  assert.equal(String(e), String(s));
});

// --- reporte ------------------------------------------------------------------

rmSync(tmpDir, { recursive: true, force: true });

console.log(`\noffline-queue.test.mjs: ${passed} pasados, ${failed} fallados, ${passed + failed} totales`);
if (failed > 0) {
  console.error(`Fallidos: ${failedNames.join(', ')}`);
  process.exit(1);
}
