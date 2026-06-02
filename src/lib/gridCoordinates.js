import { GLOBAL_HEADER } from './layers.js'

/**
 * @param {typeof GLOBAL_HEADER} header
 * @returns {{ lat: number, lon: number, index: number }[]}
 */
export function buildGridCoordinates(header = GLOBAL_HEADER) {
  const points = []
  const latStep = Math.abs(header.dy)

  for (let row = 0; row < header.ny; row++) {
    const lat = header.la1 - row * latStep
    for (let col = 0; col < header.nx; col++) {
      const lon = header.lo1 + col * header.dx
      points.push({ lat, lon, index: row * header.nx + col })
    }
  }

  return points
}
