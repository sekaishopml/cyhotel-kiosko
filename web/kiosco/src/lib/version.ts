// Helpers semver para OTA del kiosco (Fase B-web). Sin dependencias.
//
// Formatos aceptados: "1.3.0", "v1.3.0", con espacios alrededor.
// Segmentos ausentes o no numéricos se tratan como 0. Solo se comparan
// major.minor.patch (sufijos -beta/+build no participan del orden).

export type VersionTuple = [number, number, number]

export function parseVersion(v: string): VersionTuple {
  const clean = (v || '').trim().replace(/^[vV]/, '')
  const nums = clean.split('.').map((p) => {
    const n = parseInt(p, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  })
  while (nums.length < 3) nums.push(0)
  return [nums[0], nums[1], nums[2]]
}

function compare(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

/** true si `remote` es estrictamente mayor que `local`. */
export function isNewer(remote: string, local: string): boolean {
  return compare(remote, local) > 0
}

/** true si `a >= b` en semver. */
export function gte(a: string, b: string): boolean {
  return compare(a, b) >= 0
}

/**
 * true si corresponde ofrecer/instalar `remote` sobre `local`:
 * versiones distintas y `remote >= minVersion` (defecto '0.0.0').
 */
export function shouldInstall(remote: string, local: string, minVersion?: string | null): boolean {
  return compare(remote, local) !== 0 && gte(remote, minVersion || '0.0.0')
}
