/* ============================================================
 * js/engine.js · 前端主引擎
 * 状态机（before / active / memorial）· 场景调度 · Supabase 集成
 * ============================================================ */
window.App = (function () {
  const SUPABASE_URL = window.ENV_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || '';
  const FREE_MODE = !!window.ENV_FREE_MODE; // free 版：去掉时间判定

  let state = null;
  let currentScene = null;   // 当前场景 Promise 引用
  let sceneEl = null;        // 当前场景 DOM 容器
  let sceneText = null;      // 当前场景文字层
  let sceneHint = null;      // 当前场景提示层
  let pollTimer = null;
  let completeTimer = null;
  let completeQueue = [];    // 补看队列（纪念/补看模式）
  let localStorageKey = 'loveyouforalways_progress';

  /* ============ Supabase 客户端（free 模式则走本地） ============ */
  function supabaseRpc(fn, params) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: params ? JSON.stringify(params) : '{}'
    }).then(r => r.json());
  }

  /* free 模式：本地模拟 get_state / complete_day */
  function localState() {
    const completed = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
    // free 版不设时间限制：当前可走所有已到的一天，触摸即下一个
    const current_day = 14;
    const pending = [];
    for (let d = 1; d <= current_day; d++) if (!completed.includes(d)) pending.push(d);
    return Promise.resolve({
      phase: 'active',
      current_day,
      completed,
      pending,
      letters_count: completed.length,
      next_unlock_at: null
    });
  }
  function localComplete(day) {
    const completed = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
    if (completed.includes(day)) return Promise.resolve({ ok: true, error: 'already' });
    completed.push(day);
    localStorage.setItem(localStorageKey, JSON.stringify(completed));
    const line = (window.DAYS.find(d => d.day === day) || {}).line || '';
    return Promise.resolve({ ok: true, day, line, title: '', icon: '' });
  }

  function getState() {
    if (FREE_MODE) return localState();
    if (!SUPABASE_URL) return localState(); // 无后端时降级本地（便于预览）
    return supabaseRpc('get_state').catch(() => { throw new Error('network'); });
  }
  function completeDay(day) {
    if (FREE_MODE) return localComplete(day);
    if (!SUPABASE_URL) return localComplete(day);
    return supabaseRpc('complete_day', { p_day: day }).catch(() => { throw new Error('network'); });
  }

  /* ============ DOM 引用 ============ */
  let app, letterBag, letterCount, audioToggle, counter, netError;

  function initDom() {
    app = document.getElementById('app');
    // 信袋
    letterBag = document.createElement('div');
    letterBag.className = 'letter-bag';
    letterBag.innerHTML = '<svg viewBox="0 0 24 24" stroke-width="1.3" fill="none"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg><span class="count"><b class="cnt">0</b> 句</span>';
    app.appendChild(letterBag);
    letterCount = letterBag.querySelector('.cnt');
    letterBag.addEventListener('click', onBagTap);
    letterBag.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    // 声音开关
    audioToggle = document.createElement('div');
    audioToggle.className = 'audio-toggle';
    audioToggle.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4" fill="none"><path d="M5 10v4h3l4 4V6L8 10H5z"/><path d="M15 9a4 4 0 0 1 0 6M17 6a8 8 0 0 1 0 12"/></svg>';
    app.appendChild(audioToggle);
    audioToggle.addEventListener('click', () => {
      AudioEngine.ensureCtx();
      const m = !AudioEngine.isMuted();
      AudioEngine.setMuted(m);
      audioToggle.classList.toggle('on', !m);
    });
    audioToggle.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    // 进度数字
    counter = document.createElement('div');
    counter.className = 'day-counter';
    app.appendChild(counter);
    // 断网
    netError = document.createElement('div');
    netError.className = 'net-error';
    netError.innerHTML = '<p>网络好像断了</p><button>重试</button>';
    app.appendChild(netError);
    netError.querySelector('button').addEventListener('click', () => {
      netError.classList.remove('show');
      load();
    });
  }

  function onBagTap() {
    // Day 1-13：只显示已收集句数；Day 14 拼信时信袋打开
    if (state && state.phase === 'active' && state.current_day >= 14 && state.completed.includes(14)) {
      openLetterSheet();
    } else {
      // 轻提示
      const n = state ? state.letters_count : 0;
      flashBag(n);
    }
  }

  function flashBag(n) {
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;top:10vh;right:6vw;font-size:12px;letter-spacing:0.14em;color:#8A8578;z-index:9;transition:opacity 1.2s ease;';
    tip.textContent = `已收集 ${n} 句`;
    app.appendChild(tip);
    setTimeout(() => { tip.style.opacity = '0'; setTimeout(() => tip.remove(), 1200); }, 1800);
  }

  /* ============ 渲染：门口（before / 纪念 / 未完成时也走门口） ============ */
  function renderDoor(phase, daysLeft) {
    clearApp();
    const stage = document.createElement('div');
    stage.className = 'scene door-stage enter';
    stage.id = 'door-stage';

    // 拱门 SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 340 300');
    svg.setAttribute('class', 'scene-svg');
    const defs = `<defs>
      <filter id="softBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
      <radialGradient id="warmGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,217,160,0.9)"/><stop offset="35%" stop-color="rgba(242,180,92,0.35)"/>
        <stop offset="70%" stop-color="rgba(242,180,92,0.1)"/><stop offset="100%" stop-color="rgba(242,180,92,0)"/>
      </radialGradient>
    </defs>`;
    svg.innerHTML = defs;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);

    // 墙
    addRect(g, 0, 0, 340, 300, '#0E1220');
    // 拱门
    const doorG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    doorG.setAttribute('class', 'door-grp');
    addRect(doorG, 150, 90, 40, 120, '#1A1E2A', '#2A2E3A');
    const arch = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arch.setAttribute('d', 'M150 90 a20 20 0 0 1 40 0');
    arch.setAttribute('fill', '#1A1E2A');
    arch.setAttribute('stroke', '#2A2E3A');
    doorG.appendChild(arch);
    g.appendChild(doorG);
    // 门缝暖雾
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('cx', '170'); glow.setAttribute('cy', '150');
    glow.setAttribute('r', '46'); glow.setAttribute('fill', 'url(#warmGlow)');
    glow.setAttribute('class', 'door-glow');
    if (phase === 'memorial') glow.setAttribute('opacity', '0.85');
    else glow.setAttribute('opacity', phase === 'before' ? '0.12' : '0.4');
    g.appendChild(glow);
    // 门缝线
    addRect(g, 170, 96, 1.4, 108, '#FFD9A0', null, 'blur-line');
    // 地面光斑
    const floor = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    floor.setAttribute('cx', '170'); floor.setAttribute('cy', '252');
    floor.setAttribute('rx', '70'); floor.setAttribute('ry', '16');
    floor.setAttribute('fill', 'url(#warmGlow)');
    floor.setAttribute('opacity', '0.25');
    floor.setAttribute('class', 'floor-glow');
    g.appendChild(floor);
    // 浮尘
    for (let i = 0; i < 24; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', 20 + Math.random() * 300);
      c.setAttribute('cy', 30 + Math.random() * 240);
      c.setAttribute('r', 1 + Math.random());
      c.setAttribute('fill', Math.random() > 0.5 ? '#FFD9A0' : '#A8B8D8');
      c.setAttribute('opacity', (0.1 + Math.random() * 0.2).toFixed(2));
      g.appendChild(c);
    }

    stage.appendChild(svg);

    // 文字
    const cap = document.createElement('div');
    cap.className = 'door-caption';
    if (phase === 'before') {
      cap.innerHTML = `这扇门后面，是我用 14 天搭的地方。<br>还有 <b style="color:#F2B45C">${daysLeft}</b> 天，门才开。`;
    } else if (phase === 'memorial') {
      cap.innerHTML = '生日快乐。这扇门一直开着。';
    } else {
      cap.innerHTML = '这扇门后面，是我用 14 天搭的地方。<br>每天开一点，别一次走完。';
    }
    stage.appendChild(cap);

    // 倒计时/提示
    if (phase === 'before') {
      const cnt = document.createElement('div');
      cnt.className = 'door-count';
      cnt.textContent = `${daysLeft} 天 · 门才开`;
      stage.appendChild(cnt);
    } else {
      const hint = document.createElement('div');
      hint.className = 'door-hint';
      hint.textContent = phase === 'memorial' ? '轻触推门 · 全亮房间' : '轻触推门';
      stage.appendChild(hint);
      setTimeout(() => hint.classList.add('show'), 2500);
      // 推门交互
      stage.addEventListener('pointerdown', () => {
        if (phase === 'memorial') {
          openMemorial();
        } else {
          openFirstPending();
        }
      });
    }

    app.appendChild(stage);
    setTimeout(() => cap.classList.add('show'), phase === 'before' ? 600 : 900);
    if (phase === 'before') {
      const cnt = stage.querySelector('.door-count');
      setTimeout(() => cnt.classList.add('show'), 1400);
    }
    // 呼吸
    glow.classList.add('breathe');

    // 显示常驻控件
    showChrome();
  }

  function addRect(parent, x, y, w, h, fill, stroke, cls) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('fill', fill);
    if (stroke) r.setAttribute('stroke', stroke);
    if (cls) r.setAttribute('class', cls);
    parent.appendChild(r);
    return r;
  }

  /* ============ 渲染：进入某一天 ============ */
  function openDay(day) {
    // 已完成且非补看 → 直接提示
    if (state && state.completed.includes(day) && !completeQueue.length) {
      return; // 状态机保证不会走到这里
    }
    clearApp();
    sceneEl = document.createElement('div');
    sceneEl.className = 'scene';
    sceneEl.id = 'scene-wrap';
    app.appendChild(sceneEl);
    window.__sceneEl = sceneEl;
    window.__sceneText = null;
    window.__sceneHint = null;

    // 进度数字
    counter.classList.add('show');
    counter.textContent = `DAY ${String(day).padStart(2, '0')} / 14`;

    // 进场淡入
    setTimeout(() => sceneEl.classList.add('enter'), 60);

    // 调起场景
    const runner = window.Scenes[day];
    if (!runner) return;
    currentScene = runner().then(() => {
      // 完成：展示完成浮层
      showComplete(day);
    });
  }

  function showComplete(day) {
    // 过关音效按场景
    const soundMap = { 1: 'bell', 2: 'wood', 3: 'metal', 4: 'bell', 5: 'wood', 6: 'bell', 7: 'bell', 8: 'metal', 9: 'metal', 10: 'water', 11: 'bell', 12: 'bell', 13: 'bell', 14: 'bell' };
    AudioEngine.chime(soundMap[day] || 'bell');

    const line = (window.DAYS.find(d => d.day === day) || {}).line || '';
    const ov = document.createElement('div');
    ov.className = 'complete-overlay';
    ov.innerHTML = `
      <div class="env-gain"><svg viewBox="0 0 24 24" stroke-width="1.3" fill="none"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg></div>
      <div class="done-line">${line}</div>
      <div class="done-sub">信封 +1 · 明天，还有一段路。</div>
      <div class="done-next">轻触继续</div>`;
    sceneEl.appendChild(ov);
    setTimeout(() => ov.classList.add('show'), 400);

    // 防重复
    completeTimer = setTimeout(() => {
      // 报告完成到后端（幂等）
      completeDay(day).then(() => {
        // 刷新状态
        return getState();
      }).then((s) => {
        state = s;
        updateChrome();
        nextAfterComplete();
      }).catch(() => {
        netError.classList.add('show');
      });
    }, 4200);
  }

  function nextAfterComplete() {
    clearApp();
    // 补看模式：还有路没走
    if (completeQueue.length) {
      const next = completeQueue.shift();
      openDay(next);
      return;
    }
    if (state && state.phase === 'memorial') {
      openMemorial();
      return;
    }
    if (state && state.pending && state.pending.length) {
      const next = state.pending[0];
      openDay(next);
      return;
    }
    // 今天走完了 → 倒计时页
    if (state && state.current_day >= 14) {
      openLetterSheet(); // Day 14 已全部完成 → 拼信
      return;
    }
    renderDayDone();
  }

  function renderDayDone() {
    clearApp();
    const stage = document.createElement('div');
    stage.className = 'scene door-stage enter';
    stage.id = 'door-stage';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 340 300');
    svg.setAttribute('class', 'scene-svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);
    addRect(g, 0, 0, 340, 300, '#0E1220');
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('cx', '170'); glow.setAttribute('cy', '150'); glow.setAttribute('r', '40');
    glow.setAttribute('fill', 'url(#warmGlow)'); glow.setAttribute('opacity', '0.5');
    g.appendChild(glow);
    stage.appendChild(svg);
    const cap = document.createElement('div');
    cap.className = 'door-caption';
    const next = state && state.next_unlock_at ? new Date(state.next_unlock_at) : null;
    let waitText = '今天的路走完了。';
    if (next) {
      const diff = Math.max(0, next - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      waitText = `今天的路走完了。<br>下一段路，${h ? h + ' 小时 ' : ''}${m} 分钟后开。`;
    }
    cap.innerHTML = waitText;
    stage.appendChild(cap);
    app.appendChild(stage);
    setTimeout(() => cap.classList.add('show'), 800);
    showChrome();
  }

  /* ============ 纪念模式 ============ */
  function openMemorial() {
    clearApp();
    const stage = document.createElement('div');
    stage.className = 'scene memorial-stage enter';
    const head = document.createElement('div');
    head.className = 'memorial-head';
    head.textContent = '门一直开着 · 全亮房间';
    stage.appendChild(head);
    // 14 天格子
    const grid = document.createElement('div');
    grid.className = 'memorial-grid';
    const completed = (state && state.completed) || [];
    (window.DAYS || []).forEach(d => {
      const cell = document.createElement('div');
      cell.className = 'memorial-day' + (completed.includes(d.day) ? ' done' : '');
      cell.innerHTML = `${window.IconSvg(d.icon)}<span class="n">${d.day}</span>`;
      cell.addEventListener('pointerdown', () => {
        AudioEngine.start();
        openDay(d.day);
      });
      grid.appendChild(cell);
    });
    stage.appendChild(grid);
    app.appendChild(stage);
    setTimeout(() => head.classList.add('show'), 500);
    showChrome();
  }

  /* ============ 信袋展开（Day 14 信） ============ */
  function openLetterSheet() {
    clearApp();
    const stage = document.createElement('div');
    stage.className = 'letter-sheet show';
    const inner = document.createElement('div');
    inner.className = 'sheet';
    inner.innerHTML = '<div class="sheet-head">给 你</div>';
    stage.appendChild(inner);
    app.appendChild(stage);
    (window.DAYS || []).forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'letter-row' + (d.day === 14 ? ' final' : '');
      row.innerHTML = `<p>${d.line}</p>`;
      const ico = document.createElement('span');
      ico.innerHTML = window.IconSvg(d.icon);
      ico.style.cssText = 'width:15px;height:15px;flex:0 0 auto;margin-top:5px;color:#F2B45C;';
      row.prepend(ico);
      inner.appendChild(row);
      setTimeout(() => row.style.cssText = `opacity:1;transform:translateY(0);transition:opacity 1.2s ease,transform 1.2s ease;`, 800 + i * 1100);
      if (d.day !== 14) {
        const back = document.createElement('span');
        back.className = 'back-hint';
        back.textContent = `· 回看第 ${d.day} 天 ·`;
        back.style.cssText = 'display:block;margin-top:3px;font-size:11px;letter-spacing:0.1em;color:#8A8578;cursor:pointer;';
        back.addEventListener('pointerdown', () => openDay(d.day));
        row.appendChild(back);
      }
    });
    const foot = document.createElement('div');
    foot.className = 'letter-foot';
    foot.textContent = '· 点图标，回到那天 ·';
    inner.appendChild(foot);
    setTimeout(() => foot.style.opacity = '1', 800 + 14 * 1100 + 800);
  }

  /* ============ 状态同步 ============ */
  function updateChrome() {
    if (!state) return;
    if (letterCount) letterCount.textContent = state.letters_count || 0;
    letterBag.classList.add('show');
    audioToggle.classList.add('show');
  }
  function showChrome() {
    letterBag.classList.add('show');
    audioToggle.classList.add('show');
    if (state) letterCount.textContent = state.letters_count || 0;
  }

  /* ============ 调度入口 ============ */
  function load() {
    getState().then((s) => {
      state = s;
      updateChrome();
      // 断网恢复
      netError.classList.remove('show');
      if (s.phase === 'before') {
        renderDoor('before', s.days_left);
      } else if (s.phase === 'memorial') {
        // 补看：未完成的天按从小到大补
        const completed = s.completed || [];
        const missing = [];
        for (let d = 1; d <= 14; d++) if (!completed.includes(d)) missing.push(d);
        if (missing.length) {
          completeQueue = missing.slice(1);
          openDay(missing[0]);
          // 顶部轻提示
          const tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;top:8vh;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:0.16em;color:#8A8578;z-index:9;';
          tip.textContent = `还有 ${missing.length} 段路没走`;
          app.appendChild(tip);
          setTimeout(() => { tip.style.opacity = '0'; tip.style.transition = 'opacity 1.2s ease'; setTimeout(() => tip.remove(), 1300); }, 3000);
        } else {
          openMemorial();
        }
      } else if (s.phase === 'active') {
        const pending = s.pending || [];
        if (pending.length) {
          openDay(pending[0]);
        } else {
          if (s.current_day >= 14) openLetterSheet();
          else renderDayDone();
        }
      }
      startPolling();
    }).catch(() => {
      netError.classList.add('show');
    });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (FREE_MODE) return;
    pollTimer = setInterval(() => {
      getState().then((s) => {
        // 跨天：解锁了新的一天 → 重新调度
        const oldDay = state ? state.current_day : null;
        const oldPending = state ? (state.pending || []).length : 0;
        if (s.phase !== state.phase || (s.current_day !== oldDay) || (s.pending || []).length !== oldPending) {
          state = s;
          updateChrome();
          // 若当前在"今日走完"页且新一天解锁 → 进入新一天
          if (!document.querySelector('.scene .scene-svg') || document.querySelector('.complete-overlay')) {
            load();
          }
        }
      }).catch(() => { /* 网络抖动忽略 */ });
    }, 60000);
  }

  function clearApp() {
    if (completeTimer) { clearTimeout(completeTimer); completeTimer = null; }
    if (currentScene) { /* 场景 promise 不可取消，但容器会被清掉 */ }
    if (app) {
      app.querySelectorAll('.scene, .letter-sheet, .net-error').forEach(n => {
        if (n.id !== 'net-error') {
          n.style.transition = 'opacity 0.5s ease';
          n.style.opacity = '0';
          setTimeout(() => n.remove(), 500);
        }
      });
      // 清理残留
      const keep = ['letter-bag', 'audio-toggle', 'day-counter', 'net-error'];
      app.childNodes.forEach(n => {
        if (n.nodeType === 1 && !keep.includes(n.id) && !n.classList.contains('letter-bag') && !n.classList.contains('audio-toggle') && !n.classList.contains('day-counter') && !n.classList.contains('net-error')) {
          setTimeout(() => { if (n.parentNode) n.remove(); }, 600);
        }
      });
      window.__sceneEl = null;
      window.__sceneText = null;
      window.__sceneHint = null;
    }
  }

  function openFirstPending() {
    AudioEngine.start();
    AudioEngine.doorOpen();
    if (state && state.pending && state.pending.length) {
      openDay(state.pending[0]);
    } else if (state && state.phase === 'memorial') {
      openMemorial();
    }
  }

  /* ============ 启动 ============ */
  function init() {
    initDom();
    // 首次交互解锁声音
    document.addEventListener('pointerdown', () => AudioEngine.start(), { once: false });
    // 首次进入：统一从门口开始（active 也先看门，符合"每天打开一次"）
    getState().then((s) => {
      state = s;
      updateChrome();
      if (s.phase === 'before') renderDoor('before', s.days_left);
      else renderDoor(s.phase === 'memorial' ? 'memorial' : 'active');
      startPolling();
    }).catch(() => {
      netError.classList.add('show');
    });
  }

  return { init, load };
})();

document.addEventListener('DOMContentLoaded', () => window.App.init());
