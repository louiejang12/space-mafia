/* 우주선 마피아 연출 (애니메이션)
   - SpaceFX.play(종류, 옵션): 밤·아침·긴급 회의·결과 공개·승리 때 화면 전체에 짧은 연출을 띄운다. 누르면 건너뛴다.
   - SpaceFX.ambient(켜기): 대기 화면 뒤로 크루가 가끔 둥둥 떠다닌다.
   - 모두가 함께 보는 순간에만 부른다. 개인 화면(역할, 밤 선택, 경찰 결과)에는 쓰지 않는다.
   - 크루 그림은 각 페이지에 있는 <symbol id="crew">를 쓴다.
   - 움직임 줄이기 설정을 켠 기기에서는 연출을 띄우지 않는다. */
(function () {
  'use strict';
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const crew = (c, cls = '', extra = '') => `<svg class="fxcrew ${cls}" viewBox="0 0 108 122" style="--b:${c.b};--s:${c.s};${extra}" aria-hidden="true"><use href="#crew" width="108" height="122"/></svg>`;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const CSS = `
.fx{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;overflow:hidden;
  color:#fff;text-align:center;cursor:pointer;padding:24px 16px;animation:fxout .45s ease-in var(--out) forwards;
  font-family:'Black Han Sans','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
@keyframes fxout{to{opacity:0;visibility:hidden}}
.fx-bg{position:absolute;inset:0;z-index:-1;animation:fxfade .45s ease-out both}
@keyframes fxfade{from{opacity:0}}
.fx-stage{display:flex;flex-direction:column;align-items:center;gap:14px}
.fx-title{font-size:clamp(44px,14vw,76px);line-height:1.05;text-shadow:0 5px 0 rgba(0,0,0,.35);animation:fxpop .6s cubic-bezier(.2,1.5,.4,1) .35s both;word-break:keep-all}
.fx-sub{font-family:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-weight:700;font-size:17px;opacity:.9;animation:fxup .5s ease-out .65s both;word-break:keep-all;max-width:30ch}
.fx-skip{position:absolute;bottom:calc(18px + env(safe-area-inset-bottom,0px));font-family:'IBM Plex Sans KR',sans-serif;font-size:12px;opacity:.55}
@keyframes fxpop{from{transform:scale(.3) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
@keyframes fxup{from{transform:translateY(16px);opacity:0}}
.fxcrew{width:64px;height:auto;display:block;overflow:visible}
.fx-row{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;max-width:90vw}
.fx-c{position:relative}

/* 밤: 달이 뜨고 크루들이 존다 */
.fx-night .fx-bg{background:radial-gradient(ellipse at 50% 30%,#1b2466,#05071a 70%)}
.fx-moon{width:110px;height:110px;border-radius:50%;box-shadow:inset -26px 10px 0 0 #F4E7B5;filter:drop-shadow(0 0 24px #f4e7b566);animation:moonrise 1.3s cubic-bezier(.2,.8,.2,1) both}
@keyframes moonrise{from{transform:translateY(60vh) rotate(-90deg)}to{transform:rotate(-20deg)}}
.fx-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:0;animation:twinkle 1.1s ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:.1;transform:scale(.5)}to{opacity:1;transform:scale(1.3)}}
.fx-night .fxcrew{animation:sleepy 2.6s ease-in-out both}
@keyframes sleepy{0%{transform:none}35%{transform:rotate(-6deg) translateY(2px)}100%{transform:rotate(-16deg) translateY(5px)}}
.fx-z{position:absolute;top:-6px;right:-4px;font-size:18px;color:#cfe0ff;opacity:0;animation:zz 1.6s ease-out infinite}
@keyframes zz{0%{transform:translate(0,0) scale(.5);opacity:0}30%{opacity:1}100%{transform:translate(20px,-44px) scale(1.2);opacity:0}}

/* 아침(무사): 해가 뜨고 크루들이 폴짝 */
.fx-dawn .fx-bg{background:linear-gradient(to top,#ffb46b 0%,#ff7e8a 38%,#2a2f7a 100%)}
.fx-sun{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#fff6c4 0 42%,#ffd35a 43% 62%,transparent 63%);filter:drop-shadow(0 0 30px #ffd35a);animation:sunrise 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes sunrise{from{transform:translateY(55vh) scale(.7)}}
.fx-dawn .fxcrew{animation:hop .42s ease-in-out infinite alternate}
@keyframes hop{from{transform:translateY(0) scaleY(.94)}to{transform:translateY(-20px) scaleY(1.04)}}

/* 아침(희생자): 붉은 번쩍임과 함께 크루가 쓰러진다 */
.fx-dead .fx-bg{background:radial-gradient(circle at 50% 50%,#6a0c18,#12030a 75%);animation:fxfade .2s both,redpulse .45s ease-in-out .1s 3}
@keyframes redpulse{50%{filter:brightness(1.8)}}
.fx-dead .fx-stage{animation:shake .5s .95s}
.fx-victim .fxcrew{width:110px;animation:fall 1s cubic-bezier(.55,0,.8,.35) both}
@keyframes fall{0%{transform:translateY(-75vh) rotate(0)}70%{transform:translateY(0) rotate(-15deg)}82%{transform:translateY(-14px) rotate(-60deg)}100%{transform:translateY(8px) rotate(-90deg)}}
@keyframes shake{20%{transform:translate(-8px,2px)}40%{transform:translate(7px,-3px)}60%{transform:translate(-5px,2px)}80%{transform:translate(4px,-1px)}}

/* 긴급 회의: 빨간 버튼이 눌리고 경고 테이프가 흐른다 */
.fx-meet .fx-bg{inset:-60%;background:repeating-conic-gradient(from 0deg,#b3121f 0 10deg,#7d0a14 10deg 20deg);animation:fxfade .2s both,spin 9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fx-btn{width:130px;height:130px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#FF9B9B,#D3202D 55%,#7B0D16);box-shadow:0 12px 0 #4A0710,0 0 0 12px #2A304F;animation:press .6s ease-in-out .15s both}
@keyframes press{40%{transform:translateY(10px) scale(.95);box-shadow:0 2px 0 #4A0710,0 0 0 12px #2A304F}}
.fx-meet .fx-title{animation:slam .45s cubic-bezier(.2,1.6,.4,1) .55s both}
.fx-meet .fx-stage{animation:shake .45s 1s}
@keyframes slam{from{transform:scale(3.2);opacity:0}to{transform:none;opacity:1}}
.fx-tape{position:absolute;left:-10%;right:-10%;height:34px;background:repeating-linear-gradient(-45deg,#F7C948 0 18px,#1C1604 18px 36px);animation:tape .9s linear infinite;box-shadow:0 4px 12px #0006}
.fx-tape.t{top:11%;transform:rotate(-5deg)}.fx-tape.b{bottom:11%;transform:rotate(4deg);animation-direction:reverse}
@keyframes tape{to{background-position:51px 0}}

/* 결과 공개: 두구두구 */
.fx-drum .fx-bg{background:radial-gradient(circle at 50% 45%,#2a2f5a,#05060f 70%)}
.fx-spot{position:absolute;width:70vmin;height:70vmin;border-radius:50%;background:radial-gradient(circle,#fff2 0,#fff1 45%,transparent 70%);animation:spot 1.3s ease-in-out both}
@keyframes spot{0%{transform:translate(-40vw,-10vh)}50%{transform:translate(30vw,5vh)}100%{transform:none}}
.fx-drum .fx-title{animation:fxpop .4s cubic-bezier(.2,1.5,.4,1) .1s both,drum .12s linear .5s 8}
@keyframes drum{50%{transform:translateY(-3px) rotate(-1deg)}}

/* 승리 */
.fx-town .fx-bg{background:radial-gradient(ellipse at 50% 30%,#2b64c9,#0a1330 75%)}
.fx-mafia .fx-bg{background:radial-gradient(ellipse at 50% 40%,#7a0f1f,#12030a 75%)}
.fx-town .fxcrew{animation:hop .38s ease-in-out infinite alternate}
.fx-mafia .fxcrew{filter:drop-shadow(0 0 14px #ff2d3d);animation:loom 2.6s ease-out both}
@keyframes loom{from{transform:scale(.6) translateY(30px);opacity:0}to{transform:scale(1.1);opacity:1}}
.fx-mafia .fx-title{animation:fxpop .6s cubic-bezier(.2,1.5,.4,1) .35s both,glitch .3s steps(2) 1s 4}
@keyframes glitch{0%{text-shadow:4px 0 #ff2d3d,-4px 0 #3df2ff}100%{text-shadow:-3px 0 #ff2d3d,3px 0 #3df2ff}}
.fx-conf{position:absolute;top:-6vh;left:var(--x);width:9px;height:14px;border-radius:2px;background:var(--c);animation:conf var(--d) cubic-bezier(.25,.6,.45,1) var(--s) both}
@keyframes conf{to{transform:translate(var(--dx),112vh) rotate(var(--r))}}

/* 대기 화면 뒤로 떠다니는 크루 */
.fx-float{position:fixed;z-index:0;pointer-events:none;left:-90px;animation:drift var(--t) linear forwards;opacity:.55}
.fx-float .fxcrew{width:var(--w);animation:tumble var(--t) linear infinite}
@keyframes drift{to{transform:translate(calc(100vw + 180px),var(--dy))}}
@keyframes tumble{to{transform:rotate(var(--spin))}}
@media (prefers-reduced-motion:reduce){.fx,.fx-float{display:none!important}}`;

  function injectCss() {
    if (document.getElementById('fx-css')) return;
    const st = document.createElement('style'); st.id = 'fx-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  function confetti(n, colors) {
    let out = '';
    for (let i = 0; i < n; i++) {
      out += `<i class="fx-conf" style="--x:${rnd(0, 100).toFixed(1)}%;--c:${colors[i % colors.length]};--d:${rnd(1.8, 3.2).toFixed(2)}s;--s:${rnd(0, .6).toFixed(2)}s;--dx:${rnd(-25, 25).toFixed(0)}vw;--r:${rnd(-720, 720).toFixed(0)}deg"></i>`;
    }
    return out;
  }
  function stars(n) {
    let out = '';
    for (let i = 0; i < n; i++) out += `<i class="fx-star" style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 100).toFixed(1)}%;animation-delay:${rnd(0, 1.2).toFixed(2)}s"></i>`;
    return out;
  }
  const PARTY = ['#F7C948', '#FF5A5A', '#4BE38F', '#62B4FF', '#ED54BA', '#38FEDC', '#FFFFFF'];

  let current = null;
  /**
   * @param kind 'night' | 'dawnSafe' | 'dawnDead' | 'meeting' | 'drum' | 'townWin' | 'mafiaWin'
   * @param o {title, sub, crews:[{b,s}], victim:{b,s}}
   */
  function play(kind, o = {}) {
    if (reduce()) return;
    injectCss();
    if (current) current.remove();
    const crews = (o.crews || []).slice(0, 8);
    let cls = '', inner = '', dur = 2600;
    if (kind === 'night') {
      cls = 'fx-night';
      inner = `${stars(40)}<div class="fx-stage"><div class="fx-moon"></div>
        <div class="fx-row">${crews.map((c, i) => `<span class="fx-c">${crew(c)}<i class="fx-z" style="animation-delay:${(.8 + i * .2).toFixed(1)}s">Z</i></span>`).join('')}</div>
        <div class="fx-title">${esc(o.title || '밤이 되었습니다')}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>`;
    } else if (kind === 'dawnSafe') {
      cls = 'fx-dawn';
      inner = `<div class="fx-stage"><div class="fx-sun"></div>
        <div class="fx-row">${crews.map((c, i) => crew(c, '', `animation-delay:${(i * .08).toFixed(2)}s`)).join('')}</div>
        <div class="fx-title">${esc(o.title || '모두 무사해요!')}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>${confetti(30, PARTY)}`;
    } else if (kind === 'dawnDead') {
      cls = 'fx-dead';
      inner = `<div class="fx-stage"><div class="fx-victim">${o.victim ? crew(o.victim) : ''}</div>
        <div class="fx-title">${esc(o.title || '희생자 발생')}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>`;
    } else if (kind === 'meeting') {
      cls = 'fx-meet'; dur = 2200;
      inner = `<div class="fx-tape t"></div><div class="fx-tape b"></div><div class="fx-stage"><div class="fx-btn"></div>
        <div class="fx-title">${esc(o.title || '긴급 회의!')}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>`;
    } else if (kind === 'drum') {
      cls = 'fx-drum'; dur = 1700;
      inner = `<div class="fx-spot"></div><div class="fx-stage"><div class="fx-title">${esc(o.title || '두구두구두구…')}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>`;
    } else if (kind === 'townWin' || kind === 'mafiaWin') {
      const town = kind === 'townWin';
      cls = town ? 'fx-town' : 'fx-mafia'; dur = 3600;
      inner = `<div class="fx-stage"><div class="fx-row">${crews.map(c => crew(c)).join('')}</div>
        <div class="fx-title">${esc(o.title || (town ? '시민 승리!' : '마피아 승리'))}</div><div class="fx-sub">${esc(o.sub || '')}</div></div>
        ${town ? confetti(80, PARTY) : ''}`;
    } else return;
    const el = document.createElement('div');
    el.className = `fx ${cls}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', o.title || '');
    el.style.setProperty('--out', `${(dur - 450) / 1000}s`);
    el.innerHTML = `<div class="fx-bg"></div>${inner}<div class="fx-skip">화면을 누르면 넘어가요</div>`;
    el.addEventListener('click', e => { e.stopPropagation(); el.remove(); });
    document.body.appendChild(el);
    current = el;
    setTimeout(() => { if (current === el) current = null; el.remove(); }, dur + 100);
  }

  // 대기 화면에 떠다니는 크루
  let floatTimer = null, palette = [];
  function spawnFloat() {
    if (reduce() || document.visibilityState !== 'visible' || !palette.length) return;
    injectCss();
    const c = palette[Math.floor(Math.random() * palette.length)];
    const el = document.createElement('div');
    const t = rnd(16, 24);
    el.className = 'fx-float';
    el.style.cssText = `top:${rnd(12, 78).toFixed(0)}vh;--t:${t.toFixed(1)}s;--dy:${rnd(-25, 25).toFixed(0)}vh;--w:${rnd(34, 58).toFixed(0)}px;--spin:${(Math.random() < .5 ? -1 : 1) * rnd(300, 720).toFixed(0)}deg`;
    el.innerHTML = crew(c);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), t * 1000 + 200);
  }
  function ambient(on, colors) {
    if (colors) palette = colors;
    if (on && !floatTimer) { setTimeout(spawnFloat, 1500); floatTimer = setInterval(spawnFloat, 11000); }
    if (!on && floatTimer) { clearInterval(floatTimer); floatTimer = null; }
  }

  window.SpaceFX = {play, ambient};
})();
