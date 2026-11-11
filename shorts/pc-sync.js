/* pc-sync.js — BK뮤비 PC: 🎯 노래에 한 번에 맞추기 · 전주 · 간주 · 후주 · Gemini 추천 장 수  🛠 관리자 전용
 *  ※ 원래 기능(톡! 이 줄 시작 · 줄마다 다듬기 · ✨ 저절로 맞추기 · 장면 장 수)은 그대로 — 여기 것은 모두 「추가」
 *  1) 🎯 한 번에 맞추기: 가사 시간(Gemini)을 내 PC가 노래를 듣고 다듬음 (인터넷 · AI 없이)
 *       곡 전체가 밀렸으면 한꺼번에 → 구간(1절 · 2절…)마다 → 줄마다 조금씩 · 자신 없는 줄은 노란색
 *       줄마다 끝나는 시간도 정해서 전주 · 간주 동안에는 자막이 안 나오게
 *  2) 👆 ○절 자막 시작: 노래 들으며 구간 첫 줄이 시작될 때 톡 → 그 구간 줄이 한꺼번에 옮겨짐 (줄 사이 간격 그대로)
 *  3) 전주 → 썸네일을 전주 끝까지 · 간주 → 간주 화면 넣기 · 후주 → 엔딩을 후주 처음부터 (선택)
 *  4) 2단계 ③: 「장면 수는 Gemini에게 맡기기」 → 추천 장 수 그대로 받고, 장 수 바꾸기(합치기 · 나누기) · 되돌리기
 */
(function (g) {
  'use strict';
  const U = () => (g.MV && g.MV.UI) || null;
  const isAdmin = () => { try { return localStorage.getItem('bkAdmin') === '1'; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f0 = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
  const r2 = v => Math.round(v * 100) / 100;
  const GAP = 4;                 // 다음 줄까지 이만큼(초) 넘게 비면 간주
  let UNDO = null, MSG = '', busy = false, ANA = { key: '', r: null }, REC = null;

  /* ── 한 줄을 부르는 데 걸리는 대략 시간 (글자 수로) ── */
  const est = t => Math.min(7, Math.max(1.6, String(t || '').replace(/\s/g, '').length * 0.32 + 0.9));
  function timed(p) { return (p.lines || []).map((l, i) => ({ l, i })).filter(o => o.l.s != null).sort((a, b) => a.l.s - b.l.s); }
  function endOf(p, k, T) { const o = T[k], nx = T[k + 1]; const e = o.l.e != null ? o.l.e : o.l.s + est(o.l.t); return nx ? Math.min(e, nx.l.s) : e; }
  /* 전주 · 간주 · 후주 구간 */
  function gaps(p) {
    const T = timed(p), dur = (p.song && p.song.dur) || 0, out = []; if (!T.length || !dur) return out;
    if (T[0].l.s > 1) out.push({ k: 'intro', s: 0, e: T[0].l.s });
    for (let k = 0; k < T.length - 1; k++) { const e = endOf(p, k, T), ns = T[k + 1].l.s; if (ns - e >= GAP) out.push({ k: 'mid', s: r2(e), e: ns, after: k }); }
    const le = endOf(p, T.length - 1, T); if (dur - le > 2) out.push({ k: 'outro', s: r2(le), e: dur });
    return out;
  }
  /* 구간(1절 · 2절 …): 간주로 나뉜 줄 묶음 */
  function blocks(p) {
    const T = timed(p), G = gaps(p).filter(x => x.k === 'mid'), out = []; let cur = [];
    T.forEach((o, k) => { cur.push(o); if (G.some(x => x.after === k) || k === T.length - 1) { out.push(cur); cur = []; } });
    return out;
  }
  const pinnedAt = (p, t) => (p.scenes || []).some(sc => sc.pin && t >= sc.s - 0.05 && t < sc.e);

  /* ── 🎵 노래 듣기: 목소리 대역(약 200~3500Hz)이 갑자기 커지는 순간 · 크기 ── */
  async function analyzeV(blob) {
    const ab = await blob.arrayBuffer(), AC = g.AudioContext || g.webkitAudioContext, ac = new AC();
    let buf; try { buf = await ac.decodeAudioData(ab); } finally { try { ac.close(); } catch (e) { /* 괜찮음 */ } }
    const sr = buf.sampleRate, N = buf.length, d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
    const hop = Math.round(sr * 0.01), F = Math.floor(N / hop), fps = sr / hop, en = new Float32Array(F), lv = new Float32Array(F);
    const aH = Math.exp(-2 * Math.PI * 200 / sr), aL = 1 - Math.exp(-2 * Math.PI * 3500 / sr);
    let px = 0, hp = 0, lp = 0;
    for (let f = 0; f < F; f++) { let s = 0; const o = f * hop;
      for (let i = 0; i < hop; i++) { const x = (d0[o + i] + d1[o + i]) * .5; hp = aH * (hp + x - px); px = x; lp += aL * (hp - lp); s += lp * lp; }
      lv[f] = Math.sqrt(s / hop); en[f] = Math.log(1e-7 + s / hop); }
    const on = new Float32Array(F);
    for (let f = 3; f < F; f++) { const d = en[f] - Math.max(en[f - 2], en[f - 3]); on[f] = d > 0 ? d : 0; }
    for (let f = 1; f < F - 1; f++) on[f] = Math.max(on[f], (on[f - 1] + on[f + 1]) * .35);
    return { fps, on, lv, F };
  }
  async function getAna(p) {
    const key = p.song.file + ':' + p.song.dur; if (ANA.key === key && ANA.r) return ANA.r;
    const bl = await g.MV.getFile(p.song.file); if (!bl) throw new Error('노래 파일을 찾을 수 없어요');
    ANA = { key, r: await analyzeV(bl) }; return ANA.r;
  }
  const peak = (A, t, a, b) => { let m = 0, at = t; const f1 = Math.max(0, Math.floor((t + a) * A.fps)), f2 = Math.min(A.F - 1, Math.ceil((t + b) * A.fps)); for (let f = f1; f <= f2; f++) if (A.on[f] > m) { m = A.on[f]; at = f / A.fps; } return { m, at }; };
  const score = (A, ts, o) => ts.reduce((s, t) => s + peak(A, t + o, -0.06, 0.1).m, 0);
  function bestShift(A, ts, lim) {
    const base = score(A, ts, 0); let best = 0, bs = base;
    for (let o = -lim; o <= lim + 1e-6; o += 0.05) { const v = score(A, ts, o); if (v > bs) { bs = v; best = o; } }
    return bs > base * 1.12 && Math.abs(best) >= 0.1 ? r2(best) : 0;
  }
  function medianOn(A, a, b) { const f1 = Math.max(0, Math.floor(a * A.fps)), f2 = Math.min(A.F - 1, Math.floor(b * A.fps)), v = []; for (let f = f1; f <= f2; f += 2) v.push(A.on[f]); v.sort((x, y) => x - y); return v[v.length >> 1] || 0; }
  const lvMed = (A, a, b) => { const f1 = Math.max(0, Math.floor(a * A.fps)), f2 = Math.min(A.F - 1, Math.floor(b * A.fps)), v = []; for (let f = f1; f <= f2; f++) v.push(A.lv[f]); v.sort((x, y) => x - y); return v[v.length >> 1] || 0; };

  function snap(p) { return JSON.stringify({ lines: p.lines, scenes: p.scenes, thumb: p.thumb, endc: p.endc, pcSync: p.pcSync || null }); }
  function restore(p, j) { const o = JSON.parse(j); p.lines = o.lines; p.scenes = o.scenes; p.thumb = o.thumb; p.endc = o.endc; p.pcSync = o.pcSync; }
  function refresh(u, re) { follow(u.S.p); u.save(); u.S.player.refresh(); if (!u.S.player.playing()) u.S.player.seek(u.S.player.time()); if (re !== false) u.renderStage(); }

  /* ── 🎯 한 번에 맞추기 ── */
  async function syncAll() {
    const u = U(), p = u && u.S.p; if (!p || busy) return;
    if (!p.song) return u.toast('먼저 노래를 넣어 주세요');
    const T0 = timed(p); if (T0.length < 2) return u.toast('시간이 들어 있는 가사가 필요해요 · 2단계 ② 가사에서 「MP3로 가사 · 시간 받기」');
    busy = true; MSG = ''; mount();
    try {
      const A = await getAna(p), before = snap(p), can = o => !pinnedAt(p, o.l.s);
      // ① 곡 전체가 밀렸으면 한꺼번에
      const all = T0.filter(can), gsh = bestShift(A, all.map(o => o.l.s), 3);
      if (gsh) all.forEach(o => { o.l.s = r2(Math.max(0, o.l.s + gsh)); if (o.l.e != null && !o.l.pcE) o.l.e = r2(o.l.e + gsh); });
      // ② 구간(1절 · 2절 …)마다
      let bmv = 0;
      blocks(p).forEach(B => { const L = B.filter(can); if (L.length < 2) return; const d = bestShift(A, L.map(o => o.l.s), 1.5); if (d) { bmv++; L.forEach(o => { o.l.s = r2(Math.max(0, o.l.s + d)); if (o.l.e != null && !o.l.pcE) o.l.e = r2(o.l.e + d); }); } });
      // ③ 줄마다 조금씩 (±0.3초 안의 뚜렷한 목소리 시작) · 자신 없는 줄 표시
      let fine = 0, unsure = 0;
      const T = timed(p);
      T.forEach((o, k) => { if (!can(o)) return; const l = o.l, md = medianOn(A, l.s - 4, l.s + 4) || 1e-6, pk = peak(A, l.s, -0.3, 0.3), wide = peak(A, l.s, -0.6, 0.6);
        const prev = T[k - 1], next = T[k + 1];
        if (pk.m > md * 2.2 && (!prev || pk.at > prev.l.s + 0.3) && (!next || pk.at < next.l.s - 0.3)) { if (Math.abs(pk.at - l.s) >= 0.05) { l.s = r2(pk.at); fine++; } l.pcQ = 0; }
        else { l.pcQ = wide.m > md * 2.2 ? 0 : 1; if (l.pcQ) unsure++; } });
      // ④ 줄마다 끝나는 시간: 다음 줄까지 많이 비면 목소리가 작아지는 곳에서 끝 (전주 · 간주 · 후주 동안 자막 안 나오게)
      const T2 = timed(p), dur = p.song.dur; let ends = 0;
      T2.forEach((o, k) => { const l = o.l, nx = T2[k + 1], ns = nx ? nx.l.s : dur; if (l.e != null && !l.pcE) return;   // 손으로 정한 끝 시간은 그대로
        const e0 = l.s + est(l.t);
        if (ns - e0 < 2.5) { if (l.pcE) { l.e = null; l.pcE = 0; } return; }
        const ref = lvMed(A, l.s, Math.min(ns, e0)) || 1e-6; let e = e0;
        for (let t = l.s + est(l.t) * 0.6; t < Math.min(ns - 0.2, e0 + 3); t += 0.05) { if (lvMed(A, t, t + 0.4) < ref * 0.35) { e = t + 0.15; break; } e = t; }
        l.e = r2(Math.min(ns - 0.1, Math.max(l.s + 1.2, e))); l.pcE = 1; ends++; });
      UNDO = before;
      const G = gaps(p), nMid = G.filter(x => x.k === 'mid').length;
      MSG = `✅ 맞췄어요 — ${gsh ? `곡 전체 ${gsh > 0 ? '+' : ''}${gsh}초 · ` : ''}${bmv ? `구간 ${bmv}곳 · ` : ''}줄 ${fine}개 조금씩 · ${G.some(x => x.k === 'intro') ? '전주 · ' : ''}간주 ${nMid}곳 찾음${unsure ? ` · 🟡 확인할 줄 ${unsure}개 (줄마다 다듬기에서 노란색)` : ''}`;
      refresh(u, false); u.toast('🎯 맞췄어요 · ▶ 들어 보고 어긋난 구간만 「👆 ○절 자막 시작」', 5000);
    } catch (e) { MSG = '⚠️ 노래를 듣지 못했어요: ' + (e && e.message || e); }
    finally { busy = false; u.renderStage(); }
  }

  /* ── 👆 ○절 자막 시작: 지금 시간에 가장 가까운 구간을 통째로 옮기기 ── */
  function nearBlock(p, t) { const B = blocks(p); let bi = -1, bd = 1e9; B.forEach((b, i) => { const d = Math.abs(b[0].l.s - t); if (d < bd && d < 12) { bd = d; bi = i; } }); return bi < 0 ? null : { i: bi, b: B[bi], n: B.length }; }
  function tapBlock() {
    const u = U(), p = u && u.S.p; if (!p) return; if (p.locked) return u.toast('🔒 잠겨 있어요');
    const t = u.S.player.time(), nb = nearBlock(p, t); if (!nb) return u.toast('가까운 구간이 없어요 · 노래를 틀고 구간 첫 줄이 시작될 때 눌러 주세요');
    const d = r2(t - nb.b[0].l.s); if (Math.abs(d) < 0.03) return;
    if (!UNDO) UNDO = snap(p);
    nb.b.forEach(o => { if (pinnedAt(p, o.l.s)) return; o.l.s = r2(Math.max(0, o.l.s + d)); if (o.l.e != null) o.l.e = r2(o.l.e + d); o.l.pcQ = 0; });
    MSG = `👆 ${nb.i + 1}절(구간) ${nb.b.length}줄을 ${d > 0 ? '+' : ''}${d}초 옮겼어요`;
    refresh(u, false); u.toast(MSG, 2500); paint(true);
  }

  /* ── 전주 · 후주 따라가기 · 간주 화면 ── */
  function follow(p) {
    const S = p.pcSync || {}, T = timed(p), dur = (p.song && p.song.dur) || 0; if (!T.length) return;
    if (S.intro && p.thumb) { p.thumb.on = true; p.thumb.dur = r2(Math.max(1, T[0].l.s - 0.15)); }
    if (S.outro && p.endc) { const le = endOf(p, T.length - 1, T); p.endc.on = true; p.endc.dur = r2(Math.min(40, Math.max(2, dur - le - 0.1))); }
    const G = gaps(p).filter(x => x.k === 'mid');
    (p.scenes || []).forEach((sc, i) => { if (!sc.pcGap) return; let best = null, bd = 1e9; G.forEach(x => { const d = Math.abs(x.s - sc.s); if (d < bd) { bd = d; best = x; } }); if (!best || bd > 15) return; place(p, i, best); });
  }
  function place(p, i, x) {   // 간주 화면 장면을 간주 구간에 딱 맞추고 앞뒤 장면을 붙여 주기
    const S2 = p.scenes, sc = S2[i], pv = S2[i - 1], nx = S2[i + 1];
    if (pv && x.s - pv.s < 0.8) return; if (nx && nx.e - x.e < 0.8) return;
    sc.s = r2(x.s); sc.e = r2(x.e); if (pv) pv.e = sc.s; if (nx) nx.s = sc.e;
  }
  const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function blankScene(o) { return Object.assign({ id: newId(), s: 0, e: 1, file: null, kind: null, name: '', prompt: '', ok: false, off: 0, fx: '', tr: '', thumb: '', cp: 0, reuse: null, auto: false }, o || {}); }
  async function addGapScreen(gi, how) {
    const u = U(), p = u.S.p, x = gaps(p).filter(y => y.k === 'mid')[gi]; if (!x) return;
    let blob = null, name = '간주 화면';
    if (how === 'hero') { blob = await g.MV.getFile(p.look && p.look.heroImg); if (!blob) return u.toast('주인공 사진이 없어요 · 2단계 ③ 장면에서 주인공을 정해 주세요'); name = '주인공'; }
    else if (how === 'scene') { const n = +prompt(`몇 번 장면 그림을 간주 화면으로 쓸까요? (1~${p.scenes.length})`, '1'); const sc = p.scenes[n - 1]; if (!sc || !sc.file) return u.toast('그 장면에는 그림이 없어요'); blob = await g.MV.getFile(sc.file); name = '장면 ' + n; }
    else { blob = await pickImage(); if (!blob) return; name = blob.name || name; }
    if (!blob) return;
    const S2 = p.scenes, inside = S2.filter(sc => !sc.pin && sc.s >= x.s - 0.05 && sc.e <= x.e + 0.05);
    if (S2.some(sc => sc.pin && sc.s < x.e && sc.e > x.s)) return u.toast('🔒 간주 시간 안에 고정한 장면이 있어요 · 고정을 풀고 다시 해 주세요', 4000);
    if (inside.some(sc => sc.file) && !confirm(`간주 시간 안에 있던 장면 ${inside.length}개가 간주 화면으로 바뀌어요. (↩ 되돌리기 가능) 할까요?`)) return;
    UNDO = snap(p);
    const key = await g.MV.putFile(blob, name);
    let out = [];
    S2.forEach(sc => {
      if (inside.includes(sc)) return;
      if (sc.s < x.s && sc.e > x.e) { out.push(Object.assign({}, sc, { e: r2(x.s) })); out.push(blankScene(Object.assign({}, sc, { id: newId(), s: r2(x.e), file: sc.file, thumb: sc.thumb, cp: 0 }))); return; }
      if (sc.s < x.s && sc.e > x.s) sc.e = r2(x.s);
      if (sc.s < x.e && sc.e > x.e) sc.s = r2(x.e);
      out.push(sc);
    });
    out.push(blankScene({ s: r2(x.s), e: r2(x.e), file: key, kind: /^video/.test(blob.type) ? 'video' : 'image', name, prompt: '🎵 간주 화면', ok: true, pcGap: 1 }));
    out.sort((a, b) => a.s - b.s);
    for (let i = 0; i < out.length - 1; i++) out[i].e = out[i + 1].s;
    out[0].s = 0; out[out.length - 1].e = Math.max(out[out.length - 1].e, p.song.dur);
    for (let i = out.length - 1; i >= 0; i--) { const sc = out[i]; if (sc.pcGap || sc.pin || sc.e - sc.s >= 0.8 || out.length < 3) continue;   // 아주 짧게 남은 조각은 이웃 장면에 붙이기
      if (i > 0 && !out[i - 1].pcGap) out[i - 1].e = sc.e; else if (out[i + 1] && !out[i + 1].pcGap) out[i + 1].s = sc.s; else continue; out.splice(i, 1); }
    out[0].s = 0;
    out.forEach(sc => { sc.reuse = null; });
    p.scenes = out; if (p.mode === 'image') p.picN = out.length;
    MSG = `🖼 간주 ${gi + 1}에 화면을 넣었어요 (${f0(x.s)} ~ ${f0(x.e)})`;
    refresh(u);
  }
  function delGapScreen(i) {
    const u = U(), p = u.S.p, S2 = p.scenes, sc = S2[i]; if (!sc || !sc.pcGap) return;
    UNDO = snap(p);
    if (S2[i - 1]) S2[i - 1].e = sc.e; else if (S2[i + 1]) S2[i + 1].s = 0;
    S2.splice(i, 1); if (p.mode === 'image') p.picN = S2.length;
    MSG = '간주 화면을 뺐어요 (앞 장면이 이어서 나와요)'; refresh(u);
  }
  function pickImage() {
    return new Promise(res => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*,video/*'; f.onchange = () => res(f.files && f.files[0] || null); f.click(); });
  }
  function undo() { const u = U(), p = u.S.p; if (!UNDO || !p) return; restore(p, UNDO); UNDO = null; MSG = '↩ 맞추기 전으로 돌렸어요'; u.save(); u.S.player.refresh(); u.renderStage(); u.toast('↩ 되돌렸어요'); }

  /* ── 3단계 칸 ── */
  function html(p) {
    const G = gaps(p), S = p.pcSync || {}, mids = G.filter(x => x.k === 'mid'), intro = G.find(x => x.k === 'intro'), outro = G.find(x => x.k === 'outro');
    const gapRow = (x, gi) => { const si = (p.scenes || []).findIndex(sc => sc.pcGap && Math.abs(sc.s - x.s) < 15 && sc.s < x.e);
      return `<div class="psGap"><span class="psT">🎵 간주 ${gi + 1}</span><span class="psR">${f0(x.s)} ~ ${f0(x.e)} · ${Math.round(x.e - x.s)}초</span>${si >= 0
        ? `<span class="psOn">🖼 간주 화면 들어감</span><button class="btn sm ghost" data-ps="gapDel" data-v="${si}">✕ 빼기</button>`
        : `<button class="btn sm" data-ps="gapAdd" data-v="${gi}:file">📁 그림 · 영상</button><button class="btn sm" data-ps="gapAdd" data-v="${gi}:hero">👤 주인공</button><button class="btn sm" data-ps="gapAdd" data-v="${gi}:scene">🎬 장면 그림</button>`}</div>`; };
    return `<details class="pcaCard psCard" open><summary>🎯 노래에 한 번에 맞추기 · 전주 · 간주 <span class="pcsTag">🛠 PC</span></summary>
      <p class="muted" style="margin:4px 0 10px">가사 시간(Gemini)을 <b>내 PC가 노래를 듣고</b> 다듬어요. 전주 · 간주에는 자막이 안 나오게 해요. 그다음 어긋난 구간만 노래를 들으며 <b>👆 톡</b>. 원래 방법(톡! 이 줄 시작 · 줄마다 다듬기)도 그대로 써요.</p>
      <button class="btn main big" data-ps="go"${busy ? ' disabled' : ''}>${busy ? '⏳ 노래 듣고 맞추는 중…' : '🎯 한 번에 맞추기 (자동)'}</button>
      <div class="psLive"><span class="psNow">▶ 노래를 틀어 보세요</span><button class="btn big psTap" data-ps="tap">👆 구간 자막 시작</button></div>
      <p class="muted" style="margin:6px 0 0">▶ 재생하면서, 노래(1절 · 2절 · 후렴…)가 <b>다시 시작되는 순간</b>에 👆 — 그 구간 줄이 한꺼번에 옮겨져요. 한 줄만은 「줄마다 다듬기」 − ＋</p>
      ${UNDO ? '<button class="btn ghost sm" data-ps="undo" style="margin-top:8px">↩ 맞추기 되돌리기</button>' : ''}
      ${MSG ? `<p class="note ${MSG.startsWith('⚠') ? 'red' : 'green'}" style="margin-top:10px">${esc(MSG)}</p>` : ''}
      <div class="psGaps">
        ${intro ? `<div class="psGap"><span class="psT">🎵 전주</span><span class="psR">${f0(intro.s)} ~ ${f0(intro.e)}</span><label class="psChk"><input type="checkbox" data-ps="intro"${S.intro ? ' checked' : ''}> 🖼 썸네일을 전주 끝까지 보여 주기</label></div>` : ''}
        ${mids.map(gapRow).join('') || (timed(p).length ? '<p class="muted">찾은 간주가 없어요 (줄 사이가 4초 넘게 빈 곳이 간주예요 · 먼저 🎯 한 번에 맞추기)</p>' : '')}
        ${outro ? `<div class="psGap"><span class="psT">🎵 후주</span><span class="psR">${f0(outro.s)} ~ ${f0(outro.e)}</span><label class="psChk"><input type="checkbox" data-ps="outro"${S.outro ? ' checked' : ''}> 🎬 엔딩을 후주 처음부터 보여 주기</label></div>` : ''}
      </div>
    </details>`;
  }
  function mount() {
    const u = U(), p = u && u.S.p, ok = isAdmin() && p && p.kind !== 'drama' && u.S.view === 'stage' && p.step === 3 && p.song;
    const old = document.getElementById('pcSync'); if (!ok) { if (old) old.remove(); return; }
    const host = document.querySelector('#stage [data-sub="① 자막"]') || document.querySelector('#stage .stBody'); if (!host) return;
    let box = old;
    if (!box || box.parentNode !== host) { if (box) box.remove(); box = document.createElement('div'); box.id = 'pcSync'; host.insertBefore(box, host.firstChild); }
    const d = box.querySelector('details'), open = d ? d.open : true;
    box.innerHTML = html(p); box.querySelector('details').open = open; paint(true);
  }

  /* ── 재생 중: 지금 전주/간주/몇 절인지 · 👆 버튼 글씨 · 미리 보기 위 표시 · 노란 줄 ── */
  let lastK = '';
  function paint(force) {
    const u = U(), p = u && u.S.p; if (!p || !u.S.player || !p.song) return;
    const t = u.S.player.time(), G = gaps(p), x = G.find(y => t >= y.s && t < y.e);
    const nb = nearBlock(p, t), lab = x ? (x.k === 'intro' ? '🎵 전주 중' : x.k === 'outro' ? '🎵 후주 중' : '🎵 간주 중') : '';
    const k = lab + '|' + (nb ? nb.i : -1) + '|' + (u.S.player.playing() ? 1 : 0);
    // 미리 보기 위 표시 (편집할 때만 · MP4에는 안 들어감)
    const cv = u.S.pv && u.S.pv.querySelector('#pvCv'); if (cv && cv.parentElement && document.body.classList.contains('pc')) {
      const host = cv.parentElement; let bd = host.querySelector('.psBadge'); if (!bd) { bd = document.createElement('div'); bd.className = 'psBadge'; if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(bd); }
      bd.textContent = lab; bd.style.display = lab ? '' : 'none'; }
    if (!force && k === lastK) return; lastK = k;
    const box = document.getElementById('pcSync');
    if (box) { const nw = box.querySelector('.psNow'), tb = box.querySelector('.psTap');
      if (nw) nw.textContent = lab || (nb ? `🎤 ${nb.i + 1}구간 (가사 ${nb.b.length}줄)` : (u.S.player.playing() ? '🎤 노래 중' : '▶ 노래를 틀어 보세요'));
      if (tb) tb.textContent = nb ? `👆 ${nb.i + 1}구간 자막 여기서 시작` : '👆 구간 자막 시작'; }
    (p.lines || []).forEach((l, i) => { const r = document.getElementById('ln' + i); if (r) r.classList.toggle('pcQ', !!l.pcQ); });
  }
  setInterval(() => { try { if (document.getElementById('pcSync') || document.body.classList.contains('pc')) paint(false); } catch (e) { /* 괜찮음 */ } }, 250);

  /* ══════════ 2단계 ③: 장면 수는 Gemini에게 맡기기 ══════════ */
  function freeBtn() {
    if (!isAdmin()) return '';
    return `<button class="btn big pcFree" data-ps="free">🗂 장면 수는 Gemini에게 맡기기 <small>(PC · 노래 흐름대로 필요한 만큼)</small></button>`;
  }
  /* 기획 요청 버튼 하나: 기본은 Gemini가 장 수를 정함 · 「장면 수를 내가 정하기」 체크하면 예전 방식(정한 장 수) */
  function planOne(p) {
    const N = (p.scenes || []).length, hero = p.look && p.look.heroImg;
    return `<button class="btn main big" data-ps="plan1">📋 장면 기획 요청서 복사 + Gemini 열기</button>
      <label class="psChk planFix"><input type="checkbox" data-ps="planFixed"${p.pcPlanFixed ? ' checked' : ''}> 장면 수를 내가 정하기 <span class="muted">(지금 ${N}장 · 체크 안 하면 Gemini가 노래 흐름대로 정해요)</span></label>`;
  }
  function freeText(p) {
    const lk = p.look || {}, vid = p.mode !== 'image', T = timed(p), title = (String(p.title || '').indexOf('#') >= 0 ? String(p.title).split(/\s+/)[0].replace(/#/g, '') : p.title) || '제목 없음';
    const lyr = T.length ? T.map((o, k) => `${k + 1}. [${f0(o.l.s)}] ${o.l.t}`).join('\n') : (p.lines || []).map((l, k) => `${k + 1}. ${l.t}`).join('\n');
    return [`[BK뮤비 「${title}」 장면 기획 요청 · 장면 수 자유]`,
      '이 노래는 제가 수노(Suno)로 직접 만든 창작곡이에요. 발표된 다른 가수의 노래가 아니니, 인터넷에서 찾지 말고 제가 드린 내용만으로 해 주세요.',
      `노래 길이 ${f0(p.song.dur)}로 뮤직비디오를 만들어요. ${vid ? '구글 Flow 영상' : 'ChatGPT 그림'}으로 장면을 만들 거예요. 당신은 기획만 해 주세요 (그림은 그리지 마세요).`,
      `그림 느낌: ${lk.style || '실사 시네마틱'}${lk.mood ? ` · 분위기: ${lk.mood}` : ''}`,
      lk.heroImg ? `주인공: 첨부한 사진 속 사람이에요${lk.hero ? ` (${lk.hero})` : ''}. 장면 설명에는 그냥 「주인공」이라고만 써 주세요.` : (lk.hero ? `주인공: ${lk.hero}` : ''),
      '', '[장면 나누기]',
      '- 장면 수는 정해 두지 않았어요. 노래 구조(전주 · 1절 · 후렴 · 간주 · 2절 · 브리지 · 후주)와 가사 흐름에 맞게 필요한 만큼 나눠 주세요. (보통 5~10초에 한 장면)',
      '- 장면마다 시작 시간을 아래 가사 시간에 맞춰 적어 주세요. 장면은 가사 줄이 시작되는 때 바뀌는 게 좋아요.',
      '- 전주 · 간주는 따로 한 장면씩 (풍경 · 분위기)',
      p.look && p.look.kr === false ? '' : '- 모든 장면은 한국 사람 · 한국 배경',
      '- 같은 주인공 · 같은 옷이 이어지게, 주인공 없는 장면(풍경 · 손 · 뒷모습)도 섞어 주세요',
      '- 화면에 글자 · 자막 · 로고는 넣지 않기',
      '- 인사말 없이 아래 모양으로만 써 주세요:',
      '### 장면 번호 (시작 시간 분:초)', '(설명 한두 문장)',
      '', '[가사와 시간]', lyr].filter(x => x !== '').join('\n');
  }
  async function free() {
    const u = U(), p = u && u.S.p; if (!p) return; if (!p.song) return u.toast('먼저 노래를 넣어 주세요');
    p.pcFreeAsk = Date.now(); u.save();
    const t = freeText(p), bl = p.look && p.look.heroImg ? await g.MV.getFile(p.look.heroImg) : null;
    if (bl && navigator.share && g.pywebview) { try { await navigator.share({ files: [new File([bl], '주인공.jpg', { type: bl.type || 'image/jpeg' })], text: t }); return; } catch (e) { /* 아래로 */ } }
    return u.copyOpen(t, 'https://gemini.google.com/app', '📋 「장면 수 자유」 기획 요청을 복사했어요 · Gemini에 붙여넣기(Ctrl+V) → 보내기 · 받은 답은 아래 칸에');
  }
  /* 붙여 넣은 기획서에 「장면 N (m:ss)」 시간이 있으면 → 그 시간대로 장면 칸을 새로 나눔 (Gemini에게 맡기기를 눌렀을 때만) */
  async function prePlan(t) {
    const u = U(), p = u && u.S.p; if (!p) return true;
    if (/\[BK뮤비[^\]]*장면 기획 요청/.test(String(t || ''))) { u.toast('⚠️ 이건 Gemini에게 보낸 「요청서」예요. Gemini가 보내 준 「답」을 복사해서 붙여넣어 주세요', 5000); return false; }
    if (!p.pcFreeAsk || !p.song) return true;
    const H = []; String(t || '').replace(/\r/g, '').split('\n').forEach(l => { const x = l.replace(/\*\*|__|`/g, ''); const m = x.match(/^\s*[-#•\s]*(?:장면|S|scene|씬)\s*(\d{1,3})\s*[\(\[（]\s*(\d{1,2}):(\d{1,2}(?:\.\d+)?)/i); if (m) H.push({ n: +m[1], s: +m[2] * 60 + +m[3] }); });
    if (H.length < 2) return true;
    H.sort((a, b) => a.n - b.n); const st = []; H.forEach(h => { if (h.s < p.song.dur - 1 && (!st.length || h.s > st[st.length - 1] + 0.8)) st.push(h.s); });
    if (st.length < 2 || H.length !== st.length) { if (!confirm(`기획서 장면 ${H.length}개 중 시간이 겹치거나 순서가 이상한 것이 있어요. 맞는 ${st.length}개로 나눌까요?`)) return true; }
    const had = (p.scenes || []).filter(sc => sc.file).length;
    if (had && !confirm(`Gemini가 추천한 ${st.length}장면으로 장면 칸을 다시 나눌까요?\n(이미 넣은 그림 ${had}장은 앞에서부터 순서대로 남아요 · ↩ 되돌리기 가능)`)) { p.pcFreeAsk = 0; return true; }
    const T = timed(p); const sn = v => { let b = v, bd = 1.2; T.forEach(o => { const d = Math.abs(o.l.s - v); if (d < bd) { bd = d; b = o.l.s; } }); return r2(b); };
    UNDO = snap(p);
    const old = p.scenes || [], n = st.length, S2 = [];
    for (let i = 0; i < n; i++) { const o = old[i] || {}; S2.push(blankScene({ id: o.id || newId(), s: i ? sn(st[i]) : 0, e: 0, file: o.file || null, kind: o.kind || null, name: o.name || '', ok: !!o.ok && !!o.file, thumb: o.file ? (o.thumb || '') : '', off: o.off || 0 })); }
    for (let i = 0; i < n; i++) S2[i].e = i < n - 1 ? S2[i + 1].s : p.song.dur;
    p.scenes = S2.filter((sc, i) => i === 0 || sc.e - sc.s > 0.5); if (p.mode === 'image') p.picN = p.scenes.length;
    p.pcRec = { n: p.scenes.length, at: Date.now(), js: JSON.stringify(p.scenes) }; p.pcFreeAsk = 0;
    REC = null; return true;
  }
  /* 장 수 바꾸기: 줄일 때는 짧은 이웃 장면끼리 합치고(후렴 시작은 남김) · 늘릴 때는 긴 장면을 나눔 */
  function resize(target) {
    const u = U(), p = u.S.p; let S2 = p.scenes.map(sc => Object.assign({}, sc)); target = Math.max(2, Math.min(200, target));
    const chorus = (p.lines || []).filter(l => l.sec === 'chorus' && l.s != null).map(l => l.s);
    const isCh = t => chorus.some(c => Math.abs(c - t) < 0.4);
    let guard = 400;
    while (S2.length > target && guard--) { let bi = -1, bv = 1e9;
      for (let i = 0; i < S2.length - 1; i++) { const a = S2[i], b = S2[i + 1]; if (a.pin || b.pin || a.pcGap || b.pcGap) continue; const v = (b.e - a.s) + (isCh(b.s) ? 1000 : 0); if (v < bv) { bv = v; bi = i; } }
      if (bi < 0) break; const a = S2[bi], b = S2[bi + 1];
      S2.splice(bi, 2, Object.assign({}, a, { e: b.e, file: a.file || b.file, kind: a.file ? a.kind : b.kind, thumb: a.file ? a.thumb : b.thumb, prompt: [a.prompt, b.prompt].filter(Boolean).join(' / '), prompt0: [a.prompt0, b.prompt0].filter(Boolean).join(' / '), reuse: null })); }
    const T = timed(p);
    while (S2.length < target && guard--) { let bi = -1, bl = 0; S2.forEach((sc, i) => { if (!sc.pin && !sc.pcGap && sc.e - sc.s > bl) { bl = sc.e - sc.s; bi = i; } });
      if (bi < 0 || bl < 3) break; const a = S2[bi], mid = (a.s + a.e) / 2; let cut = mid, bd = 1e9; T.forEach(o => { const v = o.l.s; if (v > a.s + 1.5 && v < a.e - 1.5 && Math.abs(v - mid) < bd) { bd = Math.abs(v - mid); cut = v; } });
      S2.splice(bi, 1, Object.assign({}, a, { e: r2(cut) }), blankScene({ s: r2(cut), e: a.e, prompt: a.prompt, prompt0: a.prompt0 })); }
    S2.forEach(sc => { sc.reuse = null; });
    if (!UNDO) UNDO = snap(p);
    p.scenes = S2; if (p.mode === 'image') p.picN = S2.length;
    u.save(); u.S.player.refresh(); u.renderStage(); u.toast(`🖼 ${S2.length}장면으로 바꿨어요`);
  }
  function recBack() { const u = U(), p = u.S.p; if (!p.pcRec || !p.pcRec.js) return; p.scenes = JSON.parse(p.pcRec.js); if (p.mode === 'image') p.picN = p.scenes.length; u.save(); u.S.player.refresh(); u.renderStage(); u.toast(`↩ Gemini 추천 ${p.scenes.length}장면으로 돌렸어요`); }
  function recHtml(p) {
    const N = p.scenes.length, R = p.pcRec.n, avg = p.song ? Math.round((p.song.dur / N) * 10) / 10 : 0, need = p.scenes.filter(sc => !sc.file && sc.reuse == null).length;
    return `<div class="psRec"><b>✅ Gemini가 추천한 장면: ${R}장</b> · 지금 <b>${N}장</b> (평균 ${avg}초에 한 장 · 새로 만들 그림 ${need}장)
      <div class="row"><button class="btn sm" data-ps="rs" data-v="${N - 1}">－ 1장</button><button class="btn sm" data-ps="rs" data-v="${N + 1}">＋ 1장</button>${[12, 15, 20, 25, 30].filter(v => v !== N && v < R + 10).map(v => `<button class="btn sm ghost" data-ps="rs" data-v="${v}">${v}장</button>`).join('')}${N !== R ? `<button class="btn sm" data-ps="recBack">↩ 추천 ${R}장으로</button>` : ''}</div>
      <small class="muted">줄이면 짧은 이웃 장면끼리 합쳐요 (후렴 시작 · 🔒 고정 장면은 그대로) · 늘리면 긴 장면을 가사 줄에서 나눠요</small></div>`;
  }
  function mountRec() {
    const u = U(), p = u && u.S.p, fp = document.getElementById('fPlan'), old = document.getElementById('pcRec');
    if (!isAdmin() || !p || !p.pcRec || !fp || !p.scenes) { if (old) old.remove(); return; }
    const fld = fp.closest('.field') || fp; let box = old;
    if (!box || box.nextSibling !== fld) { if (box) box.remove(); box = document.createElement('div'); box.id = 'pcRec'; fld.parentNode.insertBefore(box, fld); }
    const h = recHtml(p); if (box._h !== h) { box._h = h; box.innerHTML = h; }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ps]'); if (!b) return; const a = b.dataset.ps;
    if (a === 'planFixed') { const u = U(); u.S.p.pcPlanFixed = b.checked; u.save(); return; }
    if (a === 'intro' || a === 'outro') { const u = U(), p = u.S.p; p.pcSync = Object.assign({}, p.pcSync, { [a]: b.checked }); if (!UNDO) UNDO = snap(p); refresh(u, false); u.toast(b.checked ? (a === 'intro' ? '🖼 썸네일이 전주 끝까지 나와요' : '🎬 엔딩이 후주 처음부터 나와요') : '원래 길이로 쓸게요'); return; }
    e.preventDefault();
    if (a === 'go') return syncAll();
    if (a === 'tap') return tapBlock();
    if (a === 'undo') return undo();
    if (a === 'gapAdd') { const [gi, how] = b.dataset.v.split(':'); return addGapScreen(+gi, how); }
    if (a === 'gapDel') return delGapScreen(+b.dataset.v);
    if (a === 'free') return free();
    if (a === 'plan1') { const u = U(), p = u.S.p; if (p.pcPlanFixed) { p.pcFreeAsk = 0; return u.act('planAI'); } return free(); }
    if (a === 'rs') return resize(+b.dataset.v);
    if (a === 'recBack') return recBack();
  }, true);
  g.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app'); let raf = 0;
    if (app) new MutationObserver(() => { if (raf) return; raf = setTimeout(() => { raf = 0; const u = U(), need = isAdmin() && u && u.S.p && u.S.view === 'stage' && u.S.p.step === 3 && u.S.p.song, b = document.getElementById('pcSync'); if (need && (!b || !b.isConnected || !b.closest('[data-sub]'))) mount(); else if (!need && b) b.remove(); mountRec(); }, 40); }).observe(app, { childList: true, subtree: true });
  });
  g.BKSYNC = { freeBtn, planOne, prePlan, syncAll, gaps, blocks, tapBlock, resize, mount };
})(window);
