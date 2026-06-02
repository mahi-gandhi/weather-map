/**
 * Leaflet bounds [[south, west], [north, east]] from grid header.
 * @param {{ la1: number, la2: number, lo1: number, lo2: number }} header
 * @returns {[[number, number], [number, number]]}
 */
export function getGridBounds(header) {
  const south = Math.min(header.la1, header.la2)
  const north = Math.max(header.la1, header.la2)
  const west = Math.min(header.lo1, header.lo2)
  const east = Math.max(header.lo1, header.lo2)
  return [
    [south, west],
    [north, east],
  ]
}
