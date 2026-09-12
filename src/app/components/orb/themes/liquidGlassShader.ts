// A glass sphere with moving emissive caustics. Coordinates and lighting are
// deliberately asymmetric, following the supplied still and motion reference.
export const LIQUID_GLASS_VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

export const LIQUID_GLASS_FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float energy;
uniform float bass;
uniform float treble;
uniform float mid;
uniform float pulse;
uniform float stateGlow;
uniform float warp;
uniform float stateScale;
uniform float motion;
uniform vec3 accent;
uniform vec3 ribbon;

float glow(float distance, float width) {
  return exp(-distance * distance / (width * width));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution) / resolution.x;
  float radius = 0.715 * (1.0 + motion * (energy * 0.075 + bass * 0.02 + stateScale) + pulse);
  vec2 p = (uv - vec2(0.0, 0.16 + sin(time * 0.85) * 0.009 * motion)) / radius;
  float r = length(p);
  float edge = 2.0 / resolution.x / radius;
  float sphere = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
  vec3 blue = mix(vec3(0.005, 0.10, 1.0), ribbon, stateGlow * 0.65);
  vec3 cyan = ribbon;
  vec3 violet = accent;
  vec3 light = vec3(0.0);

  // A soft pool and a long, fading reflection on the surface below the orb.
  vec2 floorUV = vec2(uv.x / 0.45, (uv.y + 0.665) / 0.068);
  float pool = exp(-dot(floorUV, floorUV) * 1.6);
  float ring = glow(length(floorUV) - 0.9, 0.09);
  float reflection = exp(-pow(uv.x / 0.25, 2.0) * 2.0)
    * exp(-pow((uv.y + 0.91) / 0.27, 2.0) * 1.5)
    * (1.0 - smoothstep(-0.76, -0.65, uv.y));
  light += mix(blue, violet, smoothstep(-0.3, 0.3, uv.x))
    * (pool * 0.85 + ring * 0.24 + reflection * 0.48) * (1.0 + energy * 0.8 + stateGlow);
  light += cyan * pool * 0.48;
  // Keep the outer halo restrained: most light lives inside the glass.
  light += mix(blue, violet, smoothstep(-0.2, 0.8, p.x))
    * glow(r - 1.0, 0.035) * 0.055;

  if (r < 1.0 + edge) {
    float z = sqrt(max(0.0, 1.0 - min(dot(p, p), 1.0)));
    vec3 normal = vec3(p, z);
    float t = time * 0.32;
    // Refraction compresses the pattern at the silhouette, so it wraps around
    // the sphere instead of looking like a flat animated circle.
    vec2 q = p / (0.73 + z * 0.27);
    q.x += motion * (warp + mid * 0.035 + energy * 0.045)
      * sin(q.y * 5.0 + t * 1.4) * z;
    float flow = sin(q.y * 3.7 - 0.35 + t) * 0.27;
    flow += sin(q.y * 6.5 + t * 0.7) * 0.045;
    flow += sin(q.y * 2.2 - t * 0.5) * sin(t * 0.6) * 0.12;
    float ribbonA = q.x + 0.30 - flow;
    float ribbonB = q.x - 0.72 - sin(q.y * 3.5 + t * 0.85) * 0.17;
    float ribbonC = q.x + 0.88 + sin(q.y * 4.0 - t * 0.6) * 0.10;
    float width = 0.025 + energy * 0.008 + (1.0 - smoothstep(-0.85, 0.5, q.y)) * 0.035;
    vec3 glass = vec3(0.003, 0.004, 0.014);
    glass += vec3(0.017, 0.018, 0.038) * pow(max(z, 0.0), 2.0)
      * smoothstep(-0.15, 0.9, p.y);
    float lower = 1.0 - smoothstep(-0.9, -0.30, p.y);
    float strength = 0.74 + energy * 0.65 + stateGlow;
    glass += blue * (glow(ribbonA, width * 3.1) * 0.64
      + glow(ribbonB, width * 3.6) * 0.88) * strength;
    glass += cyan * glow(ribbonA, width) * 0.74 * strength;
    glass += mix(blue, cyan, 0.45) * glow(ribbonB, width * 0.72) * 0.8 * strength;
    glass += violet * glow(ribbonC, 0.045) * (0.25 + lower * 0.6);
    glass += violet * glow(ribbonB + 0.095, 0.09) * 0.4;
    // Broad, faint reflected panels establish depth in the otherwise dark core.
    float panel = length((p - vec2(-0.05, 0.58)) / vec2(0.65, 0.52));
    float panelMask = (1.0 - smoothstep(0.97, 1.0, panel))
      * smoothstep(0.05, 0.30, p.y);
    glass += vec3(0.023, 0.021, 0.040) * panelMask;
    glass += vec3(0.08, 0.065, 0.14) * glow(panel - 1.0, 0.004)
      * smoothstep(0.18, 0.6, p.y) * 0.30;
    float sideFold = q.x + 0.96 + sin(q.y * 9.0 + t * 0.55) * 0.045;
    glass += violet * glow(sideFold, 0.013) * 0.32
      * (0.5 + 0.5 * sin(q.y * 15.0 + t));
    // The lower caustic is the bright focal point in the reference.
    vec2 base = (p - vec2(0.02 + sin(t) * 0.14, -0.88)) / vec2(0.33, 0.24);
    float caustic = exp(-dot(base, base) * 1.4);
    glass += mix(cyan, violet, smoothstep(-0.25, 0.35, p.x))
      * lower * (0.25 + 0.5 * glow(p.x, 0.7));
    glass += mix(vec3(0.64, 0.94, 1.0), violet, 0.25) * caustic * 1.65;
    // Small refracted oval at the bottom of the shell.
    vec2 lens = p - vec2(0.13 + sin(t) * 0.09, -0.88);
    lens = mat2(0.98, -0.20, 0.20, 0.98) * lens;
    float oval = length(lens / vec2(0.18, 0.046));
    glass *= 1.0 - (1.0 - smoothstep(0.65, 1.0, oval)) * 0.72;
    glass += mix(violet, vec3(0.78, 0.87, 1.0), 0.5) * glow(oval - 1.0, 0.14) * 0.65;
    // Fresnel edge broken into lit and dark arcs, not a uniform neon outline.
    float fresnel = pow(1.0 - z, 4.0);
    float arc = 0.15 + 0.85 * pow(sin(atan(p.y, p.x) * 2.5 + t * 0.25), 2.0);
    glass += mix(cyan, violet, smoothstep(-0.4, 0.6, p.x)) * fresnel * arc * 0.68;
    // Crisp curved reflection of an overhead softbox on dark polished glass.
    float cap = length((p - vec2(-0.06, -0.015)) / vec2(0.94, 0.97));
    float highlight = glow(cap - 0.94, 0.007)
      * smoothstep(0.60, 0.91, p.y) * (1.0 - smoothstep(0.13, 0.51, p.x));
    glass += vec3(0.75, 0.85, 1.0) * highlight * (0.85 + treble * 0.3);
    float specular = pow(max(dot(normal, normalize(vec3(-0.32, 0.84, 0.42))), 0.0), 95.0);
    glass += cyan * specular * (0.30 + treble * 0.25);
    light = mix(light, glass, sphere);
  }
  // Transparent outside the sphere: works on the existing showcase background.
  light *= smoothstep(-1.12, -0.96, uv.y);
  float alpha = max(sphere, clamp(max(light.r, max(light.g, light.b)) * 2.5, 0.0, 0.85));
  gl_FragColor = vec4(light, alpha);
}
`;
