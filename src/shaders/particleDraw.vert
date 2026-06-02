precision highp float;

attribute float a_index;
attribute float a_endpoint;

uniform sampler2D u_posTex;
uniform sampler2D u_windTex;
uniform vec2 u_particleTexSize;
uniform vec2 u_screenNW;
uniform vec2 u_screenNE;
uniform vec2 u_screenSW;
uniform vec2 u_screenSE;
uniform vec2 u_canvasSize;
uniform float u_windUint8;
uniform float u_posUint8;

varying float v_speed;

vec4 decodePos(vec4 raw) {
  if (u_posUint8 < 0.5) {
    return raw;
  }
  return floor(raw * 255.0 + 0.5) / 255.0;
}
varying float v_endpoint;

vec2 geoNormToScreen(vec2 norm) {
  vec2 top = mix(u_screenNW, u_screenNE, norm.x);
  vec2 bottom = mix(u_screenSW, u_screenSE, norm.x);
  return mix(top, bottom, norm.y);
}

void main() {
  float col = mod(a_index, u_particleTexSize.x);
  float row = floor(a_index / u_particleTexSize.x);
  vec2 texUV = (vec2(col, row) + 0.5) / u_particleTexSize;

  vec4 pos = decodePos(texture2D(u_posTex, texUV));
  vec2 norm = a_endpoint < 0.5 ? pos.zw : pos.xy;

  vec2 screen = geoNormToScreen(norm);

  vec2 clip = vec2(
    (screen.x / u_canvasSize.x) * 2.0 - 1.0,
    1.0 - (screen.y / u_canvasSize.y) * 2.0
  );

  gl_Position = vec4(clip, 0.0, 1.0);

  vec2 windUV = vec2(norm.x, 1.0 - norm.y);
  vec4 windSample = texture2D(u_windTex, windUV);
  v_speed = windSample.b;
  if (u_windUint8 > 0.5) {
    v_speed = windSample.b * 120.0;
  }
  v_endpoint = a_endpoint;
}
