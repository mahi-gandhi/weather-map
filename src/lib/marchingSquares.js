/**
 * Trace contour segments for a scalar field on a regular grid.
 * Each segment connects two edge interpolation points within one cell.
 * @param {number[][]} field — row 0 = north
 * @param {number} level — contour value
 * @returns {Array<[[number, number], [number, number]]>} segments in grid coords (col, row)
 */
export function marchingSquaresContours(field, level) {
  const rows = field.length
  if (rows < 2) return []
  const cols = field[0].length
  if (cols < 2) return []

  const segments = []

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const v0 = field[row][col]
      const v1 = field[row][col + 1]
      const v2 = field[row + 1][col + 1]
      const v3 = field[row + 1][col]

      if (
        v0 == null ||
        v1 == null ||
        v2 == null ||
        v3 == null ||
        Number.isNaN(v0) ||
        Number.isNaN(v1) ||
        Number.isNaN(v2) ||
        Number.isNaN(v3)
      ) {
        continue
      }

      let idx = 0
      if (v0 >= level) idx |= 1
      if (v1 >= level) idx |= 2
      if (v2 >= level) idx |= 4
      if (v3 >= level) idx |= 8
      if (idx === 0 || idx === 15) continue

      const interp = (a, b, va, vb) => {
        const t = (level - va) / (vb - va)
        return a + (b - a) * t
      }

      const top = [interp(col, col + 1, v0, v1), row]
      const right = [col + 1, interp(row, row + 1, v1, v2)]
      const bottom = [interp(col, col + 1, v3, v2), row + 1]
      const left = [col, interp(row, row + 1, v0, v3)]

      // Standard marching squares edge-pair lookup (v0 TL, v1 TR, v2 BR, v3 BL)
      const edgePairs = {
        1: [[left, top]],
        2: [[top, right]],
        3: [[left, right]],
        4: [[bottom, right]],
        5: [[left, top], [bottom, right]],
        6: [[top, bottom]],
        7: [[left, bottom]],
        8: [[left, bottom]],
        9: [[top, bottom]],
        10: [[left, bottom], [top, right]],
        11: [[bottom, right]],
        12: [[left, right]],
        13: [[top, right]],
        14: [[left, top]],
      }

      const pairs = edgePairs[idx]
      if (!pairs) continue
      for (const pair of pairs) {
        segments.push(pair)
      }
    }
  }

  return segments
}

/**
 * Merge short segments into polylines (greedy chain).
 * @param {Array<Array<[number, number]>>} segments
 * @returns {Array<Array<[number, number]>>}
 */
export function chainSegments(segments) {
  if (!segments.length) return []

  const used = new Set()
  const polylines = []

  function key(pt) {
    return `${pt[0].toFixed(4)},${pt[1].toFixed(4)}`
  }

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue
    let [a, b] = segments[i]
    used.add(i)
    const line = [a, b]
    let changed = true

    while (changed) {
      changed = false
      const end = line[line.length - 1]
      const start = line[0]

      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue
        const [s0, s1] = segments[j]
        if (key(s0) === key(end)) {
          line.push(s1)
          used.add(j)
          changed = true
        } else if (key(s1) === key(end)) {
          line.push(s0)
          used.add(j)
          changed = true
        } else if (key(s1) === key(start)) {
          line.unshift(s0)
          used.add(j)
          changed = true
        } else if (key(s0) === key(start)) {
          line.unshift(s1)
          used.add(j)
          changed = true
        }
      }
    }

    polylines.push(line)
  }

  return polylines
}
