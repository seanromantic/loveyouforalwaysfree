/* ============================================================
 * js/engine.js · 前端主引擎
 * 状态机（before / active / memorial）· 场景调度 · Supabase 集成
 * 渲染层：Three.js 真 3D（Room3D 常驻 #stage3d）
 * ============================================================ */
import { Room3D } from './room3d.js';

// 常驻 3D 舞台（clearApp 不清除；所有画面都在同一个房间里）
(function ensureStage() {
  const app = document.getElementById('app');
  if (!app) return;
  const stage = document.createElement('div');
  stage.id = 'stage3d';
  app.appendChild(stage);
  Room3D.boot(stage);
})();

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

  /* 空间显影阶段：Day1-4 虚无孤灯 / Day5 窗开墙现 / Day6-13 丰满 / Day14 全亮 */
  function stageForDay(day) {
    return day < 5 ? 0 : day === 5 ? 1 : day < 14 ? 2 : 3;
  }

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

  /* ============ 渲染：门口（Three.js 3D 门洞，before / 纪念 / 未完成时也走门口） ============ */
  function renderDoor(phase, daysLeft) {
    clearApp();
    Room3D.setRoomStage(phase === 'memorial' ? 3 : 0);   // 门前：黑暗中的门（纪念：全亮房间）
    Room3D.showDoor(phase);
    const stage = document.getElementById('stage3d');

    // 文字（毛玻璃，见 css）
    const cap = document.createElement('div');
    cap.className = 'door-caption';
    if (phase === 'before') {
      cap.innerHTML = `这扇门后面，是我用 14 天搭的地方。<br>还有 <b style="color:#F2B45C">${daysLeft}</b> 天，门才开。`;
    } else if (phase === 'memorial') {
      cap.innerHTML = '生日快乐。这扇门一直开着。';
    } else {
      cap.innerHTML = '这扇门后面，是我用 14 天搭的地方。<br>每天开一点，别一次走完。';
    }
    app.appendChild(cap);
    setTimeout(() => cap.classList.add('show'), phase === 'before' ? 600 : 900);

    // 倒计时/提示
    if (phase === 'before') {
      const cnt = document.createElement('div');
      cnt.className = 'door-count';
      cnt.textContent = `${daysLeft} 天 · 门才开`;
      app.appendChild(cnt);
      setTimeout(() => cnt.classList.add('show'), 1400);
    } else {
      const hint = document.createElement('div');
      hint.className = 'door-hint';
      hint.textContent = phase === 'memorial' ? '轻触推门 · 全亮房间' : '轻触推门';
      app.appendChild(hint);
      setTimeout(() => hint.classList.add('show'), 2500);
      const push = () => {
        stage.removeEventListener('pointerdown', push);
        if (phase === 'memorial') openMemorial();
        else openFirstPending();
      };
      stage.addEventListener('pointerdown', push);
    }

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
    Room3D.hideDoor();
    Room3D.setRoomStage(stageForDay(day));   // 空间显影：随天数墙/光慢慢长出来
    window.__currentDay = day;               // 供文字框显示 Day N
    sceneEl = document.getElementById('stage3d');
    window.__sceneEl = sceneEl;
    window.__sceneText = null;
    window.__sceneHint = null;

    // 进度数字
    counter.classList.add('show');
    counter.textContent = `DAY ${String(day).padStart(2, '0')} / 14`;

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
    // free 版：加"下一天"按钮，随时快进
    if (FREE_MODE) {
      const nb = document.createElement('button');
      nb.className = 'done-next-btn';
      nb.textContent = '下一天';
      nb.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        finishDay(day);
      });
      ov.appendChild(nb);
    }
    sceneEl.appendChild(ov);
    setTimeout(() => ov.classList.add('show'), 400);

    // 防重复
    completeTimer = setTimeout(() => finishDay(day), 4200);
  }

  function finishDay(day) {
    if (completeTimer) { clearTimeout(completeTimer); completeTimer = null; }
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
    Room3D.hideDoor();
    const dd = state && state.current_day ? state.current_day : 1;
    Room3D.setRoomStage(stageForDay(dd));
    Room3D.beginDay();            // 房间暗着，只有桌和灯（弱光）
    Room3D.lampLight.intensity = 0.8;
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
    app.appendChild(cap);
    setTimeout(() => cap.classList.add('show'), 800);
    showChrome();
  }

  /* ============ 纪念模式 ============ */
  function openMemorial() {
    clearApp();
    Room3D.setRoomStage(3);   // 纪念：全亮房间
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
    Room3D.setRoomStage(3);   // 最后一天：房间全亮
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
          if (!document.querySelector('.door-caption') || document.querySelector('.complete-overlay')) {
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
      // 3D 舞台之外的场景层
      app.querySelectorAll('.scene, .letter-sheet, .net-error, .letter-lines, .letter-hint, .fig-btns, .scene-text, .scene-hint').forEach(n => {
        if (n.id !== 'net-error') {
          n.style.transition = 'opacity 0.5s ease';
          n.style.opacity = '0';
          setTimeout(() => n.remove(), 500);
        }
      });
      // 清理残留（保留常驻控件与 3D 舞台）
      const keep = ['letter-bag', 'audio-toggle', 'day-counter', 'net-error', 'stage3d'];
      app.childNodes.forEach(n => {
        if (n.nodeType === 1 && !keep.includes(n.id) && !n.classList.contains('letter-bag') && !n.classList.contains('audio-toggle') && !n.classList.contains('day-counter') && !n.classList.contains('net-error') && n.id !== 'stage3d') {
          setTimeout(() => { if (n.parentNode) n.remove(); }, 600);
        }
      });
      window.__sceneEl = null;
      window.__sceneText = null;
      window.__sceneHint = null;
    }
    // 3D 舞台内的完成浮层等场景 DOM 也一并清除（挂在 stage3d 下，不在 app 子树）
    const st = document.getElementById('stage3d');
    if (st) {
      st.querySelectorAll('.complete-overlay').forEach(n => n.remove());
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
