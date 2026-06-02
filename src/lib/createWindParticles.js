import createREGL from 'regl'
import quadVert from '../shaders/quad.vert?raw'
import particleUpdateFrag from '../shaders/particleUpdate.frag?raw'
import particleDrawVert from '../shaders/particleDraw.vert?raw'
import particleDrawFrag from '../shaders/particleDraw.frag?raw'
import fadeFrag from '../shaders/fade.frag?raw'
import { createWindTexture } from './windTexture.js'
import { floatToUint8TextureData } from './webglFloatTextures.js'

export const PARTICLE_COUNT = 50000
export const PARTICLE_TEX_WIDTH = 250
export const PARTICLE_TEX_HEIGHT = 200

const TRAIL_FADE = 1 - 0.93
const SPEED_SCALE = 0.00035

const quadPositions = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

function randomPositions(header) {
  const data = new Float32Array(PARTICLE_TEX_WIDTH * PARTICLE_TEX_HEIGHT * 4)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const lngNorm = Math.random()
    const latNorm = Math.random()
    const offset = i * 4
    data[offset] = lngNorm
    data[offset + 1] = latNorm
    data[offset + 2] = lngNorm
    data[offset + 3] = latNorm
  }

  return { data }
}

/**
 * @param {import('regl').Regl} regl
 * @param {boolean} hasFloat
 */
function createPingPong(regl, hasFloat) {
  const textureType = hasFloat ? 'float' : 'uint8'

  const makeTarget = () =>
    regl.framebuffer({
      color: regl.texture({
        width: PARTICLE_TEX_WIDTH,
        height: PARTICLE_TEX_HEIGHT,
        format: 'rgba',
        type: textureType,
        mag: 'nearest',
        min: 'nearest',
        wrap: 'clamp',
      }),
      depth: false,
    })

  let read = makeTarget()
  let write = makeTarget()

  return {
    read: () => read,
    write: () => write,
    swap() {
      const tmp = read
      read = write
      write = tmp
    },
    destroy() {
      read.destroy()
      write.destroy()
    },
    seed(floatData) {
      const seedData = hasFloat ? floatData : floatToUint8TextureData(floatData)
      const seedTex = regl.texture({
        width: PARTICLE_TEX_WIDTH,
        height: PARTICLE_TEX_HEIGHT,
        data: seedData,
        format: 'rgba',
        type: textureType,
        mag: 'nearest',
        min: 'nearest',
        wrap: 'clamp',
      })
      regl({
        framebuffer: read,
        frag: `
          precision highp float;
          uniform sampler2D u_seed;
          varying vec2 v_uv;
          void main() {
            gl_FragColor = texture2D(u_seed, v_uv);
          }
        `,
        vert: quadVert,
        attributes: { position: quadPositions },
        uniforms: { u_seed: seedTex },
        count: 4,
        primitive: 'triangle strip',
      })()
      seedTex.destroy()
    },
  }
}

function buildLineAttributes(regl) {
  const indices = new Float32Array(PARTICLE_COUNT * 2)
  const endpoints = new Float32Array(PARTICLE_COUNT * 2)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    indices[i * 2] = i
    indices[i * 2 + 1] = i
    endpoints[i * 2] = 0
    endpoints[i * 2 + 1] = 1
  }

  return {
    a_index: regl.buffer(indices),
    a_endpoint: regl.buffer(endpoints),
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {object} options.header
 * @param {ArrayLike<number>} options.u
 * @param {ArrayLike<number>} options.v
 * @param {() => object} options.getScreenCorners
 * @param {() => { width: number, height: number }} options.getSize
 */
export function createWindParticles(canvas, { header, u, v, getScreenCorners, getSize }) {
  const regl = createREGL({
    canvas,
    extensions: ['OES_texture_float', 'OES_texture_float_linear'],
    optionalExtensions: ['OES_texture_float', 'OES_texture_float_linear'],
    attributes: {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    },
  })

  const gl = regl._gl
  const hasFloat = !!gl.getExtension('OES_texture_float')
  if (!hasFloat) {
    console.warn(
      '[wind particles] OES_texture_float unavailable — using uint8 textures',
    )
  }

  const posUint8Uniform = hasFloat ? 0 : 1
  const windUint8Uniform = hasFloat ? 0 : 1

  const pingPong = createPingPong(regl, hasFloat)
  const { data: seedData } = randomPositions(header)
  pingPong.seed(seedData)

  let gridHeader = header
  let windTexture = createWindTexture(regl, gridHeader, u, v, { hasFloat })
  const lineAttrs = buildLineAttributes(regl)

  const fade = regl({
    vert: quadVert,
    frag: fadeFrag,
    attributes: { position: quadPositions },
    uniforms: { u_opacity: TRAIL_FADE },
    count: 4,
    primitive: 'triangle strip',
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 'one',
        dstRGB: 'one minus src alpha',
        dstAlpha: 'one minus src alpha',
      },
    },
  })

  const update = regl({
    frag: particleUpdateFrag,
    vert: quadVert,
    attributes: { position: quadPositions },
    uniforms: {
      u_posTex: () => pingPong.read(),
      u_windTex: () => windTexture,
      u_bounds: () => {
        const west = Math.min(gridHeader.lo1, gridHeader.lo2)
        const east = Math.max(gridHeader.lo1, gridHeader.lo2)
        const south = Math.min(gridHeader.la1, gridHeader.la2)
        const north = Math.max(gridHeader.la1, gridHeader.la2)
        return [west, south, east, north]
      },
      u_windRes: () => [gridHeader.nx, gridHeader.ny],
      u_speedScale: SPEED_SCALE,
      u_rand: () => Math.random(),
      u_windUint8: windUint8Uniform,
      u_posUint8: posUint8Uniform,
    },
    framebuffer: () => pingPong.write(),
    count: 4,
    primitive: 'triangle strip',
  })

  const draw = regl({
    frag: particleDrawFrag,
    vert: particleDrawVert,
    attributes: lineAttrs,
    uniforms: {
      u_posTex: () => pingPong.read(),
      u_windTex: () => windTexture,
      u_particleTexSize: [PARTICLE_TEX_WIDTH, PARTICLE_TEX_HEIGHT],
      u_screenNW: () => getScreenCorners().nw,
      u_screenNE: () => getScreenCorners().ne,
      u_screenSW: () => getScreenCorners().sw,
      u_screenSE: () => getScreenCorners().se,
      u_canvasSize: () => {
        const size = getSize()
        return [size.width, size.height]
      },
      u_windUint8: windUint8Uniform,
      u_posUint8: posUint8Uniform,
    },
    count: PARTICLE_COUNT * 2,
    primitive: 'lines',
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 'one',
        dstRGB: 'one minus src alpha',
        dstAlpha: 'one minus src alpha',
      },
    },
    depth: { enable: false },
  })

  let rafId = 0
  let running = false

  function frame() {
    if (!running) return

    const size = getSize()
    if (size.width > 0 && size.height > 0) {
      regl.poll()

      fade()
      update()
      pingPong.swap()
      draw()
    }

    rafId = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      regl.clear({ color: [0, 0, 0, 0], depth: 1 })
      frame()
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
    resize() {
      regl.poll()
    },
    setWindField(newHeader, newU, newV) {
      gridHeader = newHeader
      windTexture.destroy()
      windTexture = createWindTexture(regl, gridHeader, newU, newV, { hasFloat })
      const seeded = randomPositions(gridHeader)
      pingPong.seed(seeded.data)
    },
    destroy() {
      this.stop()
      windTexture.destroy()
      lineAttrs.a_index.destroy()
      lineAttrs.a_endpoint.destroy()
      pingPong.destroy()
      regl.destroy()
    },
  }
}
