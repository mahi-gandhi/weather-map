const COLOR_STOPS = {
  wave: [
    [0, [20, 10, 60]],
    [1.0, [20, 80, 180]],
    [2.0, [0, 160, 180]],
    [3.5, [0, 200, 140]],
    [5.0, [80, 180, 80]],
    [7.0, [140, 80, 180]],
    [10, [200, 60, 220]],
  ],
  wind: [
    [0, [255, 255, 255]],
    [5, [200, 230, 255]],
    [10, [255, 220, 100]],
    [15, [255, 150, 50]],
    [20, [255, 60, 60]],
    [25, [180, 0, 180]],
  ],
  swell: [
    [0, [10, 20, 80]],
    [1, [20, 60, 160]],
    [2, [40, 120, 220]],
    [3.5, [80, 180, 240]],
    [5, [180, 230, 255]],
  ],
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function colorForSpeed(speed, colorScheme = 'wave') {
  const stops = COLOR_STOPS[colorScheme] ?? COLOR_STOPS.wave
  const s = clamp(speed, stops[0][0], stops[stops.length - 1][0])
  let color = stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [sv, sc] = stops[i - 1]
      const [ev, ec] = stops[i]
      const t = (s - sv) / (ev - sv || 1)
      color = [
        Math.round(sc[0] + (ec[0] - sc[0]) * t),
        Math.round(sc[1] + (ec[1] - sc[1]) * t),
        Math.round(sc[2] + (ec[2] - sc[2]) * t),
      ]
      break
    }
    color = stops[i][1]
  }
  return color
}
