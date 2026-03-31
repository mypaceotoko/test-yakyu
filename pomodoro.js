/* ===========================================================
   RETRO BASEBALL  –  pomodoro.js  v1.0
   ポモドーロタイマー機能
   - 25分作業 / 5分休憩 / 4セット後15分休憩
   - Web Audio API による効果音通知
   - レトロピクセルスタイル
   ============================================================ */
"use strict";

const Pomodoro = (() => {
  const SESSIONS_PER_CYCLE = 4;

  const cfg = {
    workDuration:  25 * 60,
    shortBreak:     5 * 60,
    longBreak:     15 * 60,
  };

  const state = {
    phase:          'work',   // 'work' | 'break' | 'longbreak'
    remaining:      cfg.workDuration,
    totalDuration:  cfg.workDuration,
    completedWork:  0,
    running:        false,
    timer:          null,
    audioCtx:       null,
  };

  // ── Audio ──────────────────────────────────────────────────
  function getAudio() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioCtx;
  }

  function playChime(workDone) {
    try {
      const ctx = getAudio();
      ctx.resume();
      // 作業完了：上昇音階 / 休憩完了：下降音階
      const notes = workDone
        ? [523.25, 659.25, 783.99, 1046.50]
        : [1046.50, 783.99, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.22, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
        osc.start(t0);
        osc.stop(t0 + 0.42);
      });
    } catch (_) { /* audio blocked – ignore */ }
  }

  // ── Helpers ────────────────────────────────────────────────
  function fmt(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function currentSessionNum() {
    if (state.phase === 'work') {
      return (state.completedWork % SESSIONS_PER_CYCLE) + 1;
    }
    // ブレーク中：直前に完了したセッション番号を表示
    const prev = state.completedWork - 1;
    if (state.phase === 'longbreak') return SESSIONS_PER_CYCLE;
    return (prev % SESSIONS_PER_CYCLE) + 1;
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    const labels = { work: 'WORK TIME', break: 'SHORT BREAK', longbreak: 'LONG BREAK' };
    const phase  = state.phase;

    document.getElementById('pomo-timer').textContent  = fmt(state.remaining);
    document.getElementById('pomo-phase').textContent  = labels[phase];

    // プログレスバー
    const pct = Math.round((1 - state.remaining / state.totalDuration) * 100);
    document.getElementById('pomo-progress-fill').style.width = `${pct}%`;

    // セッションラベル
    document.getElementById('pomo-session-label').textContent =
      `SESSION ${currentSessionNum()} / ${SESSIONS_PER_CYCLE}`;

    // セッションドット
    const cyclePos = state.completedWork % SESSIONS_PER_CYCLE;
    for (let i = 0; i < SESSIONS_PER_CYCLE; i++) {
      const dot = document.getElementById(`pomo-dot-${i}`);
      if (!dot) continue;
      dot.className = 'pomo-dot';
      if (phase === 'work') {
        if (i < cyclePos)      dot.classList.add('completed');
        else if (i === cyclePos) dot.classList.add('active');
      } else if (phase === 'longbreak') {
        dot.classList.add('completed');
      } else {
        // short break
        if (i < cyclePos) dot.classList.add('completed');
      }
    }

    // ボタン状態
    document.getElementById('pomo-start-btn').disabled = state.running;
    document.getElementById('pomo-pause-btn').disabled = !state.running;

    // フェーズカラー（data属性でCSS変数切り替え）
    document.getElementById('pomodoro-screen').dataset.phase = phase;

    // タブタイトル
    document.title = state.running
      ? `${fmt(state.remaining)} ${labels[phase]} | RETRO BASEBALL`
      : 'RETRO BASEBALL';
  }

  // ── Timer mechanics ────────────────────────────────────────
  function phaseComplete() {
    clearInterval(state.timer);
    state.timer   = null;
    state.running = false;

    const wasWork = state.phase === 'work';
    playChime(wasWork);

    if (wasWork) {
      state.completedWork++;
      const isLong = state.completedWork % SESSIONS_PER_CYCLE === 0;
      state.phase         = isLong ? 'longbreak' : 'break';
      state.remaining     = isLong ? cfg.longBreak : cfg.shortBreak;
      state.totalDuration = state.remaining;
    } else {
      state.phase         = 'work';
      state.remaining     = cfg.workDuration;
      state.totalDuration = cfg.workDuration;
    }
    render();
  }

  function tick() {
    state.remaining--;
    if (state.remaining <= 0) {
      state.remaining = 0;
      render();
      phaseComplete();
      return;
    }
    render();
  }

  // ── Public controls ────────────────────────────────────────
  function start() {
    if (state.running) return;
    getAudio().resume().catch(() => {});
    state.running = true;
    state.timer   = setInterval(tick, 1000);
    render();
  }

  function pause() {
    if (!state.running) return;
    state.running = false;
    clearInterval(state.timer);
    state.timer = null;
    render();
  }

  function reset() {
    clearInterval(state.timer);
    state.timer         = null;
    state.running       = false;
    state.phase         = 'work';
    state.remaining     = cfg.workDuration;
    state.totalDuration = cfg.workDuration;
    state.completedWork = 0;
    render();
  }

  // ── Screen navigation ──────────────────────────────────────
  function show() {
    document.getElementById('title-screen').style.display     = 'none';
    document.getElementById('pomodoro-screen').style.display  = 'flex';
    render();
  }

  function hide() {
    pause();
    document.getElementById('pomodoro-screen').style.display = 'none';
    document.getElementById('title-screen').style.display    = 'flex';
    document.title = 'RETRO BASEBALL';
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    document.getElementById('pomo-start-btn').addEventListener('click', start);
    document.getElementById('pomo-pause-btn').addEventListener('click', pause);
    document.getElementById('pomo-reset-btn').addEventListener('click', reset);
    document.getElementById('pomo-back-btn').addEventListener('click', hide);
    document.getElementById('title-pomo-btn').addEventListener('click', show);

    document.getElementById('pomo-work-select').addEventListener('change', (e) => {
      cfg.workDuration = parseInt(e.target.value, 10) * 60;
      if (!state.running && state.phase === 'work') {
        state.remaining     = cfg.workDuration;
        state.totalDuration = cfg.workDuration;
        render();
      }
    });

    document.getElementById('pomo-break-select').addEventListener('change', (e) => {
      cfg.shortBreak = parseInt(e.target.value, 10) * 60;
      if (!state.running && state.phase === 'break') {
        state.remaining     = cfg.shortBreak;
        state.totalDuration = cfg.shortBreak;
        render();
      }
    });

    render();
  }

  return { init };
})();

// DOMがすでに解析済み（bodyの末尾に配置）なので直接呼び出し
Pomodoro.init();
