/* ============ Marques de la suite ============
   Même construction pour les 4 apps : tuile arrondie (grille 64), couleur propre, glyphe blanc épais,
   et la « pastille locale » (petit carré en haut à droite) qui signe toute la suite : rien ne quitte l'appareil. */
const SUITE_BRAND = {
  pdf: { name: "IdontlovePDF", bg: "#e5484d", bg2: "#c9333a", fg: "#fff",
    glyph: `<path d="M20 14h17l9 9v27H20z" fill="#fff"/><path d="M37 14v9h9" fill="#f7c3c5"/><path d="M27.5 33.5c0-2.6 2-4.5 4.4-4.5 1.5 0 2.6.7 3.1 1.8.5-1.1 1.6-1.8 3.1-1.8 2.4 0 4.4 1.9 4.4 4.5 0 4.6-7.5 9-7.5 9s-7.5-4.4-7.5-9z" fill="#e5484d" transform="translate(-2.5 0)"/><path d="M25.5 41.5L41 27.5" stroke="#1d1d1f" stroke-width="2.8" stroke-linecap="round"/>` },
  mill: { name: "Moulinette", bg: "#2b3dff", bg2: "#1f2bd1", fg: "#fff",
    glyph: `<g fill="#fff"><path d="M32 32V14a9 9 0 0 1 9 9z"/><path d="M32 32h18a9 9 0 0 1-9 9z"/><path d="M32 32v18a9 9 0 0 1-9-9z"/><path d="M32 32H14a9 9 0 0 1 9-9z"/></g><circle cx="32" cy="32" r="3.2" fill="#2b3dff"/>` },
  lyric: { name: "LyricDrop", bg: "#ff5a1f", bg2: "#e2400a", fg: "#fff",
    glyph: `<path d="M15 20.5v23l17-11.5z" fill="#fff"/><g fill="#fff"><rect x="36" y="20" width="14" height="4.6" rx="2.3"/><rect x="36" y="29.7" width="11" height="4.6" rx="2.3" opacity=".85"/><rect x="36" y="39.4" width="7" height="4.6" rx="2.3" opacity=".7"/></g>` },
  pixel: { name: "Pixel Crypte", bg: "#241733", bg2: "#160e21", fg: "#e8b04a",
    glyph: `<g fill="#e8b04a">${[
      "..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", "X..XXX..X", "X..XXX..X", "XXXX.XXXX", ".XXXXXXX.", "..X.X.X.."]
      .flatMap((r, y) => [...r].map((c, x) => c === "X" ? `<rect x="${(12.2 + x * 4.4).toFixed(1)}" y="${(14.4 + y * 4.4).toFixed(1)}" width="4.45" height="4.45"/>` : "")).join("")}</g><rect x="16.6" y="27.6" width="2.2" height="2.2" fill="#ff6b9a"/><rect x="38.6" y="27.6" width="2.2" height="2.2" fill="#ff6b9a"/>` },
  suite: { name: "Ateliers", bg: "#18181b", bg2: "#0b0b0d", fg: "#fff",
    glyph: `<rect x="14" y="14" width="16.5" height="16.5" rx="4" fill="#e5484d"/><rect x="33.5" y="14" width="16.5" height="16.5" rx="4" fill="#2b3dff"/><rect x="14" y="33.5" width="16.5" height="16.5" rx="4" fill="#ff5a1f"/><rect x="33.5" y="33.5" width="16.5" height="16.5" rx="4" fill="#e8b04a"/>` },
};
/* Icône complète (tuile + glyphe + pastille). size en px, plain=true pour une version sans relief (petites tailles) */
function suiteIcon(key, { size = 64, plain = false, round = 15 } = {}){
  const b = SUITE_BRAND[key], id = "g" + key + Math.random().toString(36).slice(2, 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">` +
    (plain ? "" : `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.bg}"/><stop offset="1" stop-color="${b.bg2}"/></linearGradient></defs>`) +
    `<rect width="64" height="64" rx="${round}" fill="${plain ? b.bg : `url(#${id})`}"/>` +
    (plain ? "" : `<rect x=".75" y=".75" width="62.5" height="62.5" rx="${round - .7}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/>`) +
    b.glyph + `<rect x="51" y="7" width="6" height="6" rx="1" fill="${b.fg}" opacity=".95"/></svg>`;
}
/* Remplit les emplacements <span data-suite-logo="pdf"></span> */
function paintSuiteLogos(root = document){ root.querySelectorAll("[data-suite-logo]").forEach(el => { if (!el.firstChild) el.innerHTML = suiteIcon(el.dataset.suiteLogo, { size: +el.dataset.size || 28, plain: true, round: 14 }); }); }
if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => paintSuiteLogos()); else paintSuiteLogos(); }
if (typeof window !== "undefined") { window.SUITE_BRAND = SUITE_BRAND; window.suiteIcon = suiteIcon; }
if (typeof module !== "undefined") module.exports = { SUITE_BRAND, suiteIcon };
