/* pc.js — BK뮤비 PC: 넓은 화면 배치 도우미
 *  - 창이 넓으면(1100px 이상) body에 'pc' 표시 → pc.css가 3칸 배치로 바꿈
 *  - 작품을 열었을 때 왼쪽에 단계 목록(#pcNav)을 만들어 어느 단계든 바로 가기
 *  - 원래 BK뮤비 파일(mv-*.js)은 거의 그대로 두고, 화면 배치만 여기서 바꿈
 */
(function (g) {
  'use strict';
  const STAGES = [
    { n: 1, e: '🎼', t: '내 노래 만들기' },
    { n: 2, e: '🎵', t: '노래 · 가사 · 장면 넣기' },
    { n: 3, e: '🎬', t: '노래 · 장면 맞추기' },
    { n: 4, e: '✨', t: '효과 넣기' },
    { n: 5, e: '✂️', t: '최종 편집 · 저장' },
  ];
  const WIDE = g.matchMedia('(min-width:1100px)');
  const U = () => (g.MV && g.MV.UI) || null;

  function okStage(p, n) {   // 끝낸 단계 표시 (mv-ui.js의 done()과 같은 기준)
    if (n === 1) return !!(p.song || (p.mk && p.mk.out && p.mk.out.lyrics));
    if (n === 2) return !!(p.song && (p.lines || []).length);
    if (n === 3) return !!p.locked || ((p.scenes || []).length > 0 && p.scenes.every(x => x.pin));
    if (n === 4) return !!p.fxSeen;
    if (n === 5) return !!p.exported;
    return false;
  }

  let nav = null, last = '';
  function ensureNav() {
    if (nav) return nav;
    nav = document.createElement('nav'); nav.id = 'pcNav';
    nav.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.pcguide) return;
      const u = U(); if (!u || !u.S.p) return;
      closeGuide();
      if (b.dataset.go === 'hub') { u.S.view = 'hub'; u.render(); g.scrollTo(0, 0); }
      else if (b.dataset.go === 'home') { const h = document.getElementById('homeBtn'); if (h) h.click(); }
      else u.go(+b.dataset.go);
      last = ''; sync();
    });
    document.body.appendChild(nav);
    return nav;
  }

  function sync() {
    const wide = WIDE.matches, u = U(), p = u && u.S.p;
    document.body.classList.toggle('pc', wide);
    document.body.classList.toggle('pcWork', !!(wide && p));
    if (!wide || !p) return;
    const view = u.S.view === 'stage' ? p.step : 0;
    const SL = g.BKDRAMA && p.kind === 'drama' ? g.BKDRAMA.PCSTAGES : STAGES, dk = g.BKDRAMA && p.kind === 'drama';
    const okS = (pp, n) => dk ? !!g.BKDRAMA.done(pp, n) || (n > 3 && okStage(pp, n)) : okStage(pp, n);
    const key = view + '|' + (dk ? 'd' : 'm') + SL.map(s => okS(p, s.n) ? 1 : 0).join('');
    if (key === last) return; last = key;
    ensureNav().innerHTML = `<div class="pcT">단계</div>
      <button type="button" data-go="hub" class="${view ? '' : 'on'}"><span class="e">🗂</span><span>전체 단계<small>처음 화면</small></span></button>
      ${SL.map(s => `<button type="button" data-go="${s.n}" class="st${s.n}${view === s.n ? ' on' : ''}${okS(p, s.n) ? ' ok' : ''}"><span class="e">${s.e}</span><span><i class="num">${s.n}</i>${s.t}</span></button>`).join('')}
      <hr><button type="button" data-go="home"><span class="e">🏠</span><span>내 뮤비 목록</span></button>
      <button type="button" data-pcguide="1"><span class="e">❓</span><span>사용법</span></button>
      ${INFO ? pcInfoHtml() : '<div class="pcKey">🖥 넓은 화면 모양이에요.<br>창을 좁히면 휴대폰 모양으로 바뀌어요.</div>'}`;
  }

  /* ── 🖥 설치형 프로그램(파이썬)으로 열렸을 때: 내 PC 정보 ── */
  let INFO = null;
  const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function pcInfoHtml() {
    if (!INFO) return '';
    const gp = INFO.gpu || {};
    return `<div class="pcInfo"><b>🖥 내 PC</b>
      <span>${gp.nvidia ? escH(gp.name) + ' · ' + gp.vram_gb + 'GB' : '그래픽카드: NVIDIA 없음'}</span>
      <span>메모리 ${INFO.ram_gb}GB</span>
      <span class="pcEng">${escH(INFO.engine)}</span>
      <small>Bang Song Studio v${escH(INFO.version)}</small></div>`;
  }
  /* ❓ 사용법: 프로그램이면 기본 인터넷 창으로 크게, 아니면 새 탭 */
  function openGuide() {
    if (g.pywebview && g.pywebview.api && g.pywebview.api.open_guide) g.pywebview.api.open_guide();
    else g.open('guide.html', '_blank');
  }
  function homeInfo() {
    const app = document.getElementById('app'), u = U();
    if (!app || (u && u.S.p) || app.querySelector('.pcInfoHome')) return;
    if (!app.querySelector('[data-a="newP"]')) return;   // 내 뮤비 첫 화면일 때만
    const d = document.createElement('div'); d.className = 'pcInfoHome';
    d.innerHTML = `<button type="button" class="btn ghost pcGuideBtn" data-pcguide="1">❓ 사용법 보기 <small>처음이면 꼭 읽어 보세요</small></button>${pcInfoHtml()}`;
    app.insertBefore(d, app.firstChild);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-pcguide]')) { e.preventDefault(); openGuide(); } });
  /* 🏠 홈으로: 작업 중이면 먼저 물어보기 (자동 저장은 늘 되고 있어요 · 한 번 더 확실히 저장) */
  document.addEventListener('click', e => {
    const h = e.target.closest('#homeBtn'); if (!h || h._ok) return; const u = U(), p = u && u.S.p; if (!p) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (u.S.busy) return u.toast('🎬 영상을 만드는 중이에요 · 끝난 뒤에 홈으로 가 주세요', 3500);
    u.sheet('🏠 홈으로 갈까요?', `<p style="margin:0 0 14px;line-height:1.7">「<b>${escH(p.title || '제목 없음')}</b>」 작업을 저장하고 <b>홈(첫 화면)</b>으로 갈까요?<br><small class="muted">작업은 늘 자동으로 저장되고 있어요. 다음에 「▶ 이어 만들기」로 이어서 할 수 있어요.</small></p>
      <div class="row"><button type="button" class="btn main big" data-home="go">💾 저장하고 홈으로</button><button type="button" class="btn big" data-home="stay">✏️ 계속 작업하기</button></div>`);
  }, true);
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-home]'); if (!b) return; const u = U(); u.sheetClose(); if (b.dataset.home !== 'go') return;
    try { if (u.S.p) { u.S.p.at = Date.now(); await g.MV.putProject(u.S.p); } } catch (er) { /* 자동 저장이 이어서 함 */ }
    const h = document.getElementById('homeBtn'); h._ok = 1; h.click(); h._ok = 0; u.toast('💾 저장했어요', 1800);
  });
  document.addEventListener('click', e => { if (!e.target.closest('#bssBadge')) return; const h = document.getElementById('homeBtn'); if (h && !h.classList.contains('hide')) h.click(); else g.scrollTo({ top: 0, behavior: 'smooth' }); });
  g.addEventListener('pywebviewready', async () => {
    document.body.classList.add('pcApp');
    try { INFO = await g.pywebview.api.info(); } catch (e) { return; }
    last = ''; sync();
    const old = document.querySelector('.pcInfoHome'); if (old) old.remove();   // 내 PC 정보까지 넣어서 다시
    homeInfo();
  });

  /* ── 📋 복사: 프로그램 창 안에서는 화면 복사가 막혀서 → 파이썬이 직접 복사 ──
   *  모든 AI 버튼(ChatGPT · Gemini · 수노)이 MV.copy / navigator.clipboard 를 쓰므로 여기서 한 번에 바꿈
   *  복사한 글은 오른쪽 아래 카드에 보여 주고 「다시 복사」 가능 */
  const pyApi = () => g.pywebview && g.pywebview.api && g.pywebview.api.copy_text ? g.pywebview.api : null;
  const webCopy = (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
  async function pcCopy(t) {
    t = String(t == null ? '' : t);
    let ok = false;
    const a = pyApi();
    if (a) { try { ok = !!(await a.copy_text(t)).ok; } catch (e) { ok = false; } }
    if (!ok && webCopy) { try { await webCopy(t); ok = true; } catch (e) { ok = false; } }
    if (t.length > 40) showCopied(t, ok);
    return ok;
  }
  function showCopied(t, ok) {
    let c = document.getElementById('pcCopy');
    if (!c) { c = document.createElement('div'); c.id = 'pcCopy'; document.body.appendChild(c);
      c.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.k === 'x') return c.classList.remove('show');
        if (b.dataset.k === 'v') return c.classList.toggle('open');
        if (b.dataset.k === 'c') { const ok2 = await pcCopy(c._t); b.textContent = ok2 ? '✅ 다시 복사했어요' : '⚠️ 아래 글을 직접 복사해 주세요'; } }); }
    c._t = t;
    c.innerHTML = `<div class="hd"><b>${ok ? '📋 복사됐어요 · 붙여 넣기(Ctrl+V)만 하세요' : '⚠️ 복사가 안 됐어요 · 아래 글을 직접 복사해 주세요'}</b><button type="button" data-k="x" aria-label="닫기">✕</button></div>
      <div class="bt"><button type="button" data-k="v">👀 요청 글 보기</button><button type="button" data-k="c">📋 다시 복사</button></div>
      <textarea readonly>${escH(t)}</textarea>`;
    c.classList.add('show'); c.classList.toggle('open', !ok);
    clearTimeout(c._tm); c._tm = setTimeout(() => { if (!c.classList.contains('open')) c.classList.remove('show'); }, 12000);
  }
  function hookCopy() {
    if (g.MV && g.MV.copy !== pcCopy) g.MV.copy = pcCopy;
    try { if (navigator.clipboard) navigator.clipboard.writeText = pcCopy; } catch (e) { /* 못 바꾸면 그대로 */ }
    const ex = document.execCommand && document.execCommand.bind(document);
    if (ex && !document._pcEx) { document._pcEx = 1;
      document.execCommand = function (cmd) {   // 예전 방식 복사(숨은 글칸 선택 → copy)도 파이썬으로
        if (String(cmd).toLowerCase() === 'copy') { const el = document.activeElement; const t = el && 'value' in el ? el.value.slice(el.selectionStart || 0, el.selectionEnd || el.value.length) || el.value : String(g.getSelection() || ''); if (t) { pcCopy(t); return true; } }
        return ex.apply(null, arguments); }; }
  }
  hookCopy(); g.addEventListener('DOMContentLoaded', hookCopy); g.addEventListener('pywebviewready', hookCopy);

  /* ── 🖼 휴대폰 「공유」 창 대신 (PC 프로그램에서만) ──
   *  사진 · 영상을 다운로드\BK뮤비 에 저장 → 폴더에서 그 파일을 골라 보여 주고, 요청 글 복사, Gemini/ChatGPT 열기
   *  ※ 휴대폰 BK뮤비는 그대로 공유 창 */
  const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b); });
  async function pcShare(data) {
    const a = g.pywebview && g.pywebview.api; if (!a || !a.save_share) throw new Error('no');
    const f = data && data.files && data.files[0], t = (data && data.text) || '';
    let path = '';
    if (f) { const r = await a.save_share(f.name || '파일', await blobB64(f)); path = r && r.path || ''; }
    const isV = f && /^video/.test(f.type);
    const url = isV ? '' : /그림 방/.test(t) ? 'https://chatgpt.com/' : t ? 'https://gemini.google.com/app' : '';
    const who = /chatgpt/.test(url) ? 'ChatGPT' : 'Gemini';
    if (t) await pcCopy(t);
    if (url) setTimeout(() => g.open(url, '_blank'), 500);
    shareCard(path, t, isV, who);
    setTimeout(() => { const ts = document.getElementById('toast'); if (ts) ts.textContent = isV ? '📁 영상을 다운로드\\BK뮤비 폴더에 저장했어요' : `📁 사진은 폴더에 · 📋 요청 글은 복사됐어요 · ${who}에 넣어 주세요`; }, 30);
  }
  function shareCard(path, t, isV, who) {
    let c = document.getElementById('pcCopy');
    if (!c) { showCopied(t || ' '.repeat(50), true); c = document.getElementById('pcCopy'); }
    c._t = t; c._img = path;
    c.innerHTML = `<div class="hd"><b>${isV ? '🎬 영상을 저장했어요' : `🖼 ${who}에 사진과 요청 글을 넣어 주세요`}</b><button type="button" data-k="x" aria-label="닫기">✕</button></div>
      <ol class="shSteps">${isV ? `<li>열린 폴더(<b>다운로드 › BK뮤비</b>)에 영상이 있어요</li><li>카카오톡 · 유튜브 등에 그 파일을 끌어다 놓거나 올려 주세요</li>`
        : `<li>열린 폴더(<b>다운로드 › BK뮤비</b>)의 <b>사진을 ${who} 입력 칸에 끌어다 놓기</b><br><small>끌기가 어려우면 아래 「🖼 사진 복사」 → ${who}에서 Ctrl+V</small></li><li>${who} 입력 칸에서 <b>Ctrl+V</b> (요청 글 붙여 넣기)</li><li>보내기</li>`}</ol>
      <div class="bt">${isV ? '' : '<button type="button" data-k="img">🖼 사진 복사</button><button type="button" data-k="c">📋 글 복사</button>'}<button type="button" data-k="dir">📁 폴더 다시 열기</button></div>
      ${t ? `<textarea readonly>${escH(t)}</textarea>` : ''}`;
    c.classList.add('show'); c.classList.remove('open'); clearTimeout(c._tm);
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('#pcCopy [data-k]'); if (!b) return; const c = document.getElementById('pcCopy'), a = g.pywebview && g.pywebview.api;
    if (b.dataset.k === 'img' && a && c._img) { const r = await a.copy_image(c._img); b.textContent = r && r.ok ? '✅ 사진 복사됨 · Ctrl+V' : '⚠️ 사진 복사 안 됨'; }
    if (b.dataset.k === 'dir' && a) a.open_folder('share');
  });
  function hookShare() {
    if (!(g.pywebview && g.pywebview.api && g.pywebview.api.save_share) || navigator._pcSh) return;
    navigator._pcSh = 1;
    try { navigator.share = pcShare; navigator.canShare = () => true; } catch (e) { /* 그대로 */ }
    try { if (navigator.clipboard) navigator.clipboard.readText = async () => { const r = await g.pywebview.api.get_text(); return (r && r.text) || ''; }; } catch (e) { /* 그대로 */ }
  }
  g.addEventListener('pywebviewready', hookShare); hookShare();

  /* ── 🎨 단계마다 다른 파스텔 색 · 작은 단계(①②③) 카드에 지금 상태 적기 ── */
  const DESC = { 1: '수노로 내 노래를 만들어요', 2: '노래 파일 · 가사 · 장면 그림을 넣어요', 3: '장면이 노래 박자 · 가사에 맞게 바뀌도록 맞춰요', 4: '전환 · 스티커 · 색감 같은 효과를 넣어요', 5: '마지막으로 다듬고 MP4 영상으로 저장해요' };
  function subInfo(p, label) {
    const L = String(label);
    if (/노래/.test(L) && p.song) return '✓ ' + (g.MV.fmt0 ? g.MV.fmt0(p.song.dur) : '');
    if (/가사/.test(L) && (p.lines || []).length) return (p.lines || []).length + '줄';
    if (/장면 만들기/.test(L) && (p.scenes || []).length) return '장면 글 ' + p.scenes.filter(x => x.prompt).length + ' / ' + p.scenes.length;
    if (/장면/.test(L) && (p.scenes || []).length) return (p.scenes || []).filter(x => x.file).length + ' / ' + p.scenes.length + '장';
    return '';
  }
  function subDone(p, L) {   // 지금 작은 단계를 끝냈는지 (다음 칸에 「👉 다음」 표시)
    if (/노래/.test(L)) return !!p.song;
    if (/가사/.test(L)) return (p.lines || []).length > 0;
    if (/장면/.test(L)) return (p.scenes || []).length > 0 && p.scenes.every(x => x.file || x.reuse != null);
    if (/자막/.test(L)) return (p.lines || []).length > 0 && p.lines.every(l => l.s != null);
    if (/화면/.test(L)) return (p.scenes || []).length > 0;
    return false;
  }
  function decorate() {
    const u = U(), p = u && u.S.p, b = document.body;
    const n = p && u.S.view === 'stage' ? p.step : 0;
    for (let i = 0; i <= 5; i++) b.classList.toggle('pcS' + i, i === n);
    if (n || !p) closeGuide();
    const gd = document.getElementById('pcGuide'); if (gd) for (let i = 1; i <= 5; i++) b.classList.toggle('pcS' + i, gd.className === 'gd' + i);
    if (!b.classList.contains('pc') || !n) return;
    const t = document.querySelector('#stage .stT');
    if (t && !t.querySelector('.pcDesc')) { const d = document.createElement('small'); d.className = 'pcDesc'; d.textContent = (g.BKDRAMA && p.kind === 'drama' ? g.BKDRAMA.DESC[n] : DESC[n]) || ''; t.appendChild(d); }
    const bar = document.querySelector('#stage .subbar'), body = document.querySelector('#stage .stBody');
    if (bar && body && bar.parentNode !== body.parentNode) { body.parentNode.insertBefore(bar, body); bar.classList.add('pcTop'); }   // 큰 제목 바로 아래 · 넓게
    const sb = [...document.querySelectorAll('#stage .subbar button')], cur = sb.findIndex(x => x.classList.contains('on'));
    const nowN = document.getElementById('fxNow'), curL = cur >= 0 ? (sb[cur].dataset.lb || sb[cur].textContent) : '';   // 📍 지금 위치는 효과 · 스티커 · 소리 탭에서만
    if (nowN && nowN.closest('.note')) nowN.closest('.note').style.display = /효과|스티커|소리/.test(curL) ? '' : 'none';
    sb.forEach((x, i) => {
      if (!x.dataset.lb) x.dataset.lb = x.textContent;
      const inf = subInfo(p, x.dataset.lb), nx = i === cur + 1 && cur >= 0 && subDone(p, sb[cur].dataset.lb || ''),
        want = `<span class="sn">${escH(x.dataset.lb)}</span>${inf ? `<small>${escH(inf)}</small>` : ''}${nx ? '<i class="pcNextTag">👉 다음</i>' : ''}`;
      x.classList.toggle('pcNext', !!nx);
      if (x._h !== want) { x._h = want; x.innerHTML = want; }
    });
  }

  /* ── 🎵 노래 넣기 (PC): 다운로드 폴더 최근 MP3 · 구글 드라이브 · 끌어다 놓기 ── */
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB';
  async function loadPath(path, name, t) {
    const u = U(); if (!u || !u.S.p) return;
    if (u.S.p.song && !confirm(`지금 노래를 「${name}」(으)로 바꿀까요?`)) return;
    u.toast('🎵 노래를 불러오는 중…', 2000);
    const r = await fetch('/pcfile?t=' + encodeURIComponent(t) + '&p=' + encodeURIComponent(path)); if (!r.ok) return u.toast('⚠️ 노래 파일을 열지 못했어요');
    const bl = await r.blob(), ext = (name.split('.').pop() || 'mp3').toLowerCase(), type = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', ogg: 'audio/ogg', aac: 'audio/aac' }[ext] || 'audio/mpeg';
    await u.setSong(new File([bl], name, { type }), name);
  }
  async function songRecent() {
    const a = g.pywebview && g.pywebview.api, el = document.getElementById('boxList'); if (!el) return;
    if (!a || !a.list_audio) { el.innerHTML = '<div class="note">이 기능은 설치한 Bang Song Studio 프로그램에서 돼요. 「📁 내 MP3 고르기」를 써 주세요.</div>'; return; }
    el.innerHTML = '<p class="muted">다운로드 폴더를 보는 중…</p>';
    const r = await a.list_audio(20);
    if (!r.files.length) { el.innerHTML = '<div class="note">다운로드 폴더에 노래 파일(MP3 등)이 없어요. 수노 · Gemini에서 MP3를 내려받은 뒤 다시 눌러 주세요.</div>'; return; }
    el._t = r.t; el._f = r.files;
    el.innerHTML = `<div class="boxlist pcSongs">${r.files.map((f, i) => `<button type="button" data-pcs="use" data-v="${i}">🎵 <b>${escH(f.name)}</b> <span class="muted">${new Date(f.mtime * 1000).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${kb(f.size)}</span></button>`).join('')}</div>`;
  }
  async function songDrive() {
    const a = g.pywebview && g.pywebview.api, u = U();
    if (!a || !a.pick_audio) { g.open('https://drive.google.com/', '_blank'); return; }
    if (u) u.toast('☁️ 구글 드라이브 여는 중… (처음엔 10초쯤 걸릴 수 있어요)', 6000);
    const r = await a.pick_audio('drive');
    if (r && r.ok) return loadPath(r.path, r.name, r.t);
    if (r && r.nodrive) { g.open('https://drive.google.com/', '_blank'); const el = document.getElementById('boxList'); if (el) el.innerHTML = '<div class="note">이 PC에는 <b>구글 드라이브 PC 프로그램</b>이 없어서 드라이브 <b>웹사이트</b>를 열었어요 (크롬이 열리느라 조금 걸려요).<br>① 드라이브에서 MP3를 <b>다운로드</b> → ② 「📥 다운로드 폴더 최근 MP3」를 누르면 바로 보여요.<br>💡 <a href="https://www.google.com/drive/download/" target="_blank" rel="noopener">Google Drive PC 프로그램</a>을 설치하면 다음부터는 이 버튼으로 드라이브 폴더가 <b>바로</b> 열려요.</div>'; if (u) u.toast('☁️ 구글 드라이브를 열었어요 · MP3를 내려받은 뒤 📥 버튼', 4000); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pcs]'); if (!b) return; e.preventDefault();
    if (b.dataset.pcs === 'del') { const u = U(), p = u && u.S.p; if (!p || !p.song) return;
      if (!confirm(`노래 「${p.song.name}」을(를) 이 뮤비에서 뺄까요?
가사 · 자막 시간 · 장면 그림은 그대로 남아요. (PC에 있는 원래 MP3 파일도 그대로예요)`)) return;
      try { u.S.player.audio.pause(); } catch (er) { /* 괜찮음 */ }
      const id = p.song.file; p.song = null; u.S.song = null; if (id && g.MV.delFile) g.MV.delFile(id);
      u.save(); u.render(); return u.toast('🗑 노래를 뺐어요 · 다른 노래를 넣어 주세요', 3000); }
    if (b.dataset.pcs === 'recent') return songRecent();
    if (b.dataset.pcs === 'drive') return songDrive();
    if (b.dataset.pcs === 'use') { const el = document.getElementById('boxList'), f = el && el._f && el._f[+b.dataset.v]; if (f) loadPath(f.path, f.name, el._t); }
  });
  /* 끌어다 놓기: 노래 파일을 창에 놓으면 노래로 */
  let dragN = 0;
  const isAudio = f => f && (/^audio\//.test(f.type) || /\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(f.name));
  document.addEventListener('dragenter', e => { const u = U(); if (!u || !u.S.p || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return; dragN++; document.body.classList.add('pcDrop'); });
  document.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('pcDrop'); } });
  document.addEventListener('dragover', e => { if (document.body.classList.contains('pcDrop')) e.preventDefault(); });
  document.addEventListener('drop', async e => {
    dragN = 0; document.body.classList.remove('pcDrop');
    const u = U(), f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!u || !u.S.p || !f) return;
    e.preventDefault();
    if (g.BKDRAMA && u.S.p.kind === 'drama') return g.BKDRAMA.addClips(e.dataTransfer.files);   // 🎭 드라마: 클립 여러 개
    if (!isAudio(f)) return u.toast('🎵 노래 파일(MP3 · WAV 등)만 끌어다 놓을 수 있어요', 3000);
    if (u.S.p.song && !confirm(`지금 노래를 「${f.name}」(으)로 바꿀까요?`)) return;
    await u.setSong(f, f.name);
  });

  /* ── 2단계 콤보박스 · 지금 장면 고르기 · 넣으면 다음 빈 장면으로 ── */
  document.addEventListener('change', e => {
    const t = e.target, u = U(); if (!u || !u.S.p) return;
    if (t.matches('select[data-sel]')) { u.act(t.dataset.sel, t.value, t); return; }
    if (t.matches('select[data-pcmore]')) { const i = +t.dataset.pcmore, v = t.value; t.value = ''; if (!v) return; u.S.p.cpNext = i; u.act(v, String(i), t); }
  });
  let putWatch = null;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pcn]'); if (b) { const u = U(), p = u && u.S.p; if (!p) return; const n = +b.dataset.pcn; if (n < 0 || n >= (p.scenes || []).length) return; p.pcCur = n; u.save(); u.renderStage(); try { u.S.player.seek(p.scenes[n].s + 0.01); } catch (er) { /* 괜찮음 */ } const c = document.querySelector('.curBox'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const put = e.target.closest('.curBox [data-a="scPut"]'); if (put) { const p = U().S.p, i = +put.dataset.v; putWatch = { i, f: p.scenes[i] && p.scenes[i].file, t: Date.now() }; }
  }, true);
  setInterval(() => { try {   // 지금 장면에 그림을 넣으면 → 다음 빈 장면으로
    if (!putWatch) return; const u = U(), p = u && u.S.p; if (!p || Date.now() - putWatch.t > 120000) { putWatch = null; return; }
    const sc = p.scenes[putWatch.i]; if (!sc || !sc.file || sc.file === putWatch.f) return;
    const nx = p.scenes.findIndex((x, j) => j > putWatch.i && !x.file && x.reuse == null); putWatch = null;
    if (nx >= 0) { p.pcCur = nx; u.save(); u.renderStage(); u.toast(`✅ 넣었어요 · 다음은 장면 ${nx + 1}`, 2500); }
  } catch (er) { putWatch = null; } }, 400);

  /* ── 🖼 미리 보기 아래: 지금 장면 · 가사 한 줄 · ◀ 이전 / 다음 ▶ 장면 (빈 공간 쓰기) ── */
  function pvInfo() {
    const u = U(), p = u && u.S.p; if (!p || !p.song || !u.S.player || !document.body.classList.contains('pc')) return;
    const st = document.querySelector('#stage .stBody > .pvStick, #stage [data-sub] > .pvStick'); if (!st) return;
    let d = st.querySelector('.pcPvInfo');
    if (!d) { d = document.createElement('div'); d.className = 'pcPvInfo'; d.innerHTML = '<div class="pi"></div><div class="pb"><button type="button" data-pvj="-1">◀ 이전 장면</button><button type="button" data-pvj="1">다음 장면 ▶</button></div>'; st.appendChild(d); }
    const t = u.S.player.time(), S2 = p.scenes || [], k = Math.max(0, S2.findIndex(x => t >= x.s && t < x.e)), sc = S2[k];
    const L = (p.lines || []).filter(l => l.s != null), ln = L.filter(l => l.s <= t + 0.05).pop(), f = g.MV.fmt0 || (x => x);
    const txt = sc ? `<b>장면 ${k + 1} / ${S2.length}</b> · ${f(sc.s)}~${f(sc.e)}${sc.pin ? ' · 🔒 고정' : ''}${sc.file ? '' : ' · <span class="em">비어 있음</span>'}<br><span class="ly">🎤 ${ln && t - ln.s < 8 ? escH(ln.t) : '(반주)'}</span>` : '';
    const pi = d.querySelector('.pi'); if (pi._t !== txt) { pi._t = txt; pi.innerHTML = txt; }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pvj]'); if (!b) return; const u = U(), p = u && u.S.p; if (!p) return;
    const S2 = p.scenes || [], t = u.S.player.time(), k = Math.max(0, S2.findIndex(x => t >= x.s && t < x.e)), n = Math.min(S2.length - 1, Math.max(0, k + +b.dataset.pvj));
    if (S2[n]) u.S.player.seek(S2[n].s + 0.01); pvInfo();
  });
  setInterval(() => { try { pvInfo(); } catch (e) { /* 괜찮음 */ } }, 300);

  /* ── ✏️ 큰 글 칸마다 [📋 붙여넣기] [🗑 지우기] [↩ 되돌리기] (어디서나 같은 모양) ── */
  const HIST = {};   // 칸마다 예전 글 (되돌리기용) — 화면이 다시 그려져도 칸 이름으로 기억
  const taKey = t => t.dataset.mkc || t.dataset.mko || t.id || t.name || '';
  function remember(t) { const k = taKey(t); if (!k) return; const h = HIST[k] || (HIST[k] = []); if (h[h.length - 1] !== t.value) { h.push(t.value); if (h.length > 30) h.shift(); } }
  function setTa(t, v) { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
  function addTools() {
    if (!document.body.classList.contains('pc')) return;
    document.querySelectorAll('#stage textarea, #sheet textarea').forEach(t => {
      if (t.readOnly || t._pcT || !taKey(t) || t.closest('#pcCopy, .psCard')) return;
      t._pcT = 1; t.addEventListener('focus', () => remember(t));
      const bar = document.createElement('div'); bar.className = 'taTools';
      bar.innerHTML = (t.id === 'fPlan' || t.id === 'mkAns' || t.id === 'pcLicIn' ? '' : '<button type="button" data-ta="paste">📋 붙여넣기</button>') + '<button type="button" data-ta="clear">🗑 지우기</button><button type="button" data-ta="undo">↩ 되돌리기</button>';
      bar._ta = t; t.parentNode.insertBefore(bar, t);
    });
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('.taTools [data-ta]'); if (!b) return; e.preventDefault();
    const t = b.parentNode._ta, u = U(); if (!t || !t.isConnected) return; const k = taKey(t), a = b.dataset.ta;
    if (a === 'paste') { let v = ''; try { v = await navigator.clipboard.readText(); } catch (er) { /* 없음 */ } if (!v) return u && u.toast('복사한 글이 없어요 · 칸을 누르고 Ctrl+V 해 보세요'); remember(t); setTa(t, t.value.trim() ? t.value.replace(/\s*$/, '\n') + v : v); return u && u.toast('📋 붙여 넣었어요'); }
    if (a === 'clear') { if (!t.value.trim()) return; if (!confirm('이 칸의 글을 모두 지울까요? (↩ 되돌리기로 다시 살릴 수 있어요)')) return; remember(t); setTa(t, ''); return u && u.toast('🗑 지웠어요 · 잘못 지웠으면 ↩ 되돌리기'); }
    if (a === 'undo') { const h = HIST[k] || []; let v = h.pop(); while (v === t.value && h.length) v = h.pop(); if (v == null || v === t.value) return u && u.toast('되돌릴 글이 없어요'); setTa(t, v); const t2 = [...document.querySelectorAll('textarea')].find(x => taKey(x) === k); if (t2 && t2 !== t) t2.value = v; return u && u.toast('↩ 되돌렸어요'); }
  }, true);

  /* ── 📖 첫 화면 큰 카드를 누르면: 「이 단계는 이런 곳이에요」 안내 페이지 → ▶ 들어가기 ──
   *  왼쪽 글 메뉴는 안내 없이 바로 들어감 · 「다음부터 바로 들어가기」 체크하면 카드도 바로 */
  const GUIDE = {
    1: { what: '수노(Suno)로 내 노래를 만드는 곳이에요. 장르와 주제를 고르면 AI가 가사와 노래 스타일을 써 주고, 그걸 수노에 붙여 넣어 노래를 만들어요.',
      steps: ['장르 · 주제 · 이야기 고르기', 'AI 가사 · 노래 스타일 받기 (복사 → 붙여 넣기)', '수노에서 노래 만들고 MP3 내려받기'],
      need: '수노 계정 (이미 노래 MP3가 있으면 이 단계는 건너뛰어도 돼요)', tip: '다른 곳(수노 · Gemini 등)에서 만든 MP3가 있으면 바로 2단계로 가세요.' },
    2: { what: '뮤직비디오 재료를 넣는 곳이에요. 노래 파일, 가사(시간 포함), 장면 그림을 차례로 넣어요.',
      steps: ['🎵 노래: MP3 파일 넣기', '📝 가사: 가사 붙여 넣기 또는 「MP3로 가사 받기(Gemini)」', '🖼 장면: 주인공 정하고 장면 그림(사진 · AI 그림) 넣기'],
      need: '노래 MP3 · 가사(수노 가사 또는 Gemini) · 사진이나 AI 그림', tip: 'AI 버튼을 누르면 요청 글이 저절로 복사돼요. 열린 창에서 Ctrl+V만 하세요.' },
    3: { what: '장면이 노래와 딱 맞게 바뀌도록 맞추는 곳이에요. 자막이 가사에 맞게 나오고, 장면 길이와 순서를 정해요.',
      steps: ['자막: 가사가 나오는 때 맞추기 (가사 톡톡)', '화면: 장면 길이 · 순서 정하기 (✨ 음악에 저절로 맞추기)', '잠금: 장면마다 확인하고 🔒 고정'],
      need: '2단계에서 넣은 노래 · 가사 · 장면', tip: '「✨ 음악에 저절로 맞추기」를 누르면 박자 · 후렴에 맞춰 한 번에 맞춰 줘요. ↩ 되돌리기도 돼요.' },
    4: { what: '뮤직비디오를 멋지게 꾸미는 곳이에요. 장면 전환, 색감, 화면 효과, 스티커, 제목을 넣어요.',
      steps: ['🔀 장면 전환 38가지 고르기', '🎨 색감 · 화면 효과 넣기', '😀 스티커 · 움직이는 스티커 · 제목 넣기'],
      need: '3단계까지 맞춘 작품', tip: '장르(트로트 · 발라드 · 댄스…)를 고르면 어울리는 효과가 한 번에 들어가요.' },
    5: { what: '마지막으로 다듬고 MP4 영상으로 저장하는 곳이에요. 화면 · 음악 · 자막 · 효과 줄을 보며 고쳐요.',
      steps: ['▶ 처음부터 끝까지 미리 보기', '✂️ 화면 · 자막 · 효과 줄에서 다듬기', '💾 MP4로 저장'],
      need: '앞 단계까지 만든 작품', tip: '저장할 때 「다른 이름으로 저장」 창이 뜨면 바탕화면이나 원하는 폴더를 고르세요.' },
  };
  const NAMES = { 1: '내 노래 만들기 (수노)', 2: '노래 · 가사 · 장면 넣기', 3: '노래 · 장면 맞추기', 4: '효과 넣기', 5: '최종 편집 · 저장' };
  const EMO = { 1: '🎼', 2: '🎵', 3: '🎬', 4: '✨', 5: '✂️' };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 괜찮음 */ } };
  function guideOpen(n, card) {
    const hub = document.getElementById('hub'); if (!hub) return;
    const st = card && card.querySelector('.stt'), G = GUIDE[n];
    closeGuide();
    const d = document.createElement('section'); d.id = 'pcGuide'; d.className = 'gd' + n;
    d.innerHTML = `<button type="button" class="gBack" data-gk="back">◀ 전체 단계</button>
      <div class="gHead"><span class="gIc">${EMO[n]}</span><div><span class="gN">${n}단계</span><h2>${escH(NAMES[n])}</h2></div></div>
      <p class="gWhat">🎯 ${escH(G.what)}</p>
      <div class="gGrid">
        <div class="gBox"><h3>🧩 이런 순서로 해요</h3><ol>${G.steps.map(s => `<li>${escH(s)}</li>`).join('')}</ol></div>
        <div class="gBox"><h3>📦 준비할 것</h3><p>${escH(G.need)}</p><h3>📊 지금 내 상태</h3><p>${st ? escH(st.textContent) : (card && card.querySelector('.ic') && /✅/.test(card.querySelector('.ic').textContent) ? '✅ 끝냈어요' : '아직 시작 전이에요')}</p></div>
      </div>
      <p class="gTip">💡 ${escH(G.tip)}</p>
      <button type="button" class="gGo" data-gk="go">▶ ${n}단계 들어가기</button>
      <label class="gSkip"><input type="checkbox" data-gk="skip"${lsGet('pcGuideSkip') === '1' ? ' checked' : ''}> 다음부터 안내 없이 바로 들어가기</label>`;
    d.addEventListener('click', e => { const b = e.target.closest('[data-gk]'); if (!b) return;
      if (b.dataset.gk === 'skip') return lsSet('pcGuideSkip', b.checked ? '1' : '0');
      closeGuide(); if (b.dataset.gk === 'go') { const u = U(); if (u) u.go(n); } g.scrollTo(0, 0); });
    hub.parentNode.insertBefore(d, hub); document.body.classList.add('pcGuiding', 'pcS' + n); g.scrollTo(0, 0);
  }
  function closeGuide() { const o = document.getElementById('pcGuide'); if (o) o.remove(); document.body.classList.remove('pcGuiding'); }
  document.addEventListener('click', e => {
    const card = e.target.closest('#hub .mode[data-a="open"]');
    if (!card || !document.body.classList.contains('pc') || lsGet('pcGuideSkip') === '1') return;
    { const u0 = U(); if (u0 && u0.S.p && u0.S.p.kind === 'drama') return; }   // 드라마는 안내 없이 바로
    e.preventDefault(); e.stopPropagation(); guideOpen(+card.dataset.v, card);
  }, true);

  let raf = 0;
  const later = () => { if (raf) return; raf = setTimeout(() => { raf = 0; sync(); homeInfo(); decorate(); hookCopy(); addTools(); }, 30); };
  setInterval(() => { try { addTools(); } catch (e) { /* 괜찮음 */ } }, 700);
  g.addEventListener('DOMContentLoaded', () => {
    sync();
    const app = document.getElementById('app');
    if (app) new MutationObserver(later).observe(app, { childList: true });
    const st = () => { const s = document.getElementById('stage'), h = document.getElementById('hub'); [s, h].forEach(el => el && !el._pcObs && (el._pcObs = 1, new MutationObserver(later).observe(el, { childList: true, attributes: true, attributeFilter: ['class'] }))); };
    new MutationObserver(st).observe(app || document.body, { childList: true });
    st();
  });
  (WIDE.addEventListener ? WIDE.addEventListener('change', () => { last = ''; sync(); }) : WIDE.addListener(() => { last = ''; sync(); }));
})(window);
