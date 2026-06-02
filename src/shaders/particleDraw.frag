precision mediump float;

varying float v_speed;
varying float v_endpoint;

vec3 windyColor(float kmh) {
  kmh = max(kmh, 0.0);

  if (kmh <= 0.0) {
    return vec3(0.0);
  }

  vec3 c0 = vec3(0.0, 0.0, 0.0);
  vec3 c10 = vec3(0.039, 0.122, 0.431);
  vec3 c20 = vec3(0.102, 0.471, 0.761);
  vec3 c40 = vec3(0.0, 0.784, 1.0);
  vec3 c60 = vec3(0.0, 1.0, 0.588);
  vec3 c80 = vec3(1.0, 1.0, 0.0);
  vec3 c100 = vec3(1.0, 0.4, 0.0);
  vec3 c120 = vec3(1.0, 0.0, 0.0);

  if (kmh < 10.0) {
    return mix(c0, c10, kmh / 10.0);
  }
  if (kmh < 20.0) {
    return mix(c10, c20, (kmh - 10.0) / 10.0);
  }
  if (kmh < 40.0) {
    return mix(c20, c40, (kmh - 20.0) / 20.0);
  }
  if (kmh < 60.0) {
    return mix(c40, c60, (kmh - 40.0) / 20.0);
  }
  if (kmh < 80.0) {
    return mix(c60, c80, (kmh - 60.0) / 20.0);
  }
  if (kmh < 100.0) {
    return mix(c80, c100, (kmh - 80.0) / 20.0);
  }
  if (kmh < 120.0) {
    return mix(c100, c120, (kmh - 100.0) / 20.0);
  }
  return c120;
}

void main() {
  vec3 color = windyColor(v_speed);

  float along = v_endpoint;
  float cap = min(along, 1.0 - along) * 2.0;
  float alpha = smoothstep(0.0, 0.2, cap) * 0.85;

  gl_FragColor = vec4(color, alpha);
}
