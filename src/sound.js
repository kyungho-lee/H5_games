/* sound.js — SameGame · Grid Protocol 8-bit synthesizer
   Attaches SoundManager to window.SG. Load after core.js.
   No external audio files needed — all tones are synthesized via Web Audio API. */
(function (global) {
  'use strict';

  /* ================================================================
     SoundManager — Web Audio API 8-bit synthesizer
     No external files needed. All tones are generated in code.
     To replace with real .wav files later:
       sound.play('remove') → load src/assets/sounds/remove.wav instead
  ================================================================ */
  class SoundManager {
    constructor() {
      this._ctx   = null;
      this._muted = false;
    }

    // Lazy-init AudioContext on first user gesture (browser policy)
    _getCtx() {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }

    get muted() { return this._muted; }
    toggleMute() {
      this._muted = !this._muted;
      return this._muted;
    }

    // Core tone synthesizer
    // type: 'square'|'sawtooth'|'triangle'  (all 8-bit flavors)
    // notes: [{freq, dur, delay}]  — sequence of notes
    _play(type, notes, masterGain = 0.18) {
      if (this._muted) return;
      const ctx = this._getCtx();
      notes.forEach(({ freq, dur, delay = 0 }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

        const t0 = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(masterGain, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

        osc.start(t0);
        osc.stop(t0 + dur + 0.01);
      });
    }

    // ── 4 game sounds ──────────────────────────────────────────────

    // 타일 제거: 짧은 하강 비프 (그룹 크기에 따라 음조 변화)
    playRemove(groupSize) {
      const base = 220 + Math.min(groupSize, 20) * 18; // 220~580 Hz
      this._play('square', [
        { freq: base,        dur: 0.06 },
        { freq: base * 0.75, dur: 0.08, delay: 0.05 },
      ], 0.15);
    }

    // 콤보: 상승 아르페지오
    playCombo(comboCount) {
      const scale = [261, 329, 392, 523, 659, 784]; // C4 메이저 스케일
      const notes = [];
      const steps = Math.min(comboCount + 1, scale.length);
      for (let i = 0; i < steps; i++) {
        notes.push({ freq: scale[i], dur: 0.1, delay: i * 0.07 });
      }
      this._play('square', notes, 0.16);
    }

    // 보드 클리어: 팡파레 (5음 상승)
    playClear() {
      this._play('square', [
        { freq: 523,  dur: 0.10, delay: 0.00 },
        { freq: 659,  dur: 0.10, delay: 0.10 },
        { freq: 784,  dur: 0.10, delay: 0.20 },
        { freq: 1047, dur: 0.10, delay: 0.30 },
        { freq: 1318, dur: 0.22, delay: 0.40 },
      ], 0.18);
      // 화음 레이어
      setTimeout(() => this._play('triangle', [
        { freq: 392, dur: 0.55 },
        { freq: 523, dur: 0.55, delay: 0.10 },
      ], 0.08), 50);
    }

    // 게임 오버: 하강 단음 시퀀스
    playGameOver() {
      this._play('sawtooth', [
        { freq: 440, dur: 0.14, delay: 0.00 },
        { freq: 370, dur: 0.14, delay: 0.15 },
        { freq: 311, dur: 0.14, delay: 0.30 },
        { freq: 220, dur: 0.35, delay: 0.45 },
      ], 0.17);
    }
  }

  const SG = global.SG = global.SG || {};
  SG.SoundManager = SoundManager;

})(typeof window !== 'undefined' ? window : global);
