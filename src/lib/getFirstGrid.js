/**
 * @param {Array<{ header: object, data: number[] }> | { header: object, data: number[] }} raw
 * @returns {{ header: object, data: number[] }}
 */
export function getFirstGrid(raw) {
  const items = Array.isArray(raw) ? raw : [raw]
  if (items.length === 0) {
    throw new Error('getFirstGrid: expected at least one grid object')
  }
  return items[0]
}
