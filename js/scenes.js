/* ============================================================
 * js/scenes.js · 14 天 Three.js 真 3D 场景（《背景.docx》逐条对齐）
 * 一个房间，十四天往里放东西：Day N = 房间 + Day1..N 全部物体（累积）
 * 当日新物体执行机关（完成后 resolve → engine showComplete）
 * 旧物体点击 = 回看（镜头推近 + 句子 + 点空白返回，不重复计数）
 * 所有文字用 DOM 毛玻璃框，按物体屏幕投影定位（第五节 5.4）
 * 声音：window.AudioEngine（js/audio.js）
 * ============================================================ */
import * as THREE from 'three';
import { Room3D } from './room3d.js';

const A = window.AudioEngine;
const T = THREE;
const gsap = window.gsap;

/* —— 十四句（背景.docx 第四节，唯一权威） —— */
const SENT = [
  '灯我给你留着。回来就有。',
  '我先来过了。你别急，慢慢来。',
  '这条路我走过，绕了点。但到了。',
  '你往上走。我就在下面，哪儿也不去。',
  '它坐在这儿陪你。我先去给你倒杯水。',
  '背面有句话。你转过去，就当我小声说的。',
  '你听见响，就是我喊你了。不用应，我知道你在。',
  '我不在的时候，影子替我陪你一会儿。',
  '我们俩，一开始也对不上。现在挺好。',
  '星星罐摔过。我一颗颗捡的，一颗没少。你别哭。',
  '缺的那几块，我找回来了。都在这儿。',
  '你走一步，我跟一步。回头也行，我在。',
  '走到这儿回头看，才发现，我们已经这么远了。',
  '生日快乐。星星在，企鹅在，我一直在。'
];

/* ============================================================
 * 公共：毛玻璃文字框（5.4 / 用户 CSS 硬规格）
 * ============================================================ */
let lineEl = null;
function ensureLine() {
  if (lineEl) return lineEl;
  lineEl = document.createElement('div');
  lineEl.className = 'scene-text';
  lineEl.style.position = 'absolute';
  lineEl.style.zIndex = '30';
  lineEl.style.pointerEvents = 'none';
  lineEl.style.opacity = '0';
  const holder = document.getElementById('stage3d');
  (holder && holder.parentElement ? holder.parentElement : document.body).appendChild(lineEl);
  return lineEl;
}
function showLine(text, mesh, align) {
  const el = ensureLine();
  el.innerHTML = '';
  (Array.isArray(text) ? text : [text]).forEach((t, i) => {
    const p = document.createElement('p');
    p.textContent = t;
    p.style.margin = '0 0 ' + (i < (Array.isArray(text) ? text : [text]).length - 1 ? '0.7em' : '0');
    el.appendChild(p);
  });
  // 极淡小字指引：Day N
  const d = window.__currentDay || 0;
  if (d) {
    const tag = document.createElement('div');
    tag.className = 'scene-text-day';
    tag.textContent = 'Day ' + d;
    el.appendChild(tag);
  }
  el.style.display = 'block';
  el.style.opacity = '0';
  const cw = Room3D.containerWidth(), ch = Room3D.containerHeight();
  const p = Room3D.project(mesh);
  if (p) {
    const w = el.offsetWidth || 220, h = el.offsetHeight || 42;
    const side = align || (p.x < cw / 2 ? 'right' : 'left');
    const gap = 56;
    if (side === 'right') {
      el.style.left = Math.min(p.x + gap, cw - w - 16) + 'px';
      el.style.transform = 'translateX(-12px)';
    } else {
      el.style.left = Math.max(p.x - gap - w, 16) + 'px';
      el.style.transform = 'translateX(12px)';
    }
    el.style.top = Math.min(Math.max(p.y - h / 2, 12), ch - h - 12) + 'px';
  }
  gsap.to(el, { opacity: 1, duration: 0.8, ease: 'power2.out', onComplete: () => { el.style.transform = ''; } });
}
function hideLine() {
  if (!lineEl) return;
  gsap.to(lineEl, { opacity: 0, duration: 0.5, ease: 'power2.in',
    onComplete: () => { lineEl.style.display = 'none'; } });
}

function pulse(mesh, k = 1.08) {
  if (!mesh) return;
  gsap.killTweensOf(mesh.scale);
  const sx = mesh.userData._sx || mesh.scale.x, sy = mesh.userData._sy || mesh.scale.y, sz = mesh.userData._sz || mesh.scale.z;
  gsap.fromTo(mesh.scale, { x: sx, y: sy, z: sz },
    { x: sx * k, y: sy * k, z: sz * k, duration: 0.3, ease: 'power2.out',
      onComplete: () => gsap.to(mesh.scale, { x: sx, y: sy, z: sz, duration: 0.4, ease: 'power2.inOut' }) });
}
function storeScale(mesh) {
  if (mesh && !mesh.userData._sx) {
    mesh.userData._sx = mesh.scale.x; mesh.userData._sy = mesh.scale.y; mesh.userData._sz = mesh.scale.z;
  }
  return mesh;
}
function floaty(mesh, ampY = 0.05, ampR = 0, dur = 3) {
  storeScale(mesh);
  const oy = mesh.position.y, oz = mesh.rotation.z;
  Room3D.addAnim((dt, t) => {
    if (!mesh.parent) return;
    mesh.position.y = oy + Math.sin(t * (2 * Math.PI / dur)) * ampY;
    if (ampR) mesh.rotation.z = oz + Math.sin(t * (2 * Math.PI / dur) * 0.5) * ampR;
  });
}
function breathe(mesh, baseInt, amp, dur = 5) {
  if (!mesh.material) return;
  Room3D.addAnim((dt, t) => {
    if (!mesh.parent) return;
    mesh.material.emissiveIntensity = baseInt + Math.sin(t * (2 * Math.PI / dur)) * amp;
  });
}
let blankEnabled = true;   // Day14 起禁用点空白返回（6.6）
function bindBlank(stage) {
  stage.addEventListener('pointerdown', () => {
    setTimeout(() => {
      if (Room3D.consumeLastHit()) return;
      hideLine();
      if (blankEnabled) Room3D.defocus(1.5);
    }, 0);
  });
}
function rise(mesh, fromY, toY, dur = 1.8, delay = 0) {
  mesh.position.y = fromY;
  const mat = mesh.material;
  if (mat && !mat.transparent) mat.transparent = true;
  if (mat) mat.opacity = 0;
  gsap.to(mesh.position, { y: toY, duration: dur, delay, ease: 'power2.out' });
  if (mat) gsap.to(mat, { opacity: 1, duration: dur, delay, ease: 'power2.out' });
}
function zoomTo(z, dur = 1.2, ease = 'power2.inOut') {
  gsap.killTweensOf(Room3D.camera);
  return new Promise(r => gsap.to(Room3D.camera, {
    zoom: z, duration: dur, ease,
    onUpdate: () => Room3D.camera.updateProjectionMatrix(), onComplete: r
  }));
}
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const pickId = (n) => 'd' + n;

/* ============================================================
 * 每日物体构建（累积：buildAll(day) 建 Day1..day）
 * 每个物体：几何 + pick 注册；当日机关完成 → resolveDay()
 * ============================================================ */
let resolver = null;
function resolveDay(n) {
  if (resolver) { const r = resolver; resolver = null; setTimeout(r, 250); }
}

/* Day 1 · 灯（常驻，房间初始即有） */
function buildLamp(day, grp) {
  const wick = Room3D.scene.getObjectByName('lamp-wick');
  const halo = Room3D.scene.getObjectByName('lamp-halo');
  if (!wick) return;
  storeScale(wick);
  wick.userData.pickId = pickId(1);
  Room3D.addPick(wick, pickId(1), (mesh) => {
    pulse(mesh, 1.12);
    A.tone(196, { type: 'triangle', dur: 0.5, vol: 0.12 });      // 点火
    A.tone(523, { type: 'sine', dur: 1.2, vol: 0.08, when: 0.06 });
    showLine(SENT[0], wick);
    Room3D.focus(wick, 2.8, new THREE.Vector3(0, 2.74, -5.0), 1.8, () => {
      if (day !== 1) return;
      const s0 = wick.material.emissiveIntensity;
      gsap.to(wick.material, { emissiveIntensity: 3.4, duration: 0.35, yoyo: true, repeat: 1,
        onComplete: () => gsap.to(wick.material, { emissiveIntensity: s0, duration: 1.2 }) });
      if (halo) gsap.fromTo(halo.scale, { x: 1, y: 1, z: 1 },
        { x: 1.9, y: 1.9, z: 1.9, duration: 0.5, yoyo: true, repeat: 1 });
      resolveDay(1);
    });
  });
}

/* Day 2 · 纸条（桌上灯旁，浮上 + 展开露折痕） */
function buildNote(day, grp) {
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(0.62, 0.04, 0.46),
    new T.MeshStandardMaterial({ color: 0xEDE6DA, roughness: 0.6, metalness: 0.02 }));
  const crease = new T.Mesh(new T.BoxGeometry(0.006, 0.05, 0.5),
    new T.MeshStandardMaterial({ color: 0x8A8578, roughness: 1 }));
  g.add(body, crease);
  g.position.set(0.95, 2.28, -4.95);
  grp.add(g);
  storeScale(g);
  g.userData.pickId = pickId(2);
  if (day === 2) rise(g, 1.8, 2.28); else g.position.y = 2.28;
  floaty(g, 0.03);
  Room3D.addPick(g, pickId(2), (mesh) => {
    pulse(mesh, 1.1);
    A.paper();
    showLine(SENT[1], g);
    Room3D.focus(g, 2.7, new THREE.Vector3(0.95, 2.3, -4.95), 1.8, () => {
      if (day !== 2) return;
      gsap.to(g.rotation, { z: -0.55, duration: 0.6, ease: 'power2.out' });
      gsap.to(crease.scale, { y: 1.7, duration: 0.8, ease: 'power2.out' });
      A.paper();
      delay(1000).then(() => resolveDay(2));
    });
  });
}

/* Day 3 · 南墙光描门形（墙里显影） */
function buildDoorMark(day, grp) {
  const g = new T.Group();
  const frame = new T.Mesh(new T.BoxGeometry(1.7, 3.4, 0.06),
    new T.MeshStandardMaterial({ color: 0x1A1E2A, emissive: 0xFFD9A0, emissiveIntensity: 0, transparent: true, opacity: 0.92, roughness: 0.8 }));
  const inner = new T.Mesh(new T.PlaneGeometry(1.3, 2.9),
    new T.MeshStandardMaterial({ color: 0xFFD9A0, emissive: 0xFFD9A0, emissiveIntensity: 0, transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false }));
  inner.position.z = 0.02;
  g.add(frame, inner);
  g.position.set(-3.2, 3.2, -5.7);
  grp.add(g);
  storeScale(g);
  g.userData.pickId = pickId(3);
  if (day === 3) {
    gsap.fromTo(frame.material, { emissiveIntensity: 0 }, { emissiveIntensity: 0.55, duration: 1.8, ease: 'power2.out' });
    gsap.fromTo(inner.material, { emissiveIntensity: 0, opacity: 0 }, { emissiveIntensity: 0.5, opacity: 0.05, duration: 1.8, ease: 'power2.out' });
  } else {
    frame.material.emissiveIntensity = 0.55; inner.material.opacity = 0.05;
  }
  floaty(g, 0.025, 0, 4);
  Room3D.addPick(g, pickId(3), (mesh) => {
    pulse(mesh, 1.06);
    A.lowHum(1.6, 0.08);
    showLine(SENT[2], g);
    Room3D.focus(g, 2.5, new THREE.Vector3(-3.2, 3.2, -5.7), 1.8, () => {
      if (day !== 3) return;
      gsap.to(frame.material, { emissiveIntensity: 1.15, duration: 0.5, yoyo: true, repeat: 1 });
      delay(1200).then(() => resolveDay(3));
    });
  });
}

/* Day 4 · 桌脚旁三级小台阶（依次升起/点亮） */
function buildSteps(day, grp) {
  const g = new T.Group();
  const tiers = [];
  const mat = new T.MeshStandardMaterial({ color: 0x4A4E5C, roughness: 0.65, metalness: 0.2 });
  const defs = [
    { y: 0.06, z: -4.05, s: 0.62 },
    { y: 0.19, z: -4.22, s: 0.5 },
    { y: 0.32, z: -4.39, s: 0.38 }
  ];
  defs.forEach((s, i) => {
    const b = new T.Mesh(new T.BoxGeometry(s.s, 0.13, s.s * 0.72), mat.clone());
    b.position.set(-1.9, s.y, s.z);
    b.castShadow = b.receiveShadow = true;
    g.add(b); tiers.push(b);
  });
  grp.add(g);
  g.userData.pickId = pickId(4);
  const anchor = tiers[1];
  storeScale(anchor);
  if (day === 4) tiers.forEach((t, i) => rise(t, -0.2, t.position.y, 0.6, i * 0.35));
  Room3D.addPick(g, pickId(4), (mesh) => {
    pulse(anchor, 1.08);
    A.step(); delay(150).then(() => A.step()); delay(300).then(() => A.step());
    showLine(SENT[3], anchor);
    Room3D.focus(anchor, 2.6, new THREE.Vector3(-1.9, 0.35, -4.2), 1.8, () => {
      if (day !== 4) return;
      tiers.forEach((t, i) => {
        t.material.emissive.set(0xFFD9A0);
        gsap.to(t.material, { emissiveIntensity: 0.5, duration: 0.4, delay: i * 0.35 });
      });
      delay(1500).then(() => resolveDay(4));
    });
  });
}

/* Day 5 · 南墙小拱窗 + 窗台企鹅（半透明/窗外星光） */
function buildPenguin(day, grp) {
  const g = new T.Group();
  const winMat = new T.MeshStandardMaterial({ color: 0x0E1220, emissive: 0xA8B8D8, emissiveIntensity: 0, roughness: 0.6, metalness: 0.1 });
  const arch = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 1.1, 20, 1, true, 0, Math.PI), winMat);
  arch.rotation.z = Math.PI / 2; arch.position.set(0, 0.55, 0.02);
  const rect = new T.Mesh(new T.PlaneGeometry(1.1, 0.9), winMat);
  rect.position.set(0, -0.28, 0.02);
  const sill = new T.Mesh(new T.BoxGeometry(1.5, 0.1, 0.22), new T.MeshStandardMaterial({ color: 0x2A3042, roughness: 0.7 }));
  sill.position.set(0, -0.78, 0.04);
  const stars = new T.Points(starGeo(18, 0.12),
    new T.PointsMaterial({ color: 0xA8B8D8, size: 0.06, transparent: true, opacity: 0, depthWrite: false }));
  stars.position.set(0, 0, -0.12);
  g.add(arch, rect, sill, stars);
  const pg = (window.__glbModels && window.__glbModels.penguin) ? (() => {
    // CC0 帝企鹅 GLB（3dassets.dev）：等比缩放到高 0.85，站窗台
    const g = window.__glbModels.penguin.scene.clone();
    const box = new T.Box3().setFromObject(g);
    const sz = box.getSize(new T.Vector3());
    const s = 0.85 / sz.y;
    g.scale.multiplyScalar(s);
    g.position.y -= box.min.y * s;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  })() : (() => {
    const g = new T.Group();
    const pMat = new T.MeshStandardMaterial({ color: 0x1B1E2A, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.85 });
    const bellyM = new T.MeshStandardMaterial({ color: 0xD8DCE6, roughness: 0.6, transparent: true, opacity: 0.8 });
    const beakM = new T.MeshStandardMaterial({ color: 0xE8A34C, roughness: 0.4 });
    const body = new T.Mesh(new T.SphereGeometry(0.24, 14, 10), pMat);
    body.scale.set(0.72, 1, 0.72); body.position.y = 0.28;
    const chest = new T.Mesh(new T.SphereGeometry(0.15, 12, 8), bellyM);
    chest.scale.set(0.62, 0.9, 0.62); chest.position.set(0, 0.24, 0.1);
    const head = new T.Mesh(new T.SphereGeometry(0.13, 12, 8), pMat);
    head.position.y = 0.56;
    const beak = new T.Mesh(new T.ConeGeometry(0.035, 0.12, 6), beakM);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.55, 0.11);
    const footL = new T.Mesh(new T.BoxGeometry(0.09, 0.04, 0.16), beakM); footL.position.set(-0.09, 0.02, 0.06);
    const footR = footL.clone(); footR.position.x = 0.09;
    g.add(body, chest, head, beak, footL, footR);
    return g;
  })();
  pg.position.set(0, -0.68, 0.18);
  g.add(pg);
  g.position.set(0.6, 5.5, -5.85);
  grp.add(g);
  storeScale(pg);
  pg.userData.pickId = pickId(5);
  if (day === 5) {
    gsap.fromTo(winMat, { emissiveIntensity: 0 }, { emissiveIntensity: 0.32, duration: 1.4 });
    gsap.fromTo(stars.material, { opacity: 0 }, { opacity: 0.9, duration: 1.4, delay: 0.4 });
    rise(pg, 4.4, -0.68, 1.8, 0.6);
  } else {
    winMat.emissiveIntensity = 0.32; stars.material.opacity = 0.9;
  }
  floaty(pg, 0.035, 0.02);
  Room3D.addPick(pg, pickId(5), (mesh) => {
    pulse(mesh, 1.08);
    A.wind(0.05);
    showLine(SENT[4], pg);
    Room3D.focus(pg, 3.0, new THREE.Vector3(0.6, 5.3, -5.9), 1.8, () => {
      if (day !== 5) return;
      gsap.to(pg.rotation, { z: 0.09, duration: 0.3, yoyo: true, repeat: 5, ease: 'sine.inOut' });
      gsap.to(stars.material, { opacity: 1.2, duration: 0.4, yoyo: true, repeat: 2 });
      delay(1300).then(() => resolveDay(5));
    });
  });
}
function starGeo(n, r) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i*3] = (Math.random() - 0.5) * 1.6;
    pos[i*3+1] = (Math.random() - 0.5) * 1.3;
    pos[i*3+2] = (Math.random() - 0.5) * 0.2;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  return geo;
}

/* Day 6 · 南墙右侧转动墙板（180°，背面凹槽） */
function buildPanel(day, grp) {
  const g = new T.Group();
  const panel = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 0.12),
    new T.MeshStandardMaterial({ color: 0x1A1E2A, roughness: 0.88, metalness: 0.06 }));
  const slot = new T.Mesh(new T.BoxGeometry(0.34, 0.5, 0.05),
    new T.MeshStandardMaterial({ color: 0x05060B, roughness: 1, emissive: 0xFFD9A0, emissiveIntensity: 0 }));
  slot.position.set(0, 0, -0.09);
  g.add(panel, slot);
  g.position.set(3.1, 2.9, -5.55);
  grp.add(g);
  storeScale(g);
  g.userData.pickId = pickId(6);
  if (day === 6) gsap.fromTo(g.position, { z: -5.72 }, { z: -5.55, duration: 1.6, ease: 'power2.out' });
  Room3D.addPick(g, pickId(6), (mesh) => {
    pulse(mesh, 1.05);
    A.lowHum(2.0, 0.06);
    showLine(SENT[5], g);
    Room3D.focus(g, 2.4, new THREE.Vector3(3.1, 2.9, -5.55), 1.4, () => {
      if (day !== 6) return;
      gsap.to(g.rotation, { y: Math.PI, duration: 2.2, ease: 'power2.inOut', onComplete: () => {
        gsap.to(slot.material, { emissiveIntensity: 0.7, duration: 0.8 });
        A.lowHum(1.2, 0.05);
        showLine(SENT[5], g);
        zoomTo(2.8, 1.2).then(() => delay(900).then(() => resolveDay(6)));
      } });
    });
  });
}

/* Day 7 · 房间中央上方风铃（五片薄片细线吊挂，缓慢轻晃） */
function buildChimes(day, grp) {
  const g = new T.Group();
  const discs = [];
  const notes = [523, 587, 659, 698, 784];
  const cols = [0xC8B18A, 0xB7A583, 0xA99B7E, 0xBFAD86, 0xAE9C7C];
  for (let i = 0; i < 5; i++) {
    const dg = new T.Group();
    const wire = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 1.5, 4),
      new T.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.7 }));
    wire.position.y = 0.75;
    const disc = new T.Mesh(new T.BoxGeometry(0.28, 0.045, 0.11),
      new T.MeshStandardMaterial({ color: cols[i], roughness: 0.45, metalness: 0.35, transparent: true, opacity: 0.9 }));
    dg.add(wire, disc);
    dg.position.set((i - 2) * 0.42, 0, Math.sin(i) * 0.12);
    g.add(dg); discs.push(dg);
  }
  g.position.set(0, 5.3, -4.6);
  grp.add(g);
  storeScale(g);
  g.userData.pickId = pickId(7);
  if (day === 7) rise(g, 6.8, 5.3); else g.position.y = 5.3;
  floaty(g, 0.05, 0, 3.6);
  Room3D.addAnim((dt, t) => {
    discs.forEach((d, i) => { if (d.parent) d.rotation.z = Math.sin(t * 1.1 + i * 1.3) * 0.09; });
  });
  Room3D.addPick(g, pickId(7), (mesh) => {
    pulse(mesh, 1.04);
    showLine(SENT[6], g);
    Room3D.focus(g, 2.6, new THREE.Vector3(0, 5.3, -4.6), 1.8, () => {
      if (day !== 7) return;
      discs.forEach((d, i) => {
        const m = d.children[1].material;
        gsap.to(m, { emissiveIntensity: 1.2, duration: 0.3, delay: i * 0.45, yoyo: true, repeat: 1 });
        A.musicBox(notes[i], { dur: 1.8, vol: 0.1, when: i * 0.45 });
      });
      delay(500 + 5 * 450).then(() => resolveDay(7));
    });
  });
}

/* —— 累积构建 Day1..day —— */
function buildAll(day) {
  const grp = Room3D.beginDay();
  buildLamp(day, grp);
  const builders = { 2: buildNote, 3: buildDoorMark, 4: buildSteps, 5: buildPenguin, 6: buildPanel, 7: buildChimes };
  for (let i = 2; i <= day; i++) builders[i](day, grp);
  return grp;
}

/* —— 出口：window.Scenes（Day1–7） —— */
window.Scenes = {};
document.addEventListener('DOMContentLoaded', () => bindBlank(document.getElementById('stage3d')));
function makeDay(d) {
  window.Scenes[d] = () => {
    blankEnabled = true;
    resolver = null;
    buildAll(d);
    return new Promise(res => {
      resolver = () => { const r = res; resolver = null; setTimeout(r, 250); };
    });
  };
}
[1,2,3,4,5,6,7].forEach(makeDay);

/* ============================================================
 * Day 8 · 南墙斜影子（灯照不到的一侧，指向墙角）
 * ============================================================ */
function buildShadow(day, grp) {
  const g = new T.Group();
  const shape = new T.Shape();
  shape.moveTo(0, 0); shape.lineTo(1.5, 0.25); shape.lineTo(1.7, 1.5);
  shape.lineTo(1.0, 1.05); shape.lineTo(0.2, 1.45); shape.closePath();
  const geo = new T.ShapeGeometry(shape);
  const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
  const shadow = new T.Mesh(geo, mat);
  shadow.position.set(-2.4, 2.6, -5.88);
  shadow.rotation.y = 0.18;   // 斜指向墙角
  g.add(shadow);
  // 墙角细缝透光
  const crackMat = new T.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0, depthWrite: false });
  const crack = new T.Mesh(new T.PlaneGeometry(0.5, 0.035), crackMat);
  crack.rotation.y = -Math.PI / 2;
  crack.position.set(-5.7, 0.35, -5.6);
  g.add(crack);
  g.position.set(0, 0, 0);
  grp.add(g);
  storeScale(shadow);
  shadow.userData.pickId = pickId(8);
  if (day === 8) {
    gsap.fromTo(mat, { opacity: 0 }, { opacity: 0.42, duration: 1.8, ease: 'power2.out' });
  }
  Room3D.addPick(shadow, pickId(8), (mesh) => {
    pulse(mesh, 1.05);
    A.lowHum(1.6, 0.07);
    showLine(SENT[7], mesh);
    Room3D.focus(mesh, 2.5, new THREE.Vector3(-2.4, 2.6, -5.88), 1.8, () => {
      if (day !== 8) return;
      gsap.to(mat, { opacity: 0.6, duration: 0.6, yoyo: true, repeat: 1 });
      gsap.to(crackMat, { opacity: 0.5, duration: 0.9 });
      A.tone(220, { type: 'sine', dur: 1.4, vol: 0.06 });
      delay(1400).then(() => resolveDay(8));
    });
  });
}

/* ============================================================
 * Day 9 · 桌上两块（差一点对不上 → 翻合，接缝发光）
 * ============================================================ */
function buildMerge(day, grp) {
  const g = new T.Group();
  const matA = new T.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.7, metalness: 0.1 });
  const matB = new T.MeshStandardMaterial({ color: 0xA89F8B, roughness: 0.7, metalness: 0.1 });
  const blockA = new T.Mesh(new T.BoxGeometry(0.52, 0.3, 0.36), matA);
  blockA.position.set(-1.05, 2.3, -5.0);
  const B = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.3, 6), matB);
  B.position.set(-1.62, 2.3, -5.0);
  B.rotation.y = 0.4;
  // 接缝发光片（合上后亮）
  const seam = new T.Mesh(new T.PlaneGeometry(0.5, 0.35),
    new T.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
  seam.position.set(-1.33, 2.3, -5.02);
  g.add(blockA, B, seam);
  g.position.set(0, 0, 0);
  grp.add(g);
  storeScale(blockA); storeScale(B);
  blockA.userData.pickId = pickId(9);
  if (day === 9) { rise(blockA, 1.9, 2.3, 1.8); rise(B, 1.9, 2.3, 1.8, 0.15); }
  Room3D.addPick(blockA, pickId(9), (mesh) => {
    pulse(mesh, 1.06);
    showLine(SENT[8], blockA);
    Room3D.focus(blockA, 2.5, new THREE.Vector3(-1.33, 2.3, -5.0), 1.4, () => {
      if (day !== 9) return;
      const targetX = -1.05;
      gsap.to(B.position, { x: targetX, duration: 1.0, ease: 'power2.inOut' });
      gsap.to(B.rotation, { y: 0, duration: 1.0, ease: 'power2.inOut',
        onComplete: () => {
          gsap.to(seam.material, { opacity: 0.9, duration: 0.5 });
          A.tone(660, { type: 'triangle', dur: 0.5, vol: 0.14 });          // 干净的“合”
          A.tone(990, { type: 'sine', dur: 1.0, vol: 0.08, when: 0.08 });
          zoomTo(2.8, 1.2).then(() => delay(1000).then(() => resolveDay(9)));
        } });
    });
  });
}

/* ============================================================
 * Day 10 · 桌下小井 + 井底灯 + 星星罐（情绪高点：镜头下沉/星星亮/音乐响）
 * ============================================================ */
function buildWell(day, grp) {
  const g = new T.Group();
  // 井口细光圈
  const ringMat = new T.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0, depthWrite: false });
  const ring = new T.Mesh(new T.TorusGeometry(0.78, 0.045, 8, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.06, -4.2);
  // 井壁 + 内壁台阶
  const wallMat = new T.MeshStandardMaterial({ color: 0x232B3C, roughness: 0.85, metalness: 0.1, side: T.DoubleSide });
  const wall = new T.Mesh(new T.CylinderGeometry(0.62, 0.78, 1.2, 20, 1, true), wallMat);
  wall.position.set(0, -0.54, -4.2);
  // 4 级内台阶（圆环依次下缩）
  const tiers = [];
  [0, 1, 2, 3].forEach(i => {
    const t = new T.Mesh(new T.TorusGeometry(0.72 - i * 0.13, 0.05, 6, 20),
      new T.MeshStandardMaterial({ color: 0x2A3042, roughness: 0.8 }));
    t.rotation.x = -Math.PI / 2;
    t.position.set(0, -0.25 - i * 0.26, -4.2);
    g.add(t); tiers.push(t);
  });
  // 井底小灯
  const bottomLamp = new T.Mesh(new T.SphereGeometry(0.09, 10, 8),
    new T.MeshStandardMaterial({ color: 0xFFD9A0, emissive: 0xFFD9A0, emissiveIntensity: 0, roughness: 0.4 }));
  bottomLamp.position.set(0, -1.18, -4.2);
  const bottomHalo = new T.Mesh(new T.SphereGeometry(0.4, 10, 8),
    new T.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0, depthWrite: false }));
  bottomHalo.position.copy(bottomLamp.position);
  // 星星罐（罐身 + 裂痕 + 星星）
  const jar = new T.Group();
  const jarBody = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.4, 12, 1, true),
    new T.MeshStandardMaterial({ color: 0x4A78C8, transparent: true, opacity: 0.75, roughness: 0.4, metalness: 0.15, side: T.DoubleSide }));
  jarBody.position.y = 0.1;
  const jarLid = new T.Mesh(new T.CylinderGeometry(0.21, 0.21, 0.05, 12),
    new T.MeshStandardMaterial({ color: 0x8A8578, roughness: 0.5 }));
  jarLid.position.y = 0.32;
  // 裂痕（3 条细线）
  const crackMats = [];
  [[0.05, -0.05, 0.5], [-0.03, 0.02, 0.42], [0.1, 0.12, 0.35]].forEach(c => {
    const cm = new T.Mesh(new T.BoxGeometry(0.012, c[2], 0.008),
      new T.MeshStandardMaterial({ color: 0x0A0E1A, roughness: 1 }));
    cm.position.set(c[0], c[1], 0.11);
    jarBody.add(cm);
  });
  jar.add(jarBody, jarLid);
  // 20 颗星星（罐口上方，初始暗）
  const starMat = new T.MeshStandardMaterial({ color: 0x9FC0FF, emissive: 0x9FC0FF, emissiveIntensity: 0, roughness: 0.3 });
  const stars = [];
  for (let i = 0; i < 20; i++) {
    const s = new T.Mesh(new T.OctahedronGeometry(0.035, 0), starMat.clone());
    const a = (i / 20) * Math.PI * 2;
    const rr = 0.28 + (i % 4) * 0.075;
    s.position.set(Math.cos(a) * rr, 0.42 + (i % 5) * 0.05, Math.sin(a) * rr * 0.7);
    stars.push(s);
    jar.add(s);
  }
  jar.position.set(0, -1.12, -4.2);
  jar.rotation.z = 0.15;
  g.add(ring, wall, bottomLamp, bottomHalo, jar);
  g.position.set(0, 0, 0);
  grp.add(g);
  storeScale(ring);
  ring.userData.pickId = pickId(10);
  jar.userData.pickId = 'd10-jar';
  if (day === 10) {
    gsap.fromTo(ringMat, { opacity: 0 }, { opacity: 0.55, duration: 1.8, ease: 'power2.out' });
    gsap.fromTo(bottomLamp.material, { emissiveIntensity: 0 }, { emissiveIntensity: 1.8, duration: 1.6, delay: 0.6 });
    gsap.fromTo(bottomHalo.material, { opacity: 0 }, { opacity: 0.18, duration: 1.6, delay: 0.8 });
  } else {
    ringMat.opacity = 0.55; bottomLamp.material.emissiveIntensity = 1.8; bottomHalo.material.opacity = 0.18;
  }
  breathe(bottomLamp, 1.8, 0.5, 5);
  Room3D.addPick(ring, pickId(10), (mesh) => {
    pulse(mesh, 1.06);
    // 脚步回声越来越近（三声渐近）
    [0, 350, 700].forEach(w => setTimeout(() => A.step(), w));
    showLine([SENT[9].slice(0, SENT[9].lastIndexOf('你别哭。'))], mesh);
    const look = new THREE.Vector3(0, -0.35, -4.2);   // 微微下沉看井底
    Room3D.focus(mesh, 2.4, look, 1.8, () => {});
  });
  Room3D.addPick(jar, 'd10-jar', (mesh) => {
    pulse(mesh, 1.05);
    if (day !== 10) { Room3D.focus(mesh, 3.0, new THREE.Vector3(0, -1.0, -4.2), 1.8); return; }
    // 第二段文字
    showLine(SENT[9], mesh);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= stars.length) { clearInterval(timer); return; }
      gsap.to(stars[i].material, { emissiveIntensity: 1.8, duration: 0.3 });
      A.musicBox(1568 + i * 40, { dur: 0.7, vol: 0.05 });
      i++;
    }, 150);
    A.fullMelody();                                     // 音乐第一次完整响起（三同步）
    zoomTo(3.0, 1.8).then(() => delay(600).then(() => resolveDay(10)));
  });
}

/* ============================================================
 * Day 11 · 桌上六块碎片 → 拼成小窗形轮廓
 * ============================================================ */
function buildShards(day, grp) {
  const g = new T.Group();
  const pieces = [];
  const mat = new T.MeshStandardMaterial({ color: 0xB7A583, roughness: 0.6, metalness: 0.15 });
  // 窗形目标布局（六块）：左右竖条 + 上下横条 + 中间两格
  const target = [
    { x: -0.5, z: 0.0, ry: 0, w: 0.09, h: 0.72, d: 0.05 },
    { x: 0.5, z: 0.0, ry: 0, w: 0.09, h: 0.72, d: 0.05 },
    { x: 0.0, z: 0.36, ry: 0, w: 1.09, h: 0.09, d: 0.05 },
    { x: 0.0, z: -0.36, ry: 0, w: 1.09, h: 0.09, d: 0.05 },
    { x: 0.0, z: 0.0, ry: Math.PI / 4, w: 0.4, h: 0.4, d: 0.05 },
    { x: 0.0, z: 0.0, ry: -Math.PI / 4, w: 0.4, h: 0.4, d: 0.05 }
  ];
  const scatter = [
    { x: -1.2, z: 0.6 }, { x: 1.3, z: -0.5 }, { x: -0.8, z: -0.7 },
    { x: 1.1, z: 0.7 }, { x: 0.2, z: -0.95 }, { x: -0.4, z: 0.95 }
  ];
  target.forEach((t, i) => {
    const p = new T.Mesh(new T.BoxGeometry(t.w, t.h, t.d), mat.clone());
    p.position.set(t.x, 2.3, -4.2 + t.z);
    p.rotation.y = t.ry;
    pieces.push(p);
    g.add(p);
  });
  // 散落初始位置（Day11 时从散落落下的入场动画）
  if (day === 11) {
    pieces.forEach((p, i) => {
      const s = scatter[i];
      gsap.fromTo(p.position,
        { x: s.x, y: 2.6, z: -4.2 + s.z },
        { x: p.position.x, y: 2.3, z: p.position.z, duration: 1.2, delay: i * 0.12, ease: 'power2.out' });
    });
  }
  g.position.set(0, 0, 0);
  grp.add(g);
  storeScale(pieces[0]);
  pieces[0].userData.pickId = pickId(11);
  Room3D.addPick(pieces[0], pickId(11), (mesh) => {
    pulse(mesh, 1.08);
    showLine(SENT[10], mesh);
    Room3D.focus(mesh, 2.5, new THREE.Vector3(0, 2.3, -4.2), 1.4, () => {
      if (day !== 11) return;
      const seq = [2, 3, 0, 1, 4, 5];
      seq.forEach((idx, k) => {
        const p = pieces[idx];
        const t = target[idx];
        setTimeout(() => {
          gsap.to(p.position, { x: t.x, y: 2.3, z: -4.2 + t.z, duration: 0.55, ease: 'power2.inOut' });
          gsap.to(p.rotation, { y: t.ry, duration: 0.55, ease: 'power2.inOut' });
          A.chime('bell');
        }, k * 380);
      });
      setTimeout(() => {
        A.musicBox(523, { dur: 1.6, vol: 0.1 });
        A.musicBox(659, { dur: 1.6, vol: 0.1, when: 0.15 });
        A.musicBox(784, { dur: 1.8, vol: 0.1, when: 0.3 });
        pieces.forEach(p => { p.material.emissive.set(0xFFD9A0); p.material.emissiveIntensity = 0.35; });
        zoomTo(2.8, 1.2).then(() => delay(1200).then(() => resolveDay(11)));
      }, 6 * 380 + 400);
    });
  });
}

/* ============================================================
 * Day 12 · 桌上两个小人（走一步跟一步，合一团光）
 * ============================================================ */
function buildDuo(day, grp) {
  const g = new T.Group();
  // 桌面网格（5×5）
  const gridMat = new T.MeshBasicMaterial({ color: 0x8A8578, transparent: true, opacity: 0.35, depthWrite: false });
  const gridGeo = new T.PlaneGeometry(1.4, 1.4);
  for (let i = 0; i <= 5; i++) {
    const h = new T.Mesh(new T.BoxGeometry(1.4, 0.008, 0.012), gridMat); h.position.set(0, 2.31, -3.46 + i * 0.28);
    const v = new T.Mesh(new T.BoxGeometry(0.012, 0.008, 1.4), gridMat); v.position.set(-0.7 + i * 0.28, 2.31, -3.46);
    g.add(h, v);
  }
  // 小人工厂
  function makeFig(color) {
    const f = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshStandardMaterial({ color, roughness: 0.5 }));
    head.position.y = 0.16;
    const body = new T.Mesh(new T.CylinderGeometry(0.045, 0.06, 0.14, 8), new T.MeshStandardMaterial({ color, roughness: 0.5 }));
    body.position.y = 0.055;
    f.add(head, body);
    return f;
  }
  const warm = makeFig(0xE8A34C);
  const cold = makeFig(0x5A7CC8);
  const GRID = { x0: -0.7, z0: -3.46, step: 0.28 };
  function posOf(cx, cz) { return new T.Vector3(GRID.x0 + cx * GRID.step, 2.3, GRID.z0 + cz * GRID.step); }
  warm.position.copy(posOf(0, 0)); cold.position.copy(posOf(2, 0));
  g.add(warm, cold);
  // 光痕
  const trail = [];
  function markTrail(cx, cz, color) {
    const dot = new T.Mesh(new T.CircleGeometry(0.05, 12),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.copy(posOf(cx, cz)); dot.position.y = 2.32;
    g.add(dot); trail.push(dot);
  }
  g.position.set(0, 0, 0);
  grp.add(g);
  const wPos = { x: 0, z: 0 }, cPos = { x: 2, z: 0 };
  storeScale(warm); storeScale(cold);
  warm.userData.pickId = pickId(12);
  let merged = false;
  function stepDir(dx, dz) {
    if (merged) return;
    const nx = wPos.x + dx, nz = wPos.z + dz;
    if (nx < 0 || nx > 4 || nz < 0 || nz > 4) return;
    A.step(); setTimeout(() => A.step(), 120);
    // 暖先走，冷在原地轻跳回应（"你走一步，我跟一步"）
    gsap.to(warm.position, { x: posOf(nx, nz).x, z: posOf(nx, nz).z, duration: 0.4, ease: 'power2.inOut' });
    wPos.x = nx; wPos.z = nz;
    markTrail(nx, nz, 0xE8A34C);
    gsap.fromTo(cold.scale, { y: 1.28 }, { y: 1, duration: 0.35, ease: 'power2.out' });
    markTrail(cPos.x, cPos.z, 0x5A7CC8);
    // 相遇判定：走到冷所在的格子 → 合一团光
    if (Math.abs(wPos.x - cPos.x) + Math.abs(wPos.z - cPos.z) <= 0) {
      setTimeout(merge, 450);
    }
  }
  function merge() {
    if (merged) return; merged = true;
    A.tone(523, { type: 'sine', dur: 1.4, vol: 0.12 });
    A.tone(784, { type: 'sine', dur: 1.6, vol: 0.1, when: 0.2 });
    gsap.to(warm.scale, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.inOut' });
    gsap.to(cold.scale, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power2.inOut', delay: 0.1 });
    const mid = posOf(wPos.x, wPos.z).clone().add(posOf(cPos.x, cPos.z)).multiplyScalar(0.5);
    const glow = new T.Mesh(new T.SphereGeometry(0.16, 14, 10),
      new T.MeshStandardMaterial({ color: 0xFFD9A0, emissive: 0xFFD9A0, emissiveIntensity: 1.8 }));
    glow.position.copy(mid); glow.position.y = 2.4;
    g.add(glow);
    breathe(glow, 1.8, 0.6, 4);
    Room3D.focus(glow, 2.6, mid.clone().add(new THREE.Vector3(0, 0.1, 0)), 1.6, () => {
      if (day === 12) delay(900).then(() => resolveDay(12));
    });
  }
  // 方向按钮（DOM，场景结束即移除）
  const btns = document.createElement('div');
  btns.className = 'fig-btns';
  btns.innerHTML =
    '<button data-d="-1,0">←</button><button data-d="0,-1">↑</button>' +
    '<button data-d="0,1">↓</button><button data-d="1,0">→</button>';
  btns.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const [dx, dz] = b.dataset.d.split(',').map(Number);
    stepDir(dx, dz);
  }));
  const stage = document.getElementById('stage3d');
  stage.appendChild(btns);
  const keyFn = (e) => {
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (m) { e.preventDefault(); stepDir(m[0], m[1]); }
  };
  window.addEventListener('keydown', keyFn);
  // 场景结束时清理（engine 会调用 Scenes cleanup？用解析时清理）
  const done = () => { btns.remove(); window.removeEventListener('keydown', keyFn); };
  window.__duoCleanup = done;
  Room3D.addPick(warm, pickId(12), (mesh) => {
    pulse(mesh, 1.1);
    showLine(SENT[11], mesh);
    Room3D.focus(mesh, 2.6, posOf(1, 0), 1.6, () => {});
  });
}

/* ============================================================
 * Day 13 · 墙上三扇小门（门后透光，开门回响）
 * ============================================================ */
function buildDoors(day, grp) {
  const g = new T.Group();
  const doors = [];
  const xs = [-3.2, 0, 3.2];
  const glowCols = [0xFFD9A0, 0x9FC0FF, 0xE8A34C];
  xs.forEach((x, i) => {
    const dg = new T.Group();
    const frameMat = new T.MeshStandardMaterial({ color: 0x1A1E2A, roughness: 0.85 });
    const f1 = new T.Mesh(new T.BoxGeometry(0.09, 1.5, 0.09), frameMat); f1.position.set(-0.36, 0.75, 0.02);
    const f2 = new T.Mesh(new T.BoxGeometry(0.09, 1.5, 0.09), frameMat); f2.position.set(0.36, 0.75, 0.02);
    const f3 = new T.Mesh(new T.BoxGeometry(0.81, 0.09, 0.09), frameMat); f3.position.set(0, 1.5, 0.02);
    const door = new T.Mesh(new T.BoxGeometry(0.72, 1.42, 0.06),
      new T.MeshStandardMaterial({ color: 0x2A3042, roughness: 0.7 }));
    const glow = new T.Mesh(new T.PlaneGeometry(0.6, 1.3),
      new T.MeshBasicMaterial({ color: glowCols[i], transparent: true, opacity: 0, depthWrite: false }));
    glow.position.z = -0.04;
    dg.add(f1, f2, f3, door, glow);
    dg.position.set(x, 2.5, -5.7);
    g.add(dg); doors.push(dg);
  });
  g.position.set(0, 0, 0);
  grp.add(g);
  storeScale(doors[0]);
  doors[0].userData.pickId = pickId(13);
  if (day === 13) {
    doors.forEach((d, i) => {
      gsap.fromTo(d.children[4].material, { opacity: 0 }, { opacity: 0.55, duration: 1.0, delay: i * 0.3 });
    });
  } else doors.forEach(d => d.children[4].material.opacity = 0.55);
  Room3D.addPick(doors[0], pickId(13), (mesh) => {
    pulse(mesh, 1.05);
    showLine(SENT[12], mesh);
    Room3D.focus(mesh, 2.3, new THREE.Vector3(0, 2.5, -5.7), 1.6, () => {
      if (day !== 13) return;
      doors.forEach((d, i) => {
        setTimeout(() => {
          gsap.to(d.rotation, { y: (i % 2 ? 1 : -1) * 0.55, duration: 0.9, ease: 'power2.inOut' });
          gsap.to(d.children[4].material, { opacity: 0.9, duration: 0.8 });
          A.lowHum(1.2, 0.05);
        }, i * 320);
      });
      setTimeout(() => { resolveDay(13); }, 3 * 320 + 1100);
    });
  });
}

/* ============================================================
 * Day 14 · 信（三段：镜头移前 → 四步展开 → 十四句逐句浮现 + 图标回看）
 * ============================================================ */
function buildLetter(day, grp) {
  const g = new T.Group();
  const paperMat = () => new T.MeshStandardMaterial({
    color: 0xEDE6DA, roughness: 0.55, metalness: 0.02, emissive: 0x2A1F10, emissiveIntensity: 0.18, transparent: true
  });
  // 四段折叠信纸（上/下/左/右 + 中段）：初始叠在中段上，展开向四周摊平
  const segs = {};
  const mkSeg = (name, w, d) => {
    const pivot = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(w, 0.015, d), paperMat());
    mesh.position.set(0, 0, -d / 2);   // 折线在 pivot 本地 z=0
    pivot.add(mesh);
    pivot.position.set(0, 2.32, 0);
    g.add(pivot);
    segs[name] = pivot;
  };
  mkSeg('top', 1.5, 0.25);      // 上折（展开 z 0.35..0.6）
  mkSeg('mid', 0.7, 0.6);       // 中段（z -0.25..0.35）
  mkSeg('bottom', 1.5, 0.35);   // 下折（展开 z -0.6..-0.25）
  const mkSide = (name, w, d, sign) => {
    const pivot = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(w, 0.015, d), paperMat());
    mesh.position.set(sign < 0 ? -w / 2 : w / 2, 0, 0);
    pivot.add(mesh);
    pivot.position.set(0, 2.32, 0);
    g.add(pivot);
    segs[name] = pivot;
  };
  mkSide('left', 0.4, 1.1, -1);
  mkSide('right', 0.4, 1.1, 1);
  // 展开目标（四段向四周摊平）
  const EXPAND = {
    top:    { z: 0.35 },
    bottom: { z: -0.35 },
    left:   { x: -0.55 },
    right:  { x: 0.55 }
  };
  // 信纸下的淡影 + 边缘暖光
  const underShadow = new T.Mesh(new T.PlaneGeometry(1.7, 1.3),
    new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  underShadow.rotation.x = -Math.PI / 2;
  underShadow.position.set(0, 2.31, 0);
  g.add(underShadow);
  // 热区（比信纸大一圈）
  const hit = new T.Mesh(new T.BoxGeometry(1.9, 0.05, 1.5),
    new T.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false }));
  hit.position.set(0, 2.34, 0);
  g.add(hit);
  g.position.set(1.15, 0, -5.15);
  grp.add(g);
  storeScale(hit);
  hit.userData.pickId = pickId(14);
  if (day === 14) rise(g, 1.6, 1.0, 1.8);

  const stageEl = document.getElementById('stage3d');
  const holder = stageEl.parentElement;
  const linesHost = document.createElement('div');
  linesHost.className = 'letter-lines';
  linesHost.style.display = 'none';
  holder.appendChild(linesHost);
  const hint = document.createElement('div');
  hint.className = 'letter-hint';
  hint.textContent = '桌上有一封信。';
  holder.appendChild(hint);

  let expanded = false, linesShown = false;
  function expandLetter(fast) {
    if (expanded && !fast) return;
    expanded = true;
    const dur = fast ? 0.3 : 0.8;
    gsap.to(segs.top.position, { z: EXPAND.top.z, duration: dur, delay: fast ? 0 : 0, ease: 'power2.out' });
    gsap.fromTo(segs.top.rotation, { x: -0.5 }, { x: 0, duration: dur * 1.4, delay: fast ? 0 : 0, ease: 'power2.out' });
    gsap.to(segs.bottom.position, { z: EXPAND.bottom.z, duration: dur, delay: fast ? 0 : 0.1, ease: 'power2.out' });
    gsap.fromTo(segs.bottom.rotation, { x: 0.5 }, { x: 0, duration: dur * 1.4, delay: fast ? 0 : 0.1, ease: 'power2.out' });
    gsap.to(segs.left.position, { x: EXPAND.left.x, duration: dur, delay: fast ? 0 : 0.2, ease: 'power2.out' });
    gsap.fromTo(segs.left.rotation, { z: 0.5 }, { z: 0, duration: dur * 1.4, delay: fast ? 0 : 0.2, ease: 'power2.out' });
    gsap.to(segs.right.position, { x: EXPAND.right.x, duration: dur, delay: fast ? 0 : 0.2, ease: 'power2.out' });
    gsap.fromTo(segs.right.rotation, { z: -0.5 }, { z: 0, duration: dur * 1.4, delay: fast ? 0 : 0.2, ease: 'power2.out' });
    if (!fast) { A.paper(); setTimeout(() => A.paper(), 300); setTimeout(() => A.paper(), 650); setTimeout(() => A.paper(), 950); }
  }
  function showAllLines() {
    linesHost.innerHTML = '';
    SENT.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'l-line';
      row.style.left = ((i === 0 ? 8 : i === 13 ? 46 : 18 + ((i * 7) % 22))) + '%';
      row.style.top = (6 + i * 6.1) + '%';
      row.innerHTML = '<span class="l-ic">' + ICONS[i] + '</span><span class="l-tx">' + t + '</span>';
      row.addEventListener('click', () => visitDay(i));
      linesHost.appendChild(row);
    });
    linesHost.style.display = 'block';
    linesShown = true;
    hint.textContent = '点图标，回到那天。';
    hint.style.display = 'block';
  }
  function showLineSeq() {
    linesHost.innerHTML = '';
    linesHost.style.display = 'block';
    let idx = 0;
    function next() {
      if (idx >= SENT.length) {
        hint.textContent = '点图标，回到那天。';
        hint.style.display = 'block';
        linesShown = true;
        return;
      }
      if (idx === 13) setTimeout(next, 2000);   // 第十四句前停顿 2s
      const row = document.createElement('div');
      row.className = 'l-line';
      const t = SENT[idx];
      row.style.left = ((idx === 0 ? 8 : idx === 13 ? 46 : 18 + ((idx * 7) % 22))) + '%';
      row.style.top = (6 + idx * 6.1) + '%';
      row.innerHTML = '<span class="l-ic">' + ICONS[idx] + '</span><span class="l-tx">' + t + '</span>';
      row.style.opacity = '0';
      row.addEventListener('click', () => visitDay(idx));
      linesHost.appendChild(row);
      gsap.to(row, { opacity: 1, duration: 0.8, ease: 'power2.out' });
      gsap.to(row, { y: 6, duration: 0.8, ease: 'power2.out' });
      idx++;
      setTimeout(next, 2000);   // 0.8 浮现 + 1.2 停留
    }
    next();
  }
  function visitDay(i) {
    const id = 'd' + (i + 1);
    const mesh = Room3D.getPick(id);
    if (!mesh) return;
    linesHost.style.display = 'none';
    hint.style.display = 'none';
    // 信暂时收起（四段折回）
    gsap.to(segs.top.rotation, { x: 0, duration: 0.35 });
    gsap.to(segs.bottom.rotation, { x: 0, duration: 0.35 });
    gsap.to(segs.left.rotation, { z: 0, duration: 0.35 });
    gsap.to(segs.right.rotation, { z: 0, duration: 0.35 });
    const v = new THREE.Vector3();
    mesh.getWorldPosition(v);
    Room3D.focus(mesh, 2.6, v, 1.4, () => {
      showLine(SENT[i], mesh);
      setTimeout(() => {
        hideLine();
        // 返回信：重新展开 + 显示全文
        expandLetter(true);
        Room3D.focus(hit, 3.0, new THREE.Vector3(1.15, 2.4, -5.15), 1.2, () => {
          setTimeout(showAllLines, 500);
        });
      }, 2600);
    });
  }

  Room3D.addPick(hit, pickId(14), (mesh) => {
    if (day !== 14 || expanded) { showAllLines(); return; }
    pulse(mesh, 1.06);
    A.tone(523, { type: 'sine', dur: 0.6, vol: 0.1 });
    gsap.to(hint, { opacity: 0, duration: 0.6, onComplete: () => { hint.style.display = 'none'; } });
    // 第一段：镜头沿 lookAt 弧线移向信（3s 前慢后快再慢，机位不移动）
    Room3D.focus(hit, 3.0, new THREE.Vector3(1.15, 2.4, -5.15), 3.0, () => {
      setTimeout(() => {
        // 第二段：四步展开（到位停顿 0.5s 已含）
        expandLetter(false);
        setTimeout(() => {
          // 第三段：十四句逐句浮现 + 房间转亮
          showLineSeq();
          gsap.to(Room3D.lampLight, { intensity: 2.8, duration: 2 });
          A.fullMelody();
          setTimeout(() => resolveDay(14), 800);
        }, 1400);
      }, 500);
    });
  });
}

const ICONS = ['◎', '◭', '▣', '◫', '◒', '⧉', '♪', '◭', '◑', '✷', '◬', '◉', '▤', '★'];

/* —— 追加 Day8–14 —— */
const builders2 = { 8: buildShadow, 9: buildMerge, 10: buildWell, 11: buildShards, 12: buildDuo, 13: buildDoors, 14: buildLetter };
function buildAllFull(day) {
  const grp = Room3D.beginDay();
  buildLamp(day, grp);
  const builders1 = { 2: buildNote, 3: buildDoorMark, 4: buildSteps, 5: buildPenguin, 6: buildPanel, 7: buildChimes };
  for (let i = 2; i <= 7; i++) builders1[i](day, grp);
  for (let i = 8; i <= day; i++) builders2[i](day, grp);
  return grp;
}
[8,9,10,11,12,13,14].forEach(d => {
  window.Scenes[d] = () => {
    blankEnabled = d !== 14;
    resolver = null;
    buildAllFull(d);
    return new Promise(res => {
      resolver = () => { const r = res; resolver = null; setTimeout(r, 250); };
    });
  };
});

