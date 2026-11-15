const cameraSource = `
uniform vec2 uResolution;
uniform vec3 uOrbit;
uniform vec2 uLook;

mat3 cameraBasis() {
  float yaw = uOrbit.x + .045 * uLook.x;
  float pitch = uOrbit.y + .035 * uLook.y;
  vec3 back = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));
  vec3 right = normalize(cross(vec3(0., 1., 0.), back));
  vec3 up = cross(back, right);
  float roll = -.40;
  return mat3(right * cos(roll) + up * sin(roll), up * cos(roll) - right * sin(roll), back);
}

float sceneScale() {
  return min(uResolution.y, uResolution.x * .82);
}

vec2 screenOffset() {
  return vec2(.0, .023) * uResolution.y / sceneScale();
}

float focalLength() {
  return 1.67;
}

float cameraDistance() {
  return 6.40 / uOrbit.z;
}
`;

const quadVertex = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0., 1.);
}
`;

const sceneFragment = `
precision highp float;

${cameraSource}
uniform float uTime;
uniform float uPulse;

const vec3 INK = vec3(.019, .012, .047);
const vec3 ULTRAVIOLET = vec3(.31, .15, 1.);
const vec3 ICE = vec3(.37, .56, 1.);
const vec3 CORAL = vec3(1., .22, .13);
const vec3 GOLD = vec3(1., .61, .28);

float hash(vec2 p) {
  vec3 q = fract(p.xyx * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 w = fract(p);
  w = w * w * (3. - 2. * w);
  return mix(mix(hash(cell), hash(cell + vec2(1., 0.)), w.x),
             mix(hash(cell + vec2(0., 1.)), hash(cell + 1.), w.x), w.y);
}

float mist(vec2 p) {
  mat2 tilt = mat2(.86, .51, -.51, .86);
  return .52 * noise(p) + .29 * noise(tilt * p * 2.07)
      + .13 * noise(p * 4.72 + 4.) + .06 * noise(p * 9.13 - 7.);
}

float bell(float x) {
  return exp(-x * x);
}

vec3 starLayer(vec2 p, float count, float threshold) {
  vec2 samplePoint = p * count;
  vec2 cell = floor(samplePoint);
  float seed = hash(cell);
  vec2 center = .2 + .6 * vec2(hash(cell + 17.), hash(cell - 4.));
  vec2 delta = fract(samplePoint) - center;
  float distanceSquared = dot(delta, delta);
  float sharp = exp(-distanceSquared * (420. + seed * 950.));
  float aura = exp(-distanceSquared * 42.) * .10;
  float light = (sharp + aura) * smoothstep(threshold, 1., seed);
  return light * mix(vec3(.57, .52, 1.), vec3(1., .73, .54), hash(cell + 61.));
}

vec3 atmosphere(vec2 screen) {
  vec2 drift = uOrbit.xy * .047 + uLook * .012;
  vec2 far = screen + drift;
  float diagonal = far.y + far.x * .31;
  float fog = mist(far * 5.45 + vec2(9.4, .87));
  float brokenCloud = pow(smoothstep(.22, .87, fog), 2.);
  float wideVeil = bell(diagonal * 2.8 + .12) * bell(far.x * 1.4 - .18);
  vec3 color = INK * (.48 + .72 * bell(length(screen) * 1.8));
  color += ULTRAVIOLET * brokenCloud * wideVeil * .15;
  color += CORAL * brokenCloud * bell(length((far - vec2(.35, .12)) * vec2(2., 5.))) * .07;
  color += starLayer(far * 1.08 + .172, 53., .79) * .29;
  color += starLayer(screen + drift * .49, 127., .58) * .11;
  return color;
}

vec3 diskLight(vec3 point, float filterWidth, out float coverage) {
  float radius = length(point.xz);
  float angle = atan(point.z, point.x + .0001);
  float flow = angle - uTime * (.10 + .24 / max(radius * radius, .1));
  float turbulence = noise(vec2(cos(flow) * 4. + radius * 10., sin(flow) * 4.));
  float spiral = radius + .066 * sin(2. * flow + radius * 3.)
      + .035 * sin(5. * flow - radius * 7.);
  float orbitalFade = smoothstep(1.02, 1.12, radius) * (1. - smoothstep(1.76, 2.65, spiral));
  float smoke = noise(vec2(spiral * 18. + 1.5 * turbulence, sin(flow + spiral) * 3.5))
      * noise(vec2(spiral * 5., cos(flow - spiral * 2.) * 6.5));
  float fibers = mix(pow(.5 + .5 * sin(spiral * 159. + turbulence * 4.), 8.),
      .196, smoothstep(.65, 3.7, filterWidth * 159.));
  float arcs = mix(pow(.5 + .5 * sin(spiral * 56. - flow * 3.), 5.),
      .246, smoothstep(.65, 3.7, filterWidth * 56.));
  float bands = bell((spiral - 1.21) * 7.) * .65 + bell((spiral - 1.64) * 6.) * .47
      + bell((spiral - 2.03) * 9.) * .23;
  float filaments = (.13 + bands) * (.40 * fibers + .58 * arcs + .49 * smoke);
  float scatter = (.13 + .62 * smoke) * orbitalFade * bell((radius - 1.40) * 1.6);
  float hotSide = smoothstep(.18, 1., .5 + .5 * cos(angle - 1.14));
  float glints = bell((spiral - 1.15) * 21.) * (pow(.5 + .5 * cos(flow - .92), 9.) * 1.4 + .16);
  vec3 cold = mix(ULTRAVIOLET, ICE, fibers * .61 + arcs * .25);
  vec3 hot = mix(CORAL, GOLD, turbulence * .72 + .14);
  float wave = bell((radius - 1.05 - (uPulse * .75)) * 12.) * max(0., 1. - uPulse * .42);
  coverage = clamp((scatter * .54 + filaments * .53) * orbitalFade, 0., .7);
  return mix(cold, hot, hotSide * .95) * orbitalFade * (filaments * 1.7 + scatter * .52 + .22 * wave)
       + mix(vec3(1., .49, .87), vec3(1., .9, .68), hotSide) * glints * orbitalFade;
}

void main() {
  vec2 screen = (gl_FragCoord.xy - .5 * uResolution) / sceneScale() - screenOffset();
  mat3 basis = cameraBasis();
  float focal = focalLength();
  vec3 eye = basis[2] * cameraDistance();
  vec3 ray = normalize(basis * vec3(screen, -focal));
  float approach = -dot(eye, ray);
  float impact = length(eye + approach * ray);
  float lensAngle = atan(screen.y, screen.x + .0001);
  vec3 color = atmosphere(screen);
  bool hitsSphere = impact < 1.;
  float edgeHalo = bell((impact - 1.01) * 2.2) * .14 + bell((impact - 1.03) * 7.0) * .14;
  float warmRim = smoothstep(.08, .97, .5 + .5 * cos(lensAngle - .89));
  vec3 rim = mix(ULTRAVIOLET, CORAL, warmRim);
  color += rim * edgeHalo * (.58 + .42 * sin(lensAngle + .47));
  float front = approach;
  if (hitsSphere) {
    front -= sqrt(max(0., 1. - impact * impact));
    vec3 normal = normalize(eye + ray * front);
    vec3 key = normalize(basis * vec3(-.42 + .20 * uLook.x, .67 + .24 * uLook.y, .37));
    float reflection = max(0., dot(reflect(ray, normal), key));
    float surfaceNoise = noise(normal.xy * 14.) * .37 + noise(normal.zy * 32.) * .19;
    float metallic = pow(reflection, 13.) * .11 + pow(reflection, 47.) * .15;
    float fresnel = pow(impact, 13.);
    color = INK * (.26 + surfaceNoise * .25)
        + mix(ULTRAVIOLET, ICE, metallic) * metallic * surfaceNoise
        + rim * fresnel * (.074 + .14 * smoothstep(.35, .98, .5 + .5 * cos(lensAngle - 1.02)));
  } else {
    // The thinner inner shell and broken outer halo suggest light bending around the silhouette.
    float rimTexture = noise(vec2(cos(lensAngle), sin(lensAngle)) * 11. + .18 * uTime);
    float photonRing = bell((impact - 1.017) * 62.) * (.25 + warmRim * .68);
    float outerRing = bell((impact - 1.058 - rimTexture * .035) * 23.) * .24;
    float shade = .61 + .39 * sin(lensAngle + 1.63);
    color += mix(ICE, GOLD, warmRim) * (photonRing + outerRing) * shade;
    color += vec3(1., .47, .40) * bell((impact - 1.014) * 33.)
        * bell(sin((lensAngle - .73) * .5) * 7.5) * .92;
  }
  // The nearer part of the translucent disc crosses the silhouette. The sphere occludes its far side.
  float planeDepth = -eye.y / (ray.y + .00001);
  vec3 point = eye + ray * planeDepth;
  float filterWidth = 0.;
#ifdef HORIZON_DERIVATIVES
  filterWidth = fwidth(length(point.xz));
#endif
  if (planeDepth > 0. && (!hitsSphere || planeDepth < front)) {
    if (dot(point.xz, point.xz) < 8.2) {
      float coverage = 0.;
      vec3 emission = diskLight(point, filterWidth, coverage);
      float edgeOn = smoothstep(.008, .095, abs(basis[2].y));
      color = color * (1. - coverage * .45 * edgeOn) + emission * edgeOn;
    }
  }
  // Low-frequency scattering ties the narrow strands into a single luminous volume.
  float lensRoll = -.40;
  vec2 disc = mat2(cos(lensRoll), sin(lensRoll), -sin(lensRoll), cos(lensRoll)) * screen;
  float glow = bell((disc.y + .035) * 9.) * bell(disc.x * 1.7) * smoothstep(.96, 1.18, impact);
  color += mix(ULTRAVIOLET, CORAL, smoothstep(-.36, .44, disc.x)) * glow * .084;
  float vignette = 1. - .78 * smoothstep(.39, .94, length(screen * vec2(.86, 1.)));
  float grain = (hash(gl_FragCoord.xy + 7.) - .5) * .011;
  vec3 finish = 1. - exp(-color * 1.42);
  gl_FragColor = vec4(max(vec3(0.), pow(finish, vec3(.92)) * vignette + grain), 1.);
}
`;

const sparksVertex = `
precision highp float;

${cameraSource}
attribute vec4 aSeed;
uniform float uTime;
uniform float uPulse;
varying mediump vec3 vColor;
varying mediump float vStrength;

float bell(float x) {
  return exp(-x * x);
}

void main() {
  mat3 basis = cameraBasis();
  float radius = aSeed.x;
  float angle = aSeed.y + uTime * (.12 + .31 / (radius * radius));
  float elevation = aSeed.z * (.15 + .35 * smoothstep(1.64, 3.8, radius));
  vec3 point = vec3(radius * cos(angle), elevation, radius * sin(angle));
  vec3 view = vec3(dot(point, basis[0]), dot(point, basis[1]), dot(point, basis[2]));
  float depth = cameraDistance() - view.z;
  vec2 dimensions = uResolution / sceneScale();
  vec2 screen = view.xy * focalLength() / depth;
  vec3 eye = basis[2] * cameraDistance();
  vec3 ray = normalize(point - eye);
  float approach = -dot(eye, ray);
  float impact = length(eye + approach * ray);
  float visibility = approach < length(point - eye) ? smoothstep(.97, 1.014, impact) : 1.;
  gl_Position = vec4(2. * (screen + screenOffset()) / dimensions, 0., 1.);
  float nearby = .1 + .9 * (1. - smoothstep(3.6, 8.1, depth));
  gl_PointSize = clamp((aSeed.w * 6. + .85) * sceneScale() / 550.
      * (.82 + nearby * .42), 1., 9.);
  float blink = .70 + .30 * sin(uTime * 1.8 + aSeed.w * 29.);
  float pulse = bell((radius - 1.05 - uPulse * .75) * 9.) * max(0., 1. - uPulse * .42);
  vStrength = visibility * (.23 + aSeed.w * .44) * blink * nearby + visibility * pulse * .51;
  float hot = smoothstep(.10, 1., .5 + .5 * cos(angle - 1.14));
  vColor = mix(vec3(.53, .43, 1.), vec3(1., .56, .33), hot);
}
`;

const sparksFragment = `
precision mediump float;
varying mediump vec3 vColor;
varying mediump float vStrength;

void main() {
  vec2 point = 2. * gl_PointCoord - 1.;
  float radius = dot(point, point);
  float light = (exp(-radius * 12.) * .69 + exp(-radius * 4.) * .17) * (1. - smoothstep(.56, 1., radius));
  gl_FragColor = vec4(vColor * light * vStrength, 1.);
}
`;

interface SceneFrame {
  time: number;
  yaw: number;
  pitch: number;
  zoom: number;
  lookX: number;
  lookY: number;
  pulse: number;
}

type Attribute = 'aPosition' | 'aSeed';

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result = gl.createShader(type);
  if (!result) return null;
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (gl.getShaderParameter(result, gl.COMPILE_STATUS)) return result;
  gl.deleteShader(result);
  return null;
}

function makePass(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attribute: Attribute,
  data: Float32Array,
  itemSize: number,
) {
  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  if (!vertex) return null;
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = fragment && gl.createProgram();
  if (!program || !fragment) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  const buffer = gl.getProgramParameter(program, gl.LINK_STATUS) && gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, attribute);
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const orbit = gl.getUniformLocation(program, 'uOrbit');
  const look = gl.getUniformLocation(program, 'uLook');
  const time = gl.getUniformLocation(program, 'uTime');
  const pulse = gl.getUniformLocation(program, 'uPulse');
  return {
    draw(mode: number, width: number, height: number, frame: SceneFrame) {
      // biome-ignore lint/correctness/useHookAtTopLevel: This is the WebGL program binding method.
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, itemSize, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, width, height);
      gl.uniform3f(orbit, frame.yaw, frame.pitch, frame.zoom);
      gl.uniform2f(look, frame.lookX, frame.lookY);
      gl.uniform1f(time, frame.time);
      gl.uniform1f(pulse, frame.pulse);
      gl.drawArrays(mode, 0, data.length / itemSize);
      gl.disableVertexAttribArray(position);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function sparkSeeds() {
  let seed = 41693;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sparks = new Float32Array(560 * 4);
  for (let index = 0; index < sparks.length; index += 4) {
    sparks[index] = 1.085 + 2.5 * next() ** 2;
    sparks[index + 1] = next() * Math.PI * 2;
    sparks[index + 2] = (next() - 0.5) * (next() < 0.16 ? 5.5 : 2.5);
    sparks[index + 3] = next() ** 4;
  }
  return sparks;
}

export function createHorizonRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'low-power',
    stencil: false,
  });
  if (!gl || gl.isContextLost()) return null;
  const triangle = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const derivatives = gl.getExtension('OES_standard_derivatives')
    ? '#extension GL_OES_standard_derivatives : enable\n#define HORIZON_DERIVATIVES\n'
    : '';
  const scene = makePass(gl, quadVertex, derivatives + sceneFragment, 'aPosition', triangle, 2);
  const sparks = makePass(gl, sparksVertex, sparksFragment, 'aSeed', sparkSeeds(), 4);
  if (!scene || !sparks) {
    scene?.dispose();
    sparks?.dispose();
    return null;
  }
  gl.blendFunc(gl.ONE, gl.ONE);
  return {
    draw(frame: SceneFrame) {
      const { width, height } = canvas;
      gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND);
      scene.draw(gl.TRIANGLES, width, height, frame);
      gl.enable(gl.BLEND);
      sparks.draw(gl.POINTS, width, height, frame);
    },
    dispose() {
      scene.dispose();
      sparks.dispose();
    },
  };
}
