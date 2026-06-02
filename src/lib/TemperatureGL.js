import { tempQuadVert, tempFieldFrag } from './temperatureGLShaders.js'
import { TEMPERATURE_LUT_SIZE } from './temperatureLut.js'

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Temperature shader compile: ${log}`)
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
    throw new Error(`Temperature program link: ${log}`)
  }
  return program
}

function createTexture(gl, width, height, data, filter) {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
  if (data) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    )
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
  }
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

const PI = Math.PI

function latLngToMercator(lat, lng) {
  const latRad = (lat * PI) / 180
  const lngRad = (lng * PI) / 180
  return [lngRad, Math.log(Math.tan(PI * 0.25 + latRad * 0.5))]
}

/**
 * GPU temperature field — fragment shader samples grid + LUT (no CPU pixel loops).
 */
export class TemperatureGL {
  constructor(canvas) {
    const gl =
      canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
      }) ||
      canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: true,
      })

    if (!gl) throw new Error('WebGL not available for temperature layer')

    this.gl = gl
    this.canvas = canvas
    this.dataBounds = [0, 0, 1, 1]
    this.tempMin = -20
    this.tempMax = 50
    this.mercCorners = {
      nw: [0, 0],
      ne: [0, 0],
      sw: [0, 0],
      se: [0, 0],
    }
    this.opacity = 0.65
    this.canvasSize = [1, 1]

    this._initGL()
  }

  _initGL() {
    const { gl } = this

    this.program = createProgram(gl, tempQuadVert, tempFieldFrag)

    this.quadBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )

    this.gridTexture = createTexture(gl, 1, 1, null, gl.LINEAR)
    this.lutTexture = createTexture(gl, 1, 1, null, gl.LINEAR)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  /**
   * @param {Uint8Array} data
   * @param {number} width
   * @param {number} height
   * @param {number} tempMin
   * @param {number} tempMax
   */
  setTemperatureGrid(data, width, height, tempMin, tempMax) {
    const { gl } = this
    this.tempMin = tempMin
    this.tempMax = tempMax

    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /**
   * @param {Uint8Array} rgba — 1024×1 LUT
   */
  setColorLut(rgba) {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      TEMPERATURE_LUT_SIZE,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgba,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /**
   * @param {number} west
   * @param {number} south
   * @param {number} east
   * @param {number} north
   */
  setDataBounds(west, south, east, north) {
    this.dataBounds = [west, south, east, north]
  }

  /**
   * @param {{ nw: number[], ne: number[], sw: number[], se: number[] }} corners Mercator [x,y]
   */
  setMercatorCorners(corners) {
    this.mercCorners = corners
  }

  resize(width, height) {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    this.canvas.width = w
    this.canvas.height = h
    this.canvasSize = [w, h]
  }

  frame() {
    const { gl, canvas, program } = this
    const w = canvas.width
    const h = canvas.height
    if (w <= 0 || h <= 0) return

    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_temp_grid'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_color_lut'), 1)

    const b = this.dataBounds
    gl.uniform4f(
      gl.getUniformLocation(program, 'u_data_bounds'),
      b[0],
      b[1],
      b[2],
      b[3],
    )

    const c = this.mercCorners
    gl.uniform2f(gl.getUniformLocation(program, 'u_merc_nw'), c.nw[0], c.nw[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_merc_ne'), c.ne[0], c.ne[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_merc_sw'), c.sw[0], c.sw[1])
    gl.uniform2f(gl.getUniformLocation(program, 'u_merc_se'), c.se[0], c.se[1])

    gl.uniform1f(gl.getUniformLocation(program, 'u_temp_min'), this.tempMin)
    gl.uniform1f(gl.getUniformLocation(program, 'u_temp_max'), this.tempMax)
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_lut_size'),
      TEMPERATURE_LUT_SIZE,
    )
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this.opacity)
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_canvas_size'),
      this.canvasSize[0],
      this.canvasSize[1],
    )

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.disableVertexAttribArray(posLoc)
  }

  destroy() {
    const { gl } = this
    gl.deleteTexture(this.gridTexture)
    gl.deleteTexture(this.lutTexture)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteProgram(this.program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

export { latLngToMercator }
