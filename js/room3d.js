/* ============================================================
 * js/room3d.js · 真 3D 房间核心（Three.js 官方生态）
 * 规格来源：《背景.docx》第二节/第五节/第七节 + 用户强制技术栈
 *  - OrthographicCamera 等距视角，机位固定 (20,20,20)，lookAt 房间中心偏上
 *  - MeshStandardMaterial（PBR），PCFSoftShadowMap 软阴影
 *  - EffectComposer：RenderPass + UnrealBloomPass + VignetteShader + OutputPass
 *  - 一个房间十四天往里放东西：常驻房间 persistent，每日物体 dayGroup 累积替换
 *  - Raycaster 拾取（hover 提亮 + 手型 / click 触发），GSAP 推近 zoom+lookAt
 *  - 文字屏幕投影：project(mesh) → 供 DOM 毛玻璃文字框定位
 * ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const Room3D = (() => {
  const gsap = window.gsap;   // GSAP 以普通 script 引入为全局
  /* ---- 常量（《背景.docx》硬规格） ---- */
  const BG       = 0x080A10;          // 背景最深
  const WALL     = 0x3A4460;          // 墙面（暗部有层次，不死黑）
  const FLOOR    = 0x39415A;          // 地面基色
  const WARM     = 0xFFD9A0;          // 主暖光
  const COOL     = 0xA8B8D8;          // 冷月光
  const CAM_POS  = new THREE.Vector3(20, 20, 20);
  const CAM_LOOK = new THREE.Vector3(0, 3.2, 0);   // 房间中心偏上 → 桌/灯在中下部
  const FRUSTUM  = 16;                // 初始视野高度（zoom=1）
  const NEAR     = 0.1, FAR = 200;

  /* ---- 运行时状态 ---- */
  let renderer = null, scene = null, camera = null, composer = null, clock = null;
  let container = null;
  let persistent = null;              // 房间常驻组（墙/地/桌/灯/浮尘）
  let dayGroup = null;                // 每日物体组（随天替换）
  let doorGroup = null;               // 门口过渡组
  let dust = null;                    // 浮尘
  let lampLight = null;               // 桌上主点光源
  let rafId = 0, running = false;
  let animFns = [];                   // 每帧回调（呼吸/光晕/机关动画）
  let pickMap = new Map();            // pickId -> handler
  let hoverPick = null;
  let focused = false;                // 是否处于推近聚焦状态
  let camTarget = CAM_LOOK.clone();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let lastHit = false;   // 最近一次 pointerdown 是否命中可点物体（供场景空白返回判断）

  /* ---- 正交投影更新（zoom 变化时） ---- */
  function updateOrtho() {
    const aspect = container ? (container.clientWidth / Math.max(1, container.clientHeight)) : 1.6;
    const halfH = FRUSTUM / 2 / camera.zoom;
    const halfW = halfH * aspect;
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  /* 顶层函数：供方法体裸调用（对象方法作用域链可解析到它们） */
  function clearDayGroup() {
    const dispose = (o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    };
    dayGroup.traverse(dispose);
    while (dayGroup.children.length) dayGroup.remove(dayGroup.children[0]);
    pickMap.clear();
    animFns.length = 0;
    clearHover();
    camTarget.copy(CAM_LOOK);
    gsap.killTweensOf(camera); gsap.killTweensOf(camTarget);
    camera.zoom = 1; updateOrtho();
    focused = false;
  }
  function addAnim(fn) { animFns.push(fn); }

  function onResize() {
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    updateOrtho();
  }

  /* ---- 房间几何（厚板地面 / 三面墙 / 墙根阴影 / 桌子 / 灯） ---- */
  function buildRoom() {
    // 地面：厚板 + 石板缝纹理（程序生成，无图片文件）
    const floorTex = makeSlabTexture();
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.8, metalness: 0.2, map: floorTex })
    );
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    persistent.add(floor);

    // 南墙（有厚度）
    const south = new THREE.Mesh(
      new THREE.BoxGeometry(12, 8, 0.5),
      new THREE.MeshStandardMaterial({ color: WALL, roughness: 0.92, metalness: 0.08 })
    );
    south.position.set(0, 4, -6.25);
    south.receiveShadow = true;
    persistent.add(south);

    // 侧墙（东/西，更暗）
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x161C2A, roughness: 0.95, metalness: 0.06 });
    for (const sx of [6.25, -6.25]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 12), sideMat);
      side.position.set(sx, 4, 0);
      side.receiveShadow = true;
      persistent.add(side);
    }

    // 墙根阴影（南墙根，软化的暗带，非硬切线）
    const baseShade = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.05, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, transparent: true, opacity: 0.5 })
    );
    baseShade.position.set(0, 0.025, -5.8);
    persistent.add(baseShade);

    // 桌子：桌面 + 四腿
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x2A3042, roughness: 0.7, metalness: 0.1 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 1.6), deskMat);
    top.position.set(0, 2.075, -5.0);
    top.castShadow = true; top.receiveShadow = true;
    persistent.add(top);
    const legGeo = new THREE.BoxGeometry(0.16, 1.95, 0.16);
    for (const lx of [-1.4, 1.4]) for (const lz of [-4.25, -5.75]) {
      const leg = new THREE.Mesh(legGeo, deskMat);
      leg.position.set(lx, 0.975, lz);
      leg.castShadow = true; leg.receiveShadow = true;
      persistent.add(leg);
    }

    // 灯（常驻，Day1 的主角）：灯座 + 灯芯 + 光晕 + 主光源
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.4, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x5A5F70, roughness: 0.5, metalness: 0.35 })
    );
    lampBase.position.set(0, 2.36, -5.0);
    lampBase.castShadow = true;
    persistent.add(lampBase);

    const wick = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 12),
      new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 2.2, roughness: 0.4 })
    );
    wick.position.set(0, 2.74, -5.0);
    persistent.add(wick);
    wick.name = 'lamp-wick';

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 20, 14),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.15, depthWrite: false })
    );
    halo.position.copy(wick.position);
    persistent.add(halo);
    halo.name = 'lamp-halo';

    // 主光源（桌上灯，暖，castShadow 1024）
    lampLight = new THREE.PointLight(WARM, 2, 20, 2);
    lampLight.position.set(0, 3.1, -5.0);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.005;
    persistent.add(lampLight);

    // 环境光（暗部不死黑）
    const ambient = new THREE.AmbientLight(0x404050, 1.5);
    persistent.add(ambient);

    // 天光（半球，补房间整体层次——参考库做法，冷色天光 + 暖色地光）
    const hemi = new THREE.HemisphereLight(0x93A4CE, 0x2A2436, 1.15);
    persistent.add(hemi);

    // 冷色补光（左上，勾勒轮廓；开启阴影让房间大范围有软影）
    const key = new THREE.DirectionalLight(COOL, 1.6);
    key.position.set(8, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.004;
    persistent.add(key);

    // 浮尘（暖色，缓慢上飘，20~30 个，仅灯附近可见）
    buildDust();
  }

  /* 程序生成石板缝纹理（CanvasTexture，非图片文件） */
  function makeSlabTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#1d2331';
    g.fillRect(0, 0, 1024, 1024);
    // 石板块（每块 256，3px 暗缝）
    g.strokeStyle = 'rgba(6,8,14,0.85)';
    g.lineWidth = 5;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const ox = x * 256 + Math.floor(Math.random() * 40);
        const oy = y * 256 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgb(${26 + Math.floor(Math.random() * 14)},${31 + Math.floor(Math.random() * 14)},${46 + Math.floor(Math.random() * 14)})`;
        g.fillRect(ox + 3, oy + 3, 244, 244);
        g.strokeRect(ox + 2.5, oy + 2.5, 246, 246);
      }
    }
    // 细颗粒噪点（明暗层次）
    for (let i = 0; i < 6000; i++) {
      const a = Math.random() * 0.06;
      g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.2, 1.2);
    tex.anisotropy = 4;
    return tex;
  }

  function buildDust() {
    const N = 26;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 2.6;
      const y = 2.2 + Math.random() * 2.2;
      const z = -6.4 + Math.random() * 2.4;
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
      seeds[i*3] = (Math.random() - 0.5) * 0.4;
      seeds[i*3+1] = 0.12 + Math.random() * 0.2;
      seeds[i*3+2] = (Math.random() - 0.5) * 0.4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: WARM, size: 0.11, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true
    });
    dust = new THREE.Points(geo, mat);
    dust.userData.seeds = seeds;
    persistent.add(dust);
  }

  /* ---- 拾取 ---- */
  function pickMeshes() {
    const arr = [];
    for (const [id] of pickMap) {
      const m = findPickMesh(id);
      if (m) arr.push(m);
    }
    return arr;
  }
  function findPickMesh(id) {
    let found = null;
    dayGroup && dayGroup.traverse(o => { if (o.userData && o.userData.pickId === id) found = o; });
    if (!found && doorGroup) doorGroup.traverse(o => { if (o.userData && o.userData.pickId === id) found = o; });
    if (!found) persistent.traverse(o => { if (o.userData && o.userData.pickId === id) found = o; });
    return found;
  }
  function updateRay(evt) {
    const r = container.getBoundingClientRect();
    ndc.x = ((evt.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((evt.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const meshes = [];
    dayGroup && dayGroup.traverse(o => { if (o.isMesh && o.userData && o.userData.pickId) meshes.push(o); });
    if (doorGroup) doorGroup.traverse(o => { if (o.isMesh && o.userData && o.userData.pickId) meshes.push(o); });
    persistent.traverse(o => { if (o.isMesh && o.userData && o.userData.pickId) meshes.push(o); });
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0].object : null;
  }
  function setHover(mesh) {
    if (hoverPick === mesh) return;
    clearHover();
    if (mesh && mesh.userData.pickId) {
      hoverPick = mesh;
      container.style.cursor = 'pointer';
      const m = mesh.material;
      if (m && m.emissive) {
        mesh.userData._emInt = m.emissiveIntensity;
        m.emissive.set(WARM);
        m.emissiveIntensity = 0.14;
      }
    }
  }
  function clearHover() {
    if (hoverPick) {
      const m = hoverPick.material;
      if (m && m.emissive) {
        m.emissive.set(hoverPick.userData._emColor || 0x000000);
        m.emissiveIntensity = hoverPick.userData._emInt != null ? hoverPick.userData._emInt : 0;
      }
      hoverPick = null;
      if (container) container.style.cursor = 'default';
    }
  }

  function onPointerMove(e) { setHover(updateRay(e)); }
  function onPointerDown(e) {
    const mesh = updateRay(e);
    lastHit = !!mesh;
    if (mesh && mesh.userData.pickId) {
      const fn = pickMap.get(mesh.userData.pickId);
      if (fn) fn(mesh);
    }
  }

  /* ---- 主循环 ---- */
  function loop() {
    if (!running) return;
    const dt = clock.getDelta();
    // 浮尘上飘
    if (dust) {
      const p = dust.geometry.attributes.position.array;
      const s = dust.userData.seeds;
      const n = p.length / 3;
      for (let i = 0; i < n; i++) {
        p[i*3+1] += s[i*3+1] * dt;
        p[i*3] += Math.sin(p[i*3+1] * 2 + i) * 0.02 * dt;
        if (p[i*3+1] > 4.6) { p[i*3+1] = 2.2; p[i*3] = (Math.random()-0.5)*2.6; p[i*3+2] = -6.4 + Math.random()*2.4; }
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    // 每帧动画回调（呼吸/光晕/机关）
    for (const fn of animFns) fn(dt, clock.elapsedTime);
    // 相机 lookAt 跟随 camTarget（GSAP 驱动）
    camera.lookAt(camTarget);
    composer.render();
    rafId = requestAnimationFrame(loop);
  }

  /* ---- 对外 API ---- */
  return {
    /* 一次性挂载（renderer 常驻；engine 保留 #stage3d 容器） */
    boot(el) {
      if (renderer) { onResize(); return; }
      container = el;
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(BG);
      scene.fog = new THREE.Fog(BG, 20, 60);

      camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, NEAR, FAR);
      camera.position.copy(CAM_POS);
      camera.zoom = 1;
      camera.lookAt(CAM_LOOK);
      camTarget.copy(CAM_LOOK);
      updateOrtho();

      persistent = new THREE.Group(); scene.add(persistent);
      dayGroup  = new THREE.Group(); scene.add(dayGroup);
      doorGroup = new THREE.Group(); doorGroup.visible = false; scene.add(doorGroup);
      buildRoom();

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(el.clientWidth, el.clientHeight), 0.5, 0.5, 0.85
      );
      composer.addPass(bloom);
      const vig = new ShaderPass(VignetteShader);
      vig.uniforms['offset'].value = 1.05;
      vig.uniforms['darkness'].value = 0.92;
      composer.addPass(vig);
      composer.addPass(new OutputPass());

      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('resize', onResize);

      clock = new THREE.Clock();
      running = true;
      rafId = requestAnimationFrame(loop);
    },

    /* 每日：清空前一日物体，挂上本日物体组 */
    beginDay() {
      clearDayGroup();
      if (lampLight) { lampLight.intensity = 2; lampLight.distance = 20; }
      return dayGroup;
    },
    clearDayGroup() { clearDayGroup(); },

    /* 注册可点物体：mesh.userData.pickId + handler */
    addPick(mesh, id, handler) {
      mesh.userData.pickId = id;
      pickMap.set(id, handler);
    },

    /* 每帧动画（光晕呼吸 / 浮动 / 机关） */
    addAnim(fn) { addAnim(fn); },
    clearAnims() { animFns.length = 0; },

    /* 镜头推近（正交：只改 zoom + lookAt，不改机位） */
    focus(mesh, zoom, lookAt, dur = 1.8, onDone) {
      if (focused) { if (onDone) onDone(); return; }
      focused = true;
      clearHover();
      gsap.killTweensOf(camera); gsap.killTweensOf(camTarget);
      const t = lookAt ? (lookAt.clone ? lookAt.clone() : lookAt) : camTarget.clone();
      gsap.to(camTarget, { x: t.x, y: t.y, z: t.z, duration: dur, ease: 'power2.inOut' });
      gsap.to(camera, {
        zoom: zoom || 2.5, duration: dur, ease: 'power2.inOut',
        onUpdate: updateOrtho, onComplete: () => { if (onDone) onDone(); }
      });
    },
    /* 镜头平滑返回 */
    defocus(dur = 1.5, onDone) {
      if (!focused) { if (onDone) onDone(); return; }
      focused = false;
      gsap.killTweensOf(camera); gsap.killTweensOf(camTarget);
      gsap.to(camTarget, { x: CAM_LOOK.x, y: CAM_LOOK.y, z: CAM_LOOK.z, duration: dur, ease: 'power2.inOut' });
      gsap.to(camera, {
        zoom: 1, duration: dur, ease: 'power2.inOut',
        onUpdate: updateOrtho, onComplete: () => { if (onDone) onDone(); }
      });
    },
    isFocused() { return focused; },

    /* 屏幕投影（文字框定位）：返回 {x, y} 相对容器像素 */
    project(mesh) {
      if (!mesh || !container) return null;
      const v = new THREE.Vector3();
      mesh.getWorldPosition(v);
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * container.clientWidth,
        y: (-v.y * 0.5 + 0.5) * container.clientHeight
      };
    },
    containerWidth() { return container ? container.clientWidth : 0; },
    containerHeight() { return container ? container.clientHeight : 0; },

    /* 门口过渡组（门洞 + 门缝光 + 光斑；phase: before/active/memorial） */
    showDoor(phase) {
      const open = phase !== 'before';
      doorGroup.visible = true;
      clearDayGroup();
      doorGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      while (doorGroup.children.length) doorGroup.remove(doorGroup.children[0]);

      const glowI = phase === 'memorial' ? 1.5 : phase === 'active' ? 0.85 : 0.18;
      const patchO = phase === 'memorial' ? 0.3 : phase === 'active' ? 0.22 : 0.05;
      const doorMat = new THREE.MeshStandardMaterial({
        color: open ? 0x111827 : 0x0E1220, emissive: open ? 0x2A1F10 : 0x000000,
        emissiveIntensity: glowI * 0.6, roughness: 0.5, side: THREE.DoubleSide
      });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.2), doorMat);
      door.position.set(0, 3.1, -5.6);
      doorGroup.add(door);

      // 门框
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1A1E2A, roughness: 0.92 });
      const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.2, 0.18), frameMat); f1.position.set(-1.42, 3.1, -5.55);
      const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.2, 0.18), frameMat); f2.position.set(1.42, 3.1, -5.55);
      const f3 = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), frameMat); f3.position.set(0, 6.35, -5.55);
      doorGroup.add(f1, f2, f3);

      // 门缝竖光
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 6.0),
        new THREE.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: glowI * 0.85, depthWrite: false }));
      seam.position.set(0, 3.1, -5.45);
      doorGroup.add(seam);

      // 地面光斑（门缝透出的光，呼吸）
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.8),
        new THREE.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: patchO, depthWrite: false })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(0, 0.02, -5.1);
      doorGroup.add(patch);
      addAnim((dt, t) => {
        if (!patch.parent) return;
        patch.material.opacity = patchO * (0.72 + 0.28 * Math.sin(t * 0.9));
        seam.material.opacity = glowI * 0.85 * (0.8 + 0.2 * Math.sin(t * 0.9));
      });
      // 推门交互（handle 由 engine 绑定到 DOM，此处仅供回看拾取）
      door.userData.pickId = '__door';
    },
    hideDoor() { doorGroup.visible = false; },

    /* 测试钩子（回归脚本用；走真实 pick handler） */
    __fire(id) {
      const fn = pickMap.get(id);
      if (fn) fn(findPickMesh(id));
      return !!fn;
    },
    __hasPick(id) { return pickMap.has(id); },
    getPick(id) { return findPickMesh(id); },
    get lastHit() { return lastHit; },
    consumeLastHit() { const v = lastHit; lastHit = false; return v; },

    /* 场景级便利 */
    get scene() { return scene; },
    get camera() { return camera; },
    get lampLight() { return lampLight; },
    get gsap() { return gsap; },
  };
})();

// 全局引用（调试 / 回看用）
window.Room3D = Room3D;
