/* ============================================================
 * js/scenes.js · 14 天逐日机关场景
 * 全部 SVG / CSS 手绘，不依赖任何外部图片
 * 每个场景：mount(el) 注入 SVG 并绑定交互，
 *          resolves 一个 {line} 表示完成。
 * ============================================================ */
window.Scenes = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340, H = 300; // 场景画布基准

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 共用滤镜：柔边 */
  const defsSvg = `
    <defs>
      <filter id="softBlur" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.5"/>
      </filter>
      <radialGradient id="warmGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,217,160,0.9)"/>
        <stop offset="35%" stop-color="rgba(242,180,92,0.35)"/>
        <stop offset="70%" stop-color="rgba(242,180,92,0.10)"/>
        <stop offset="100%" stop-color="rgba(242,180,92,0)"/>
      </radialGradient>
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(168,184,216,0.85)"/>
        <stop offset="60%" stop-color="rgba(168,184,216,0.20)"/>
        <stop offset="100%" stop-color="rgba(168,184,216,0)"/>
      </radialGradient>
    </defs>`;

  const root = (w = W, h = H) => {
    const s = el('svg', { viewBox: `0 0 ${w} ${h}`, class: 'scene-svg' });
    s.innerHTML = defsSvg;
    return s;
  };

  /* 浮尘：20-40 个 1-2px 光点 */
  function dust(g, count = 26, x0 = 30, y0 = 40, w = 280, h = 230) {
    for (let i = 0; i < count; i++) {
      const c = el('circle', {
        cx: x0 + Math.random() * w,
        cy: y0 + Math.random() * h,
        r: 1 + Math.random() * 1.2,
        fill: Math.random() > 0.5 ? '#FFD9A0' : '#A8B8D8',
        opacity: (0.1 + Math.random() * 0.2).toFixed(2),
        class: 'dust-bit'
      }, g);
      const d = 4 + Math.random() * 6;
      c.style.animation = `dustFloat ${d}s ease-in-out ${Math.random() * 4}s infinite`;
    }
  }

  /* ============================================================
   * 等距立体工具（给制作方规格 · 2026-10）
   * 30° 等距斜线 / 光从左上来 / 顶面100% 左面70% 右面45%
   * 柔边 1.5px（softBlur）/ 光雾 blur 8px / 空气透视（远暗远糊远透明）
   * ============================================================ */
  const ISO = 0.577; // tan(30°)，等距斜线深/宽比

  /* 颜色变暗：hex → factor 倍亮度（保持色相，生成三面明暗） */
  function shade(hex, f) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /* 等距立方体：中心(cx,cy)、半宽 w、高 h、基色 c（可选自定义半深 d）
     顶面 100% / 左面 70% / 右面 45%。视觉层，一律 pointer-events:none 不拦截点击。 */
  function isoBox(g, cx, cy, w, h, c, d) {
    const dd = d || Math.round(w * ISO);
    const top = [cx, cy - dd, cx + w, cy, cx, cy + dd, cx - w, cy].join(',');
    const left = [cx - w, cy, cx, cy + dd, cx, cy + dd + h, cx - w, cy + h].join(',');
    const right = [cx, cy + dd, cx + w, cy, cx + w, cy + h, cx, cy + dd + h].join(',');
    el('polygon', { points: top, fill: c, class: 'soft-edge', style: 'pointer-events:none' }, g);
    el('polygon', { points: left, fill: shade(c, 0.7), class: 'soft-edge', style: 'pointer-events:none' }, g);
    el('polygon', { points: right, fill: shade(c, 0.45), class: 'soft-edge', style: 'pointer-events:none' }, g);
  }

  /* 等距菱形顶面（地面 / 石板 / 浮石顶） */
  function isoTop(g, cx, cy, w, c, d) {
    const dd = d || Math.round(w * ISO);
    el('polygon', { points: [cx, cy - dd, cx + w, cy, cx, cy + dd, cx - w, cy].join(','), fill: c, class: 'soft-edge', style: 'pointer-events:none' }, g);
  }

  /* 等距平行四边形（墙 / 斜面 / 扶手 / 光束带） */
  function isoFace(g, pts, c, cls) {
    el('polygon', { points: pts.join(','), fill: c, class: cls || 'soft-edge', style: 'pointer-events:none' }, g);
  }

  /* 光雾：焦点物体周围的径向渐变暖光，blur 8px（纯视觉） */
  function fog(g, cx, cy, r, op, cls) {
    const c = el('circle', { cx: cx, cy: cy, r: r, fill: 'url(#warmGlow)', opacity: String(op == null ? 0.8 : op) }, g);
    c.setAttribute('class', cls || 'fog');
    c.setAttribute('style', 'pointer-events:none;filter:blur(8px)');
    return c;
  }

  /* 空气透视：远层元素更暗 / 更糊 / 更透明（给背景层用） */
  function airDist(g, tag, attrs, blur = 3, opacity = 0.55) {
    const n = el(tag, attrs, g);
    n.setAttribute('class', 'soft-edge air-far');
    n.setAttribute('style', 'pointer-events:none;filter:blur(' + blur + 'px);opacity:' + opacity);
    return n;
  }

  /* 五角星 */
  function star(cx, cy, r, fill = '#A8B8D8', g) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
    }
    el('polygon', { points: pts.join(' '), fill, opacity: '0', class: 'star-bit' }, g);
  }

  /* 提示语出现 */
  function showHint(el, text, delay = 0) {
    setTimeout(() => {
      el.classList.add('show');
      if (text) el.textContent = text;
    }, delay);
  }

  /* ============================================================
   * Day 1 · 灯（点灯 → 凹槽显形 → 拖门开）
   * ============================================================ */
  function d1() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 背景：后墙（融黑，空气透视）——
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: 'rgba(8,10,16,0.55)' }, g);
      // —— 中景：地板（等距菱形，切石板，边缘渐隐）——
      isoTop(g, 170, 262, 128, '#151A26', 74);            // 大地板
      isoTop(g, 170, 262, 92, '#191F2D', 53);             // 内层石板
      isoTop(g, 170, 262, 56, '#1D2433', 32);             // 中心石板
      // 左右墙（平行四边形，贴地板边缘向左上/右上立起）
      isoFace(g, ['44,196', '108,240', '108,88', '44,60'], '#131826', 'soft-edge');
      isoFace(g, ['296,196', '232,240', '232,88', '296,60'], '#0F1522', 'soft-edge');
      // 门形凹槽（后墙，几乎看不见，灯亮显形）
      const niche = el('g', { class: 'niche fade-in-svg', opacity: '0.18', style: 'pointer-events:none' }, g);
      isoFace(niche, ['160,96', '180,96', '180,60', '160,60'], '#080A10', 'soft-edge');
      el('rect', { x: 146, y: 104, width: 48, height: 84, rx: 24, ry: 24, fill: '#080A10', stroke: '#1A1E2A', 'stroke-width': 1, style: 'pointer-events:none' }, niche);
      // 地上的灯（未亮）：梯形灯座（上窄下宽）+ 圆灯芯 + 三层光雾
      const lampG = el('g', { transform: 'translate(170,218)', class: 'breathe' }, g);
      const glow = el('circle', { cx: 0, cy: 0, r: 84, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(8px)' }, lampG);
      glow.setAttribute('class', 'lamp-glow');
      el('circle', { cx: 0, cy: 0, r: 5, fill: '#FFF3E0', class: 'blur-line', opacity: '0.85', style: 'pointer-events:none' }, lampG);
      // 梯形灯座：等距三面
      isoFace(lampG, ['-14,8', '14,8', '20,26', '-20,26'], '#1D2433', 'soft-edge');   // 灯座正面
      isoFace(lampG, ['14,8', '14,26', '20,26', '20,8'], '#232B3C', 'soft-edge');     // 灯座右面
      isoFace(lampG, ['-14,8', '-14,26', '-20,26', '-20,8'], '#171C29', 'soft-edge'); // 灯座左面
      // 门（后墙凹槽处）
      const door = el('g', { transform: 'translate(170,110)', class: 'door-grp', style: 'cursor:pointer' }, g);
      el('rect', { x: -18, y: -50, width: 36, height: 96, rx: 18, ry: 18, fill: '#1A1E2A', stroke: '#2A2E3A', 'stroke-width': 1, style: 'pointer-events:none' }, door);
      const doorline = el('rect', { x: 0, y: -44, width: 1.4, height: 84, fill: '#FFD9A0', class: 'blur-line', opacity: '0', style: 'pointer-events:none' }, door);
      doorline.setAttribute('class', 'door-line');
      // 地面光斑（灯下椭圆，边缘化开）
      el('ellipse', { cx: 170, cy: 262, rx: 58, ry: 17, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(4px)', class: 'fade-in-svg' }, g);
      dust(g);
      // 交互
      let lit = false, opened = false;
      const lampHit = el('circle', { cx: 170, cy: 218, r: 34, fill: 'transparent', class: 'hit-area' }, g);
      const onLamp = () => {
        if (lit) return;
        lit = true;
        AudioEngine.chime('bell');
        glow.style.opacity = '0.9';
        glow.style.transition = 'opacity 1.6s ease';
        niche.setAttribute('opacity', '0.55');
        niche.classList.add('on');
        doorline.setAttribute('opacity', '0.5');
        setTimeout(() => hint.textContent = '拖开那扇门', 1200);
      };
      lampHit.addEventListener('pointerdown', onLamp);
      const doorHit = el('rect', { x: 148, y: 58, width: 44, height: 100, fill: 'transparent', class: 'hit-area' }, g);
      const onDoor = () => {
        if (!lit || opened) return;
        opened = true;
        AudioEngine.doorOpen();
        door.style.transition = 'transform 2.5s cubic-bezier(0.22,0.61,0.36,1)';
        door.style.transform = 'translate(170,110) rotate(62deg) translateY(-8px)';
        door.style.transformOrigin = '16px -50px';
        glow.style.opacity = '1';
        setTimeout(() => finish(), 2600);
      };
      doorHit.addEventListener('pointerdown', onDoor);
      // 完成
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      // 挂载文字
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '轻触那盏灯';
      wrap.appendChild(hint);
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第一天的灯</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 2 · 窄道（点地面走三步）
   * ============================================================ */
  function d2() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 背景：尽头光雾 + 深色走廊 ——
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // 天花板（连接两墙顶部，向远处收窄）
      isoFace(g, ['132,40', '208,40', '226,58', '114,58'], '#11151F', 'soft-edge');
      // 尽头光源：三层光雾
      fog(g, 170, 62, 12, 0.9, 'fade-in-svg on');
      fog(g, 170, 62, 26, 0.5, 'fade-in-svg on');
      fog(g, 170, 62, 44, 0.28, 'fade-in-svg on');
      const far = el('circle', { cx: 170, cy: 62, r: 8, fill: '#FFF3E0', class: 'fade-in-svg', style: 'pointer-events:none' }, g);
      // 左右墙（长平行四边形，向远处收窄，30° 斜线）
      isoFace(g, ['62,272', '128,168', '128,36', '62,120'], '#131826', 'soft-edge');
      isoFace(g, ['278,272', '212,168', '212,36', '278,120'], '#0F1522', 'soft-edge');
      // 地面：长菱形石板（越远越窄）
      const tiles = [];
      const tileGeom = [
        { cy: 238, w: 66 },  // 近
        { cy: 190, w: 50 },  // 中
        { cy: 142, w: 36 }   // 远
      ];
      for (let i = 0; i < 3; i++) {
        const cx = 170, cy = tileGeom[i].cy, w = tileGeom[i].w, d = Math.round(w * 0.577);
        const t = el('polygon', {
          points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','),
          fill: '#1A1E2A', stroke: '#2A2E3A', 'stroke-width': 0.6,
          class: 'tile soft-edge', style: 'cursor:pointer'
        }, g);
        tiles.push(t);
      }
      // 近处暗角（前景）
      isoFace(g, ['40,300', '160,220', '160,300', '40,300'], '#080A10', 'soft-edge');
      isoFace(g, ['300,300', '180,220', '180,300', '300,300'], '#080A10', 'soft-edge');
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '轻触地面，向前';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第二天的窄道</span>';
      let stepIdx = 0;
      const lightTile = (t, i) => {
        const cx = 170, cy = tileGeom[i].cy, w = tileGeom[i].w, d = Math.round(w * 0.577);
        const glow = el('polygon', {
          points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','),
          fill: '#FFD9A0', opacity: '0.3', class: 'blur-line', style: 'pointer-events:none'
        }, g);
        glow.style.transition = 'opacity 0.6s ease';
        AudioEngine.step();
        setTimeout(() => glow.setAttribute('opacity', '0.12'), 900);
      };
      tiles.forEach((t, i) => {
        t.addEventListener('pointerdown', () => {
          if (i !== stepIdx) return;
          stepIdx++;
          lightTile(t, i);
          if (stepIdx === 3) {
            far.classList.add('on');
            setTimeout(() => finish(), 1400);
          }
        });
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 800);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2600);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 3 · 旋转的桥（拖动一段转 90° 接上）
   * ============================================================ */
  function d3() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 背景：虚空（深色渐变往下更黑）——
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#080A10' }, g);
      el('rect', { x: 0, y: 150, width: 340, height: 150, fill: 'rgba(8,10,16,0.85)', style: 'pointer-events:none' }, g);
      // 虚空里两三根悬浮柱（细长方体，增加纵深）
      isoBox(g, 78, 236, 12, 46, '#131826', 7);
      isoBox(g, 268, 244, 9, 38, '#10151F', 5);
      isoBox(g, 172, 262, 7, 30, '#0E1320', 4);
      // —— 中景：两段桥（长方体，顶面菱形 + 左右平行四边形）——
      // 近端桥（画面左下伸向中右，顶面受光）
      const left = el('g', {}, g);
      isoFace(left, ['0,150', '150,150', '166,166', '0,166'], '#1D2433', 'soft-edge');   // 桥顶面
      isoFace(left, ['0,166', '166,166', '166,178', '0,178'], '#141926', 'soft-edge');   // 桥右面
      isoFace(left, ['0,150', '0,166', '0,178', '0,150'], '#232B3C', 'soft-edge');        // 桥端面
      // 远端桥（可转，画面右上伸向中左）
      const rightG = el('g', { transform: 'translate(260,149)', class: 'bridge-grp', style: 'cursor:grab' }, g);
      // 桥三面（保留可点，否则拖拽失效）
      el('polygon', { points: '0,-6 130,-6 142,10 0,10', fill: '#1D2433', class: 'soft-edge' }, rightG);
      el('polygon', { points: '0,10 142,10 142,22 0,22', fill: '#141926', class: 'soft-edge' }, rightG);
      el('polygon', { points: '130,-6 130,10 142,10 142,-6', fill: '#232B3C', class: 'soft-edge' }, rightG);
      // 断口消散
      el('line', { x1: 150, y1: 140, x2: 260, y2: 140, stroke: 'rgba(168,184,216,0.15)', 'stroke-width': 14, class: 'blur-line', style: 'pointer-events:none' }, g);
      // 接缝光
      const seam = el('line', { x1: 200, y1: 128, x2: 200, y2: 172, stroke: '#FFD9A0', 'stroke-width': 2, opacity: '0', class: 'blur-line', style: 'pointer-events:none' }, g);
      // 斜光带（左上斜射，打亮桥面）
      isoFace(g, ['30,30', '60,60', '300,300', '240,300'], 'rgba(242,180,92,0.08)', 'blur-line');
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '拖动那段桥';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第三天的断桥</span>';
      // 拖转：按角度滑动
      let dragY = 0, rotating = false, angle = 0;
      const onMove = (e) => {
        if (!rotating) return;
        const dy = (e.touches ? e.touches[0].clientY : e.clientY) - dragY;
        angle = Math.max(0, Math.min(90, -dy * 0.9));
        rightG.setAttribute('transform', `translate(260,149) rotate(${angle.toFixed(1)} 130 6)`);
      };
      const onUp = () => {
        if (!rotating) return;
        rotating = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (angle >= 70) {
          AudioEngine.chime('metal');
          rightG.style.transition = 'transform 1s cubic-bezier(0.22,0.61,0.36,1)';
          rightG.setAttribute('transform', 'translate(260,149) rotate(90 130 6)');
          seam.setAttribute('opacity', '0.9');
          setTimeout(() => finish(), 1500);
        } else {
          rightG.style.transition = 'transform 0.8s cubic-bezier(0.22,0.61,0.36,1)';
          rightG.setAttribute('transform', 'translate(260,149) rotate(0)');
        }
      };
      rightG.addEventListener('pointerdown', (e) => {
        rotating = true;
        dragY = e.touches ? e.touches[0].clientY : e.clientY;
        rightG.style.transition = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2500);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 4 · 台阶（按顺序点亮 7 级，顺序藏在 Day1/2：2 次·3 步 → 2,3,4,5,6,7,1）
   * ============================================================ */
  function d4() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 背景：尽头拱窗 + 夜空 + 冷光 ——
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // 尽头墙（暖暗）
      isoFace(g, ['120,52', '220,52', '232,60', '108,60'], '#131826', 'soft-edge');
      // 拱窗（矩形+半圆，窗内深蓝夜空星点）
      el('rect', { x: 150, y: 40, width: 40, height: 52, rx: 20, ry: 20, fill: '#080A10', stroke: '#2A2E3A', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      [[170, 40], [156, 50], [184, 48], [170, 62], [160, 68]].forEach(([x, y], i) => {
        el('circle', { cx: x, cy: y, r: 1.2 + (i % 2), fill: '#A8B8D8', opacity: '0.6', class: 'star-bit', style: 'pointer-events:none' }, g);
      });
      fog(g, 170, 70, 30, 0.5, 'fade-in-svg');
      // 左右扶手墙（斜平行四边形，随台阶上升）
      isoFace(g, ['60,120', '108,86', '108,252', '60,284'], '#0F1522', 'soft-edge');
      isoFace(g, ['280,120', '232,86', '232,252', '280,284'], '#11151F', 'soft-edge');
      // —— 中景：七级台阶（长方体，逐级变小后退）——
      const order = [2, 3, 4, 5, 6, 7, 1];
      const steps = [];
      for (let i = 0; i < 7; i++) {
        const cy = 268 - i * 27;
        const w = 108 - i * 10;   // 半宽逐级变小
        const cx = 170;
        const d = Math.round(w * 0.577);
        const s = el('g', { class: 'step-tile', style: 'cursor:pointer' }, g);
        // 每级长方体：顶面 + 左右面
        el('polygon', { points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','), fill: '#1D2433', 'stroke-width': 0.5, class: 'soft-edge', style: 'pointer-events:none' }, s);
        el('polygon', { points: [cx - w, cy, cx, cy + d, cx, cy + d + 12, cx - w, cy + 12].join(','), fill: '#141926', class: 'soft-edge', style: 'pointer-events:none' }, s);
        el('polygon', { points: [cx, cy + d, cx + w, cy, cx + w, cy + 12, cx, cy + d + 12].join(','), fill: '#10151F', class: 'soft-edge', style: 'pointer-events:none' }, s);
        // 透明热区（收窄成台阶中心小块，避免相邻台阶热区重叠误命中）
        const hit = el('rect', { x: cx - 10, y: cy - 10, width: 20, height: 20, rx: 3, fill: 'transparent', class: 'hit-area' }, s);
        s.appendChild(hit);
        steps.push(s);
      }
      // 地面（起点）
      isoTop(g, 170, 290, 110, '#151A26', 64);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '按顺序点亮它们';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第四天的台阶</span>';
      let idx = 0, litIdx = [];
      const litStep = (i) => {
        const cy = 268 - i * 27, w = 108 - i * 10, d = Math.round(w * 0.577);
        const glow = el('polygon', {
          points: [170, cy - d, 170 + w, cy, 170, cy + d, 170 - w, cy].join(','),
          fill: '#FFD9A0', opacity: '0.35', class: 'blur-line', style: 'pointer-events:none'
        }, g);
        glow.style.transition = 'opacity 0.5s ease';
        AudioEngine.tone(440 + i * 70, { type: 'sine', dur: 0.5, vol: 0.1 });
        setTimeout(() => glow.setAttribute('opacity', '0.15'), 1200);
      };
      steps.forEach((s, i) => {
        s.addEventListener('pointerdown', () => {
          const expect = order[idx];
          if (i + 1 === expect) {
            idx++;
            litStep(i);
            litIdx.push(i);
            if (idx === 7) {
              AudioEngine.chime('bell');
              el('line', { x1: 60, y1: 252, x2: 280, y2: 252, stroke: '#FFD9A0', 'stroke-width': 3, opacity: '0.8', class: 'blur-line' }, g);
              setTimeout(() => finish(), 1600);
            }
          } else {
            // 点错：暗回已亮的
            litIdx.forEach((li) => { /* 已亮保持，未惩罚 */ });
            if (idx > 0) {
              const w2 = 108 - i * 10, d2 = Math.round(w2 * 0.577);
              const wrongGlow = el('polygon', {
                points: [170, 268 - i * 27 - d2, 170 + w2, 268 - i * 27, 170, 268 - i * 27 + d2, 170 - w2, 268 - i * 27].join(','),
                fill: '#A8B8D8', opacity: '0.25', style: 'pointer-events:none'
              }, g);
              setTimeout(() => wrongGlow.setAttribute('opacity', '0'), 500);
            }
          }
        });
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 5 · 窗（推窗 → 点企鹅）
   * ============================================================ */
  function d5() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 背景：窗外夜空（深蓝 + 柔光星点）——
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // 夜空
      el('rect', { x: 95, y: 52, width: 150, height: 150, rx: 75, ry: 75, fill: '#0A0F1E', style: 'pointer-events:none' }, g);
      [[170, 92], [130, 78], [208, 80], [148, 128], [196, 126], [122, 118], [216, 108], [162, 68]].forEach(([x, y], i) => {
        const st = el('circle', { cx: x, cy: y, r: 1.6 + (i % 3), fill: '#A8B8D8', opacity: '0', class: 'star-bit', style: 'pointer-events:none' }, g);
        setTimeout(() => st.setAttribute('opacity', (0.5 + Math.random() * 0.4).toFixed(2)), 1600 + i * 120);
      });
      // 窗框（拱窗：矩形+半圆）
      el('path', { d: 'M98 202 L98 140 A72 72 0 0 1 242 140 L242 202 Z', fill: 'none', stroke: '#2A2E3A', 'stroke-width': 2, style: 'pointer-events:none' }, g);
      // 窗外冷光
      el('ellipse', { cx: 170, cy: 127, rx: 70, ry: 76, fill: 'url(#moonGlow)', opacity: '0.25', style: 'pointer-events:none;filter:blur(4px)' }, g);
      // —— 中景：正面墙 + 两侧斜墙 + 窗台 + 企鹅 ——
      // 两侧斜墙（向内斜，形成窗的凹空间）
      isoFace(g, ['95,214', '120,196', '120,52', '95,70'], '#11151F', 'soft-edge');
      isoFace(g, ['245,214', '220,196', '220,52', '245,70'], '#0E1220', 'soft-edge');
      // 窗台（横向长方体，伸出墙面）
      isoFace(g, ['118,202', '222,202', '222,210', '118,210'], '#1D2433', 'soft-edge');
      isoFace(g, ['222,202', '236,196', '236,210', '222,210'], '#10151F', 'soft-edge');
      isoFace(g, ['118,202', '104,196', '104,210', '118,210'], '#232B3C', 'soft-edge');
      // 企鹅（坐在窗台上，椭圆身体，整体半透明 + 影子）
      const peng = el('g', { transform: 'translate(214,180)', class: 'penguin-grp', style: 'cursor:pointer' }, g);
      // 透明热区（保证可点，视觉元素不拦截）
      el('ellipse', { cx: 0, cy: 0, rx: 16, ry: 20, fill: 'transparent' }, peng);
      el('ellipse', { cx: 0, cy: 8, rx: 16, ry: 4, fill: 'rgba(0,0,0,0.4)', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, peng);  // 影子
      el('ellipse', { cx: 0, cy: 0, rx: 12, ry: 15, fill: '#2A2E3A', class: 'blur-line', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 0, cy: 4, rx: 8, ry: 10, fill: '#EDE6DA', opacity: '0.9', style: 'pointer-events:none' }, peng);
      el('circle', { cx: -4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('circle', { cx: 4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('polygon', { points: '-1.6,-1 1.6,-1 0,2.4', fill: '#F2B45C', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: -10, cy: 2, rx: 3.4, ry: 5.6, fill: '#2A2E3A', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 10, cy: 2, rx: 3.4, ry: 5.6, fill: '#2A2E3A', style: 'pointer-events:none' }, peng);
      peng.style.opacity = '0.85';
      // 地面
      isoTop(g, 170, 268, 92, '#151A26', 53);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '推开窗';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第五天的窗</span>';
      let pushed = false, tapped = false, finishTimer = null;
      const pushDone = () => {
        if (pushed) return;
        pushed = true;
        // 推窗完成后释放热区，避免拦截企鹅点击
        winHit.style.pointerEvents = 'none';
        AudioEngine.chime('wood');
        AudioEngine.firstMusicBox();
        const pushGlow = el('circle', { cx: 170, cy: 127, r: 72, fill: 'url(#warmGlow)', opacity: '0.7' }, g);
        pushGlow.style.pointerEvents = 'none';
        setTimeout(() => hint.textContent = '点一下企鹅', 900);
      };
      const pengTap = () => {
        if (!pushed || tapped) return;
        tapped = true;
        AudioEngine.musicBox(659.25, { vol: 0.08 });
        peng.style.transition = 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
        peng.style.transform = 'translate(214,172) rotate(3deg)';
        setTimeout(() => peng.style.transform = 'translate(214,172) rotate(0deg)', 600);
        setTimeout(() => finish(), 1000);
      };
      // 推窗：点窗内
      const winHit = el('circle', { cx: 170, cy: 127, r: 70, fill: 'transparent', class: 'hit-area' }, g);
      winHit.addEventListener('pointerdown', pushDone);
      peng.addEventListener('pointerdown', pengTap);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2500);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 6 · 背面（拖动旋转墙 180°，背面小窗）
   * ============================================================ */
  function d6() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // 墙（等距：正面平行四边形 + 顶面窄菱形厚度 + 右侧暗面）
      const wall = el('g', {}, g);
      const wallBody = el('g', { class: 'blur-line' }, wall);
      // 透明热区（保证可拖，视觉元素不拦截）
      el('rect', { x: 92, y: 46, width: 156, height: 210, fill: 'transparent' }, wallBody);
      // 正面（受光，70%）
      el('polygon', { points: '92,46 248,46 248,256 92,256', fill: '#1D2433', style: 'pointer-events:none' }, wallBody);
      // 顶面窄菱形（墙厚度，100% 亮）
      el('polygon', { points: '92,46 248,46 268,40 112,40', fill: '#232B3C', style: 'pointer-events:none' }, wallBody);
      // 右侧暗面（45%）
      el('polygon', { points: '248,46 268,40 268,250 248,256', fill: '#10151F', style: 'pointer-events:none' }, wallBody);
      // 正面极淡阴影（提示可转；纯视觉，不拦截点击）
      el('rect', { x: 92, y: 46, width: 156, height: 210, fill: 'rgba(8,10,16,0.3)', style: 'pointer-events:none' }, wallBody);
      el('rect', { x: 96, y: 50, width: 148, height: 202, fill: 'none', stroke: 'rgba(242,180,92,0.08)', 'stroke-width': 1, style: 'pointer-events:none' }, wallBody);
      // 背面的小窗（旋转后出现；纯视觉，不拦截拖拽）
      const backWin = el('g', { class: 'back-win', opacity: '0', style: 'pointer-events:none' }, wall);
      el('rect', { x: 150, y: 112, width: 36, height: 50, rx: 18, ry: 18, fill: '#080A10', stroke: '#FFD9A0', 'stroke-width': 1.4, class: 'blur-line' }, backWin);
      // 窗内暖光
      el('circle', { cx: 168, cy: 137, r: 22, fill: 'url(#warmGlow)', opacity: '0.7', style: 'filter:blur(4px)' }, backWin);
      // 两侧地面菱形（判断墙立着）
      isoTop(g, 60, 270, 52, '#151A26', 30);
      isoTop(g, 280, 270, 52, '#141824', 30);
      // 墙在地面的斜影（方向与光向一致，左下）
      el('polygon', { points: '92,256 246,256 282,282 128,282', fill: 'rgba(0,0,0,0.45)', class: 'blur-line', style: 'pointer-events:none;filter:blur(3px)' }, g);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '转一下看看';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第六天的背面</span>';
      let rotating = false, sx = 0, sy = 0, done = false, rotCur = 0;
      const onMove = (e) => {
        if (!rotating) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        const rot = Math.max(0, Math.min(180, dx * 0.85));
        rotCur = rot;
        wallBody.style.transform = `perspective(700px) rotateY(${rot.toFixed(1)}deg)`;
        wallBody.style.transformOrigin = '50% 50%';
        wallBody.style.transition = 'none';
        if (rot > 100) {
          backWin.setAttribute('opacity', String((rot - 100) / 80 * 0.95).slice(0, 4));
        }
      };
      const onUp = () => {
        if (!rotating) return;
        rotating = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!done && rotCur >= 135) {
          done = true;
          AudioEngine.chime('bell');
          wallBody.style.transition = 'transform 0.9s cubic-bezier(0.22,0.61,0.36,1)';
          wallBody.style.transform = 'perspective(700px) rotateY(180deg)';
          backWin.setAttribute('opacity', '0.95');
          setTimeout(() => hint.textContent = '推开那扇小窗', 900);
          setTimeout(() => {
            if (window.__sceneHint) window.__sceneHint.textContent = '推开那扇小窗';
          }, 800);
          // 点小窗完成
          const winHit = el('rect', { x: 148, y: 110, width: 40, height: 54, fill: 'transparent', class: 'hit-area' }, g);
          winHit.addEventListener('pointerdown', () => {
            if (done && !finishedFlag) {
              AudioEngine.chime('wood');
              el('circle', { cx: 170, cy: 137, r: 34, fill: 'url(#warmGlow)', opacity: '0.8' }, g);
              setTimeout(() => finish(), 1300);
            }
          });
        } else {
          wallBody.style.transition = 'transform 0.8s cubic-bezier(0.22,0.61,0.36,1)';
          wallBody.style.transform = 'perspective(700px) rotateY(0deg)';
          backWin.setAttribute('opacity', '0');
        }
      };
      wallBody.addEventListener('pointerdown', (e) => {
        rotating = true;
        sx = e.touches ? e.touches[0].clientX : e.clientX;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      let finishedFlag = false;
      const finish = () => {
        if (finishedFlag) return;
        finishedFlag = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2500);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 7 · 回声（浮石按音高从低到高点亮）
   * ============================================================ */
  function d7() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#080A10' }, g);
      // —— 背景：虚空（深色渐变往下更黑）——
      el('rect', { x: 0, y: 120, width: 340, height: 180, fill: 'rgba(8,10,16,0.9)', style: 'pointer-events:none' }, g);
      // 前景悬浮光柱（极细，增加纵深）
      isoBox(g, 44, 150, 3, 96, '#131826', 2);
      isoBox(g, 300, 168, 3, 82, '#10151F', 2);
      isoBox(g, 316, 130, 2, 60, '#0E1320', 1);
      // 5 块浮石（扁长方体：顶面菱形 + 四面矮；音高从低到高：左→右）
      const freq = [220, 277, 330, 370, 440];
      const stones = [];
      const xs = [88, 126, 166, 206, 246];
      const ys = [142, 134, 148, 136, 144];
      const colors = ['#FFD9A0', '#F2B45C', '#A8B8D8', '#F2B45C', '#FFD9A0'];
      const stoneBox = (g2, cx, cy, w, h, c) => {
        const d = Math.round(w * 0.577);
        el('polygon', { points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','), fill: c, class: 'soft-edge', style: 'pointer-events:none' }, g2);
        el('polygon', { points: [cx - w, cy, cx, cy + d, cx, cy + d + h, cx - w, cy + h].join(','), fill: shade(c, 0.7), class: 'soft-edge', style: 'pointer-events:none' }, g2);
        el('polygon', { points: [cx, cy + d, cx + w, cy, cx + w, cy + h, cx, cy + d + h].join(','), fill: shade(c, 0.45), class: 'soft-edge', style: 'pointer-events:none' }, g2);
      };
      freq.forEach((f, i) => {
        // 浮石投影（下方淡椭圆光晕）
        el('ellipse', { cx: xs[i], cy: ys[i] + 18, rx: 18, ry: 5, fill: 'url(#warmGlow)', opacity: '0.28', style: 'pointer-events:none;filter:blur(3px)' }, g);
        const st = el('g', { transform: `translate(${xs[i]},${ys[i]})`, class: 'stone', style: 'cursor:pointer' }, g);
        // 透明热区（保证可点）
        el('polygon', { points: [0, -12, 24, 0, 0, 12, -24, 0].join(','), fill: 'transparent' }, st);
        stoneBox(st, 0, 0, 22, 8, '#1A1E2A');
        st.dataset.f = f;
        st.dataset.i = i;
        stones.push(st);
        st.addEventListener('pointerdown', () => {
          AudioEngine.musicBox(f, { dur: 1.2, vol: 0.12 });
          const ring = el('circle', { cx: xs[i], cy: ys[i], r: 30, fill: colors[i], opacity: '0.5', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, g);
        });
      });
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '听，然后按顺序';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第七天的回声</span>';
      let idx = 0;
      const check = (i) => {
        if (i !== idx) {
          // 点错：暗回
          stones[i].style.transition = 'opacity 0.4s ease';
          stones[i].setAttribute('opacity', '0.35');
          setTimeout(() => stones[i].setAttribute('opacity', '1'), 600);
          return;
        }
        idx++;
        stones[i].style.transition = 'opacity 0.6s ease';
        stones[i].setAttribute('opacity', '0.55');
        const glow = el('circle', { cx: xs[i], cy: ys[i], r: 26, fill: 'url(#warmGlow)', opacity: '0.85' }, g);
        glow.style.pointerEvents = 'none';
        if (idx === 5) {
          AudioEngine.chime('bell');
          el('line', { x1: 70, y1: 165, x2: 270, y2: 165, stroke: '#FFD9A0', 'stroke-width': 3, opacity: '0.85', class: 'blur-line' }, g);
          setTimeout(() => finish(), 1500);
        }
      };
      stones.forEach((s) => s.addEventListener('pointerdown', () => check(Number(s.dataset.i))));
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 8 · 影子（拖光源角度 → 影子指向墙角 → 墙裂开门）
   * ============================================================ */
  function d8() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：左右墙（融黑）——
      isoFace(g, ['30,140', '110,60', '110,300', '30,300'], '#11151F', 'soft-edge');
      isoFace(g, ['310,140', '230,60', '230,300', '310,300'], '#0E1220', 'soft-edge');
      // 地面：大菱形切块
      isoTop(g, 170, 262, 128, '#151A26', 74);
      isoTop(g, 170, 262, 88, '#191F2D', 51);
      isoTop(g, 170, 262, 50, '#1D2433', 29);
      // —— 中景：光束 + 光源 + 影子 ——
      // 光束（左上斜射，半透明梯形）
      const beam = el('polygon', { points: '280,40 120,290 220,290', fill: 'rgba(242,180,92,0.10)', class: 'blur-line', style: 'pointer-events:none' }, g);
      // 光源（可拖）
      const lightSrc = el('circle', { cx: 280, cy: 42, r: 8, fill: '#FFF3E0', class: 'blur-line', style: 'cursor:grab' }, g);
      const lightGlow = el('circle', { cx: 280, cy: 42, r: 30, fill: 'url(#warmGlow)', opacity: '0.6', style: 'pointer-events:none;filter:blur(8px)' }, g);
      // 几何影子（菱形，边缘化开，随角度移动；可点可拖）
      const shadowG = el('g', { transform: 'translate(150,270)', opacity: '0.9', style: 'cursor:grab' }, g);
      el('polygon', { points: '0,0 34,-8 52,0 30,6', fill: 'rgba(0,0,0,0.55)', class: 'blur-line', style: 'filter:blur(2px)' }, shadowG);
      // 墙角门（影子和墙角重合时裂开）
      const crackDoor = el('g', { class: 'crack-door', opacity: '0', style: 'pointer-events:none' }, g);
      el('rect', { x: 150, y: 128, width: 40, height: 96, rx: 20, ry: 20, fill: '#080A10', stroke: '#FFD9A0', 'stroke-width': 1.2, class: 'blur-line' }, crackDoor);
      el('circle', { cx: 170, cy: 176, r: 26, fill: 'url(#warmGlow)', opacity: '0.7', style: 'filter:blur(6px)' }, crackDoor);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '跟着影子走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第八天的影子</span>';
      let dragging = false, sx = 0, done = false, angle = 0;
      const onMove = (e) => {
        if (!dragging) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        angle = Math.max(-60, Math.min(0, dx * 0.4));
        shadowG.setAttribute('transform', `translate(${(150 + angle * 0.9).toFixed(1)},270)`);
        lightSrc.setAttribute('cx', String(280 + angle));
        beam.setAttribute('points', `${280 + angle},40 120,290 220,290`);
        AudioEngine.tone(60, { type: 'sine', dur: 0.1, vol: 0.015 });
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!done && angle <= -35) {
          done = true;
          AudioEngine.lowHum();
          crackDoor.setAttribute('opacity', '1');
          el('circle', { cx: 170, cy: 176, r: 40, fill: 'url(#warmGlow)', opacity: '0.8' }, g);
          setTimeout(() => {
            const winHit = el('rect', { x: 148, y: 126, width: 44, height: 100, fill: 'transparent', class: 'hit-area' }, g);
            winHit.addEventListener('pointerdown', () => {
              AudioEngine.chime('wood');
              setTimeout(() => finish(), 1200);
            });
          }, 900);
        }
      };
      lightSrc.addEventListener('pointerdown', (e) => {
        dragging = true;
        sx = e.touches ? e.touches[0].clientX : e.clientX;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      // 也允许直接拖动影子
      shadowG.addEventListener('pointerdown', (e) => {
        dragging = true;
        sx = e.touches ? e.touches[0].clientX : e.clientX;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2500);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 9 · 错位（拖动翻转合上）
   * ============================================================ */
  function d9() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：虚空（深色渐变）——
      el('rect', { x: 0, y: 80, width: 340, height: 220, fill: 'rgba(8,10,16,0.6)', style: 'pointer-events:none' }, g);
      // —— 中景：两个不规则多面体（3-4 平行四边形拼）——
      // 几何体 A（左上方，缺口，悬空）
      const geomA = el('g', { transform: 'translate(120,150)' }, g);
      el('polygon', { points: '-60,-60 -10,-60 -10,40 -60,40', fill: '#1D2433', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '-10,-60 20,-40 20,60 -10,40', fill: '#141926', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '-60,40 -10,40 20,60 -30,60', fill: '#10151F', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '18,-10 54,-10 54,30 18,30', fill: '#080A10', stroke: 'rgba(242,180,92,0.35)', 'stroke-width': 1, style: 'pointer-events:none' }, geomA); // 缺口
      // 几何体 B（右下方，可转，凸块）
      const fitG = el('g', { transform: 'translate(255,150)', style: 'cursor:grab', class: 'fit-grp' }, g);
      // 透明热区（保证可拖）
      el('rect', { x: -80, y: -60, width: 160, height: 120, fill: 'transparent' }, fitG);
      el('polygon', { points: '-80,-60 -10,-60 -10,60 -80,60', fill: '#1D2433', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('polygon', { points: '-10,-60 20,-40 20,60 -10,60', fill: '#141926', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('polygon', { points: '-80,60 -10,60 20,60 -50,60', fill: '#10151F', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('rect', { x: -36, y: -22, width: 36, height: 42, fill: '#F2B45C', opacity: '0.55', class: 'blur-line', style: 'pointer-events:none' }, fitG);
      // 缝隙（暗色）
      el('rect', { x: 196, y: 108, width: 8, height: 96, fill: 'rgba(0,0,0,0.45)', style: 'pointer-events:none' }, g);
      // 各几何体下方淡光晕（悬空感）
      el('ellipse', { cx: 130, cy: 226, rx: 46, ry: 10, fill: 'url(#warmGlow)', opacity: '0.18', style: 'pointer-events:none;filter:blur(6px)' }, g);
      el('ellipse', { cx: 258, cy: 226, rx: 46, ry: 10, fill: 'url(#warmGlow)', opacity: '0.18', style: 'pointer-events:none;filter:blur(6px)' }, g);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '把它们合上';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第九天的错位</span>';
      let dragging = false, sx = 0, sy = 0, done = false;
      const onMove = (e) => {
        if (!dragging) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        fitG.setAttribute('transform', `translate(${(255 + dx).toFixed(1)},150)`);
      };
      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (dx < -60) {
          done = true;
          AudioEngine.chime('metal');
          fitG.style.transition = 'transform 0.9s cubic-bezier(0.22,0.61,0.36,1)';
          fitG.setAttribute('transform', 'translate(175,150)');
          el('line', { x1: 175, y1: 92, x2: 175, y2: 208, stroke: '#FFD9A0', 'stroke-width': 2, opacity: '0.9', class: 'blur-line' }, g);
          setTimeout(() => finish(), 1300);
        } else {
          fitG.style.transition = 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
          fitG.setAttribute('transform', 'translate(255,150)');
        }
      };
      fitG.addEventListener('pointerdown', (e) => {
        dragging = true;
        sx = e.touches ? e.touches[0].clientX : e.clientX;
        fitG.style.transition = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2500);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 10 · 井（往下走 5 阶 → 点星星罐，星星一颗颗亮起）
   * ============================================================ */
  function d10() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#080A10' }, g);
      // —— 背景：井壁（环形墙，越往下越暗）——
      el('ellipse', { cx: 170, cy: 140, rx: 150, ry: 48, fill: '#10151F', style: 'pointer-events:none' }, g);
      el('ellipse', { cx: 170, cy: 140, rx: 124, ry: 40, fill: '#0D111C', style: 'pointer-events:none' }, g);
      // 井口椭圆环（最上方边缘，受光）
      el('ellipse', { cx: 170, cy: 100, rx: 150, ry: 46, fill: 'none', stroke: '#1D2433', 'stroke-width': 8, style: 'pointer-events:none' }, g);
      // —— 中景：一圈圈向下的螺旋台阶（长方体，逐级旋转逐级下降）——
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const r = 150 - i * 26;
        const ry = r * 0.32;
        const cy = 140 + i * 3;
        // 台阶顶面（菱形环段，每次旋转偏移）
        const off = i * 9;
        const rr = el('ellipse', { cx: 170, cy: cy, rx: r, ry: ry, fill: 'none', stroke: '#1A1E2A', 'stroke-width': 10, opacity: '0.9', style: 'pointer-events:none' }, g);
        // 立体台阶块（每级一小段长方体，螺旋旋转）
        const a = (i * 0.9 + 0.4) * Math.PI;
        const bx = 170 + Math.cos(a) * (r - 8) * 0.72;
        const by = cy + Math.sin(a) * (r - 8) * 0.36;
        isoBox(g, bx, by, 14, 9, '#1D2433', 8);
        rings.push(rr);
      }
      // 井底（椭圆，最亮）
      el('ellipse', { cx: 170, cy: 158, rx: 30, ry: 10, fill: '#232B3C', style: 'pointer-events:none' }, g);
      // 井底灯（梯形灯座 + 圆灯芯 + 三层光雾）
      const wellLight = el('circle', { cx: 170, cy: 158, r: 26, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(8px)' }, g);
      fog(g, 170, 158, 10, 0, 'well-fog-1');
      // 星星罐（重点：裂痕 + 星星；罐体透明填充保证可点）
      const jarG = el('g', { transform: 'translate(196,152)', style: 'cursor:pointer', opacity: '0', class: 'jar-grp' }, g);
      el('rect', { x: -14, y: -18, width: 28, height: 34, rx: 6, fill: 'transparent' }, jarG);
      // 罐身（描边不填充）
      el('rect', { x: -12, y: -16, width: 24, height: 30, rx: 6, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jarG);
      // 罐口
      el('rect', { x: -9, y: -19, width: 18, height: 4, rx: 2, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jarG);
      // 裂痕（两三笔折线，裂痕后叠暖光）
      el('polyline', { points: '-9,-14 -6,-4 -10,4 -5,12', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.8', style: 'pointer-events:none' }, jarG);
      el('polyline', { points: '7,-10 9,0 6,8', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.6', style: 'pointer-events:none' }, jarG);
      // 裂痕后暖光
      el('ellipse', { cx: 196, cy: 152, rx: 12, ry: 15, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(4px)', class: 'jar-glow-bg' }, g);
      // 倒锥形光（越往下越亮）
      el('polygon', { points: '120,0 220,0 188,170 152,170', fill: 'rgba(242,180,92,0.05)', style: 'pointer-events:none' }, g);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '往下走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十天的井</span>';
      let descend = 0, starsLit = 0, starTotal = 36;
      const onDescend = () => {
        if (descend >= 5) return;
        descend++;
        AudioEngine.step();
        const stepGlow = el('ellipse', { cx: 170, cy: 108 + descend * 12, rx: 150 - descend * 26, ry: (150 - descend * 26) * 0.3, fill: 'none', stroke: '#FFD9A0', 'stroke-width': 2, opacity: '0.5', class: 'blur-line', style: 'pointer-events:none' }, g);
        setTimeout(() => stepGlow.setAttribute('opacity', '0.15'), 900);
        if (descend === 5) {
          wellLight.style.transition = 'opacity 1.2s ease';
          wellLight.setAttribute('opacity', '0.95');
          jarG.style.transition = 'opacity 1.4s ease';
          jarG.setAttribute('opacity', '1');
          const jarBg = g.querySelector('.jar-glow-bg');
          if (jarBg) { jarBg.style.transition = 'opacity 1.4s ease'; jarBg.setAttribute('opacity', '0.35'); }
          // 释放命中区，让星星罐可点
          hits.forEach((h) => h.style.pointerEvents = 'none');
          AudioEngine.lowHum(2.5, 0.06);
          setTimeout(() => hint.textContent = '点那罐星星', 1000);
        }
      };
      // 每阶可点（收窄为台阶中心小圆，避免相邻环重叠误命中）
      const hits = [];
      for (let i = 0; i < 5; i++) {
        const hit = el('circle', { cx: 170, cy: 100 + i * 12, r: 6, fill: 'transparent', class: 'hit-area' }, g);
        hits.push(hit);
        hit.addEventListener('pointerdown', onDescend);
      }
      // 星星罐点击：星星一颗颗亮
      const onJar = () => {
        if (descend < 5 || starsLit >= starTotal) return;
        // 生成 36 颗星星
        if (starsLit === 0) {
          for (let i = 0; i < starTotal; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.random() * 16;
            setTimeout(() => {
              const s = el('circle', {
                cx: 196 + Math.cos(a) * rr,
                cy: 152 + Math.sin(a) * rr * 0.7,
                r: 1.2 + Math.random() * 1.4,
                fill: '#A8B8D8',
                opacity: '0',
                class: 'blur-line'
              }, g);
              s.style.transition = 'opacity 0.5s ease';
              s.setAttribute('opacity', (0.6 + Math.random() * 0.3).toFixed(2));
              starsLit++;
              AudioEngine.musicBox(880 + starsLit * 6, { dur: 0.7, vol: 0.05 });
              if (starsLit === starTotal) {
                AudioEngine.fullMelody();
                setTimeout(() => finish(), 2600);
              }
            }, i * 55);
          }
        }
      };
      jarG.addEventListener('pointerdown', onJar);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 11 · 碎片（拖 5 片归位拼成一扇窗）
   * ============================================================ */
  function d11() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：四周墙退到边缘（几条平行四边形）——
      isoFace(g, ['30,60', '110,100', '110,300', '30,300'], '#11151F', 'soft-edge');
      isoFace(g, ['310,60', '230,100', '230,300', '310,300'], '#0E1220', 'soft-edge');
      // 地面：大等距菱形
      isoTop(g, 170, 262, 132, '#151A26', 76);
      isoTop(g, 170, 262, 94, '#191F2D', 54);
      // —— 中景：窗轮廓（目标位）+ 碎片 ——
      // 窗形轮廓（矩形+半圆，地面上的淡淡轮廓）
      const frame = el('g', { opacity: '0.25', style: 'pointer-events:none' }, g);
      el('rect', { x: 110, y: 70, width: 120, height: 150, rx: 60, ry: 60, fill: 'none', stroke: '#2A2E3A', 'stroke-width': 1.6 }, frame);
      // 5 片碎片（可拖；每片 3-4 个平行四边形拼成）
      const pieces = [
        { x: 46, y: 42, w: 46, h: 30, slot: [112, 72] },
        { x: 250, y: 60, w: 44, h: 34, slot: [160, 110] },
        { x: 36, y: 190, w: 48, h: 32, slot: [112, 150] },
        { x: 258, y: 200, w: 44, h: 30, slot: [176, 188] },
        { x: 146, y: 236, w: 42, h: 28, slot: [136, 130] }
      ];
      const placed = [false, false, false, false, false];
      const pieceGs = pieces.map((p, i) => {
        const pg = el('g', { transform: `translate(${p.x},${p.y})`, style: 'cursor:grab', class: 'piece-grp' }, g);
        // 透明热区（保证可拖）
        el('rect', { x: -6, y: -6, width: p.w + 12, height: p.h + 12, rx: 4, fill: 'transparent' }, pg);
        // 立体碎片（三面）
        const c = ['#1D2433', '#1A2130', '#232B3C'][i % 3];
        el('polygon', { points: `0,0 ${p.w},0 ${p.w + 8},${Math.round(p.h * 0.3)} ${8},${Math.round(p.h * 0.3)}`, fill: c, class: 'soft-edge', style: 'pointer-events:none' }, pg);
        el('polygon', { points: `${p.w},0 ${p.w + 8},${Math.round(p.h * 0.3)} ${p.w + 8},${Math.round(p.h * 0.3) + 8} ${p.w},${p.h}`, fill: shade(c, 0.45), class: 'soft-edge', style: 'pointer-events:none' }, pg);
        el('polygon', { points: `8,${Math.round(p.h * 0.3)} ${p.w + 8},${Math.round(p.h * 0.3)} ${p.w + 8},${Math.round(p.h * 0.3) + 8} ${8},${Math.round(p.h * 0.3) + 8}`, fill: shade(c, 0.7), class: 'soft-edge', style: 'pointer-events:none' }, pg);
        el('circle', { cx: p.w / 2, cy: p.h / 2, r: 6, fill: '#FFD9A0', opacity: '0.5', style: 'pointer-events:none' }, pg);
        return pg;
      });
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '放回去';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十一天的碎片</span>';
      let drag = null;
      const onMove = (e) => {
        if (!drag) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - drag.sx;
        const dy = (e.touches ? e.touches[0].clientY : e.clientY) - drag.sy;
        drag.g.setAttribute('transform', `translate(${drag.base[0] + dx},${drag.base[1] + dy})`);
      };
      const onUp = (e) => {
        if (!drag) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - drag.sx;
        const dy = (e.touches ? e.touches[0].clientY : e.clientY) - drag.sy;
        const px = drag.base[0] + dx, py = drag.base[1] + dy;
        const p = drag.p;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        // 判断归位
        if (Math.abs(px - p.slot[0]) < 34 && Math.abs(py - p.slot[1]) < 30) {
          placed[drag.i] = true;
          AudioEngine.chime('bell');
          drag.g.style.transition = 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
          drag.g.setAttribute('transform', `translate(${p.slot[0]},${p.slot[1]})`);
          const slotGlow = el('rect', { x: p.slot[0], y: p.slot[1], width: p.w, height: p.h, rx: 4, fill: '#FFD9A0', opacity: '0.4', class: 'blur-line' }, g);
          setTimeout(() => slotGlow.setAttribute('opacity', '0.18'), 700);
          if (placed.every(Boolean)) {
            AudioEngine.chime('bell');
            frame.setAttribute('opacity', '1');
            el('circle', { cx: 170, cy: 145, r: 46, fill: 'url(#warmGlow)', opacity: '0.8' }, g);
            setTimeout(() => finish(), 1500);
          }
        } else {
          drag.g.style.transition = 'transform 0.5s cubic-bezier(0.22,0.61,0.36,1)';
          drag.g.setAttribute('transform', `translate(${p.x},${p.y})`);
        }
        drag = null;
      };
      pieceGs.forEach((pg, i) => {
        pg.addEventListener('pointerdown', (e) => {
          drag = { g: pg, i, p: pieces[i], base: [pieces[i].x, pieces[i].y], sx: e.touches ? e.touches[0].clientX : e.clientX, sy: e.touches ? e.touches[0].clientY : e.clientY };
          pg.style.transition = 'none';
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 12 · 双人（点方向走暖人偶，冷人偶跟随，走到同一格）
   * ============================================================ */
  function d12() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：四周墙退到边缘 ——
      isoFace(g, ['30,60', '110,100', '110,300', '30,300'], '#11151F', 'soft-edge');
      isoFace(g, ['310,60', '230,100', '230,300', '310,300'], '#0E1220', 'soft-edge');
      // —— 中景：格状地面（大菱形切小菱形棋盘）——
      const grid = 5, cell = 42, ox = 70, oy = 80;
      // 棋盘外的大等距菱形
      isoTop(g, 170, 240, 128, '#151A26', 74);
      // 棋盘（小菱形格，等距）
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const cx = ox + c * cell + cell / 2;
          const cy = oy + r * cell + cell / 2;
          const w = cell / 2;
          const d = Math.round(w * 0.577);
          const fill = (r + c) % 2 === 0 ? 'rgba(26,30,42,0.75)' : 'rgba(29,36,51,0.75)';
          el('polygon', { points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','), fill: fill, stroke: '#2A2E3A', 'stroke-width': 0.4, style: 'pointer-events:none' }, g);
        }
      }
      // 暖人偶（玩家，左上方：圆头 + 梯形身体）
      const warmG = el('g', { transform: `translate(${ox + 0 * cell + cell / 2},${oy + 2 * cell + cell / 2})`, class: 'warm-fig' }, g);
      el('circle', { cx: 0, cy: -10, r: 8, fill: '#FFD9A0', class: 'blur-line', style: 'pointer-events:none' }, warmG);
      el('polygon', { points: '-8,-2 8,-2 5,10 -5,10', fill: '#FFD9A0', opacity: '0.9', style: 'pointer-events:none' }, warmG);
      el('ellipse', { cx: 0, cy: 2, rx: 12, ry: 7, fill: 'url(#warmGlow)', opacity: '0.5', style: 'pointer-events:none;filter:blur(6px)' }, warmG);
      // 冷人偶（跟随，右下方）
      const coldG = el('g', { transform: `translate(${ox + 4 * cell + cell / 2},${oy + 2 * cell + cell / 2})`, class: 'cold-fig' }, g);
      el('circle', { cx: 0, cy: -10, r: 8, fill: '#A8B8D8', class: 'blur-line', style: 'pointer-events:none' }, coldG);
      el('polygon', { points: '-8,-2 8,-2 5,10 -5,10', fill: '#A8B8D8', opacity: '0.85', style: 'pointer-events:none' }, coldG);
      el('ellipse', { cx: 0, cy: 2, rx: 12, ry: 7, fill: 'url(#moonGlow)', opacity: '0.5', style: 'pointer-events:none;filter:blur(6px)' }, coldG);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '带它走过去';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十二天的双人</span>';
      // 方向键
      const keys = document.createElement('div');
      keys.className = 'dir-keys';
      keys.style.cssText = 'position:absolute;bottom:10vh;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:4;';
      const mk = (label, dx, dy) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = 'dir-btn';
        b.dataset.dx = dx;
        b.dataset.dy = dy;
        b.style.cssText = 'width:52px;height:52px;border-radius:50%;background:rgba(26,30,42,0.8);border:1px solid rgba(242,180,92,0.4);color:#FFD9A0;font-size:20px;cursor:pointer;font-family:inherit;';
        b.addEventListener('pointerdown', () => move(dx, dy));
        keys.appendChild(b);
      };
      mk('←', -1, 0); mk('↑', 0, -1); mk('↓', 0, 1); mk('→', 1, 0);
      wrap.appendChild(keys);
      let warm = [0, 2], cold = [4, 2], moved = 0;
      const move = (dx, dy) => {
        const nx = warm[0] + dx, ny = warm[1] + dy;
        if (nx < 0 || nx >= grid || ny < 0 || ny >= grid) return;
        warm = [nx, ny];
        warmG.style.transition = 'transform 0.5s cubic-bezier(0.22,0.61,0.36,1)';
        warmG.setAttribute('transform', `translate(${ox + nx * cell + cell / 2},${oy + ny * cell + cell / 2})`);
        // 冷人偶跟随一步（向暖人偶靠近）
        const cdx = Math.sign(nx - cold[0]), cdy = Math.sign(ny - cold[1]);
        const cnx = cold[0] + cdx, cny = cold[1] + cdy;
        if (cnx >= 0 && cnx < grid && cny >= 0 && cny < grid) {
          cold = [cnx, cny];
          coldG.style.transition = 'transform 0.5s cubic-bezier(0.22,0.61,0.36,1)';
          coldG.setAttribute('transform', `translate(${ox + cnx * cell + cell / 2},${oy + cny * cell + cell / 2})`);
        }
        AudioEngine.step();
        // 走过的格子留淡光痕
        const trace = el('rect', { x: ox + nx * cell, y: oy + ny * cell, width: cell, height: cell, fill: '#FFD9A0', opacity: '0.22', class: 'blur-line' }, g);
        setTimeout(() => trace.setAttribute('opacity', '0.04'), 1200);
        moved++;
        if (warm[0] === cold[0] && warm[1] === cold[1]) {
          AudioEngine.chime('bell');
          el('circle', { cx: ox + nx * cell + cell / 2, cy: oy + ny * cell + cell / 2, r: 40, fill: 'url(#warmGlow)', opacity: '0.9' }, g);
          setTimeout(() => finish(), 1400);
        }
      };
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        keys.remove();
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 13 · 回廊（点着向前走，两侧门打开，掠过句子影子）
   * ============================================================ */
  function d13() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：尽头融光 ——
      fog(g, 170, 60, 40, 0.55, 'fade-in-svg');
      fog(g, 170, 60, 70, 0.3, 'fade-in-svg');
      // 天花板（连接两墙，向远处收窄）
      isoFace(g, ['132,36', '208,36', '226,54', '114,54'], '#11151F', 'soft-edge');
      // —— 中景：地面长菱形 + 左右墙（带门）——
      // 地面（长菱形）
      isoTop(g, 170, 262, 118, '#151A26', 68);
      // 左墙 + 右侧暗面
      isoFace(g, ['62,272', '128,168', '128,36', '62,120'], '#131826', 'soft-edge');
      isoFace(g, ['278,272', '212,168', '212,36', '278,120'], '#0F1522', 'soft-edge');
      // 暖光长廊
      el('rect', { x: 0, y: 78, width: 340, height: 108, fill: 'rgba(242,180,92,0.04)', style: 'pointer-events:none' }, g);
      // 两侧 3-4 扇门（矩形+半圆，门内透暖光色差）——两侧各 13 门为走步计数
      const doors = [];
      for (let i = 0; i < 13; i++) {
        const x = 26 + i * 24;
        const d = el('g', {}, g);
        // 左门（矩形+半圆）
        el('path', { d: `M${x} 180 L${x} 102 A8 8 0 0 1 ${x + 16} 102 L${x + 16} 180 Z`, fill: '#1D2433', stroke: '#2A2E3A', 'stroke-width': 0.7, opacity: '0.9', style: 'pointer-events:none' }, d);
        // 左门内暖光
        el('path', { d: `M${x + 2} 178 L${x + 2} 104 A6 6 0 0 1 ${x + 14} 104 L${x + 14} 178 Z`, fill: 'url(#warmGlow)', opacity: '0.14', style: 'pointer-events:none' }, d);
        // 右门（对称）
        el('path', { d: `M${x} 214 L${x} 136 A8 8 0 0 1 ${x + 16} 136 L${x + 16} 214 Z`, fill: '#1D2433', stroke: '#2A2E3A', 'stroke-width': 0.7, opacity: '0.9', style: 'pointer-events:none' }, d);
        el('path', { d: `M${x + 2} 212 L${x + 2} 138 A6 6 0 0 1 ${x + 14} 138 L${x + 14} 212 Z`, fill: 'url(#warmGlow)', opacity: '0.12', style: 'pointer-events:none' }, d);
        doors.push(d);
      }
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '往前走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十三天的回廊</span>';
      let pos = 0;
      const walk = () => {
        if (pos >= 13) return;
        const d = doors[pos];
        // 门开
        d.style.transition = 'opacity 0.6s ease';
        d.setAttribute('opacity', '0.35');
        const litDoor = el('path', { d: `M${26 + pos * 24} 178 L${26 + pos * 24} 104 A6 6 0 0 1 ${26 + pos * 24 + 12} 104 L${26 + pos * 24 + 12} 178 Z`, fill: '#FFD9A0', opacity: '0.3', class: 'blur-line', style: 'pointer-events:none' }, g);
        litDoor.style.pointerEvents = 'none';
        // 句子影子（淡，掠过）
        if (window.DAYS && window.DAYS[pos]) {
          const ghost = document.createElement('div');
          ghost.className = 'ghost-line';
          ghost.textContent = window.DAYS[pos].line;
          ghost.style.cssText = 'position:absolute;left:50%;top:34vh;transform:translateX(-50%);font-size:12px;letter-spacing:0.08em;color:rgba(242,180,92,0.0);white-space:nowrap;transition:opacity 2.4s ease,color 2.4s ease;z-index:3;pointer-events:none;';
          wrap.appendChild(ghost);
          setTimeout(() => { ghost.style.color = 'rgba(242,180,92,0.55)'; }, 200);
          setTimeout(() => { ghost.style.color = 'rgba(242,180,92,0)'; ghost.remove(); }, 2600);
        }
        AudioEngine.chime(['bell', 'wood', 'water', 'metal'][pos % 4]);
        pos++;
        if (pos >= 13) {
          AudioEngine.chime('bell');
          setTimeout(() => finish(), 1200);
        }
      };
      // 点任意门/画面推进
      const hit = el('rect', { x: 0, y: 0, width: 340, height: 300, fill: 'transparent', class: 'hit-area' }, g);
      hit.addEventListener('pointerdown', walk);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 1000);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 14 · 信（点信封 → 展开，14 句浮现）
   * ============================================================ */
  function d14() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0E1220' }, g);
      // —— 背景：四周墙退到四边（很淡的边）——
      isoFace(g, ['30,60', '110,100', '110,300', '30,300'], '#11151F', 'soft-edge');
      isoFace(g, ['310,60', '230,100', '230,300', '310,300'], '#0E1220', 'soft-edge');
      // 全暖光铺底
      el('ellipse', { cx: 170, cy: 150, rx: 150, ry: 100, fill: 'url(#warmGlow)', opacity: '0.12', style: 'pointer-events:none;filter:blur(8px)' }, g);
      // —— 中景：企鹅 + 星星罐 + 中央悬浮信 + 前 13 天几何体环形排列 ——
      // 企鹅（信左侧，半透明浮着）
      const peng = el('g', { transform: 'translate(66,196)', class: 'float-slow', opacity: '0.9' }, g);
      el('ellipse', { cx: 0, cy: 6, rx: 14, ry: 4, fill: 'rgba(0,0,0,0.3)', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, peng);
      el('ellipse', { cx: 0, cy: 0, rx: 12, ry: 15, fill: '#2A2E3A', class: 'blur-line', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 0, cy: 4, rx: 8, ry: 10, fill: '#EDE6DA', opacity: '0.9', style: 'pointer-events:none' }, peng);
      el('circle', { cx: -4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('circle', { cx: 4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('polygon', { points: '-1.6,-1 1.6,-1 0,2.4', fill: '#F2B45C', style: 'pointer-events:none' }, peng);
      // 星星罐（信右侧，半透明，裂痕微光）
      const jar = el('g', { transform: 'translate(274,196)', class: 'float-slow', opacity: '0.9' }, g);
      el('rect', { x: -12, y: -16, width: 24, height: 30, rx: 6, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jar);
      el('polyline', { points: '-9,-14 -6,-4 -10,4 -5,12', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.8', style: 'pointer-events:none' }, jar);
      el('circle', { cx: 2, cy: 2, r: 1.5, fill: '#A8B8D8', opacity: '0.7', style: 'pointer-events:none' }, jar);
      el('circle', { cx: -3, cy: -4, r: 1.2, fill: '#A8B8D8', opacity: '0.5', style: 'pointer-events:none' }, jar);
      // 前 13 天几何体缩小环形排列（四周）
      [[70, 96, 5], [110, 70, 7], [230, 70, 6], [272, 96, 7], [286, 136, 5], [272, 178, 6], [230, 208, 7], [110, 208, 6], [70, 178, 5]].forEach(([px, py, s], i) => {
        isoBox(g, px, py, s, s * 1.4, ['#1D2433', '#232B3C', '#141926'][i % 3], 0);
      });
      // 中央悬浮信（圆角矩形，暖白柔边，暖色手写字）
      const env = el('g', { transform: 'translate(170,132)', style: 'cursor:pointer', class: 'env-grp' }, g);
      // 透明热区（保证可点，视觉元素不拦截）
      el('rect', { x: -38, y: -28, width: 76, height: 56, rx: 5, fill: 'transparent' }, env);
      el('rect', { x: -32, y: -24, width: 64, height: 48, rx: 5, fill: 'rgba(237,230,218,0.14)', stroke: '#F2B45C', 'stroke-width': 1.4, class: 'blur-line', style: 'pointer-events:none' }, env);
      el('polygon', { points: '-32,-24 0,2 32,-24', fill: 'none', stroke: '#F2B45C', 'stroke-width': 1, opacity: '0.8', style: 'pointer-events:none' }, env);
      // 暖色手写字样（几笔弧线）
      el('path', { d: 'M-20,2 Q-8,-2 0,2 T20,2', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1.2, opacity: '0.7', style: 'pointer-events:none' }, env);
      const envGlow = el('circle', { cx: 170, cy: 132, r: 66, fill: 'url(#warmGlow)', opacity: '0.55', class: 'breathe', style: 'pointer-events:none;filter:blur(8px)' }, g);
      dust(g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '点开那封信';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十四天 · 信</span>';
      const open = () => {
        AudioEngine.fullMelody();
        // 展开信
        const sheet = document.createElement('div');
        sheet.className = 'letter-sheet';
        const inner = document.createElement('div');
        inner.className = 'sheet';
        inner.innerHTML = '<div class="sheet-head">给 你</div>';
        sheet.appendChild(inner);
        wrap.appendChild(sheet);
        setTimeout(() => sheet.classList.add('show'), 200);
        // 前 13 句
        (window.DAYS || []).forEach((d, i) => {
          if (d.day > 13) return;
          const row = document.createElement('div');
          row.className = 'letter-row';
          const ico = document.createElement('span');
          ico.innerHTML = IconSvg(d.icon);
          ico.style.cssText = 'width:15px;height:15px;flex:0 0 auto;margin-top:5px;color:#F2B45C;';
          const p = document.createElement('p');
          p.textContent = d.line;
          row.appendChild(ico);
          row.appendChild(p);
          inner.appendChild(row);
          setTimeout(() => row.style.cssText = `opacity:1;transform:translateY(0);transition:opacity 1.2s ease,transform 1.2s ease;`, 1200 + i * 1200);
        });
        // 第 14 句
        const fin = window.DAYS[13];
        const frow = document.createElement('div');
        frow.className = 'letter-row final';
        frow.innerHTML = `${IconSvg(fin.icon)}<p>${fin.line}</p>`;
        inner.appendChild(frow);
        setTimeout(() => frow.style.cssText = `opacity:1;transform:translateY(0);transition:opacity 1.6s ease,transform 1.6s ease;`, 1200 + 13 * 1200 + 2200);
        const foot = document.createElement('div');
        foot.className = 'letter-foot';
        foot.textContent = '· 点图标，回到那天 ·';
        inner.appendChild(foot);
        setTimeout(() => foot.style.opacity = '1', 1200 + 14 * 1200 + 2400);
        setTimeout(() => finish(), 1200 + 14 * 1200 + 3200);
      };
      env.addEventListener('pointerdown', open);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      showHint(hint, '', 900);
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      setTimeout(() => txt.classList.add('show'), 2400);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* 图标（信的每句旁） */
  function IconSvg(icon) {
    const map = {
      lamp: '<path d="M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z"/><path d="M9 20h6"/>',
      foot: '<path d="M7 3c2 2 3 5 2 8l-1 4 3 2 1-4 1-2 3 3 2-2-3-4-1-3-1-2z"/>',
      bridge: '<path d="M4 16c4-8 12-8 16 0"/>',
      steps: '<path d="M4 20h4l4-8 4 8h4"/>',
      penguin: '<ellipse cx="12" cy="15" rx="5" ry="7"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/>',
      back: '<path d="M4 6h16v12H4z"/><path d="M4 6l8 6 8-6"/>',
      note: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
      shadow: '<path d="M4 20h16M6 20l14-14M20 6v8"/>',
      merge: '<path d="M8 12h8M12 8v8"/>',
      stars: '<path d="M12 4l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L6.2 8.2l4-.6z"/>',
      shard: '<path d="M8 4h8v8l-8 8zM16 12l4 4 4-4"/>',
      duo: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M5 18c0-3 2-5 3-5s3 2 3 5"/><path d="M13 18c0-3 2-5 3-5s3 2 3 5"/>',
      gallery: '<path d="M4 8h16M4 16h16M8 8v8M16 8v8"/>',
      letter: '<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>'
    };
    return `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3" fill="none">${map[icon] || map.letter}</svg>`;
  }
  window.IconSvg = IconSvg;

  return {
    1: d1, 2: d2, 3: d3, 4: d4, 5: d5, 6: d6, 7: d7,
    8: d8, 9: d9, 10: d10, 11: d11, 12: d12, 13: d13, 14: d14
  };
})();
