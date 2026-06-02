import { lookupGridValue } from './lookupGrid.js'

/**
 * @param {object} header
 * @param {ArrayLike<number>} uData
 * @param {ArrayLike<number>} vData
 * @param {number} lat
 * @param {number} lng
 * @returns {{ u: number, v: number } | null}
 */
export function lookupGridVector(header, uData, vData, lat, lng) {
  const u = lookupGridValue(header, uData, lat, lng)
  if (u === null) return null
  const v = lookupGridValue(header, vData, lat, lng)
  if (v === null) return null
  return { u, v }
}
