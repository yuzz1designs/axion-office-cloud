import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AudioLevelRef, AivaVisualState } from "./aivaVisual.types";
import { getAivaStatePresets } from "./aivaStatePresets";
import type { AivaBrainId } from "../../lib/aivaBrain";

interface Props { state: AivaVisualState; accentColor: string; audioLevel: AudioLevelRef; reducedMotion: boolean; brain: AivaBrainId; executing: boolean; }

const shellVertex = /* glsl */ `
  uniform float uTime; uniform float uActivity; uniform float uAudio; uniform vec2 uPointer;
  varying vec3 vNormal; varying vec3 vWorld; varying float vFlow;
  void main() {
    vec3 p = position;
    float flow = sin(p.y * 5.2 + p.x * 2.1 - uTime * 0.72) * sin(p.z * 4.1 - uTime * 0.41);
    p += normal * flow * (0.026 + uActivity * 0.024 + uAudio * 0.05);
    p.xy += uPointer * vec2(0.035, 0.02) * (0.4 + p.z * 0.25);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz; vNormal = normalize(mat3(modelMatrix) * normal); vFlow = flow;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const shellFragment = /* glsl */ `
  uniform vec3 uColor; uniform float uGlow; uniform float uTime; uniform float uAudio;
  varying vec3 vNormal; varying vec3 vWorld; varying float vFlow;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 3.6);
    float threads = pow(max(0.0, sin(vWorld.y * 8.0 + vWorld.x * 3.0 - uTime * 0.48) * 0.5 + 0.5), 9.0);
    float lower = 1.0 - smoothstep(-1.25, 0.3, vWorld.y);
    vec3 deep = mix(uColor, vec3(0.002, 0.006, 0.016), 0.72);
    vec3 color = mix(deep, uColor, fresnel * 0.88 + lower * 0.25 + max(0.0, -vFlow) * 0.1);
    color = mix(color, vec3(1.0), pow(fresnel, 6.0) * (0.12 + lower * 0.16));
    float alpha = fresnel * (0.12 + uGlow * 0.14) + threads * fresnel * 0.1 + uAudio * fresnel * 0.16;
    gl_FragColor = vec4(color * (0.72 + fresnel * 1.35 + uAudio * 0.45), alpha);
  }
`;

function flowingCurve(index: number, lower = false) {
  const points: THREE.Vector3[] = [];
  const phase = index * 1.71;
  for (let i = 0; i < 120; i += 1) {
    const angle = i / 120 * Math.PI * 2;
    const latitude = lower
      ? -0.8 + Math.sin(angle + phase) * 0.12 + Math.sin(angle * 3 - phase) * 0.045
      : Math.sin(angle * (1 + index % 2) + phase) * (0.34 + index * 0.035) + Math.sin(angle * 3.0 - phase) * 0.055;
    const radius = Math.sqrt(Math.max(0.2, 1.82 - latitude * latitude)) * (1 + Math.sin(angle * 3 + phase) * 0.022);
    points.push(new THREE.Vector3(Math.cos(angle) * radius, latitude, Math.sin(angle) * radius * (0.78 + index * 0.018)));
  }
  return new THREE.CatmullRomCurve3(points, true, "centripetal");
}

function makeRibbon(index: number, color: THREE.Color, lower = false) {
  const geometry = new THREE.TubeGeometry(flowingCurve(index, lower), 180, lower ? 0.009 + index * 0.002 : 0.006 + index * 0.001, 5, true);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lower ? 0.45 : 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Mesh(geometry, material);
}

function createAuraTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 5, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,.18)"); gradient.addColorStop(0.42, "rgba(255,255,255,.07)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createFlareTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!; const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(0.08, "rgba(255,255,255,.82)"); gradient.addColorStop(0.28, "rgba(255,255,255,.35)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}

export default function AivaParticleScene({ state, accentColor, audioLevel, reducedMotion, brain, executing }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const accentRef = useRef(accentColor);
  const brainRef = useRef(brain);
  const executingRef = useRef(executing);
  brainRef.current = brain; executingRef.current = executing;
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { accentRef.current = accentColor; }, [accentColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, reducedMotion ? 1 : 1.65));
    renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 30); camera.position.z = 6.8;
    const orb = new THREE.Group(); orb.scale.setScalar(1.05); scene.add(orb);
    const uniforms = { uTime: { value: 0 }, uActivity: { value: 0.2 }, uAudio: { value: 0 }, uGlow: { value: 0.8 }, uPointer: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(accentColor) } };
    const shellGeometry = new THREE.SphereGeometry(1.42, 128, 96);
    const shellMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: shellVertex, fragmentShader: shellFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    orb.add(new THREE.Mesh(shellGeometry, shellMaterial));
    const coreGeometry = new THREE.IcosahedronGeometry(0.58, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: accentColor, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(coreGeometry, coreMaterial); orb.add(core);
    const ringGeometry = new THREE.TorusGeometry(1.62, 0.005, 6, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.rotation.x = 1.12; orb.add(ring);
    const ribbons = Array.from({ length: 5 }, (_, index) => makeRibbon(index, new THREE.Color(accentColor)));
    const lowerRibbons = [0, 1].map((index) => makeRibbon(index, new THREE.Color(accentColor), true));
    ribbons.forEach((ribbon, index) => { ribbon.rotation.set(index * 0.08 - 0.22, index * 0.19, index * 0.055 - 0.18); orb.add(ribbon); });
    lowerRibbons.forEach((ribbon, index) => { ribbon.rotation.set(0.03 + index * 0.025, index * 0.035 - 0.04, index * 0.018); orb.add(ribbon); });
    const auraMaterial = new THREE.SpriteMaterial({ map: createAuraTexture(), color: new THREE.Color(accentColor), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    const aura = new THREE.Sprite(auraMaterial); aura.scale.set(4.35, 4.35, 1); aura.position.z = -0.7; scene.add(aura);
    const flareMaterial = new THREE.SpriteMaterial({ map: createFlareTexture(), color: new THREE.Color(accentColor), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.72 });
    const flare = new THREE.Sprite(flareMaterial); flare.scale.set(0.72, 0.5, 1); flare.position.set(-0.72, -0.89, 1.18); orb.add(flare);
    const pointerTarget = new THREE.Vector2(); const pointer = new THREE.Vector2();
    const move = (event: PointerEvent) => { const b = mount.getBoundingClientRect(); pointerTarget.set((event.clientX - b.left) / b.width * 2 - 1, -((event.clientY - b.top) / b.height * 2 - 1)); };
    const leave = () => pointerTarget.set(0, 0);
    mount.addEventListener("pointermove", move); mount.addEventListener("pointerleave", leave);
    const resize = () => { const w = Math.max(1, mount.clientWidth); const h = Math.max(1, mount.clientHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    const clock = new THREE.Clock(); let frame = 0; let coreMix = 0;
    const render = () => {
      frame = requestAnimationFrame(render); if (document.hidden) return;
      const time = clock.getElapsedTime(); const preset = getAivaStatePresets(accentRef.current)[stateRef.current]; const ease = reducedMotion ? 0.03 : 0.055;
      const activeColor = new THREE.Color(accentRef.current);
      coreMix = THREE.MathUtils.lerp(coreMix, brainRef.current === "mark-ii" ? 1 : 0, reducedMotion ? 1 : 0.045);
      coreMaterial.color.lerp(activeColor, ease); ringMaterial.color.lerp(activeColor, ease);
      coreMaterial.opacity = coreMix * (executingRef.current ? 0.24 : 0.12);
      ringMaterial.opacity = coreMix * 0.2;
      if (!reducedMotion) { core.rotation.y = time * (executingRef.current ? 0.35 : 0.12); core.rotation.z = Math.sin(time * 0.15) * 0.3; ring.rotation.z = time * 0.08; }
      uniforms.uTime.value = time; uniforms.uActivity.value = THREE.MathUtils.lerp(uniforms.uActivity.value, preset.turbulence, ease); uniforms.uAudio.value = audioLevel.current; uniforms.uGlow.value = THREE.MathUtils.lerp(uniforms.uGlow.value, preset.glow, ease); uniforms.uColor.value.lerp(activeColor, ease);
      pointer.lerp(pointerTarget, 0.035); uniforms.uPointer.value.copy(pointer);
      orb.rotation.y = Math.sin(time * 0.16) * 0.14 + pointer.x * 0.13; orb.rotation.x = Math.cos(time * 0.13) * 0.045 - pointer.y * 0.08;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.72) * 0.012 + audioLevel.current * 0.045; orb.scale.setScalar((1.05 + coreMix * 0.035) * pulse);
      ribbons.forEach((ribbon, index) => { ribbon.rotation.y += (0.0002 + index * 0.00004) * (reducedMotion ? 0.1 : 1); const material = ribbon.material as THREE.MeshBasicMaterial; material.color.lerp(activeColor, ease); material.opacity = 0.018 + preset.glow * 0.024 + audioLevel.current * 0.05; });
      lowerRibbons.forEach((ribbon, index) => { ribbon.position.y = Math.sin(time * 0.22 + index) * 0.018; const material = ribbon.material as THREE.MeshBasicMaterial; material.color.lerp(activeColor, ease); material.opacity = (index === 1 ? 0.16 : 0.1) + preset.glow * 0.08 + audioLevel.current * 0.14; });
      auraMaterial.color.lerp(activeColor, ease); flareMaterial.color.lerp(activeColor, ease);
      flareMaterial.opacity = 0.48 + Math.sin(time * 1.05) * 0.1 + audioLevel.current * 0.28;
      auraMaterial.opacity = 0.1 + preset.glow * 0.045 + audioLevel.current * 0.06; renderer.render(scene, camera);
    }; render();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mount.removeEventListener("pointermove", move); mount.removeEventListener("pointerleave", leave);
      shellGeometry.dispose(); shellMaterial.dispose(); [...ribbons, ...lowerRibbons].forEach((ribbon) => { ribbon.geometry.dispose(); (ribbon.material as THREE.Material).dispose(); });
      coreGeometry.dispose(); coreMaterial.dispose(); ringGeometry.dispose(); ringMaterial.dispose();
      auraMaterial.map?.dispose(); auraMaterial.dispose(); flareMaterial.map?.dispose(); flareMaterial.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [audioLevel, reducedMotion]);
  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
