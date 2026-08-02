/**
 * Three passes, one organism.
 *
 * 1. advect — the energy field (RGB = cool/live/hot energy) is carried along
 *    a curl-noise current, decays, and receives the scene's own injections:
 *    the attention bloom, the incandescent core, the visitor's inquiry.
 * 2. inject — motes, dendrites and flares are stamped into the field so
 *    everything that moves leaves liquid light behind it.
 * 3. composite — the field becomes colour (palette fed in sRGB, mixed in
 *    OKLab on the CPU), over a breathing nebular ground, graded warm as the
 *    mind approaches its decision; vignette + grain keep it filmic.
 */
import * as THREE from "three";
import type { SceneKey } from "../scenes";
import type { World } from "../world";

const NOISE = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(234.34,435.345)); p += dot(p,p+34.23); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.-2.*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.; float amp = .5;
    for(int k=0;k<4;k++){ v += amp*vnoise(p); p = p*2.03 + 17.3; amp *= .5; }
    return v;
  }
`;

const ADVECT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform float uTime, uDt, uDecay, uFlowAmp, uFlowScale, uSwirl, uAttract;
  uniform float uAttention, uCore, uNebula, uPointerAmp, uAspect;
  uniform vec2 uFocus, uPointer;
  ${NOISE}
  vec2 toWorld(vec2 uv){ return vec2((uv.x-.5)*2.*uAspect, (uv.y-.5)*2.); }
  vec2 flow(vec2 w){
    float e = 0.12;
    float n1 = fbm(w*uFlowScale + vec2(uTime*.021, -uTime*.017));
    float nx = fbm((w+vec2(e,0.))*uFlowScale + vec2(uTime*.021, -uTime*.017));
    float ny = fbm((w+vec2(0.,e))*uFlowScale + vec2(uTime*.021, -uTime*.017));
    vec2 curl = vec2((ny-n1)/e, -(nx-n1)/e) * uFlowAmp * .55;
    vec2 d = uFocus - w;
    float r = length(d) + 1e-4;
    vec2 tang = vec2(-d.y, d.x)/r;
    float fall = smoothstep(1.7, .12, r);
    return curl + tang*uSwirl*fall*.9 + d*uAttract*.8;
  }
  void main(){
    vec2 w = toWorld(vUv);
    vec2 f = flow(w);
    vec2 duv = vec2(f.x/(2.*uAspect), f.y/2.) * uDt;
    vec3 e = texture2D(uPrev, vUv - duv).rgb * uDecay;

    // the field breathes on its own — faint cool energy everywhere
    e.r += (fbm(w*1.4 + vec2(0., uTime*.015)) - .42) * uNebula * .012;

    // attention arrives before structure
    float rf = length(w - uFocus);
    e.g += exp(-rf*rf*7.) * uAttention * .05;
    // the incandescent decision
    e.b += exp(-rf*rf*38.) * uCore * .16;
    e.g += exp(-rf*rf*14.) * uCore * .04;

    // the visitor's inquiry — the mind attends where you ask
    float rp = length(w - uPointer);
    e.g += exp(-rp*rp*46.) * uPointerAmp * .06;

    gl_FragColor = vec4(max(e, 0.), 1.);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform float uTime, uNebula, uWarm, uExposure, uAspect, uGrain;
  uniform vec2 uFieldPx;
  uniform vec3 uCool, uLive, uHot;
  ${NOISE}
  void main(){
    vec2 w = vec2((vUv.x-.5)*2.*uAspect, (vUv.y-.5)*2.);
    vec2 px = uFieldPx;
    vec3 e = texture2D(uField, vUv).rgb * .4
           + texture2D(uField, vUv + vec2(px.x, 0.)).rgb * .15
           + texture2D(uField, vUv - vec2(px.x, 0.)).rgb * .15
           + texture2D(uField, vUv + vec2(0., px.y)).rgb * .15
           + texture2D(uField, vUv - vec2(0., px.y)).rgb * .15;

    // ground: deep charcoal-midnight, warmed as the mind decides
    vec3 ground = mix(vec3(.039,.051,.078), vec3(.078,.055,.043), uWarm*.75);
    ground *= 1. - .28*length(w*vec2(.6,.9));

    // nebular breath
    vec2 warp = vec2(fbm(w*.9 + uTime*.008), fbm(w*.9 - uTime*.006));
    float neb = fbm(w*1.15 + warp*1.4);
    vec3 col = ground + uCool * neb * uNebula * .075;

    // energy → light
    float ec = 1. - exp(-e.r*1.9);
    float el = 1. - exp(-e.g*2.1);
    float eh = 1. - exp(-e.b*2.4);
    col += uCool * ec * .85;
    col += uLive * el;
    col += uHot  * eh * 1.02;
    // the hottest pixels whiten — incandescence, not clipping
    col += vec3(1.) * pow(eh, 3.2) * .42;

    col = 1. - exp(-col * uExposure);

    // vignette + fine grain
    col *= 1. - .34*pow(length(w*vec2(.62,.95)), 2.2);
    col += (hash21(vUv*vec2(1920.,1080.) + fract(uTime)*13.7) - .5) * uGrain;

    gl_FragColor = vec4(col, 1.);
  }
`;

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aChan;
  varying float vAlpha;
  varying vec3 vChan;
  uniform float uPx;
  void main(){
    vAlpha = aAlpha;
    vChan = aChan;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    gl_PointSize = aSize * uPx;
  }
`;

const POINT_FRAG_INJECT = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vChan;
  uniform float uGain;
  void main(){
    vec2 d = gl_PointCoord - .5;
    float fall = exp(-dot(d,d)*9.);
    gl_FragColor = vec4(vChan * fall * vAlpha * uGain, 1.);
  }
`;

const POINT_FRAG_CRISP = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vChan;
  uniform vec3 uCool, uLive, uHot;
  uniform float uGain;
  void main(){
    vec2 d = gl_PointCoord - .5;
    float r = length(d)*2.;
    float core = smoothstep(1., .1, r);
    vec3 col = uCool*vChan.r + uLive*vChan.g + uHot*vChan.b;
    gl_FragColor = vec4(col * core * vAlpha * uGain, 1.);
  }
`;

const LINE_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aChan;
  varying float vAlpha;
  varying vec3 vChan;
  void main(){
    vAlpha = aAlpha;
    vChan = aChan;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const LINE_FRAG_INJECT = /* glsl */ `
  precision highp float;
  varying float vAlpha; varying vec3 vChan;
  uniform float uGain;
  void main(){ gl_FragColor = vec4(vChan * vAlpha * uGain, 1.); }
`;

const LINE_FRAG_CRISP = /* glsl */ `
  precision highp float;
  varying float vAlpha; varying vec3 vChan;
  uniform vec3 uCool, uLive, uHot;
  uniform float uGain;
  void main(){
    vec3 col = uCool*vChan.r + uLive*vChan.g + uHot*vChan.b;
    gl_FragColor = vec4(col * vAlpha * uGain, 1.);
  }
`;

function quadScene(mat: THREE.Material): THREE.Scene {
  const s = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  s.add(m);
  return s;
}

export class WorldGL {
  renderer: THREE.WebGLRenderer;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private advectMat: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;
  private advectScene: THREE.Scene;
  private compositeScene: THREE.Scene;
  private injectScene = new THREE.Scene();
  private crispScene = new THREE.Scene();
  private moteGeo = new THREE.BufferGeometry();
  private anomGeo = new THREE.BufferGeometry();
  private nodeGeo = new THREE.BufferGeometry();
  private linkGeo = new THREE.BufferGeometry();
  private flareGeo = new THREE.BufferGeometry();
  private flarePos = new Float32Array(64 * 3);
  private flareChan = new Float32Array(64 * 3);
  private flareSize = new Float32Array(64);
  private flareAlpha = new Float32Array(64);
  private injPointMat: THREE.ShaderMaterial;
  private crispPointMat: THREE.ShaderMaterial;
  private injLineMat: THREE.ShaderMaterial;
  private crispLineMat: THREE.ShaderMaterial;
  private anomMat: THREE.PointsMaterial;
  fieldScale = 0.5;

  constructor(canvas: HTMLCanvasElement, private world: World) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.autoClear = false;

    const rtOpts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    this.rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts);

    this.advectMat = new THREE.ShaderMaterial({
      fragmentShader: ADVECT_FRAG,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      uniforms: {
        uPrev: { value: null }, uTime: { value: 0 }, uDt: { value: 1 / 60 },
        uDecay: { value: 0.96 }, uFlowAmp: { value: 0.3 }, uFlowScale: { value: 1 },
        uSwirl: { value: 0 }, uAttract: { value: 0 }, uAttention: { value: 0 },
        uCore: { value: 0 }, uNebula: { value: 0.3 }, uPointerAmp: { value: 0 },
        uAspect: { value: 1.6 }, uFocus: { value: new THREE.Vector2() }, uPointer: { value: new THREE.Vector2(99, 99) },
      },
      depthTest: false, depthWrite: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      fragmentShader: COMPOSITE_FRAG,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      uniforms: {
        uField: { value: null }, uTime: { value: 0 }, uNebula: { value: 0.3 },
        uWarm: { value: 0 }, uExposure: { value: 1 }, uAspect: { value: 1.6 },
        uGrain: { value: 0.028 }, uFieldPx: { value: new THREE.Vector2(0.002, 0.002) },
        uCool: { value: new THREE.Vector3() }, uLive: { value: new THREE.Vector3() }, uHot: { value: new THREE.Vector3() },
      },
      depthTest: false, depthWrite: false,
    });
    this.advectScene = quadScene(this.advectMat);
    this.compositeScene = quadScene(this.compositeMat);

    const pointUniforms = () => ({
      uPx: { value: 2 }, uGain: { value: 1 },
      uCool: { value: (this.compositeMat.uniforms.uCool as { value: THREE.Vector3 }).value },
      uLive: { value: (this.compositeMat.uniforms.uLive as { value: THREE.Vector3 }).value },
      uHot: { value: (this.compositeMat.uniforms.uHot as { value: THREE.Vector3 }).value },
    });
    const additive = { blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false };
    this.injPointMat = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG_INJECT, uniforms: pointUniforms(), ...additive });
    this.crispPointMat = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG_CRISP, uniforms: pointUniforms(), ...additive });
    this.injLineMat = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG_INJECT, uniforms: pointUniforms(), ...additive });
    this.crispLineMat = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG_CRISP, uniforms: pointUniforms(), ...additive });
    this.anomMat = new THREE.PointsMaterial({
      color: new THREE.Color(0xe4529e), size: 3, sizeAttenuation: false,
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    });

    const w = this.world;
    this.moteGeo.setAttribute("position", new THREE.BufferAttribute(w.mPos, 3));
    this.moteGeo.setAttribute("aChan", new THREE.BufferAttribute(w.mChan, 3));
    this.moteGeo.setAttribute("aSize", new THREE.BufferAttribute(w.mSize, 1));
    this.moteGeo.setAttribute("aAlpha", new THREE.BufferAttribute(w.mAlpha, 1));
    this.anomGeo.setAttribute("position", new THREE.BufferAttribute(w.aPos, 3));
    this.nodeGeo.setAttribute("position", new THREE.BufferAttribute(w.nPos, 3));
    this.nodeGeo.setAttribute("aChan", new THREE.BufferAttribute(w.nChan, 3));
    this.nodeGeo.setAttribute("aSize", new THREE.BufferAttribute(w.nSize, 1));
    this.nodeGeo.setAttribute("aAlpha", new THREE.BufferAttribute(w.nAlpha, 1));
    this.linkGeo.setAttribute("position", new THREE.BufferAttribute(w.lPos, 3));
    this.linkGeo.setAttribute("aChan", new THREE.BufferAttribute(w.lChan, 3));
    this.linkGeo.setAttribute("aAlpha", new THREE.BufferAttribute(w.lAlpha, 1));
    this.flareGeo.setAttribute("position", new THREE.BufferAttribute(this.flarePos, 3));
    this.flareGeo.setAttribute("aChan", new THREE.BufferAttribute(this.flareChan, 3));
    this.flareGeo.setAttribute("aSize", new THREE.BufferAttribute(this.flareSize, 1));
    this.flareGeo.setAttribute("aAlpha", new THREE.BufferAttribute(this.flareAlpha, 1));

    const motesInj = new THREE.Points(this.moteGeo, this.injPointMat);
    const nodesInj = new THREE.Points(this.nodeGeo, this.injPointMat);
    const linksInj = new THREE.LineSegments(this.linkGeo, this.injLineMat);
    const flaresInj = new THREE.Points(this.flareGeo, this.injPointMat);
    const motesCrisp = new THREE.Points(this.moteGeo, this.crispPointMat);
    const nodesCrisp = new THREE.Points(this.nodeGeo, this.crispPointMat);
    const linksCrisp = new THREE.LineSegments(this.linkGeo, this.crispLineMat);
    const anomCrisp = new THREE.Points(this.anomGeo, this.anomMat);
    for (const o of [motesInj, nodesInj, linksInj, flaresInj, motesCrisp, nodesCrisp, linksCrisp, anomCrisp]) o.frustumCulled = false;
    this.injectScene.add(motesInj, nodesInj, linksInj, flaresInj);
    this.crispScene.add(motesCrisp, nodesCrisp, linksCrisp, anomCrisp);
  }

  setPointer(wx: number, wy: number, amp: number) {
    (this.advectMat.uniforms.uPointer.value as THREE.Vector2).set(wx, wy);
    this.advectMat.uniforms.uPointerAmp.value = amp;
  }

  resize(w: number, h: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const A = w / h;
    this.world.A = A;
    this.cam.left = -A; this.cam.right = A; this.cam.top = 1; this.cam.bottom = -1;
    this.cam.updateProjectionMatrix();
    this.advectMat.uniforms.uAspect.value = A;
    this.compositeMat.uniforms.uAspect.value = A;
    const fw = Math.max(64, Math.round(w * dpr * this.fieldScale));
    const fh = Math.max(64, Math.round(h * dpr * this.fieldScale));
    this.rtA.setSize(fw, fh);
    this.rtB.setSize(fw, fh);
    (this.compositeMat.uniforms.uFieldPx.value as THREE.Vector2).set(1.5 / fw, 1.5 / fh);
    const px = (h * dpr) / 900; // point sizes tuned for a 900px-tall frame
    this.injPointMat.uniforms.uPx.value = 2.6 * px * this.fieldScale * 2;
    this.crispPointMat.uniforms.uPx.value = 1.5 * px;
  }

  render(sc: SceneKey, time: number, dt: number) {
    const u = this.advectMat.uniforms;
    u.uTime.value = time;
    u.uDt.value = Math.min(dt, 1 / 30);
    u.uDecay.value = sc.decay;
    u.uFlowAmp.value = sc.flowAmp;
    u.uFlowScale.value = sc.flowScale;
    u.uSwirl.value = sc.swirl;
    u.uAttract.value = sc.attract;
    u.uAttention.value = sc.attention;
    u.uCore.value = sc.core;
    u.uNebula.value = sc.nebula;
    const [fx, fy] = this.world.focusWorld();
    (u.uFocus.value as THREE.Vector2).set(fx, fy);

    const cu = this.compositeMat.uniforms;
    cu.uTime.value = time;
    cu.uNebula.value = sc.nebula;
    cu.uWarm.value = sc.warm;
    cu.uExposure.value = sc.exposure;
    (cu.uCool.value as THREE.Vector3).set(sc.cool[0], sc.cool[1], sc.cool[2]);
    (cu.uLive.value as THREE.Vector3).set(sc.live[0], sc.live[1], sc.live[2]);
    (cu.uHot.value as THREE.Vector3).set(sc.hot[0], sc.hot[1], sc.hot[2]);

    // flares → geometry
    const fl = this.world.flares;
    const fn = Math.min(64, fl.length);
    for (let i = 0; i < fn; i++) {
      this.flarePos[i * 3] = fl[i].x; this.flarePos[i * 3 + 1] = fl[i].y;
      const life = Math.max(0, Math.min(1, fl[i].life));
      this.flareAlpha[i] = Math.sin(life * Math.PI) * 0.9;
      this.flareSize[i] = 10 + (1 - life) * 14;
      this.flareChan[i * 3] = fl[i].chan === 0 ? 1 : 0;
      this.flareChan[i * 3 + 1] = fl[i].chan === 1 ? 1 : 0;
      this.flareChan[i * 3 + 2] = fl[i].chan === 2 ? 1 : 0;
    }
    this.flareGeo.setDrawRange(0, fn);

    for (const g of [this.moteGeo, this.nodeGeo, this.linkGeo, this.anomGeo, this.flareGeo]) {
      for (const name of ["position", "aChan", "aSize", "aAlpha"]) {
        const at = g.getAttribute(name) as THREE.BufferAttribute | undefined;
        if (at) at.needsUpdate = true;
      }
    }

    // 1. advect prev → next
    u.uPrev.value = this.rtA.texture;
    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(this.advectScene, this.quadCam);
    // 2. inject structures into the field
    this.renderer.render(this.injectScene, this.cam);
    // 3. composite to screen + crisp overlay
    this.renderer.setRenderTarget(null);
    cu.uField.value = this.rtB.texture;
    this.renderer.render(this.compositeScene, this.quadCam);
    this.renderer.render(this.crispScene, this.cam);

    const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp;
  }
}
