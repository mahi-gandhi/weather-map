import {
  quadVert,
  particleUpdateFrag,
  particleDrawVert,
  particleDrawFrag,
  fadeFrag,
} from './windGLShaders.js'

const PARTICLE_RES = 256
const NUM_PARTICLES = PARTICLE_RES * PARTICLE_RES

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile: ${log}`)
  }
  return shader
}

function createProgram(gl, vertSrc, fragSrc) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  const program = gl.createProgram()
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link: ${log}`)
  }
  return program
}

function createTexture(gl, width, height, data, format, type, filter) {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

function createFramebuffer(gl, texture) {
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  )
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return fbo
}

/**
 * Windy-style GPU wind particles (raw WebGL, float texture fallback).
 */
export class WindGL {
  constructor(canvas) {
    const gl =
      canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) ||
      canvas.getContext('experimental-webgl', {
        alpha: true,
        preserveDrawingBuffer: true,
      })

    if (!gl) throw new Error('WebGL not available')

    this.gl = gl
    this.canvas = canvas
    this.numParticles = NUM_PARTICLES
    this.particleRes = PARTICLE_RES

    this.floatExt = gl.getExtension('OES_texture_float')
    gl.getExtension('OES_texture_float_linear')
    this.useFloat = !!this.floatExt

    this.windMin = [0, 0]
    this.windMax = [1, 1]
    this.ndcCorners = {
      nw: [-1, 1],
      ne: [1, 1],
      sw: [-1, -1],
      se: [1, -1],
    }

    this._initGL()
    this._seedParticles()
  }

  _initGL() {
    const { gl } = this

    this.updateProgram = createProgram(gl, quadVert, particleUpdateFrag)
    this.drawProgram = createProgram(gl, particleDrawVert, particleDrawFrag)
    this.fadeProgram = createProgram(gl, quadVert, fadeFrag)

    this.quadBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const indices = new Float32Array(this.numParticles)
    for (let i = 0; i < this.numParticles; i++) indices[i] = i
    this.particleIndexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleIndexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    const particleType = this.useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE
    const particleFormat = this.useFloat ? gl.RGBA : gl.RGBA

    this.particleState = [0, 1]
    this.particleTextures = [
      createTexture(
        gl,
        this.particleRes,
        this.particleRes,
        null,
        particleFormat,
        particleType,
        gl.NEAREST,
      ),
      createTexture(
        gl,
        this.particleRes,
        this.particleRes,
        null,
        particleFormat,
        particleType,
        gl.NEAREST,
      ),
    ]
    this.particleFbos = [
      createFramebuffer(gl, this.particleTextures[0]),
      createFramebuffer(gl, this.particleTextures[1]),
    ]

    this.windTexture = createTexture(
      gl,
      256,
      128,
      null,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      gl.LINEAR,
    )

    this.screenTextures = [null, null]
    this.screenFbos = [null, null]
    this.screenIndex = 0
    this._resizeScreenTextures()

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  _resizeScreenTextures() {
    const { gl, canvas } = this
    const w = Math.max(1, canvas.width)
    const h = Math.max(1, canvas.height)

    for (let i = 0; i < 2; i++) {
      if (this.screenTextures[i]) gl.deleteTexture(this.screenTextures[i])
      if (this.screenFbos[i]) gl.deleteFramebuffer(this.screenFbos[i])
      this.screenTextures[i] = createTexture(
        gl,
        w,
        h,
        null,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        gl.LINEAR,
      )
      this.screenFbos[i] = createFramebuffer(gl, this.screenTextures[i])
    }
  }

  _seedParticles() {
    const count = this.particleRes * this.particleRes * 4
    const floatData = new Float32Array(count)
    for (let i = 0; i < floatData.length; i += 4) {
      floatData[i] = Math.random()
      floatData[i + 1] = Math.random()
      floatData[i + 2] = 0
      floatData[i + 3] = 1
    }

    const { gl } = this
    const uploadData = this.useFloat
      ? floatData
      : (() => {
          const u8 = new Uint8Array(count)
          for (let i = 0; i < count; i++) {
            u8[i] = Math.round(Math.max(0, Math.min(1, floatData[i])) * 255)
          }
          return u8
        })()
    const type = this.useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE

    for (const tex of this.particleTextures) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.particleRes,
        this.particleRes,
        0,
        gl.RGBA,
        type,
        uploadData,
      )
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /**
   * @param {ImageData} imageData
   * @param {[number, number]} windMin
   * @param {[number, number]} windMax
   */
  setWind(imageData, windMin, windMax) {
    const { gl } = this
    this.windMin = windMin
    this.windMax = windMax

    gl.bindTexture(gl.TEXTURE_2D, this.windTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageData.data,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /**
   * @param {{ nw: number[], ne: number[], sw: number[], se: number[] }} corners NDC
   */
  setNdcCorners(corners) {
    this.ndcCorners = corners
  }

  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
    this._resizeScreenTextures()
  }

  _drawQuad(program) {
    const { gl } = this
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.disableVertexAttribArray(posLoc)
  }

  _updateParticles() {
    const { gl } = this
    const src = this.particleState[0]
    const dst = this.particleState[1]

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.particleFbos[dst])
    gl.viewport(0, 0, this.particleRes, this.particleRes)

    const program = this.updateProgram
    gl.useProgram(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.particleTextures[src])
    gl.uniform1i(gl.getUniformLocation(program, 'u_particles'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_wind'), 1)

    gl.uniform2f(
      gl.getUniformLocation(program, 'u_wind_min'),
      this.windMin[0],
      this.windMin[1],
    )
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_wind_max'),
      this.windMax[0],
      this.windMax[1],
    )
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_rand_seed'),
      Math.random(),
    )
    gl.uniform1f(gl.getUniformLocation(program, 'u_drop_rate'), 0.003)
    gl.uniform1f(gl.getUniformLocation(program, 'u_speed_factor'), 0.00035)

    this._drawQuad(program)

    this.particleState = [dst, src]
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  _fadePreviousFrame() {
    const { gl, canvas } = this
    const w = canvas.width
    const h = canvas.height
    const readIdx = this.screenIndex
    const writeIdx = 1 - readIdx

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.screenFbos[writeIdx])
    gl.viewport(0, 0, w, h)

    const program = this.fadeProgram
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.screenTextures[readIdx])
    gl.uniform1i(gl.getUniformLocation(program, 'u_screen'), 0)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), 0.93)

    this._drawQuad(program)
    this.screenIndex = writeIdx
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  _drawParticles() {
    const { gl, canvas } = this
    const w = canvas.width
    const h = canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.screenFbos[this.screenIndex])
    gl.viewport(0, 0, w, h)

    const program = this.drawProgram
    gl.useProgram(program)

    const idxLoc = gl.getAttribLocation(program, 'a_index')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleIndexBuffer)
    gl.enableVertexAttribArray(idxLoc)
    gl.vertexAttribPointer(idxLoc, 1, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.particleTextures[this.particleState[0]])
    gl.uniform1i(gl.getUniformLocation(program, 'u_particles'), 0)
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_particles_res'),
      this.particleRes,
    )

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.windTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_wind'), 1)

    gl.uniform2f(
      gl.getUniformLocation(program, 'u_wind_min'),
      this.windMin[0],
      this.windMin[1],
    )
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_wind_max'),
      this.windMax[0],
      this.windMax[1],
    )

    const c = this.ndcCorners
    gl.uniform2f(gl.getUniformLocation(program, 'u_ndc_nw'), c.nw[0], c.nw[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_ndc_ne'), c.ne[0], c.ne[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_ndc_sw'), c.sw[0], c.sw[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_ndc_se'), c.se[0], c.se[1])

    gl.drawArrays(gl.POINTS, 0, this.numParticles)
    gl.disableVertexAttribArray(idxLoc)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  _blitToScreen() {
    const { gl, canvas } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const program = this.fadeProgram
    gl.useProgram(program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.screenTextures[this.screenIndex])
    gl.uniform1i(gl.getUniformLocation(program, 'u_screen'), 0)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), 1.0)
    this._drawQuad(program)
  }

  frame() {
    this._updateParticles()
    this._fadePreviousFrame()
    this._drawParticles()
    this._blitToScreen()
  }

  destroy() {
    const { gl } = this
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
