/* m.js — BSS 쇼츠 (핸드폰용 Bang Song Studio)
 *  · 세로 9:16 쇼츠만 · 59초까지만 저장 · 영상은 720p로 가볍게
 *  · 작품은 핸드폰판 전용 저장 공간(IndexedDB 'bss-shorts')에 — 다른 BK 앱 작품은 건드리지 않아요
 */
(function (g) {
  'use strict';
  const MV = g.MV; if (!MV) return;
  MV.MAXDUR = 59; MV.SHORTS = true;
  const fix = p => { if (p) { p.ratio = '9:16'; if (p.dr) { p.dr.ratio = '9:16'; p.dr.len = 1; } } return p; };
  const put = MV.putProject; if (put) MV.putProject = p => put(fix(p));

  /* 노래가 59초보다 길면 아래에 안내 띠 */
  function warn() {
    const u = MV.UI, p = u && u.S && u.S.p; let b = document.getElementById('mLong');
    if (p) fix(p);
    const d = p && p.song && p.song.dur, over = d && d > MV.MAXDUR + .5;
    if (!over) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'mLong'; b.className = 'mLong'; document.body.appendChild(b); }
    const t = `⏱ 노래가 <b>${Math.round(d)}초</b> · 쇼츠는 <b>59초까지만</b> 저장돼요<small>원하는 부분만 남기려면 ⑤ 최종 편집 → 「📐 자르기」</small>`;
    if (b.innerHTML !== t) b.innerHTML = t;
  }
  setInterval(warn, 1500);

  const css = document.createElement('style');
  css.textContent = `
  .bssW::after{content:' 쇼츠';color:#d4537e;font-weight:900}
  .mLong{position:fixed;left:8px;right:8px;bottom:8px;z-index:250;background:#1e293bee;color:#fff;border-radius:14px;padding:10px 14px;font-size:.88rem;line-height:1.5;box-shadow:0 6px 18px #0004}
  .mLong small{display:block;color:#cbd5e1;font-size:.78rem}
  @media (max-width:700px){
    header.top{gap:6px!important}
    header.top h1{font-size:1rem!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bssW{font-size:0!important}.bssW b{font-size:1.05rem;color:#fff!important}.bssW::after{font-size:1.05rem;color:#fde68a}   /* 좁은 화면: 「BSS 쇼츠」로 짧게 */
    header.top #homeBtn{padding:6px 10px!important;font-size:.85rem!important}
    #bssBadge img{height:26px!important}
    .kTag{font-size:.68rem!important;padding:1px 6px!important;margin-left:4px!important}
  }`;
  document.head.appendChild(css);
})(window);
