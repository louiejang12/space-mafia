/* 우주선 마피아 사운드
   - 배경음악과 효과음을 Web Audio로 즉석 합성한다 (음원 파일 없음).
   - 게임 화면은 SpaceSound.scene(이름)으로 배경음악을, SpaceSound.play(이름)으로 효과음을 요청한다.
   - 비공개 행동(역할 확인, 밤 선택, 투표 선택)에는 소리를 붙이지 않는다. 호출하는 쪽의 규칙이다. */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const MUSIC_LEVEL = 0.5, DUCK_LEVEL = 0.14;
  let ctx = null, master, music, sfx, delay;
  let musicOn = true, sfxOn = true, ducked = false;
  let want = null, cur = null, track = null, bus = null, timer = null, step = 0, nextTime = 0;

  function init() {
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        master = ctx.createGain(); master.gain.value = 0.9;
        master.connect(comp); comp.connect(ctx.destination);
        music = ctx.createGain(); music.gain.value = MUSIC_LEVEL; music.connect(master);
        sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
        // 배경음악용 공간감 (에코)
        delay = ctx.createDelay(1); delay.delayTime.value = 0.34;
        const fb = ctx.createGain(); fb.gain.value = 0.33;
        const wet = ctx.createGain(); wet.gain.value = 0.3;
        delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(music);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 악기 ---------- */
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, freq, t, dur, peak, dest, o = {}) {
    const a = o.a == null ? 0.01 : o.a;
    const n = ctx.createOscillator();
    n.type = type; n.frequency.setValueAtTime(freq, t);
    if (o.detune) n.detune.value = o.detune;
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    let out = n;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; n.connect(f); out = f; }
    out.connect(g); g.connect(dest);
    n.start(t); n.stop(t + a + dur + 0.05);
    return n;
  }
  let noiseBuf = null;
  function noiseHit(t, dur, peak, dest, o = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const a = o.a == null ? 0.005 : o.a;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'highpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.freq || 6000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + a + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + a + dur + 0.05);
  }
  function pad(midis, t, dur, peak, dest, cutoff = 900) {
    midis.forEach(m => [-8, 8].forEach(dt => osc('sawtooth', mtof(m), t, dur * 0.7, peak / midis.length, dest, {a: dur * 0.3, detune: dt, filter: cutoff})));
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 배경음악 ---------- */
  const TRACKS = {
    // 대기실·역할 확인: 잔잔한 우주 정거장 느낌
    lobby: {
      bpm: 92,
      play(s, t, sd, out) {
        const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]];
        const bass = [36, 33, 29, 31];
        const bar = Math.floor(s / 8) % 4, k = s % 8, ch = chords[bar];
        if (k === 0) pad(ch, t, sd * 8.4, 0.05, out, 1100);
        if (k === 0 || k === 5) osc('triangle', mtof(bass[bar]), t, sd * 2.5, 0.11, out, {a: 0.02, filter: 500});
        if ([0, 2, 3, 5, 6].includes(k)) osc('triangle', mtof(ch[(k + bar) % 4] + 12), t, 0.4, 0.045, out, {a: 0.004});
        if (k % 2 === 1) noiseHit(t, 0.03, 0.012, out, {freq: 8000});
      },
    },
    // 밤: 낮게 깔리는 드론과 느린 심장 박동, 멀리서 반짝이는 별 소리
    night: {
      bpm: 62,
      play(s, t, sd, out) {
        const k = s % 16;
        if (k === 0) {
          pad([45, 52, 57], t, sd * 17, 0.06, out, 420);
          osc('sine', mtof(33), t, sd * 16, 0.08, out, {a: sd * 4});
          noiseHit(t, sd * 12, 0.018, out, {type: 'bandpass', freq: 300, freqEnd: 1200, q: 2, a: sd * 4});
        }
        if (k % 4 === 0) {
          osc('sine', 58, t, 0.22, 0.12, out, {a: 0.004});
          osc('sine', 52, t + 0.2, 0.26, 0.08, out, {a: 0.004});
        }
        if (Math.random() < 0.22) osc('sine', mtof(pick([81, 84, 86, 88, 91, 93])), t, 1.8, 0.022, out, {a: 0.01});
      },
    },
    // 긴급 회의·찬반 투표: 낮게 쿵쿵대는 긴장감
    tension: {
      bpm: 112,
      play(s, t, sd, out) {
        const k = s % 16;
        osc('sawtooth', mtof(38), t, sd * 0.8, k % 4 === 0 ? 0.09 : 0.05, out, {a: 0.005, filter: 320});
        if (k === 0) pad([62, 63, 69], t, sd * 16, 0.025, out, 1300);
        if (k === 0 || k === 6 || k === 8) { const o = osc('sine', 120, t, 0.25, 0.16, out, {a: 0.003}); o.frequency.exponentialRampToValueAtTime(45, t + 0.2); }
        noiseHit(t, 0.025, k % 2 ? 0.008 : 0.014, out, {freq: 9000});
      },
    },
  };

  function schedule() {
    if (!track || !ctx) return;
    const sd = 60 / track.bpm / 2;
    while (nextTime < ctx.currentTime + 0.3) { try { track.play(step, nextTime, sd, bus); } catch (e) {} step++; nextTime += sd; }
  }
  function stopTrack() {
    clearInterval(timer); timer = null; track = null;
    if (bus) {
      const b = bus, now = ctx.currentTime;
      b.gain.cancelScheduledValues(now); b.gain.setValueAtTime(b.gain.value, now); b.gain.linearRampToValueAtTime(0, now + 0.9);
      setTimeout(() => { try { b.disconnect(); } catch (e) {} }, 8000);
      bus = null;
    }
  }
  function startTrack(name) {
    bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.6);
    bus.connect(music);
    const send = ctx.createGain(); send.gain.value = 0.35; bus.connect(send); send.connect(delay);
    track = TRACKS[name]; step = 0; nextTime = ctx.currentTime + 0.05;
    timer = setInterval(schedule, 60); schedule();
  }
  function apply() {
    if (!ctx) return;
    const target = musicOn && TRACKS[want] ? want : null;
    if (target === cur) return;
    cur = target;
    stopTrack();
    if (target) startTrack(target);
  }

  /* ---------- 효과음 ---------- */
  const FX = {
    click(t) { osc('sine', 900, t, 0.05, 0.06, sfx, {a: 0.002}); },
    pop(t) { const o = osc('sine', 500, t, 0.14, 0.12, sfx, {a: 0.004}); o.frequency.exponentialRampToValueAtTime(1000, t + 0.1); },
    night(t) {
      [55, 82.5, 110].forEach((f, i) => osc('sine', f, t, 3.6, 0.2 / (i + 1), sfx, {a: 0.02}));
      osc('triangle', 220, t, 2.4, 0.03, sfx, {a: 0.5});
      noiseHit(t, 2.4, 0.05, sfx, {type: 'lowpass', freq: 900, freqEnd: 150, a: 0.8});
    },
    dawn(t) {
      [72, 76, 79, 84].forEach((m, i) => {
        osc('sine', mtof(m), t + i * 0.15, 1.7, 0.09, sfx, {a: 0.005});
        osc('sine', mtof(m) * 2.01, t + i * 0.15, 0.8, 0.02, sfx, {a: 0.005});
      });
    },
    death(t) {
      const o = osc('sine', 120, t, 1, 0.35, sfx, {a: 0.004}); o.frequency.exponentialRampToValueAtTime(38, t + 0.7);
      [50, 51, 57].forEach(m => osc('sawtooth', mtof(m), t, 2, 0.035, sfx, {a: 0.01, filter: 700}));
      noiseHit(t, 0.5, 0.09, sfx, {type: 'lowpass', freq: 1400, freqEnd: 200});
    },
    safe(t) { [67, 71, 74, 79].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.1, 1.3, 0.06, sfx, {a: 0.01})); },
    alarm(t) { for (let i = 0; i < 6; i++) osc('square', i % 2 ? 660 : 880, t + i * 0.22, 0.17, 0.07, sfx, {a: 0.01, filter: 2400}); },
    reveal(t) {
      const o = osc('sine', 160, t, 0.5, 0.4, sfx, {a: 0.003}); o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
      noiseHit(t, 0.3, 0.1, sfx, {type: 'lowpass', freq: 3000, freqEnd: 300});
      [57, 60, 64].forEach(m => osc('sawtooth', mtof(m), t + 0.02, 1.3, 0.025, sfx, {a: 0.01, filter: 1400}));
    },
    eject(t) {
      noiseHit(t, 2.3, 0.13, sfx, {type: 'bandpass', freq: 2600, freqEnd: 140, q: 1.2, a: 0.1});
      const o = osc('sine', 900, t + 0.2, 2.2, 0.07, sfx, {a: 0.05}); o.frequency.exponentialRampToValueAtTime(90, t + 2.4);
    },
    tick(t) { osc('square', 1500, t, 0.03, 0.05, sfx, {a: 0.001, filter: 3200}); },
    chime(t) { [76, 83].forEach((m, i) => osc('sine', mtof(m), t + i * 0.2, 1.3, 0.09, sfx, {a: 0.005})); },
    buzzer(t) { [0, 0.3].forEach(off => osc('square', 880, t + off, 0.24, 0.13, sfx, {a: 0.02, filter: 3000})); },
    townWin(t) {
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.1, i === 6 ? 2 : 0.5, 0.08, sfx, {a: 0.005}));
      pad([60, 64, 67, 72], t + 0.7, 3, 0.07, sfx, 1600);
    },
    mafiaWin(t) {
      [57, 56, 53, 50].forEach((m, i) => osc('sawtooth', mtof(m), t + i * 0.38, 1.5, 0.05, sfx, {a: 0.02, filter: 900}));
      osc('sine', 55, t, 3.2, 0.25, sfx, {a: 0.05});
    },
  };

  window.SpaceSound = {
    /** 사용자가 화면을 누를 때마다 호출 (브라우저는 터치 이후에만 소리를 허락함) */
    unlock() { if (init()) apply(); },
    /** 배경음악 장면: 'lobby' | 'night' | 'tension' | null(무음) */
    scene(name) { want = name || null; apply(); },
    play(name, delaySec = 0) {
      if (!sfxOn || !FX[name] || !ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      try { FX[name](ctx.currentTime + 0.02 + delaySec); } catch (e) {}
    },
    setMusic(on) { musicOn = !!on; apply(); },
    setSfx(on) { sfxOn = !!on; },
    /** 사회자 음성이 나오는 동안 배경음악을 줄인다 */
    duck(on) {
      if (!ctx || ducked === !!on) return;
      ducked = !!on;
      const now = ctx.currentTime;
      music.gain.cancelScheduledValues(now); music.gain.setValueAtTime(music.gain.value, now);
      music.gain.linearRampToValueAtTime(on ? DUCK_LEVEL : MUSIC_LEVEL, now + 0.3);
    },
  };
})();
