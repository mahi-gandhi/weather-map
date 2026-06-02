precision highp float;

uniform sampler2D u_posTex;
uniform sampler2D u_windTex;
uniform vec4 u_bounds;
uniform vec2 u_windRes;
uniform float u_speedScale;
uniform float u_rand;
uniform float u_windUint8;
uniform float u_posUint8;

varying vec2 v_uv;

vec4 decodePos(vec4 raw) {
  if (u_posUint8 < 0.5) {
    return raw;
  }
  // Uint8 upload uses 0–255 bytes; sampling is normalized — re-quantize to match
  return floor(raw * 255.0 + 0.5) / 255.0;
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233)) + u_rand) * 43758.5453);
}

void main() {
  vec4 pos = decodePos(texture2D(u_posTex, v_uv));
  vec2 curr = pos.xy;
  vec2 prev = pos.zw;

  float west = u_bounds.x;
  float south = u_bounds.y;
  float east = u_bounds.z;
  float north = u_bounds.w;

  float lng = mix(west, east, curr.x);
  float lat = mix(south, north, curr.y);

  vec2 windUV = vec2(curr.x, 1.0 - curr.y);
  vec4 windSample = texture2D(u_windTex, windUV);
  vec2 velocity = windSample.xy;
  if (u_windUint8 > 0.5) {
    velocity = (velocity * 2.0 - 1.0) * 120.0;
  }
  vec2 delta = velocity * u_speedScale;
  float newLng = lng + delta.x;
  float newLat = lat + delta.y;

  bool outside =
    newLng < west || newLng > east || newLat < south || newLat > north;

  if (outside) {
    newLng = mix(west, east, rand(vec2(v_uv.x, v_uv.y)));
    newLat = mix(south, north, rand(vec2(v_uv.y, v_uv.x)));
    prev = vec2(newLng, newLat);
    curr = prev;
  }

  float newLngNorm = (newLng - west) / (east - west);
  float newLatNorm = (newLat - south) / (north - south);

  gl_FragColor = vec4(newLngNorm, newLatNorm, curr.x, curr.y);
}
