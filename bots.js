/* 우주선 마피아 AI 플레이어
   - 두 게임 화면(index.html, online.html)이 함께 쓰는 AI의 두뇌.
   - AI는 자기가 알 수 있는 정보만 쓴다: 자기 역할, (마피아라면) 동료, (경찰이라면) 조사 결과,
     그리고 모두에게 공개된 것(누가 죽었는지, 공개된 역할, AI들의 발언).
   - 게임 엔진이 넘겨주는 g 객체:
       players  : [{id, name, role, alive, bot, known}]  (role은 엔진 내부용, AI는 위 규칙대로만 읽는다)
       brain    : newBrain()으로 만든 저장용 객체 (게임 상태와 함께 저장된다)
       day, settings:{selfHeal}, counts:{police, doctor}
       night    : 이번 밤 마피아 선택 {mafia:{}, draft:{}}   (마피아 AI가 동료를 따르기 위해)
       lastNight: {target, saved, heals:{의사id: 대상id}}  (의사 AI가 자기 공을 말하기 위해, 자기 것만 본다)
       lastInv  : {경찰id: 대상id}                          (경찰 AI가 자기 결과를 말하기 위해, 자기 것만 본다) */
(function () {
  'use strict';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const chance = p => Math.random() < p;
  const fill = (s, map) => s.replace(/\{(\w)\}/g, (_, k) => map[k]);

  const LINES = {
    accuse: ['{X}님이 좀 수상해요.', '저는 {X}님이 마피아 같아요.', '{X}님, 어젯밤에 뭐 하셨어요? 의심스러워요.', '{X}님 말이 계속 마음에 걸려요.', '오늘은 {X}님한테 투표할 생각이에요.'],
    unsure: ['아직은 잘 모르겠어요. 조금 더 지켜볼게요.', '확실한 게 없어서 말을 아낄게요.', '다들 이야기 더 들어보고 정할게요.', '음… 오늘은 조용히 듣고 있을게요.'],
    policeHit: ['제가 경찰이에요. 조사해 보니 {X}님이 마피아였어요!', '경찰입니다. {X}님은 마피아예요. 믿어주세요.', '더 숨길 수가 없네요. 저 경찰이고, {X}님이 마피아예요.'],
    policeClear: ['제가 경찰인데, {X}님은 시민이었어요.', '경찰로서 말씀드리면 {X}님은 마피아가 아니에요.'],
    doctorSave: ['제가 의사예요. 어젯밤 {X}님은 제가 살렸어요.', '어젯밤 아무도 안 죽은 건 제가 {X}님을 지켰기 때문이에요.'],
    doubt: ['{C}님이 경찰이라는 거, 저는 못 믿겠어요.', '{C}님, 경찰인 척하는 마피아 아니에요?', '{C}님 말만 믿고 투표하면 위험해요.'],
    defendMafia: ['저 아니에요! 진짜 마피아는 {X}님 같아요.', '억울해요. 저를 처형하면 마피아만 좋아해요.', '저는 시민이에요! {X}님을 더 의심해야 해요.'],
    defendTown: ['저는 시민이에요. 정말 억울해요!', '제가 처형되면 시민만 손해예요. 다시 생각해 주세요.', '저 아니에요. 믿어주세요.'],
    defendDoctor: ['저는 의사예요. 저를 처형하면 아무도 못 지켜요.'],
    defendPolice: ['저는 경찰이에요! 아직 마피아를 못 찾았지만 믿어주세요.'],
  };

  function newBrain() { return {mem:{}, claims:{}, accusations:[]}; }

  const P = (g, id) => g.players.find(p => p.id === id);
  const alive = g => g.players.filter(p => p.alive);
  const name = (g, id) => (P(g, id) || {}).name || '?';
  function M(g, me) {
    let m = g.brain.mem[me.id];
    if (!m) {
      m = g.brain.mem[me.id] = {sus:{}, trust:{}, claimed:false, fakeClaim:false};
      g.players.forEach(p => { if (p.id !== me.id) m.sus[p.id] = Math.random() * 0.4; });
    }
    return m;
  }
  const trust = (g, me, id) => { const t = M(g, me).trust[id]; return t == null ? 0.5 : t; };
  function score(g, me, p) {
    let s = M(g, me).sus[p.id] || 0;
    const k = me.known && me.known[p.id];
    if (k) s += k === 'mafia' ? 100 : -100;
    return s;
  }
  // 의심 순서 (자기와 마피아 동료는 제외)
  function ranked(g, me, filter) {
    return alive(g)
      .filter(p => p.id !== me.id && !(me.role === 'mafia' && p.role === 'mafia') && (!filter || filter(p)))
      .map(p => ({p, s:score(g, me, p) + Math.random() * 0.9}))
      .sort((a, b) => b.s - a.s);
  }
  // 마피아가 보는 위협: 경찰·의사라고 밝힌 사람, 동료를 지목한 사람
  function threat(g, p) {
    let s = Math.random() * 2;
    const c = g.brain.claims[p.id];
    if (c && c.role === 'police') s += 6;
    if (c && c.role === 'doctor') s += 3;
    g.brain.accusations.forEach(a => { if (a.from === p.id) { const t = P(g, a.to); if (t && t.role === 'mafia') s += 2.5; } });
    return s;
  }
  const townByThreat = (g, me) => alive(g).filter(p => p.role !== 'mafia' && p.id !== me.id).map(p => ({p, s:threat(g, p)})).sort((a, b) => b.s - a.s);

  /* ---------- 밤 ---------- */
  function nightTarget(me, g) {
    const al = alive(g);
    if (me.role === 'mafia') {
      const n = g.night || {};
      const mates = al.filter(p => p.role === 'mafia' && p.id !== me.id);
      const matePick = mates.map(p => (n.mafia || {})[p.id] || (n.draft || {})[p.id]).filter(Boolean);
      if (matePick.length && chance(0.85)) return matePick[0];
      const t = townByThreat(g, me);
      return t.length ? t[0].p.id : null;
    }
    if (me.role === 'police') {
      const c = ranked(g, me, p => !(me.known && me.known[p.id]));
      const r = c[0] || ranked(g, me)[0];
      return r ? r.p.id : null;
    }
    if (me.role === 'doctor') {
      const claimers = al.filter(p => { const c = g.brain.claims[p.id]; return c && c.role === 'police' && p.id !== me.id && trust(g, me, p.id) >= 0.4; });
      if (claimers.length && chance(0.7)) return pick(claimers).id;
      if (g.settings.selfHeal && chance(0.35)) return me.id;
      const c = ranked(g, me).reverse();   // 가장 믿는 사람
      return c.length ? c[0].p.id : (g.settings.selfHeal ? me.id : null);
    }
    const c = ranked(g, me);
    return c.length ? c[0].p.id : null;
  }

  /* ---------- 투표 ---------- */
  function vote(me, g) {
    if (me.role === 'mafia') {
      const mine = g.brain.accusations.filter(a => a.from === me.id && a.day === g.day).map(a => P(g, a.to)).find(p => p && p.alive && p.role !== 'mafia');
      if (mine) return mine.id;
      const t = townByThreat(g, me);
      return t.length ? t[0].p.id : 'skip';
    }
    const c = ranked(g, me);
    if (!c.length) return 'skip';
    if (c[0].s < 0.45 && chance(0.35)) return 'skip';
    return c[0].p.id;
  }
  function confirm(me, g, accId) {
    const a = P(g, accId);
    if (!a) return 'no';
    if (me.role === 'mafia') return a.role === 'mafia' ? (chance(0.15) ? 'yes' : 'no') : (chance(0.9) ? 'yes' : 'no');
    const s = score(g, me, a);
    if (s >= 0.6) return 'yes';
    if (s <= -0.5) return 'no';
    return chance(0.55) ? 'yes' : 'no';
  }

  /* ---------- 말하기 ----------
     반환: {text, claim?:'police'|'doctor', accuse?:id, clear?:id, doubt?:id} */
  function talk(me, g) {
    const m = M(g, me), al = alive(g);
    if (me.role === 'police') {
      const found = Object.keys(me.known || {}).filter(id => me.known[id] === 'mafia' && P(g, id) && P(g, id).alive);
      if (found.length && (m.claimed || chance(0.85))) { m.claimed = true; return {text:fill(pick(LINES.policeHit), {X:name(g, found[0])}), claim:'police', accuse:found[0]}; }
      const last = g.lastInv && g.lastInv[me.id];
      if (last && me.known[last] === 'town' && P(g, last).alive && (m.claimed || chance(0.3))) { m.claimed = true; return {text:fill(pick(LINES.policeClear), {X:name(g, last)}), claim:'police', clear:last}; }
    }
    if (me.role === 'doctor') {
      const ln = g.lastNight;
      if (ln && ln.saved && ln.heals && ln.heals[me.id] === ln.target && chance(0.4)) return {text:fill(pick(LINES.doctorSave), {X:name(g, ln.target)}), claim:'doctor'};
    }
    if (me.role === 'mafia') {
      // 동료를 지목한 '경찰'에게 반박한다
      const hostile = Object.keys(g.brain.claims).filter(id => g.brain.claims[id].role === 'police' && id !== me.id && P(g, id) && P(g, id).alive
        && g.brain.accusations.some(a => a.from === id && P(g, a.to) && P(g, a.to).role === 'mafia'));
      if (hostile.length && chance(0.7)) return {text:fill(pick(LINES.doubt), {C:name(g, hostile[0])}), doubt:hostile[0], accuse:hostile[0]};
      const towns = townByThreat(g, me);
      // 아직 아무도 경찰이라 밝히지 않았으면 가끔 가짜 경찰 행세를 한다
      if (towns.length && !m.fakeClaim && g.day >= 2 && !Object.values(g.brain.claims).some(c => c.role === 'police') && chance(0.2)) {
        m.fakeClaim = true; m.claimed = true;
        return {text:fill(pick(LINES.policeHit), {X:name(g, towns[0].p.id)}), claim:'police', accuse:towns[0].p.id};
      }
      if (towns.length && chance(g.day === 1 ? 0.5 : 0.8)) { const X = towns[Math.min(towns.length - 1, Math.floor(Math.random() * 2))].p.id; return {text:fill(pick(LINES.accuse), {X:name(g, X)}), accuse:X}; }
      return {text:pick(LINES.unsure)};
    }
    const c = ranked(g, me);
    if (c.length && (c[0].s > 0.8 || chance(g.day === 1 ? 0.35 : 0.6))) return {text:fill(pick(LINES.accuse), {X:name(g, c[0].p.id)}), accuse:c[0].p.id};
    return {text:pick(LINES.unsure)};
  }

  // 최후 변론
  function defend(me, g) {
    if (me.role === 'police') {
      const found = Object.keys(me.known || {}).filter(id => me.known[id] === 'mafia' && P(g, id) && P(g, id).alive);
      if (found.length) return {text:fill(pick(LINES.policeHit), {X:name(g, found[0])}), claim:'police', accuse:found[0]};
      return {text:pick(LINES.defendPolice), claim:'police'};
    }
    if (me.role === 'doctor' && chance(0.6)) return {text:pick(LINES.defendDoctor), claim:'doctor'};
    if (me.role === 'mafia') {
      const t = townByThreat(g, me);
      if (t.length) return {text:fill(pick(LINES.defendMafia), {X:name(g, t[0].p.id)}), accuse:t[0].p.id};
    }
    return {text:pick(LINES.defendTown)};
  }

  /* ---------- 공개된 사건을 보고 생각 고치기 ---------- */
  const thinkers = (g, except) => g.players.filter(p => p.bot && p.alive && p.id !== except && p.role !== 'mafia');

  function observeTalk(g, sid, st) {
    const b = g.brain;
    if (st.claim) b.claims[sid] = {role:st.claim, day:g.day};
    if (st.accuse) b.accusations.push({from:sid, to:st.accuse, day:g.day, claim:st.claim || null});
    const policeClaimers = Object.keys(b.claims).filter(id => b.claims[id].role === 'police' && P(g, id) && P(g, id).alive);
    const onlyOnePolice = !g.counts || (g.counts.police || 0) <= 1;
    thinkers(g, sid).forEach(bot => {
      const m = M(g, bot);
      if (st.claim === 'police') {
        // 진짜 경찰(경찰이 1명인 판)은 다른 사람의 경찰 주장이 거짓임을 안다
        if (bot.role === 'police' && onlyOnePolice) { m.trust[sid] = 0; m.sus[sid] = (m.sus[sid] || 0) + 3; return; }
        // 경찰이라는 사람이 여럿이면 서로 믿음이 떨어진다
        if (onlyOnePolice && policeClaimers.length > 1) policeClaimers.forEach(id => { m.trust[id] = Math.min(trust(g, bot, id), 0.35); });
      }
      if (bot.role === 'police' && st.accuse && bot.known && bot.known[st.accuse] === 'town') {
        m.trust[sid] = Math.max(0, trust(g, bot, sid) - 0.3); m.sus[sid] = (m.sus[sid] || 0) + 0.8;
      }
      const t = trust(g, bot, sid);
      if (st.accuse === bot.id) m.sus[sid] = (m.sus[sid] || 0) + 1.2;            // 시민인 나를 모함한다 → 수상하다
      else if (st.accuse) m.sus[st.accuse] = (m.sus[st.accuse] || 0) + (st.claim === 'police' ? 3 : 0.3) * t;   // 그냥 지목은 살짝만 따라간다 (우르르 몰리지 않게)
      if (st.clear) m.sus[st.clear] = (m.sus[st.clear] || 0) - 2 * t;
      if (st.doubt && st.doubt !== bot.id) m.trust[st.doubt] = Math.max(0, trust(g, bot, st.doubt) - 0.15 * t);
    });
  }

  // 밤에 죽은 사람은 시민 팀이다
  function observeNight(g, victim) {
    if (!victim) return;
    const b = g.brain, c = b.claims[victim];
    thinkers(g).forEach(bot => {
      const m = M(g, bot);
      m.sus[victim] = -5;
      // 경찰이라던 사람이 밤에 죽었다 → 그 사람의 지목은 믿을 만하다
      if (c && c.role === 'police') b.accusations.filter(a => a.from === victim).forEach(a => { if (a.to !== bot.id) m.sus[a.to] = (m.sus[a.to] || 0) + 2; });
      // 죽은 시민을 의심했던 사람은 조금 수상하다
      b.accusations.filter(a => a.to === victim && a.from !== bot.id).forEach(a => { m.sus[a.from] = (m.sus[a.from] || 0) + 0.5; });
    });
  }

  // 처형된 사람의 역할이 공개됐을 때만 배운다
  function observeExec(g, id, role) {
    if (!role) return;
    const b = g.brain;
    thinkers(g).forEach(bot => {
      const m = M(g, bot);
      b.accusations.filter(a => a.to === id && a.from !== bot.id).forEach(a => {
        if (role === 'mafia') { m.trust[a.from] = Math.min(1, trust(g, bot, a.from) + 0.25); m.sus[a.from] = (m.sus[a.from] || 0) - 0.8; }
        else { m.trust[a.from] = Math.max(0, trust(g, bot, a.from) - (a.claim === 'police' ? 0.6 : 0.25)); m.sus[a.from] = (m.sus[a.from] || 0) + (a.claim === 'police' ? 3 : 0.8); }
      });
    });
  }

  window.MafiaBots = {newBrain, nightTarget, vote, confirm, talk, defend, observeTalk, observeNight, observeExec};
})();
