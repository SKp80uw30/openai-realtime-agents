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

// Smooth spatial variation: neighboring points and frames stay connected.
// A small bounded hash also works with the renderer's mediump fallback.
float fieldHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float lightField(vec3 p) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(fieldHash(cell), fieldHash(cell + vec3(1, 0, 0)), f.x),
        mix(fieldHash(cell + vec3(0, 1, 0)), fieldHash(cell + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(fieldHash(cell + vec3(0, 0, 1)), fieldHash(cell + vec3(1, 0, 1)), f.x),
        mix(fieldHash(cell + vec3(0, 1, 1)), fieldHash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
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
    float t = time * 0.32 * motion;
    // Refraction compresses the pattern at the silhouette, so it wraps around
    // the sphere instead of looking like a flat animated circle.
    vec2 q = p / (0.73 + z * 0.27);
    q.x += motion * (warp + mid * 0.035 + energy * 0.045)
      * sin(q.y * 5.0 + t * 1.4) * z;
    // Let the light environment drift around the curved surface, rather than
    // sliding two screen-space tracks. Independent rates avoid a short loop.
    vec3 surface = normal;
    float tilt = sin(t * 0.23) * 0.42 + sin(t * 0.137) * 0.22
      + motion * mid * 0.12;
    surface.xy = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * surface.xy;
    float turn = sin(t * 0.173) * 0.38;
    surface.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * surface.xz;
    vec3 drift = vec3(t * 0.11, -t * 0.073, t * 0.097);
    float broad = lightField(surface * 1.8 + drift);
    float detail = lightField(surface * 3.6 - drift * 0.71 + broad * 0.7);
    float travel = lightField(vec3(t * 0.19, 2.7, 5.1)) - 0.5;
    float bend = (broad - 0.5) * (0.85 + motion * (warp + mid * 0.16))
      + (detail - 0.5) * 0.18;
    float field = surface.x / (0.73 + z * 0.27) + bend;
    float ribbonA = field + 0.27 + travel * 0.32;
    float ribbonB = field - 0.64 + (detail - 0.5) * 0.32 - travel * 0.24;
    float ribbonC = field + 0.88 + (broad - 0.5) * 0.18;
    // Vary the length and focus as well as the path: reflections can soften,
    // recede and reappear without blinking or adding more bright strands.
    float focusA = smoothstep(0.20, 0.65, broad + surface.y * 0.16);
    float focusB = smoothstep(0.18, 0.70, 1.0 - broad - surface.y * 0.20);
    float width = (0.025 + motion * energy * 0.008
      + (1.0 - smoothstep(-0.85, 0.5, p.y)) * 0.035)
      * mix(0.75, 1.35, detail);
    vec3 glass = vec3(0.003, 0.004, 0.014);
    glass += vec3(0.017, 0.018, 0.038) * pow(max(z, 0.0), 2.0)
      * smoothstep(-0.15, 0.9, p.y);
    float lower = 1.0 - smoothstep(-0.9, -0.30, p.y);
    float strength = 0.74 + energy * 0.65 + stateGlow;
    glass += blue * (glow(ribbonA, width * 3.1) * 0.64 * focusA
      + glow(ribbonB, width * 3.6) * 0.88 * focusB) * strength;
    glass += cyan * glow(ribbonA, width) * 0.74 * strength * focusA;
    glass += mix(blue, cyan, 0.45) * glow(ribbonB, width * 0.72) * 0.8 * strength * focusB;
    glass += violet * glow(ribbonC, 0.045) * (0.25 + lower * 0.6);
    glass += violet * glow(ribbonB + 0.095, 0.09) * 0.4 * focusB;
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
