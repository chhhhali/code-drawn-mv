// 舞台：渲染器、后期（暗角 / 去饱和 / 冷暖 / 颗粒 / 淡入淡出）、灯光（台灯聚光 + 软阴影 + 月光补光）。书桌和立体书在 book.js。
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export const W = 1920;
export const H = 1080;

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2(W, H) },
    uWarm: { value: 0.5 }, // 0 = 冷（夜蓝），1 = 暖（黄昏金）
    uFade: { value: 1 }, // 0 = 全黑
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFrame;
    uniform vec2 uRes;
    uniform float uWarm;
    uniform float uFade;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float vig = smoothstep(1.08, 0.28, length(d));
      c.rgb *= mix(0.58, 1.0, vig);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, mix(0.84, 0.97, uWarm));
      vec3 cool = c.rgb * vec3(0.95, 1.0, 1.07) + vec3(0.006, 0.012, 0.03);
      vec3 warm = c.rgb * vec3(1.09, 1.0, 0.84) + vec3(0.03, 0.016, 0.0);
      c.rgb = mix(cool, warm, uWarm);
      c.rgb *= uFade;
      float g = hash(floor(vUv * uRes) + uFrame * 7.13) - 0.5;
      c.rgb += g * 0.04;
      gl_FragColor = vec4(c.rgb, 1.0);
    }
  `,
};

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0d1018");
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 120);

  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);

  return { renderer, scene, camera, composer, film };
}

export function buildLights(scene, mode = "book") {
  // 台灯：左前上方的暖光，投出纸片的软阴影
  const full = mode === "fullscreen";
  const lamp = new THREE.SpotLight("#ffd6a0", full ? 2400 : 1500, 0, full ? 0.62 : 0.55, 0.9, 2);
  lamp.position.set(full ? -8 : -7.5, full ? 11 : 10.5, full ? 13 : 9.5);
  lamp.target.position.set(full ? 0.4 : 0.2, full ? 1.6 : 1.8, full ? 1.6 : 1.8);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(4096, 4096);
  lamp.shadow.camera.near = 4;
  lamp.shadow.camera.far = 40;
  lamp.shadow.radius = 7;
  lamp.shadow.intensity = 0.62; // 纸片的影子淡一点，亮背景上不会像黑洞
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.015;
  scene.add(lamp, lamp.target);
  // 窗外月光：冷色补光
  const moon = new THREE.DirectionalLight("#9fb3dd", 0.35);
  moon.position.set(6, 8, 5);
  scene.add(moon);
  scene.add(new THREE.HemisphereLight("#4a5a7c", full ? "#5a4a3c" : "#2a2018", 1.0));
  return { lamp, moon, hemi: scene.children.find((o) => o.isHemisphereLight) };
}
