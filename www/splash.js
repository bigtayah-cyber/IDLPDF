/* ============ Écran titre d'une app (versions installées) ============
   Tuile de l'app + nom, cadres de visée qui se calent, puis fondu. Un clic ou une touche le passe. */
(() => {
  const key = window.SUITE_APP, b = window.SUITE_BRAND?.[key]; if (!b) return;
  const css = `.sp-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:${b.bg2};color:#f2f1ec;transition:opacity .55s cubic-bezier(.2,.8,.2,1),visibility .55s;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}
.sp-splash.out{opacity:0;visibility:hidden}
.sp-splash .sp-in{position:relative;display:grid;justify-items:center;gap:22px;padding:34px 46px 26px}
.sp-splash .sp-ic{width:132px;height:132px;animation:sp-pop .8s cubic-bezier(.2,.8,.2,1) both;filter:drop-shadow(0 18px 40px rgba(0,0,0,.45))}
.sp-splash .sp-ic svg{width:100%;height:100%}
.sp-splash h1{margin:0;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;font-weight:900;font-stretch:125%;font-size:46px;letter-spacing:-.03em;line-height:1;animation:sp-up .8s .12s cubic-bezier(.2,.8,.2,1) both}
.sp-splash p{margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;animation:sp-up .8s .22s cubic-bezier(.2,.8,.2,1) both}
.sp-splash .sp-bar{width:180px;height:2px;background:rgba(242,241,236,.14);overflow:hidden}
.sp-splash .sp-bar i{display:block;height:100%;width:100%;background:${key === "pixel" ? b.fg : "#f2f1ec"};transform-origin:left;animation:sp-load 1.05s .1s cubic-bezier(.6,0,.2,1) both}
.sp-splash .c{position:absolute;width:12px;height:12px;border:0 solid rgba(242,241,236,.5);animation:sp-acq .75s cubic-bezier(.2,.8,.2,1) both}
.sp-splash .tl{top:0;left:0;border-top-width:1px;border-left-width:1px;--dx:-14px;--dy:-14px}.sp-splash .tr{top:0;right:0;border-top-width:1px;border-right-width:1px;--dx:14px;--dy:-14px}
.sp-splash .bl{bottom:0;left:0;border-bottom-width:1px;border-left-width:1px;--dx:-14px;--dy:14px}.sp-splash .br{bottom:0;right:0;border-bottom-width:1px;border-right-width:1px;--dx:14px;--dy:14px}
@keyframes sp-acq{0%{transform:translate(var(--dx),var(--dy));opacity:0}35%{opacity:1}48%{opacity:.2}62%{opacity:1}100%{transform:none;opacity:1}}
@keyframes sp-pop{from{transform:scale(.82) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
@keyframes sp-up{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:.99}}
@keyframes sp-load{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.sp-splash *{animation:none!important}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const el = document.createElement("div"); el.className = "sp-splash"; el.setAttribute("aria-hidden", "true");
  const sub = { pdf: "Vos PDF, sur votre appareil", mill: "Vidéos · sons · photos", lyric: "Vidéos de paroles", pixel: "Pixel art & animation" }[key] || "";
  el.innerHTML = `<div class="sp-in"><span class="sp-ic">${window.suiteIcon(key, { size: 132 })}</span><h1>${b.name}</h1><p>${sub}</p><span class="sp-bar"><i></i></span><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i></div>`;
  const put = () => { document.body.appendChild(el); const t = setTimeout(hide, 1350); el.addEventListener("pointerdown", hide, { once: true }); addEventListener("keydown", hide, { once: true }); function hide(){ clearTimeout(t); el.classList.add("out"); setTimeout(() => el.remove(), 700); } };
  if (document.body) put(); else addEventListener("DOMContentLoaded", put);
})();
