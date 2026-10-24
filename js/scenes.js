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
      <radialGradient id="vignette" cx="50%" cy="55%" r="68%">
        <stop offset="52%" stop-color="rgba(8,10,16,0)"/>
        <stop offset="100%" stop-color="rgba(8,10,16,0.55)"/>
      </radialGradient>
      <linearGradient id="roomFog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(8,10,16,0.62)"/>
        <stop offset="38%" stop-color="rgba(8,10,16,0.20)"/>
        <stop offset="100%" stop-color="rgba(8,10,16,0)"/>
      </linearGradient>
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

  /* ============================================================
   * 统一房间（背景.docx · 背景立体感专项方案）
   * 有厚度的盒子：地面厚板（石板缝+明暗衰减）+ 南墙（顶面厚度边+墙根阴影）
   * + 侧墙（更暗+交线）+ 桌子（体积+影子）+ 灯（唯一主光源，光晕呼吸）
   * + 环境光 / 补光 / 雾 / 暗角 / 浮尘（灯附近）
   * 全部视觉层 pointer-events:none，不拦截任何点击
   * opts: {table, lamp, wallR, fog, dust, lampOn}
   * ============================================================ */
  function room(g, o) {
    o = o || {};
    const table = o.table !== false;
    const lamp = o.lamp !== false;
    const wallR = o.wallR !== false;
    const dustN = o.dust == null ? 26 : o.dust;
    // —— 底色：最深 + 环境光（极暗冷色，暗部不死黑）——
    el('rect', { x: 0, y: 0, width: 340, height: 300, fill: '#0B0D16', style: 'pointer-events:none' }, g);
    el('rect', { x: 0, y: 0, width: 340, height: 300, fill: 'rgba(168,184,216,0.045)', style: 'pointer-events:none' }, g);
    // —— 地面：厚板（等距菱形三层，石板感 + 明暗衰减）——
    isoTop(g, 170, 262, 128, '#151A26', 74);            // 大地板（近暗远稍亮）
    isoTop(g, 170, 262, 92, '#181E2C', 53);             // 内层石板
    isoTop(g, 170, 262, 56, '#1C2431', 32);             // 中心石板（灯下最亮区）
    // 石板暗缝（沿等距方向的细线）
    el('polygon', { points: [170, 188, 214, 210, 210, 212, 166, 190].join(','), fill: 'rgba(8,10,16,0.55)', style: 'pointer-events:none' }, g);
    el('polygon', { points: [170, 336, 126, 314, 130, 312, 174, 334].join(','), fill: 'rgba(8,10,16,0.55)', style: 'pointer-events:none' }, g);
    // 地面厚度边（近端一条深色带，让地面是"板"不是"纸"）
    isoFace(g, ['170,336', '298,262', '302,270', '174,344'], '#0D111E', 'soft-edge');
    isoFace(g, ['170,336', '42,262', '38,270', '166,344'], '#0A0D18', 'soft-edge');
    // —— 南墙：竖直长方体正对镜头（大矩形），顶面厚度边 + 墙根阴影 ——
    isoFace(g, ['42,60', '298,60', '298,188', '42,188'], '#1A1E2A', 'soft-edge');            // 正面（受光）
    isoFace(g, ['42,60', '298,60', '310,52', '52,52'], '#2A3146', 'soft-edge');              // 顶面厚度边（补光，最亮）
    // 墙根阴影（南墙底部一圈，从墙根向外渐隐）
    el('polygon', { points: '42,188 298,188 298,193 42,193'.split(' '), fill: 'rgba(0,0,0,0.45)', style: 'pointer-events:none;filter:blur(2px)' }, g);
    // —— 东墙（右侧墙）：比南墙暗 + 与南墙交线（一侧亮一侧暗）——
    if (wallR) {
      isoFace(g, ['298,60', '344,78', '344,206', '298,188'], '#0E1320', 'soft-edge');         // 东墙正面（暗）
      isoFace(g, ['298,60', '344,78', '352,70', '306,52'], '#171C2E', 'soft-edge');           // 东墙顶面厚度边
      el('polygon', { points: '298,60 298,188 300,188 300,60'.split(' '), fill: 'rgba(168,184,216,0.15)', style: 'pointer-events:none' }, g); // 交线亮侧
      el('polygon', { points: '296,60 298,60 298,188 296,188'.split(' '), fill: 'rgba(0,0,0,0.5)', style: 'pointer-events:none' }, g);        // 交线暗侧
    }
    // —— 桌子：桌面 + 四腿 + 桌下影子（有体积、有明暗）——
    if (table) {
      isoTop(g, 170, 234, 46, '#232B3C', 27);                            // 桌面（顶面，最亮）
      isoFace(g, ['124,234', '170,261', '170,268', '124,241'], shade('#232B3C', 0.7), 'soft-edge');   // 左面
      isoFace(g, ['216,234', '170,261', '170,268', '216,241'], shade('#232B3C', 0.45), 'soft-edge');  // 右面
      el('rect', { x: 126, y: 262, width: 3, height: 36, fill: '#0E1320', style: 'pointer-events:none' }, g); // 腿
      el('rect', { x: 211, y: 262, width: 3, height: 36, fill: '#0E1320', style: 'pointer-events:none' }, g);
      el('ellipse', { cx: 170, cy: 302, rx: 40, ry: 8, fill: 'rgba(0,0,0,0.4)', style: 'pointer-events:none;filter:blur(3px)' }, g); // 桌下影子
    }
    // —— 灯：灯座（梯形等距三面）+ 灯芯 + 光晕（唯一主光源，呼吸 4-6s）——
    if (lamp) {
      const lampG = el('g', { transform: 'translate(170,206)', class: 'breathe', style: 'pointer-events:none' }, g);
      const glow = el('circle', { cx: 0, cy: 0, r: 62, fill: 'url(#warmGlow)', opacity: '0.55', style: 'pointer-events:none;filter:blur(8px)' }, lampG);
      glow.classList.add('lamp-glow');
      el('circle', { cx: 0, cy: -6, r: 5, fill: '#FFF3E0', class: 'blur-line', opacity: '0.85', style: 'pointer-events:none' }, lampG); // 灯芯
      isoFace(lampG, ['-12,-2', '12,-2', '18,16', '-18,16'], '#1D2433', 'soft-edge');    // 灯座正面
      isoFace(lampG, ['12,-2', '18,16', '20,18', '14,0'], '#232B3C', 'soft-edge');       // 灯座右面
      isoFace(lampG, ['-12,-2', '-18,16', '-20,18', '-14,0'], '#171C29', 'soft-edge');   // 灯座左面
    }
    // —— 雾：上方远处淡入（roomFog 线性渐变）——
    el('rect', { x: 0, y: 0, width: 340, height: 300, fill: 'url(#roomFog)', style: 'pointer-events:none' }, g);
    // —— 暗角：中间亮四周暗（视觉焦点压在桌灯附近）——
    el('rect', { x: 0, y: 0, width: 340, height: 300, fill: 'url(#vignette)', style: 'pointer-events:none' }, g);
    // —— 浮尘：只在灯附近（暖色，缓慢上飘，10-15s）——
    if (dustN > 0) {
      const lg = el('g', { style: 'pointer-events:none' }, g);
      for (let i = 0; i < dustN; i++) {
        const c = el('circle', {
          cx: 150 + Math.random() * 40,
          cy: 180 + Math.random() * 34,
          r: 1 + Math.random() * 1.2,
          fill: '#FFD9A0',
          opacity: (0.10 + Math.random() * 0.20).toFixed(2),
          class: 'dust-bit'
        }, lg);
        c.style.animation = `dustFloat ${10 + Math.random() * 5}s ease-in-out ${Math.random() * 6}s infinite`;
      }
    }
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
      // —— 统一房间（Day 1：房间初始态，只有桌子和灯）——
      room(g, { table: true, lamp: false, dust: 20 });
      // 门形凹槽（南墙中央，光描出的门，灯亮才显形）
      const niche = el('g', { class: 'niche fade-in-svg', opacity: '0.18', style: 'pointer-events:none' }, g);
      isoFace(niche, ['146,118', '194,118', '194,84', '146,84'], '#080A10', 'soft-edge');
      el('rect', { x: 146, y: 88, width: 48, height: 84, rx: 24, ry: 24, fill: '#080A10', stroke: '#1A1E2A', 'stroke-width': 1, style: 'pointer-events:none' }, niche);
      // —— 桌上的灯（唯一主光源，可交互）——
      const lampG = el('g', { transform: 'translate(170,206)', class: 'breathe' }, g);
      const glow = el('circle', { cx: 0, cy: 0, r: 84, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(8px)' }, lampG);
      glow.setAttribute('class', 'lamp-glow');
      el('circle', { cx: 0, cy: 0, r: 5, fill: '#FFF3E0', class: 'blur-line', opacity: '0.85', style: 'pointer-events:none' }, lampG);
      // 梯形灯座（等距三面：顶亮 / 左70 / 右45）
      isoFace(lampG, ['-14,8', '14,8', '20,26', '-20,26'], '#1D2433', 'soft-edge');
      isoFace(lampG, ['14,8', '14,26', '20,26', '20,8'], '#232B3C', 'soft-edge');
      isoFace(lampG, ['-14,8', '-14,26', '-20,26', '-20,8'], '#171C29', 'soft-edge');
      // 地面光斑（灯下椭圆，边缘化开）
      el('ellipse', { cx: 170, cy: 262, rx: 58, ry: 17, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(4px)', class: 'fade-in-svg' }, g);
      // —— 门（南墙上的拱门，点灯后拖开）——
      const door = el('g', { transform: 'translate(170,110)', class: 'door-grp', style: 'cursor:pointer' }, g);
      el('rect', { x: -18, y: -50, width: 36, height: 96, rx: 18, ry: 18, fill: '#1A1E2A', stroke: '#2A2E3A', 'stroke-width': 1, style: 'pointer-events:none' }, door);
      const doorline = el('rect', { x: 0, y: -44, width: 1.4, height: 84, fill: '#FFD9A0', class: 'blur-line', opacity: '0', style: 'pointer-events:none' }, door);
      doorline.setAttribute('class', 'door-line');
      // 交互
      let lit = false, opened = false;
      const lampHit = el('circle', { cx: 170, cy: 206, r: 34, fill: 'transparent', class: 'hit-area' }, g);
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
      txt.innerHTML = '<span class="sub">第一天的灯</span><span class="line">灯我给你留着。回来就有。</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 2 · 纸条（桌上，灯旁。点纸条展开）
   * ============================================================ */
  function d2() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间（桌上放纸条）——
      room(g, { dust: 22 });
      // —— 纸条：压扁的小长方体，灯座旁 ——
      const noteG = el('g', { transform: 'translate(214,232)', style: 'cursor:pointer' }, g);
      // 纸条（等距小长方体：顶面 + 左面 + 右面）
      const top = el('polygon', { points: [0, -6, 18, 0, 0, 6, -18, 0].join(','), fill: '#F2E9D5', class: 'soft-edge', style: 'pointer-events:none' }, noteG);
      el('polygon', { points: [-18, 0, 0, 6, 0, 10, -18, 4].join(','), fill: shade('#F2E9D5', 0.72), class: 'soft-edge', style: 'pointer-events:none' }, noteG);
      el('polygon', { points: [0, 6, 18, 0, 18, 4, 0, 10].join(','), fill: shade('#F2E9D5', 0.45), class: 'soft-edge', style: 'pointer-events:none' }, noteG);
      // 折痕（一条斜线，暗示折起来的纸条）
      el('polygon', { points: [-6, -3, 6, -5, 4, -1, -8, 1].join(','), fill: '#D8CFB6', style: 'pointer-events:none;opacity:0.8' }, noteG);
      // 展开的一角（点击后出现）
      const openFlap = el('polygon', { points: [6, -5, 18, -4, 12, 6, 0, 5].join(','), fill: '#FFF6E3', class: 'fade-in-svg', style: 'pointer-events:none' }, noteG);
      // 纸条小影子
      el('ellipse', { cx: 214, cy: 248, rx: 14, ry: 4, fill: 'rgba(0,0,0,0.35)', style: 'pointer-events:none;filter:blur(2px)' }, g);
      // 交互：点纸条 → 展开露出折痕
      const hit = el('rect', { x: 196, y: 222, width: 40, height: 26, fill: 'transparent', class: 'hit-area' }, g);
      hit.addEventListener('pointerdown', () => {
        if (opened) return;
        opened = true;
        AudioEngine.paper();
        noteG.style.transition = 'transform 0.9s cubic-bezier(0.22,0.61,0.36,1)';
        noteG.style.transform = 'translate(214,232) rotate(-4deg)';
        openFlap.classList.add('on');
        top.setAttribute('opacity', '0.55');
        setTimeout(() => finish(), 1500);
      });
      let opened = false;
      // 完成
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '轻触那张纸条';
      wrap.appendChild(hint);
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第二天的纸条</span><span class="line">我先来过了。你别急，慢慢来。</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 3 · 墙上的门形（南墙偏左，光描出的门，能点不能开）
   * ============================================================ */
  function d3() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 22 });
      // —— 南墙上的门形：从墙里显影（光从墙背面透过来）——
      const doorShape = el('g', { class: 'fade-in-svg', style: 'pointer-events:none' }, g);
      // 光描的门框（一道拱形光，不是实体门）
      el('rect', { x: 96, y: 128, width: 46, height: 96, rx: 23, ry: 23, fill: 'rgba(242,180,92,0.06)', stroke: '#F2B45C', 'stroke-width': 1.2, opacity: '0.7', class: 'blur-line' }, doorShape);
      // 门缝光（竖直细光，最亮）
      el('rect', { x: 117, y: 134, width: 3, height: 86, rx: 1.5, fill: '#FFD9A0', opacity: '0.55', class: 'blur-line' }, doorShape);
      // 门框上下各一道横向微光（"光描"的边框感）
      el('rect', { x: 100, y: 130, width: 38, height: 2, rx: 1, fill: 'rgba(242,180,92,0.5)', opacity: '0.4', class: 'blur-line' }, doorShape);
      el('rect', { x: 100, y: 220, width: 38, height: 2, rx: 1, fill: 'rgba(242,180,92,0.5)', opacity: '0.4', class: 'blur-line' }, doorShape);
      setTimeout(() => doorShape.classList.add('on'), 800);
      // 点门形 → 亮一下
      const hit = el('rect', { x: 88, y: 120, width: 62, height: 112, rx: 30, fill: 'transparent', class: 'hit-area' }, g);
      hit.addEventListener('pointerdown', () => {
        if (done) return;
        done = true;
        AudioEngine.lowHum();
        // 门形亮一下再收回
        doorShape.querySelectorAll('*').forEach((n) => {
          n.style.transition = 'opacity 0.5s ease';
          n.setAttribute('opacity', String(Math.min(1, parseFloat(n.getAttribute('opacity') || '1') + 0.35)));
        });
        setTimeout(() => finish(), 1200);
      });
      let done = false;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '轻触那道光门';
      wrap.appendChild(hint);
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第三天的门形</span><span class="line">这条路我走过，绕了点。但到了。</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 4 · 小台阶（桌脚旁，三级从下到上依次亮）
   * ============================================================ */
  function d4() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 22 });
      // —— 桌脚旁三级小台阶（手掌大，从地面微微升起，通向桌沿）——
      const stepGeom = [
        { cy: 286, w: 30 },  // 最下（近桌脚）
        { cy: 268, w: 26 },  // 中
        { cy: 250, w: 22 }   // 最上（近桌沿）
      ];
      const steps = [];
      stepGeom.forEach((geo, i) => {
        const cx = 214, cy = geo.cy, w = geo.w, d = Math.round(w * 0.577);
        const s = el('g', { class: 'step-tile', style: 'cursor:pointer' }, g);
        // 台阶小长方体：顶面 + 左右面（顶面受光最亮）
        el('polygon', { points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','), fill: '#232B3C', class: 'soft-edge', style: 'pointer-events:none' }, s);
        el('polygon', { points: [cx - w, cy, cx, cy + d, cx, cy + d + 10, cx - w, cy + 10].join(','), fill: shade('#232B3C', 0.7), class: 'soft-edge', style: 'pointer-events:none' }, s);
        el('polygon', { points: [cx, cy + d, cx + w, cy, cx + w, cy + 10, cx, cy + d + 10].join(','), fill: shade('#232B3C', 0.45), class: 'soft-edge', style: 'pointer-events:none' }, s);
        // 热区（中心小块，避免重叠）
        const hit = el('rect', { x: cx - 12, y: cy - 12, width: 24, height: 24, rx: 4, fill: 'transparent', class: 'hit-area' }, s);
        steps.push(s);
      });
      // 交互：从下到上依次点
      let idx = 0;
      steps.forEach((s, i) => {
        s.addEventListener('pointerdown', () => {
          if (i !== idx) return;
          idx++;
          const cx = 214, cy = stepGeom[i].cy, w = stepGeom[i].w, d = Math.round(w * 0.577);
          const glow = el('polygon', {
            points: [cx, cy - d, cx + w, cy, cx, cy + d, cx - w, cy].join(','),
            fill: '#FFD9A0', opacity: '0.35', class: 'blur-line', style: 'pointer-events:none'
          }, g);
          AudioEngine.tone(440 + i * 80, { type: 'sine', dur: 0.5, vol: 0.1 });
          setTimeout(() => glow.setAttribute('opacity', '0.12'), 1200);
          if (idx === 3) {
            AudioEngine.chime('bell');
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
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '从下到上，轻触台阶';
      wrap.appendChild(hint);
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第四天的小台阶</span><span class="line">你往上走。我就在下面，哪儿也不去。</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
      window.__sceneText = txt;
      window.__sceneHint = hint;
    });
  }

  /* ============================================================
   * Day 5 · 窗（南墙拱窗 + 窗台企鹅：先推窗，再点企鹅）
   * ============================================================ */
  function d5() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 22 });
      // —— 南墙上开一扇小拱窗：窗洞后是另一个空间（深色平面 + 星点）——
      // 窗洞（挖在墙上：深色平面，比墙深，接近夜空）
      el('rect', { x: 122, y: 92, width: 96, height: 78, rx: 48, ry: 48, fill: '#0A0F1E', style: 'pointer-events:none' }, g);
      // 星点（窗洞内）
      [[170, 130], [140, 112], [200, 116], [154, 150], [188, 146], [134, 138], [208, 130]].forEach(([x, y], i) => {
        const st = el('circle', { cx: x, cy: y, r: 1.4 + (i % 3), fill: '#A8B8D8', opacity: '0', class: 'star-bit', style: 'pointer-events:none' }, g);
        setTimeout(() => st.setAttribute('opacity', (0.5 + Math.random() * 0.4).toFixed(2)), 1600 + i * 120);
      });
      // 窗外冷光
      el('ellipse', { cx: 170, cy: 131, rx: 44, ry: 36, fill: 'url(#moonGlow)', opacity: '0.25', style: 'pointer-events:none;filter:blur(4px)' }, g);
      // 窗框（拱窗：矩形+半圆），边缘一圈厚度面（窗"嵌"在墙里）
      el('path', { d: 'M122 170 L122 128 A48 48 0 0 1 218 128 L218 170 Z', fill: 'none', stroke: '#2A2E3A', 'stroke-width': 2, style: 'pointer-events:none' }, g);
      el('path', { d: 'M120 170 L120 128 A50 50 0 0 1 220 128 L220 170 Z', fill: 'none', stroke: 'rgba(168,184,216,0.1)', 'stroke-width': 3, style: 'pointer-events:none;filter:blur(1.5px)' }, g);
      // —— 窗台（横向长方体，伸出墙面，下方有厚度）——
      isoFace(g, ['118,170', '222,170', '222,178', '118,178'], '#232B3C', 'soft-edge');
      isoFace(g, ['222,170', '236,164', '236,178', '222,178'], '#10151F', 'soft-edge');
      isoFace(g, ['118,170', '104,164', '104,178', '118,178'], '#2A3146', 'soft-edge');
      // —— 企鹅（坐在窗台上，几何体拼成，半透明 + 影子）——
      const peng = el('g', { transform: 'translate(214,168)', class: 'penguin-grp', style: 'cursor:pointer' }, g);
      // 透明热区（保证可点，视觉元素不拦截）
      el('ellipse', { cx: 0, cy: 0, rx: 16, ry: 20, fill: 'transparent' }, peng);
      el('ellipse', { cx: 0, cy: 10, rx: 16, ry: 4, fill: 'rgba(0,0,0,0.4)', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, peng);  // 影子
      el('ellipse', { cx: 0, cy: 0, rx: 12, ry: 15, fill: '#2A2E3A', class: 'blur-line', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 0, cy: 4, rx: 8, ry: 10, fill: '#EDE6DA', opacity: '0.9', style: 'pointer-events:none' }, peng);
      el('circle', { cx: -4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('circle', { cx: 4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('polygon', { points: '-1.6,-1 1.6,-1 0,2.4', fill: '#F2B45C', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: -10, cy: 2, rx: 3.4, ry: 5.6, fill: '#2A2E3A', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 10, cy: 2, rx: 3.4, ry: 5.6, fill: '#2A2E3A', style: 'pointer-events:none' }, peng);
      peng.style.opacity = '0.85';
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '推开窗';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第五天的企鹅</span><span class="line">它坐在这儿陪你。我先去给你倒杯水。</span>';
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
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // 墙板（南墙右侧、与桌子齐高的方形墙板：正面 + 顶面厚度 + 右侧暗面）
      const wall = el('g', {}, g);
      const wallBody = el('g', { class: 'blur-line' }, wall);
      // 透明热区（保证可拖，视觉元素不拦截）
      el('rect', { x: 132, y: 60, width: 136, height: 148, fill: 'transparent' }, wallBody);
      // 正面（受光，70%）
      el('polygon', { points: '132,60 268,60 268,208 132,208', fill: '#1D2433', style: 'pointer-events:none' }, wallBody);
      // 顶面窄菱形（墙板厚度，100% 亮）
      el('polygon', { points: '132,60 268,60 286,54 150,54', fill: '#232B3C', style: 'pointer-events:none' }, wallBody);
      // 右侧暗面（45%）
      el('polygon', { points: '268,60 286,54 286,202 268,208', fill: '#10151F', style: 'pointer-events:none' }, wallBody);
      // 正面边缘细缝（提示可转；纯视觉，不拦截点击）
      el('rect', { x: 136, y: 64, width: 128, height: 140, fill: 'none', stroke: 'rgba(242,180,92,0.1)', 'stroke-width': 1, style: 'pointer-events:none' }, wallBody);
      // 背面的小凹槽（旋转后出现；纯视觉，不拦截拖拽）
      const backWin = el('g', { class: 'back-win', opacity: '0', style: 'pointer-events:none' }, wall);
      el('rect', { x: 180, y: 108, width: 36, height: 50, rx: 18, ry: 18, fill: '#080A10', stroke: '#FFD9A0', 'stroke-width': 1.4, class: 'blur-line' }, backWin);
      // 槽内暖光
      el('circle', { cx: 198, cy: 133, r: 22, fill: 'url(#warmGlow)', opacity: '0.7', style: 'filter:blur(4px)' }, backWin);
      // 墙板在地面的斜影（方向与光向一致，向左下）
      el('polygon', { points: '132,208 268,208 296,226 160,226', fill: 'rgba(0,0,0,0.45)', class: 'blur-line', style: 'pointer-events:none;filter:blur(3px)' }, g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '转一下看看';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第六天的方板</span><span class="line">背面有句话。你转过去，就当我小声说的。</span>';
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
          const winHit = el('rect', { x: 178, y: 106, width: 40, height: 54, fill: 'transparent', class: 'hit-area' }, g);
          winHit.addEventListener('pointerdown', () => {
            if (done && !finishedFlag) {
              AudioEngine.chime('wood');
              el('circle', { cx: 198, cy: 133, r: 34, fill: 'url(#warmGlow)', opacity: '0.8' }, g);
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
   * Day 7 · 风铃（房间中央上方，五片薄片细线吊着，点一片依次亮）
   * ============================================================ */
  function d7() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // —— 风铃：五片几何薄片，细线吊着，高低错落，悬在桌子正上方 ——
      const chimes = [];
      const sheetGeom = [
        { cy: 96, w: 14, c: '#FFD9A0' },  // 低音片（最高）
        { cy: 112, w: 12, c: '#F2B45C' },
        { cy: 130, w: 11, c: '#A8B8D8' },
        { cy: 148, w: 10, c: '#F2B45C' },
        { cy: 164, w: 9, c: '#FFD9A0' }   // 高音片（最低）
      ];
      const xs = [150, 176, 200, 172, 158];
      // 挂线（极细，从上往下）
      el('line', { x1: 170, y1: 58, x2: 170, y2: 96, stroke: 'rgba(168,184,216,0.25)', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      el('line', { x1: 170, y1: 58, x2: 176, y2: 112, stroke: 'rgba(168,184,216,0.25)', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      el('line', { x1: 170, y1: 58, x2: 200, y2: 130, stroke: 'rgba(168,184,216,0.25)', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      el('line', { x1: 170, y1: 58, x2: 172, y2: 148, stroke: 'rgba(168,184,216,0.25)', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      el('line', { x1: 170, y1: 58, x2: 158, y2: 164, stroke: 'rgba(168,184,216,0.25)', 'stroke-width': 0.8, style: 'pointer-events:none' }, g);
      // 悬杆（顶部细横杆）
      el('line', { x1: 140, y1: 56, x2: 210, y2: 56, stroke: 'rgba(168,184,216,0.3)', 'stroke-width': 1.2, style: 'pointer-events:none' }, g);
      // 薄片（小菱形薄片，高低错落，各自轻晃）
      sheetGeom.forEach((geo, i) => {
        const cx = xs[i], cy = geo.cy, w = geo.w, d = Math.round(w * 0.577);
        const c = el('g', { transform: `translate(${cx},${cy})`, style: 'cursor:pointer' }, g);
        // 热区（静态，不随动画位移）
        el('polygon', { points: [0, -d, w, 0, 0, d, -w, 0].join(','), fill: 'transparent' }, c);
        // 内层承载动画（translate 留在外层，避免动画 transform 覆盖定位）
        const inner = el('g', { style: 'pointer-events:none' }, c);
        el('polygon', { points: [0, -d, w, 0, 0, d, -w, 0].join(','), fill: geo.c, opacity: '0.6', class: 'soft-edge' }, inner);
        el('polygon', { points: [0, d, w, 0, w, d + 2, 0, d + 2].join(','), fill: shade(geo.c, 0.55), opacity: '0.6', class: 'soft-edge' }, inner);
        inner.style.animation = `chimeSwing ${3.2 + i * 0.5}s ease-in-out ${i * 0.7}s infinite`;
        chimes.push(c);
      });
      // 薄片影子（桌面下方的淡光点）
      el('ellipse', { cx: 170, cy: 234, rx: 34, ry: 10, fill: 'rgba(242,180,92,0.08)', style: 'pointer-events:none;filter:blur(3px)' }, g);
      // 交互：点任意一片，五片从高到低依次亮
      let idx = 0, done = false;
      const noteSeq = [523.25, 587.33, 659.25, 783.99, 880.0];
      chimes.forEach((c, i) => {
        c.addEventListener('pointerdown', () => {
          if (done) return;
          done = true;
          noteSeq.forEach((f, j) => {
            setTimeout(() => {
              AudioEngine.musicBox(f, { dur: 1.4, vol: 0.1 });
              const gl = el('circle', { cx: xs[j], cy: sheetGeom[j].cy, r: 16, fill: sheetGeom[j].c, opacity: '0.5', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, g);
              setTimeout(() => gl.setAttribute('opacity', '0'), 1500);
            }, j * 260);
          });
          setTimeout(() => finish(), noteSeq.length * 260 + 900);
        });
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve({});
      };
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '轻触一片风铃';
      wrap.appendChild(hint);
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第七天的风铃</span><span class="line">你听见响，就是我喊你了。不用应，我知道你在。</span>';
      setTimeout(() => svg.classList.add('fadeIn'), 100);
      showHint(hint, '', 900);
      showHint(txt, '', 3200);
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
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // —— 中景：光束 + 光源 + 南墙上的影子 ——
      // 光束（左上斜射，半透明梯形，从光源投向南墙）
      const beam = el('polygon', { points: '286,36 170,300 240,300', fill: 'rgba(242,180,92,0.09)', class: 'blur-line', style: 'pointer-events:none' }, g);
      // 光源（可拖，房间补光一侧的小光点）
      const lightSrc = el('circle', { cx: 286, cy: 36, r: 7, fill: '#FFF3E0', class: 'blur-line', style: 'cursor:grab' }, g);
      const lightGlow = el('circle', { cx: 286, cy: 36, r: 26, fill: 'url(#warmGlow)', opacity: '0.55', style: 'pointer-events:none;filter:blur(8px)' }, g);
      // 南墙上的几何影子（斜斜的一道，指向墙角；可点可拖）
      const shadowG = el('g', { transform: 'translate(222,150)', opacity: '0.92', style: 'cursor:grab' }, g);
      el('polygon', { points: '0,0 44,-10 66,0 36,8', fill: 'rgba(0,0,0,0.55)', class: 'blur-line', style: 'filter:blur(2px)' }, shadowG);
      // 墙角小门（影子移到墙角时裂开一道细缝透光）
      const crackDoor = el('g', { class: 'crack-door', opacity: '0', style: 'pointer-events:none' }, g);
      el('rect', { x: 128, y: 128, width: 40, height: 96, rx: 20, ry: 20, fill: '#080A10', stroke: '#FFD9A0', 'stroke-width': 1.2, class: 'blur-line' }, crackDoor);
      el('circle', { cx: 148, cy: 176, r: 26, fill: 'url(#warmGlow)', opacity: '0.7', style: 'filter:blur(6px)' }, crackDoor);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '跟着影子走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第八天的影子</span><span class="line">我不在的时候，影子替我陪你一会儿。</span>';
      let dragging = false, sx = 0, done = false, angle = 0;
      const onMove = (e) => {
        if (!dragging) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        angle = Math.max(-60, Math.min(0, dx * 0.4));
        shadowG.setAttribute('transform', `translate(${(222 + angle * 0.9).toFixed(1)},150)`);
        lightSrc.setAttribute('cx', String(286 + angle));
        beam.setAttribute('points', `${286 + angle},36 170,300 240,300`);
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
          el('circle', { cx: 148, cy: 176, r: 36, fill: 'url(#warmGlow)', opacity: '0.8' }, g);
          setTimeout(() => {
            const winHit = el('rect', { x: 126, y: 126, width: 44, height: 100, fill: 'transparent', class: 'hit-area' }, g);
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
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // —— 中景：两块拼板（各占画面一半，桌脚两侧的地面上，右块可拖）——
      // 几何体 A（左上方，缺口，在地面左后方）
      const geomA = el('g', { transform: 'translate(108,238)' }, g);
      el('polygon', { points: '-60,-60 -10,-60 -10,40 -60,40', fill: '#1D2433', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '-10,-60 20,-40 20,60 -10,40', fill: '#141926', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '-60,40 -10,40 20,60 -30,60', fill: '#10151F', class: 'soft-edge', style: 'pointer-events:none' }, geomA);
      el('polygon', { points: '18,-10 54,-10 54,30 18,30', fill: '#080A10', stroke: 'rgba(242,180,92,0.35)', 'stroke-width': 1, style: 'pointer-events:none' }, geomA); // 缺口
      // 几何体 B（右下方，可拖，凸块）
      const fitG = el('g', { transform: 'translate(255,238)', style: 'cursor:grab', class: 'fit-grp' }, g);
      // 透明热区（保证可拖）
      el('rect', { x: -80, y: -60, width: 160, height: 120, fill: 'transparent' }, fitG);
      el('polygon', { points: '-80,-60 -10,-60 -10,60 -80,60', fill: '#1D2433', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('polygon', { points: '-10,-60 20,-40 20,60 -10,60', fill: '#141926', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('polygon', { points: '-80,60 -10,60 20,60 -50,60', fill: '#10151F', class: 'soft-edge', style: 'pointer-events:none' }, fitG);
      el('rect', { x: -36, y: -22, width: 36, height: 42, fill: '#F2B45C', opacity: '0.55', class: 'blur-line', style: 'pointer-events:none' }, fitG);
      // 缝隙（暗色，两板之间的接缝）
      el('rect', { x: 178, y: 192, width: 8, height: 96, fill: 'rgba(0,0,0,0.45)', style: 'pointer-events:none' }, g);
      // 两板在地面的影子
      el('ellipse', { cx: 118, cy: 312, rx: 46, ry: 9, fill: 'rgba(0,0,0,0.4)', style: 'pointer-events:none;filter:blur(3px)' }, g);
      el('ellipse', { cx: 256, cy: 312, rx: 46, ry: 9, fill: 'rgba(0,0,0,0.4)', style: 'pointer-events:none;filter:blur(3px)' }, g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '把它们合上';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第九天的两块拼合</span><span class="line">我们俩，一开始也对不上。现在挺好。</span>';
      let dragging = false, sx = 0, sy = 0, done = false;
      const onMove = (e) => {
        if (!dragging) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
        fitG.setAttribute('transform', `translate(${(255 + dx).toFixed(1)},238)`);
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
          fitG.setAttribute('transform', 'translate(172,238)');
          el('line', { x1: 172, y1: 178, x2: 172, y2: 300, stroke: '#FFD9A0', 'stroke-width': 2, opacity: '0.9', class: 'blur-line' }, g);
          setTimeout(() => finish(), 1300);
        } else {
          fitG.style.transition = 'transform 0.6s cubic-bezier(0.22,0.61,0.36,1)';
          fitG.setAttribute('transform', 'translate(255,238)');
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
   * Day 10 · 桌下小井（井口小台阶 → 井底小灯 → 裂痕星星罐，情绪高点）
   * ============================================================ */
  function d10() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // —— 桌下的小井：井口（椭圆，比桌子小）嵌在地面上 ——
      // 井口厚边（椭圆环，受光）
      el('ellipse', { cx: 170, cy: 256, rx: 30, ry: 9, fill: '#1D2433', style: 'pointer-events:none' }, g);
      el('ellipse', { cx: 170, cy: 256, rx: 25, ry: 7.5, fill: '#0D111C', style: 'pointer-events:none' }, g);
      // —— 向下的台阶（5 级，逐级下降收窄）——
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const r = 22 - i * 2.5;
        const ry = r * 0.3;
        const cy = 262 + i * 5;
        const rr = el('ellipse', { cx: 170, cy: cy, rx: r, ry: ry, fill: 'none', stroke: '#1A1E2A', 'stroke-width': 5, opacity: '0.9', style: 'pointer-events:none' }, g);
        rings.push(rr);
      }
      // 井底（椭圆，最亮）
      el('ellipse', { cx: 170, cy: 288, rx: 12, ry: 4, fill: '#232B3C', style: 'pointer-events:none' }, g);
      // 井底小灯（圆灯芯 + 光雾，唯一主光源外的一盏小灯）
      const wellLight = el('circle', { cx: 170, cy: 288, r: 14, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(6px)' }, g);
      fog(g, 170, 288, 8, 0, 'well-fog-1');
      // 星星罐（裂痕 + 星星；罐体透明填充保证可点）
      const jarG = el('g', { transform: 'translate(196,280)', style: 'cursor:pointer', opacity: '0', class: 'jar-grp' }, g);
      el('rect', { x: -13, y: -16, width: 26, height: 30, rx: 6, fill: 'transparent' }, jarG);
      // 罐身（描边不填充）
      el('rect', { x: -12, y: -16, width: 24, height: 30, rx: 6, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jarG);
      // 罐口
      el('rect', { x: -9, y: -19, width: 18, height: 4, rx: 2, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jarG);
      // 裂痕（两三笔折线，裂痕后叠暖光）
      el('polyline', { points: '-9,-14 -6,-4 -10,4 -5,12', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.8', style: 'pointer-events:none' }, jarG);
      el('polyline', { points: '7,-10 9,0 6,8', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.6', style: 'pointer-events:none' }, jarG);
      // 裂痕后暖光
      el('ellipse', { cx: 196, cy: 280, rx: 12, ry: 15, fill: 'url(#warmGlow)', opacity: '0', style: 'pointer-events:none;filter:blur(4px)', class: 'jar-glow-bg' }, g);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '往下走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十天的桌下小井</span><span class="line">星星罐摔过。我一颗颗捡的，一颗没少。你别哭。</span>';
      let descend = 0, starsLit = 0, starTotal = 36;
      const onDescend = () => {
        if (descend >= 5) return;
        descend++;
        AudioEngine.step();
        const stepGlow = el('ellipse', { cx: 170, cy: 262 + descend * 5, rx: 22 - descend * 2.5, ry: (22 - descend * 2.5) * 0.3, fill: 'none', stroke: '#FFD9A0', 'stroke-width': 2, opacity: '0.5', class: 'blur-line', style: 'pointer-events:none' }, g);
        setTimeout(() => stepGlow.setAttribute('opacity', '0.15'), 900);
        if (descend === 5) {
          wellLight.style.transition = 'opacity 1.2s ease';
          wellLight.setAttribute('opacity', '0.9');
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
        const hit = el('circle', { cx: 170, cy: 262 + i * 5, r: 5, fill: 'transparent', class: 'hit-area' }, g);
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
                cy: 280 + Math.sin(a) * rr * 0.7,
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
      // —— 统一房间 ——
      room(g, { dust: 20 });
      // —— 中景：南墙上的窗形轮廓（目标位）+ 碎片 ——
      // 窗形轮廓（矩形+半圆，南墙上的淡淡轮廓）
      const frame = el('g', { opacity: '0.25', style: 'pointer-events:none' }, g);
      el('rect', { x: 110, y: 88, width: 120, height: 100, rx: 60, ry: 60, fill: 'none', stroke: '#2A2E3A', 'stroke-width': 1.6 }, frame);
      // 5 片碎片（可拖；每片 3-4 个平行四边形拼成）
      const pieces = [
        { x: 46, y: 42, w: 46, h: 30, slot: [114, 92] },
        { x: 250, y: 60, w: 44, h: 34, slot: [166, 126] },
        { x: 36, y: 190, w: 48, h: 32, slot: [114, 156] },
        { x: 258, y: 200, w: 44, h: 30, slot: [176, 170] },
        { x: 146, y: 236, w: 42, h: 28, slot: [140, 128] }
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
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '放回去';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十一天的碎片</span><span class="line">缺的那几块，我找回来了。都在这儿。</span>';
      let drag = null;
      // 拖拽距离按 SVG 坐标系换算（屏幕像素 ÷ 渲染缩放），保证任何视口下归位判定一致
      const svgScale = () => svg.getBoundingClientRect().width / 340;
      const onMove = (e) => {
        if (!drag) return;
        const dx = ((e.touches ? e.touches[0].clientX : e.clientX) - drag.sx) / drag.scale;
        const dy = ((e.touches ? e.touches[0].clientY : e.clientY) - drag.sy) / drag.scale;
        drag.g.setAttribute('transform', `translate(${drag.base[0] + dx},${drag.base[1] + dy})`);
      };
      const onUp = (e) => {
        if (!drag) return;
        const dx = ((e.touches ? e.touches[0].clientX : e.clientX) - drag.sx) / drag.scale;
        const dy = ((e.touches ? e.touches[0].clientY : e.clientY) - drag.sy) / drag.scale;
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
          drag = { g: pg, i, p: pieces[i], base: [pieces[i].x, pieces[i].y], sx: e.touches ? e.touches[0].clientX : e.clientX, sy: e.touches ? e.touches[0].clientY : e.clientY, scale: svgScale() };
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
      // —— 统一房间 ——
      room(g, { dust: 18 });
      // —— 中景：格状地面（桌脚前方地面上的小菱形棋盘）——
      const grid = 5, cell = 40, ox = 68, oy = 96;
      // 棋盘（小菱形格，等距，贴在地面）
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const cx = ox + c * cell + cell / 2;
          const cy = oy + r * cell + cell / 2;
          const w = cell / 2;
          const d = Math.round(w * 0.577);
          const fill = (r + c) % 2 === 0 ? 'rgba(26,30,42,0.85)' : 'rgba(29,36,51,0.85)';
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
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '带它走过去';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十二天的双人</span><span class="line">你走一步，我跟一步。回头也行，我在。</span>';
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
      // 方向键也支持（桌面）
      const keyMap = { ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0] };
      const onKey = (e) => {
        const m = keyMap[e.key];
        if (m) { e.preventDefault(); move(m[0], m[1]); }
      };
      window.addEventListener('keydown', onKey);
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
        window.removeEventListener('keydown', onKey);
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
   * Day 13 · 南墙上一排小门（点着向前走，一扇扇透暖光，掠过句子影子）
   * ============================================================ */
  function d13() {
    return new Promise((resolve) => {
      const svg = root();
      const g = el('g', {}, svg);
      // —— 统一房间 ——
      room(g, { dust: 18 });
      // —— 南墙上一排小门（13 扇，等距排列，门缝透暖光）——
      const doors = [];
      for (let i = 0; i < 13; i++) {
        const x = 48 + i * 20;
        const d = el('g', {}, g);
        // 门（矩形+半圆，嵌在南墙上：左墙 y60-188 区域内）
        el('path', { d: `M${x} 186 L${x} 96 A10 10 0 0 1 ${x + 16} 96 L${x + 16} 186 Z`, fill: '#141926', stroke: '#2A2E3A', 'stroke-width': 0.7, opacity: '0.92', style: 'pointer-events:none' }, d);
        // 门缝透暖光
        el('path', { d: `M${x + 2} 184 L${x + 2} 98 A8 8 0 0 1 ${x + 14} 98 L${x + 14} 184 Z`, fill: 'url(#warmGlow)', opacity: '0.16', style: 'pointer-events:none' }, d);
        doors.push(d);
      }
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '往前走';
      const txt = document.createElement('div');
      txt.className = 'scene-text';
      const wrap = window.__sceneEl;
      wrap.appendChild(svg);
      wrap.appendChild(hint);
      wrap.appendChild(txt);
      txt.innerHTML = '<span class="sub">第十三天 · 一排小门</span><span class="line">走到这儿回头看，才发现，我们已经这么远了。</span>';
      let pos = 0;
      const walk = () => {
        if (pos >= 13) return;
        const d = doors[pos];
        // 门开
        d.style.transition = 'opacity 0.6s ease';
        d.setAttribute('opacity', '0.35');
        const litDoor = el('path', { d: `M${48 + pos * 20 + 2} 184 L${48 + pos * 20 + 2} 98 A8 8 0 0 1 ${48 + pos * 20 + 14} 98 L${48 + pos * 20 + 14} 184 Z`, fill: '#FFD9A0', opacity: '0.35', class: 'blur-line', style: 'pointer-events:none' }, g);
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
      // —— 统一房间（信在桌上中央）——
      room(g, { dust: 22 });
      // 全暖光铺底（集中在桌面）
      el('ellipse', { cx: 170, cy: 234, rx: 130, ry: 70, fill: 'url(#warmGlow)', opacity: '0.14', style: 'pointer-events:none;filter:blur(8px)' }, g);
      // —— 中景：企鹅 + 星星罐 + 桌面中央的信 + 前 13 天几何体环形排列 ——
      // 企鹅（信左侧，半透明浮着，桌面边缘）
      const pengW = el('g', { transform: 'translate(88,236)', opacity: '0.9', style: 'pointer-events:none' }, g);
      const peng = el('g', { class: 'float-slow' }, pengW);
      el('ellipse', { cx: 0, cy: 6, rx: 14, ry: 4, fill: 'rgba(0,0,0,0.3)', class: 'blur-line', style: 'pointer-events:none;filter:blur(2px)' }, peng);
      el('ellipse', { cx: 0, cy: 0, rx: 12, ry: 15, fill: '#2A2E3A', class: 'blur-line', style: 'pointer-events:none' }, peng);
      el('ellipse', { cx: 0, cy: 4, rx: 8, ry: 10, fill: '#EDE6DA', opacity: '0.9', style: 'pointer-events:none' }, peng);
      el('circle', { cx: -4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('circle', { cx: 4, cy: -5, r: 2, fill: '#080A10', style: 'pointer-events:none' }, peng);
      el('polygon', { points: '-1.6,-1 1.6,-1 0,2.4', fill: '#F2B45C', style: 'pointer-events:none' }, peng);
      // 星星罐（信右侧，半透明，裂痕微光）
      const jarW = el('g', { transform: 'translate(252,236)', opacity: '0.9', style: 'pointer-events:none' }, g);
      const jar = el('g', { class: 'float-slow' }, jarW);
      el('rect', { x: -12, y: -16, width: 24, height: 30, rx: 6, fill: 'none', stroke: 'rgba(168,184,216,0.5)', 'stroke-width': 1.2, style: 'pointer-events:none' }, jar);
      el('polyline', { points: '-9,-14 -6,-4 -10,4 -5,12', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1, class: 'blur-line', opacity: '0.8', style: 'pointer-events:none' }, jar);
      el('circle', { cx: 2, cy: 2, r: 1.5, fill: '#A8B8D8', opacity: '0.7', style: 'pointer-events:none' }, jar);
      el('circle', { cx: -3, cy: -4, r: 1.2, fill: '#A8B8D8', opacity: '0.5', style: 'pointer-events:none' }, jar);
      // 前 13 天几何体缩小环形排列（沿桌面四周）
      [[92, 96, 5], [132, 76, 7], [212, 76, 6], [250, 96, 7], [264, 150, 5], [250, 208, 6], [212, 256, 7], [132, 256, 6], [92, 208, 5]].forEach(([px, py, s], i) => {
        isoBox(g, px, py, s, s * 1.4, ['#1D2433', '#232B3C', '#141926'][i % 3], 0);
      });
      // 桌面中央的信（圆角矩形，暖白柔边，暖色手写字）
      const env = el('g', { transform: 'translate(170,224)', style: 'cursor:pointer', class: 'env-grp' }, g);
      // 透明热区（保证可点，视觉元素不拦截）
      el('rect', { x: -38, y: -28, width: 76, height: 56, rx: 5, fill: 'transparent' }, env);
      el('rect', { x: -32, y: -24, width: 64, height: 48, rx: 5, fill: 'rgba(237,230,218,0.14)', stroke: '#F2B45C', 'stroke-width': 1.4, class: 'blur-line', style: 'pointer-events:none' }, env);
      el('polygon', { points: '-32,-24 0,2 32,-24', fill: 'none', stroke: '#F2B45C', 'stroke-width': 1, opacity: '0.8', style: 'pointer-events:none' }, env);
      // 暖色手写字样（几笔弧线）
      el('path', { d: 'M-20,2 Q-8,-2 0,2 T20,2', fill: 'none', stroke: '#FFD9A0', 'stroke-width': 1.2, opacity: '0.7', style: 'pointer-events:none' }, env);
      const envGlow = el('circle', { cx: 170, cy: 224, r: 66, fill: 'url(#warmGlow)', opacity: '0.55', class: 'breathe', style: 'pointer-events:none;filter:blur(8px)' }, g);
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
