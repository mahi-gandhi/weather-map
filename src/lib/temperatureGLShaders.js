export const tempQuadVert = `
attribute vec2 a_pos;
varying vec2 v_tex_pos;

void main() {
  v_tex_pos = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const tempFieldFrag = `
precision highp float;

uniform sampler2D u_temp_grid;
uniform sampler2D u_color_lut;
uniform vec4 u_data_bounds;
uniform vec2 u_merc_nw;
uniform vec2 u_merc_ne;
uniform vec2 u_merc_sw;
uniform vec2 u_merc_se;
uniform float u_temp_min;
uniform float u_temp_max;
uniform float u_lut_size;
uniform float u_opacity;
uniform vec2 u_canvas_size;

varying vec2 v_tex_pos;

const float PI = 3.14159265359;

vec2 latLngToMercator(vec2 latlng) {
  float latRad = latlng.x * PI / 180.0;
  float lngRad = latlng.y * PI / 180.0;
  return vec2(lngRad, log(tan(PI * 0.25 + latRad * 0.5)));
}

vec2 mercatorToLatLng(vec2 m) {
  float lat = (2.0 * atan(exp(m.y)) - PI * 0.5) * 180.0 / PI;
  float lng = m.x * 180.0 / PI;
  return vec2(lat, lng);
}

vec2 latLngFromScreen(vec2 uv) {
  vec2 top = mix(u_merc_nw, u_merc_ne, uv.x);
  vec2 bottom = mix(u_merc_sw, u_merc_se, uv.x);
  return mercatorToLatLng(mix(top, bottom, uv.y));
}

float radialEdge(vec2 uv) {
  vec2 c = uv - 0.5;
  float d = length(c) / 0.52;
  return smoothstep(1.0, 0.28, d);
}

void main() {
  vec2 containerPx = vec2(gl_FragCoord.x, u_canvas_size.y - gl_FragCoord.y);
  vec2 screenUv = containerPx / u_canvas_size;
  vec2 latlng = latLngFromScreen(screenUv);

  float west = u_data_bounds.x;
  float south = u_data_bounds.y;
  float east = u_data_bounds.z;
  float north = u_data_bounds.w;

  if (latlng.x < south || latlng.x > north || latlng.y < west || latlng.y > east) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float gridU = (latlng.y - west) / (east - west);
  float gridV = (north - latlng.x) / (north - south);
  vec4 sample = texture2D(u_temp_grid, vec2(gridU, gridV));

  if (sample.a < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float lutSpan = u_temp_max - u_temp_min;
  float lutT = lutSpan > 0.0
    ? (mix(u_temp_min, u_temp_max, sample.r) - u_temp_min) / lutSpan
    : sample.r;
  lutT = clamp(lutT, 0.0, 1.0);
  float lutIdx = floor(lutT * (u_lut_size - 1.0));
  float lutU = (lutIdx + 0.5) / u_lut_size;
  vec4 color = texture2D(u_color_lut, vec2(lutU, 0.5));

  float edge = radialEdge(screenUv);
  // color.* already 0–1 from texture; do not divide alpha by 255 again
  gl_FragColor = vec4(color.rgb, color.a * u_opacity * edge);
}
`
