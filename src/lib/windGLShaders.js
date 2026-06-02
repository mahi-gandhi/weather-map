export const quadVert = `
attribute vec2 a_pos;
varying vec2 v_tex_pos;
void main() {
  v_tex_pos = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const particleUpdateFrag = `
precision highp float;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;
uniform float u_drop_rate;
uniform float u_speed_factor;

varying vec2 v_tex_pos;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233)) + u_rand_seed) * 43758.5453);
}

void main() {
  vec4 px = texture2D(u_particles, v_tex_pos);
  vec2 pos = px.rg;

  vec2 windSample = texture2D(u_wind, pos).rg;
  vec2 velocity = mix(u_wind_min, u_wind_max, windSample);
  pos += velocity * u_speed_factor;

  float drop = step(1.0 - u_drop_rate, rand(pos + u_rand_seed));
  if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0 || drop > 0.5) {
    pos = vec2(rand(pos + 1.3), rand(pos + 2.1));
  }

  gl_FragColor = vec4(pos, 0.0, 1.0);
}
`

export const particleDrawVert = `
precision highp float;

attribute float a_index;
uniform sampler2D u_particles;
uniform float u_particles_res;
uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec2 u_ndc_nw;
uniform vec2 u_ndc_ne;
uniform vec2 u_ndc_sw;
uniform vec2 u_ndc_se;

varying float v_speed;

vec2 uvToNdc(vec2 uv) {
  vec2 top = mix(u_ndc_nw, u_ndc_ne, uv.x);
  vec2 bottom = mix(u_ndc_sw, u_ndc_se, uv.x);
  return mix(top, bottom, uv.y);
}

void main() {
  vec2 uv = vec2(
    fract(a_index / u_particles_res),
    floor(a_index / u_particles_res) / u_particles_res
  );
  vec2 pos = texture2D(u_particles, uv).rg;

  vec2 windSample = texture2D(u_wind, pos).rg;
  vec2 velocity = mix(u_wind_min, u_wind_max, windSample);
  v_speed = length(velocity) / max(length(u_wind_max), 0.001);

  vec2 ndc = uvToNdc(pos);
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = 1.8;
}
`

export const particleDrawFrag = `
precision mediump float;
varying float v_speed;

void main() {
  vec3 color;
  if (v_speed < 0.1) color = vec3(0.1, 0.3, 0.8);
  else if (v_speed < 0.3) color = vec3(0.0, 0.8, 1.0);
  else if (v_speed < 0.5) color = vec3(0.0, 1.0, 0.5);
  else if (v_speed < 0.7) color = vec3(1.0, 1.0, 0.0);
  else color = vec3(1.0, 0.3, 0.0);
  gl_FragColor = vec4(color, 0.85);
}
`

export const fadeFrag = `
precision mediump float;
uniform sampler2D u_screen;
uniform float u_opacity;
varying vec2 v_tex_pos;

void main() {
  gl_FragColor = texture2D(u_screen, v_tex_pos) * u_opacity;
}
`
