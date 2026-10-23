/* ============================================================
 * js/audio.js · 声音引擎（Web Audio API 全合成）
 * 底噪 10% · 八音盒 / 单音钢琴 · 过关轻响（钟木水铃）
 * 默认低音量，右下角可关
 * ============================================================ */
window.AudioEngine = (function () {
  let ctx = null;
  let master = null;
  let enabled = true;         // 是否已解锁（首次交互后启动）
  let muted = false;          // 用户是否关闭
  let noiseGain = null;
  let noiseSource = null;
  let breatheTimer = null;

  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
      // 底噪：极轻房间环境音，音量 10%
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.28;
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf;
      noiseSource.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 480;
      noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.02; // 10% 量级的极轻底噪
      noiseSource.connect(lp); lp.connect(noiseGain); noiseGain.connect(master);
      noiseSource.start();
      // 慢速渐变到主音量 0.5
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, ctx.currentTime + 2.2);
    } catch (e) {
      console.warn('Audio unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function start() {
    enabled = true;
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(m ? 0 : 0.5, t + 0.8);
    }
  }
  function isMuted() { return muted; }

  /* —— 单音（oscillator + 包络）—— */
  function tone(freq, opts = {}) {
    if (!ctx || muted || !enabled) return;
    const { type = 'sine', dur = 0.9, vol = 0.16, attack = 0.02, release = 0.9, when = 0, detune = 0 } = opts;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * release);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  }

  /* —— 八音盒（正弦 + 高次泛音，衰减快）—— */
  function musicBox(note, opts = {}) {
    if (!ctx || muted || !enabled) return;
    const { dur = 2.4, vol = 0.1, when = 0 } = opts;
    const t0 = ctx.currentTime + when;
    [note, note * 4, note * 5.34].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol * (i === 0 ? 1 : 0.14), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (i === 0 ? 1 : 0.55));
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.1);
    });
  }

  /* —— 过关轻响：钟 / 木 / 水 / 铃 —— */
  function chime(kind = 'bell') {
    if (!ctx || muted || !enabled) return;
    const base = { bell: 1046, wood: 660, water: 880, metal: 1568 };
    const f = base[kind] || base.bell;
    if (kind === 'wood') {
      // 木：短促低音 + 一点噪声
      tone(f, { type: 'triangle', dur: 0.5, vol: 0.2, release: 0.35 });
      tone(f * 1.5, { type: 'sine', dur: 0.4, vol: 0.08, release: 0.3 });
    } else if (kind === 'water') {
      // 水：上滑两个快速泛音
      tone(f * 0.5, { type: 'sine', dur: 0.6, vol: 0.12, release: 0.5 });
      tone(f, { type: 'sine', dur: 0.9, vol: 0.08, release: 0.8, when: 0.05 });
      tone(f * 2.01, { type: 'sine', dur: 0.5, vol: 0.05, release: 0.4, when: 0.12 });
    } else {
      musicBox(f, { dur: 1.6, vol: 0.12 });
    }
  }

  /* —— 脚步声 —— */
  function step() {
    if (!ctx || muted || !enabled) return;
    tone(130, { type: 'triangle', dur: 0.22, vol: 0.1, release: 0.7 });
    tone(196, { type: 'sine', dur: 0.3, vol: 0.05, release: 0.8, when: 0.04 });
  }

  /* —— 风声（极轻）—— */
  function wind(vol = 0.04) {
    if (!ctx || muted || !enabled) return;
    if (!noiseGain) return;
    const t = ctx.currentTime;
    noiseGain.gain.cancelScheduledValues(t);
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, t);
    noiseGain.gain.linearRampToValueAtTime(vol, t + 1.2);
    noiseGain.gain.linearRampToValueAtTime(0.02, t + 5);
  }

  /* —— 低鸣（机关触发）—— */
  function lowHum(dur = 2.2, vol = 0.1) {
    if (!ctx || muted || !enabled) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 82;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  }

  /* —— 完整旋律（八音盒 · Day 10 / 14）—— */
  const FULL_MELODY = [523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25];
  function fullMelody() {
    if (!ctx || muted || !enabled) return;
    FULL_MELODY.forEach((f, i) => {
      musicBox(f, { dur: 2.6, vol: 0.1, when: i * 0.9 });
    });
    // 收尾渐弱，只剩底噪
    if (ctx) {
      const t = ctx.currentTime + FULL_MELODY.length * 0.9 + 1.6;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(master.gain.value, ctx.currentTime + 0.05);
      master.gain.linearRampToValueAtTime(0.5, t);
    }
  }

  /* —— 八音盒第一次响起（Day 5）—— */
  function firstMusicBox() {
    if (!ctx || muted || !enabled) return;
    [523.25, 587.33, 659.25].forEach((f, i) => musicBox(f, { dur: 2, vol: 0.09, when: i * 0.55 }));
  }

  /* —— 开门（低沉木头声）—— */
  function doorOpen() {
    if (!ctx || muted || !enabled) return;
    tone(110, { type: 'triangle', dur: 1.4, vol: 0.16, release: 0.9 });
    tone(55, { type: 'sine', dur: 1.6, vol: 0.1, release: 0.9, when: 0.1 });
  }

  return {
    start,
    tone,
    musicBox,
    chime,
    step,
    wind,
    lowHum,
    fullMelody,
    firstMusicBox,
    doorOpen,
    setMuted,
    isMuted,
    ensureCtx
  };
})();
