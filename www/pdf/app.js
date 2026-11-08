(() => {
/* ============ Import de fichiers — commun à toute la suite ============
   Reconnaît le vrai format d'un fichier (pas seulement son extension), lit les formats que le navigateur
   ne sait pas lire seul (AIFF, TIFF, HEIC) et donne un message clair quand un fichier ne passe pas. */
const FI = (() => {
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const LIBS = {
    heic2any: "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
    UTIF: "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js",
    pako: "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js",
    Tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    lamejs: "https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js",
  };
  /* Dans les versions installées (Mac, PC, Android), les modules sont livrés dans lib/ : pas besoin d'Internet */
  const LOCAL = { heic2any: "heic2any.min.js", UTIF: "UTIF.js", pako: "pako.min.js", Tesseract: "tesseract/tesseract.min.js", lamejs: "lame.min.js" };
  const localBase = () => window.SUITE_LIB_BASE ? new URL(window.SUITE_LIB_BASE, location.href).href : null;
  const addScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = () => { s.remove(); rej(); }; document.head.appendChild(s); });
  const loading = {};
  /* Charge une bibliothèque à la demande (une seule fois), depuis un CDN autorisé */
  function lib(name){
    if (window[name]) return Promise.resolve(window[name]);
    return loading[name] ||= (async () => {
      const base = localBase();
      if (base && LOCAL[name]) { try { await addScript(base + LOCAL[name]); if (window[name]) return window[name]; } catch {} }
      try { await addScript(LIBS[name]); } catch { delete loading[name]; throw new Error("Cette fonction télécharge un module la première fois : vérifiez la connexion Internet, puis réessayez."); }
      if (window[name]) return window[name];
      delete loading[name]; throw new Error("Bibliothèque incomplète.");
    })();
  }
  const err = msg => Object.assign(new Error(msg), { friendly: true });

  /* ---------- Reconnaître le format ---------- */
  function kindOf(b){
    if (!b.length) return "empty";
    const s = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
    if (s(0, 5) === "%PDF-" || s(0, 1024).includes("%PDF-")) return "pdf";
    if (b[0] === 0x89 && s(1, 3) === "PNG") return "png";
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "jpg";
    if (s(0, 4) === "GIF8") return "gif";
    if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "webp";
    if (s(0, 4) === "RIFF" && s(8, 4) === "WAVE") return "wav";
    if (s(0, 4) === "RIFF" && s(8, 4) === "AVI ") return "avi";
    if (s(0, 2) === "BM" && b.length > 26) return "bmp";
    if (s(0, 4) === "II*\0" || s(0, 4) === "MM\0*") return "tiff";
    if (s(0, 4) === "FORM" && /AIF[FC]/.test(s(8, 4))) return "aiff";
    if (s(0, 4) === "fLaC") return "flac";
    if (s(0, 4) === "OggS") return /OpusHead/.test(s(0, 200)) ? "opus" : "ogg";
    if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return "webm";
    if (s(0, 3) === "ID3") return "mp3";
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return (b[1] & 0x06) === 0 ? "aac" : "mp3";
    if (s(4, 4) === "ftyp") {
      const brands = s(8, Math.min(64, b.length - 8));
      if (/avif|avis/.test(brands)) return "avif";
      if (/heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1/.test(brands.slice(0, 4)) || /heic|heix/.test(brands)) return "heic";
      if (/M4P /.test(brands)) return "m4p";
      if (/M4A |M4B /.test(brands)) return "m4a";
      if (/^qt {2}/.test(brands)) return "mov";
      return "mp4";
    }
    if (/^(\s|﻿)*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(s(0, Math.min(1024, b.length)))) return "svg";
    if (s(0, 4) === "PK\x03\x04") return "zip";
    if (s(0, 4) === "wOFF" || s(0, 4) === "wOF2" || s(0, 4) === "OTTO" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return "font";
    return "unknown";
  }
  const sniff = async f => kindOf(new Uint8Array(await f.slice(0, 4096).arrayBuffer()));
  const FAM = { pdf: "pdf", png: "image", jpg: "image", gif: "image", webp: "image", bmp: "image", tiff: "image", heic: "image", avif: "image", svg: "image",
    mp3: "audio", aac: "audio", wav: "audio", aiff: "audio", flac: "audio", ogg: "audio", opus: "audio", m4a: "audio", m4p: "audio",
    mp4: "video", mov: "video", webm: "video", avi: "video", zip: "archive", font: "font", empty: "empty" };
  const family = k => FAM[k] || "unknown";
  const WHAT = { pdf: "un PDF", image: "une image", audio: "un son", video: "une vidéo", archive: "une archive ZIP", font: "une police" };
  /* Famille d'un fichier : contenu d'abord, extension et type MIME en secours */
  async function familyOf(f){
    const k = await sniff(f), fam = family(k);
    if (fam !== "unknown") return { kind: k, fam };
    const n = f.name || "", t = f.type || "";
    if (/^image\//.test(t) || /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg)$/i.test(n)) return { kind: k, fam: "image" };
    if (/^audio\//.test(t) || /\.(mp3|m4a|aac|wav|aiff?|flac|ogg|opus|weba)$/i.test(n)) return { kind: k, fam: "audio" };
    if (/^video\//.test(t) || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(n)) return { kind: k, fam: "video" };
    if (/pdf/.test(t) || /\.pdf$/i.test(n)) return { kind: k, fam: "pdf" };
    return { kind: k, fam: "unknown" };
  }
  const EMPTY = "Ce fichier est vide (0 octet). S'il vient d'iCloud, Drive ou d'un message, attendez qu'il soit complètement téléchargé, puis réessayez.";
  const wrong = (fam, expected) => fam === "empty" ? EMPTY : `Ce fichier est ${WHAT[fam] || "d'un type inconnu"}, pas ${expected}.`;

  /* Cherche une suite d'octets au début et à la fin d'un gros fichier (les infos MP4 peuvent être en fin de fichier) */
  async function has(f, ...needles){
    const span = 2 << 20, parts = [f.slice(0, span)]; if (f.size > span) parts.push(f.slice(Math.max(span, f.size - span)));
    for (const p of parts) { const u = new Uint8Array(await p.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 65536) s += String.fromCharCode.apply(null, u.subarray(i, i + 65536));
      for (const n of needles) if (s.includes(n)) return n; }
    return null;
  }

  /* ---------- Son ---------- */
  function decodeAiff(ab, ctx){
    const v = new DataView(ab), str = (o, n) => String.fromCharCode(...new Uint8Array(ab, o, n));
    const aifc = str(8, 4) === "AIFC"; let ch = 0, frames = 0, bits = 16, rate = 44100, data = -1, le = false;
    for (let o = 12; o + 8 <= ab.byteLength;) {
      const id = str(o, 4), len = v.getUint32(o + 4);
      if (id === "COMM") {
        ch = v.getInt16(o + 8); frames = v.getUint32(o + 10); bits = v.getInt16(o + 14);
        const e = v.getUint16(o + 16) & 0x7FFF, hi = v.getUint32(o + 18), lo = v.getUint32(o + 22); rate = (hi * 2 ** 32 + lo) * 2 ** (e - 16383 - 63);
        if (aifc) { const c = str(o + 26, 4); if (c === "sowt") le = true; else if (c !== "NONE" && c !== "twos") throw err("Ce fichier AIFF est compressé dans un format non pris en charge. Exportez-le en WAV ou en AIFF standard."); }
      } else if (id === "SSND") data = o + 16 + v.getUint32(o + 8);
      o += 8 + len + (len & 1);
    }
    if (!ch || data < 0 || !rate) throw err("Ce fichier AIFF est incomplet.");
    const B = Math.ceil(bits / 8); frames = Math.min(frames, Math.floor((ab.byteLength - data) / (B * ch)));
    const buf = (ctx.createBuffer ? ctx.createBuffer(ch, Math.max(1, frames), Math.round(rate)) : new AudioBuffer({ numberOfChannels: ch, length: Math.max(1, frames), sampleRate: Math.round(rate) }));
    const outs = [...Array(ch)].map((_, c) => buf.getChannelData(c)), u = new Uint8Array(ab), full = 2 ** (B * 8 - 1);
    for (let i = 0, p = data; i < frames; i++) for (let c = 0; c < ch; c++, p += B) {
      let x = 0; if (le) for (let k = B - 1; k >= 0; k--) x = x * 256 + u[p + k]; else for (let k = 0; k < B; k++) x = x * 256 + u[p + k];
      if (x >= full) x -= full * 2; outs[c][i] = x / full;
    }
    return buf;
  }
  async function audioError(f, kind){
    const fam = family(kind);
    if (kind === "empty") return EMPTY;
    if (kind === "m4p") return "Ce morceau est protégé contre la copie (Apple Music ou ancien achat iTunes) : aucune autre app ne peut l'ouvrir. Utilisez le fichier original (MP3, WAV, M4A non protégé).";
    if (fam === "image" || fam === "pdf" || fam === "archive" || fam === "font") return wrong(fam, "un son");
    if (fam === "video" || kind === "m4a" || kind === "mp4") {
      const k = await has(f, "alac", "mp4a", "soun");
      if (k === "alac") return "Ce son est en Apple Lossless (ALAC), un format que ce navigateur ne lit pas. Exportez-le en AAC, MP3 ou WAV (dans Musique : Fichier › Convertir), puis réessayez.";
      if (k !== "mp4a" && k !== "soun" && fam === "video") return "Cette vidéo n'a pas de piste son.";
    }
    if (kind === "webm" && fam === "video") return "Cette vidéo n'a pas de son, ou son format audio n'est pas lisible ici.";
    if (kind === "ogg" || kind === "opus") return "Ce navigateur ne lit pas l'OGG / Opus. Mettez l'appareil à jour (iOS 17 ou plus) ou utilisez un MP3, M4A ou WAV.";
    if (kind === "flac") return "Ce navigateur ne lit pas le FLAC. Mettez-le à jour ou utilisez un WAV ou un MP3.";
    if (/\.wma$/i.test(f.name)) return "Le WMA (Windows Media) n'est lisible par aucun navigateur. Convertissez-le en MP3.";
    if (/\.(mid|midi)$/i.test(f.name)) return "Un fichier MIDI contient des notes, pas du son enregistré. Exportez d'abord le morceau en WAV ou MP3 depuis votre logiciel de musique.";
    return "Ce son n'a pas pu être lu : le fichier est abîmé ou dans un format inconnu. Essayez en MP3, M4A ou WAV.";
  }
  /* Décode un son en AudioBuffer. ctx = AudioContext de l'app */
  async function decodeAudio(f, ctx){
    const ab = f instanceof ArrayBuffer ? f : await f.arrayBuffer(), file = f instanceof Blob ? f : new Blob([ab]);
    const kind = kindOf(new Uint8Array(ab, 0, Math.min(4096, ab.byteLength)));
    if (kind === "empty") throw err(EMPTY);
    if (kind === "aiff") return decodeAiff(ab, ctx);
    try {
      return await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab.slice(0), res, rej); if (p && p.catch) p.catch(() => {}); });
    } catch { throw err(await audioError(file, kind)); }
  }

  /* ---------- Images ---------- */
  function viaImg(blob){
    return new Promise(res => { const url = URL.createObjectURL(blob), i = new Image();
      i.onload = () => { URL.revokeObjectURL(url); const w = i.naturalWidth || 1024, h = i.naturalHeight || 1024, c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(i, 0, 0, w, h); res(c); };
      i.onerror = () => { URL.revokeObjectURL(url); res(null); }; i.src = url; });
  }
  /* Ouvre une image (JPG, PNG, WEBP, GIF, BMP, AVIF, SVG, HEIC, TIFF) et la réduit à `max` px si besoin.
     Renvoie un ImageBitmap ou un canvas, tous deux dessinables avec drawImage. */
  async function image(f, { max = 0 } = {}){
    const { kind, fam } = await familyOf(f);
    if (kind === "empty") throw err(EMPTY);
    if (fam !== "image" && fam !== "unknown") throw err(wrong(fam, "une image"));
    let img = null;
    if (kind !== "svg") { try { img = await createImageBitmap(f, { imageOrientation: "from-image" }); } catch { try { img = await createImageBitmap(f); } catch {} } }
    if (!img && kind !== "heic" && kind !== "tiff") img = await viaImg(f);
    if (!img && kind === "heic") {
      try { const h = await lib("heic2any"); let o = await h({ blob: f, toType: "image/jpeg", quality: .92 }); if (Array.isArray(o)) o = o[0]; img = await createImageBitmap(o); }
      catch (e) { throw err(e.friendly || /connexion/.test(e.message) ? e.message : "Cette photo HEIC n'a pas pu être lue. Sur iPhone, réglez Appareil photo › Formats › « Le plus compatible », ou envoyez-la en JPG."); }
    }
    if (!img && kind === "tiff") {
      try { await lib("pako").catch(() => {}); const U = await lib("UTIF"), buf = await f.arrayBuffer(), ifds = U.decode(buf); U.decodeImage(buf, ifds[0]);
        const rgba = U.toRGBA8(ifds[0]); img = await createImageBitmap(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), ifds[0].width, ifds[0].height)); }
      catch (e) { throw err(/connexion/.test(e.message) ? e.message : "Cette image TIFF n'a pas pu être lue. Enregistrez-la en PNG ou JPG, puis réessayez."); }
    }
    if (!img) throw err(kind === "avif" ? "Ce navigateur ne lit pas l'AVIF. Mettez-le à jour, ou enregistrez l'image en JPG ou PNG." : "Cette image n'a pas pu être lue : le fichier est abîmé ou dans un format inconnu. Essayez en JPG ou PNG.");
    if (max && Math.max(img.width, img.height) > max) {
      const k = max / Math.max(img.width, img.height), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, c.width, c.height); img.close?.(); img = c;
    }
    return img;
  }
  /* Image → Blob JPG/PNG (pour les apps qui gardent un fichier) */
  async function imageBlob(f, { max = 0, type = "image/png", quality = .9 } = {}){
    const { kind } = await familyOf(f);
    if (!max && ["jpg", "png", "webp", "gif"].includes(kind)) return f;
    const img = await image(f, { max }); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0);
    return new Promise(r => c.toBlob(r, type, quality));
  }

  /* ---------- Vidéo : repère les cas qu'un navigateur ne sait pas lire ---------- */
  async function videoProblem(f){
    const { kind, fam } = await familyOf(f);
    if (kind === "empty") return EMPTY;
    if (fam === "audio" || kind === "m4a") return "Ce fichier est un son, sans image.";
    if (fam !== "video" && fam !== "unknown") return wrong(fam, "une vidéo");
    if (kind === "mp4" || kind === "mov") {
      const k = await has(f, "hvc1", "hev1", "vide");
      if (k === "hvc1" || k === "hev1") return "hevc";
      if (!k) return "Ce fichier ne contient pas d'image vidéo.";
    }
    return null;
  }
  const HEVC = "Vidéo HEVC (format des iPhone) que ce navigateur ne sait pas lire. Sur Windows, installez « Extensions vidéo HEVC » depuis le Microsoft Store ou utilisez Edge ; sur iPhone, ouvrez l'app dans Safari. Pour les prochaines vidéos : Réglages › Appareil photo › Formats › « Le plus compatible ».";

  /* ---------- Sélecteurs de fichiers ---------- */
  /* Sur iPhone/iPad, un accept avec une extension « maison » (.lrc, .gpl…) grise ces fichiers : on le retire. */
  const CUSTOM = /\.(lyricstyle|lyricdrop|lrc|srt|gpl|hex|pixelcrypte|ase|aseprite|ttf|otf|woff2?)\b/i;
  function fixAccepts(){ if (!IOS) return; document.querySelectorAll('input[type=file][accept]').forEach(i => { if (CUSTOM.test(i.accept)) i.removeAttribute("accept"); }); }
  if (IOS) { document.addEventListener("click", fixAccepts, true); setTimeout(fixAccepts, 0); }

  /* Dépôt de fichiers partout dans la page (glisser-déposer) */
  function onDrop(cb){
    let depth = 0;
    addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { depth++; document.body.classList.add("dragging"); } });
    addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; document.body.classList.remove("dragging"); } });
    addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
    addEventListener("drop", e => { const files = [...(e.dataTransfer?.files || [])]; depth = 0; document.body.classList.remove("dragging"); if (!files.length) return; e.preventDefault(); cb(files, e); });
  }

  return { IOS, lib, localBase, kindOf, sniff, family, familyOf, decodeAudio, image, imageBlob, videoProblem, HEVC, EMPTY, wrong, fixAccepts, onDrop };
})();

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

"use strict";
/* ============ Utilitaires ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const svgNS = "http://www.w3.org/2000/svg";
const A4 = [595.28, 841.89], LETTER = [612, 792];
const MM = 72 / 25.4;
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSize = b => b < 1024 ? b + " o" : b < 1048576 ? Math.round(b / 1024) + " Ko" : (b / 1048576).toFixed(1).replace(".", ",") + " Mo";
const plural = (n, s, p) => n + " " + (n > 1 ? (p || s + "s") : s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const toHex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
const baseName = n => (n || "document").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "document";
const isPdfFile = f => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImgFile = f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);

const P = {
  logo: "M12 20.5S3.5 15.3 3.5 9.3A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.3c0 6-8.5 11.2-8.5 11.2z M12 7l-1.6 4 3 1.6-1.4 3.6",
  merge: "M4 4h6v7H4z M14 4h6v7h-6z M7 11v3h10v-3 M12 14v6 M9 17l3 3 3-3",
  split: "M7 3h10v7H7z M12 10v3 M6 13h12 M6 13v3 M18 13v3 M3 16h6v5H3z M15 16h6v5h-6z",
  trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
  extract: "M14 3H6v18h12V9z M14 3v6h6 M8 15h8 M13 12l3 3-3 3",
  organize: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  rotate: "M20 12a8 8 0 1 1-2.34-5.66 M20 4v5h-5",
  rotl: "M4 12a8 8 0 1 0 2.34-5.66 M4 4v5h5",
  compress: "M12 3v6 M9 6l3 3 3-3 M12 21v-6 M9 18l3-3 3 3 M4 12h16",
  crop: "M6 2v14a2 2 0 0 0 2 2h14 M18 22V8a2 2 0 0 0-2-2H2",
  img2pdf: "M3 4h11v11H3z M3 12l3.5-3.5 3 3 2-2 2.5 2.5 M15 9h6v12H9v-3",
  pdf2img: "M5 3h9l5 5v13H5z M14 3v5h5 M8 18l3-3 2 2 3-3 M9.5 12h.01",
  txt: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6 M9 8h2",
  lines: "M5 5h14 M5 10h14 M5 15h10 M5 20h6",
  word: "M5 3h9l5 5v13H5z M14 3v5h5 M8 12l1.5 6 2.5-4.5 2.5 4.5 1.5-6",
  pen: "M4 20l1.2-4.2L16 5a2.1 2.1 0 0 1 3 3L8.2 18.8z M14 7l3 3",
  sign: "M3 16c2.5-5 4.5-9 6-9 1.8 0-.5 8 1.5 8s2.5-4 4-4c1.2 0 1 3 2.5 3 1 0 2-1 4-1 M3 20h18",
  redact: "M3 5h18 M3 19h18 M4 9h16v6H4z",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  hash: "M5 9h14 M4 15h14 M10 3L8 21 M16 3l-2 18",
  forms: "M4 4h5v5H4z M5.5 6.5l1 1 2-2.5 M12 6.5h8 M4 14h5v5H4z M12 16.5h8",
  lock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4 M12 15v2",
  unlock: "M6 11h12v10H6z M8 11V7a4 4 0 0 1 7.6-1.7 M12 15v2",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01",
  back: "M15 18l-6-6 6-6", next: "M9 6l6 6-6 6",
  plus: "M12 5v14 M5 12h14", minus: "M5 12h14", x: "M6 6l12 12 M18 6L6 18",
  undo: "M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  apps: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 14v6 M14 17h6",
  sliders: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4",
  install: "M12 3v12 M7 10l5 5 5-5 M5 21h14",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  check: "M5 12l5 5 9-10",
  select: "M6 3l12 9-5.5 1.2L15.5 20l-2.6 1.2-2.6-6.6L6 18z",
  text: "M5 7V5h14v2 M12 5v14 M9 19h6",
  retouch: "M3 7V5h11v2 M8.5 5v14 M6 19h5 M18 4v16 M16 4h4 M16 20h4",
  marker: "M14.5 4.5l5 5L11 18H6v-5z M4 21h14",
  mask: "M3 6h18v12H3z M7 10h10 M7 14h6",
  image: "M4 5h16v14H4z M4 16l5-5 4 4 2-2 5 5 M15.5 9.5h.01",
  shape: "M4 4h8v8H4z M17 13a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M14 4l6 6",
  blank: "M6 3h8l4 4v14H6z M14 3v4h4 M12 11v6 M9 14h6",
  upload: "M12 20V8 M7 13l5-5 5 5 M5 4h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  reverse: "M7 4v16 M4 7l3-3 3 3 M17 20V4 M14 17l3 3 3-3",
  up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
  s_rect: "M4 6h16v12H4z", s_ellipse: "M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z",
  s_line: "M5 19L19 5", s_arrow: "M5 19L19 5 M10 5h9v9", s_check: "M5 12.5l4.5 4.5L19 7", s_cross: "M6 6l12 12 M18 6L6 18"
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || ""}"/></svg>`;
function paintIcons(root = document){ root.querySelectorAll("[data-icon]").forEach(el => { if (!el.dataset.iconDone) { el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)); el.dataset.iconDone = 1; } }); }

/* ============ État ============ */
function freshDoc(){
  return {
    name: "document", pages: [],
    wm: { on: false, mode: "text", text: "CONFIDENTIEL", img: null, size: 60, opacity: .18, angle: 35, pos: "mc", tile: false, color: "#e5484d" },
    num: { on: false, pos: "bc", fmt: "nof", start: 1, size: 10, margin: 26, skipFirst: false },
    hf: { on: false, tl: "", tc: "", tr: "", bl: "", bc: "", br: "", size: 9, margin: 24, color: "#3d4048", skipFirst: false },
    forms: {}, formsFlatten: false, meta: null,
    txt: null, txtOpts: { font: "Helvetica", size: 11, margin: 20, page: "A4" },
    imgOpts: { page: "A4", orient: "auto", margin: "small" }
  };
}
const S = {
  view: "home", tool: null, wview: "grid",
  doc: freshDoc(), cur: 0,
  sel: new Set(), annSel: null, editing: null, etool: "select", zoom: null,
  props: { color: "#16171b", size: 16, font: "Helvetica", bold: false, width: 3, hl: "#ffd84d", shape: "rect" },
  protect: { user: "", confirm: "", owner: "", print: true, copy: true, modify: false, show: false },
  busy: false
};
const sources = [];   // {bytes, name, raster:null|"password"|"restricted"|"broken", password, pageCount, size, pdfP}
const images = {};    // id -> {bytes, kind, url, el, w, h}
const pages = () => S.doc.pages;
const cur = () => S.doc.pages[S.cur];
const rotOf = p => (((p.baseRot + p.rot) % 360) + 360) % 360;
const pageIdx = id => S.doc.pages.findIndex(p => p.id === id);
function pruneSel(){ for (const id of [...S.sel]) if (pageIdx(id) < 0) S.sel.delete(id); }

/* ============ Annuler / Rétablir ============ */
const undoS = [], redoS = [];
const snapState = () => JSON.stringify({ pages: S.doc.pages, cur: S.cur });
function snapshot(){ undoS.push(snapState()); if (undoS.length > 120) undoS.shift(); redoS.length = 0; updUndo(); }
function applySnap(str){ const st = JSON.parse(str); S.doc.pages = st.pages; S.cur = clamp(st.cur, 0, Math.max(0, S.doc.pages.length - 1)); S.annSel = null; pruneSel(); }
function undo(){ if (S.editing) finishEditing(true); if (!undoS.length) return; redoS.push(snapState()); applySnap(undoS.pop()); docChanged(); }
function redo(){ if (S.editing) finishEditing(true); if (!redoS.length) return; undoS.push(snapState()); applySnap(redoS.pop()); docChanged(); }
function updUndo(){ const u = $("#btnUndo"), r = $("#btnRedo"); if (u) u.disabled = !undoS.length; if (r) r.disabled = !redoS.length; }
function resetHistory(){ undoS.length = 0; redoS.length = 0; updUndo(); }

/* ============ Petites aides UI ============ */
let toastT;
function toast(msg, ms = 2800){ const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); if (ms) toastT = setTimeout(() => t.hidden = true, ms); }
function openModal(id){ $(id).hidden = false; }
function closeModal(id){ $(id).hidden = true; }
let chooseResolve = null;
function choose(title, msg, buttons){
  return new Promise(res => {
    chooseResolve = res;
    $("#chT").textContent = title; $("#chM").textContent = msg || ""; $("#chM").hidden = !msg;
    const box = $("#chB"); box.innerHTML = "";
    buttons.forEach(b => {
      const el = document.createElement("button");
      el.className = "btn " + (b.primary ? "primary" : b.danger ? "ghost danger" : "ghost"); el.textContent = b.label;
      el.onclick = () => { closeModal("#mChoose"); chooseResolve = null; res(b.v); };
      box.appendChild(el);
    });
    openModal("#mChoose");
  });
}
function bindModals(){
  $$(".modal").forEach(m => {
    m.addEventListener("pointerdown", e => { if (e.target === m) m.dataset.down = "1"; });
    m.addEventListener("click", e => {
      if ((e.target === m && m.dataset.down) || e.target.closest("[data-close]")) {
        if (m.id === "mPass") pwResolve?.(null);
        else { m.hidden = true; if (m.id === "mChoose") { chooseResolve?.(null); chooseResolve = null; } }
      }
      delete m.dataset.down;
    });
  });
}
let pwResolve = null;
function askPassword(name, wrong){
  return new Promise(res => {
    $("#pwM").textContent = `« ${name} » est protégé par un mot de passe.`;
    $("#pwErr").textContent = wrong ? "Mot de passe incorrect. Réessayez." : "";
    $("#pwIn").value = "";
    const done = v => { closeModal("#mPass"); pwResolve = null; res(v); };
    pwResolve = done;
    $("#pwOk").onclick = () => done($("#pwIn").value);
    $("#pwCancel").onclick = () => done(null);
    $("#pwIn").onkeydown = e => { if (e.key === "Enter") done($("#pwIn").value); if (e.key === "Escape") { e.stopPropagation(); done(null); } };
    openModal("#mPass"); setTimeout(() => $("#pwIn").focus(), 50);
  });
}

/* ============ Bibliothèques ============ */
let pdfjsP;
function pdfjsReady(){
  return pdfjsP ||= new Promise((res, rej) => {
    const done = () => {
      const L = window.pdfjsLib;
      if (window.PDFJS_WORKER && !L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = window.PDFJS_WORKER;
      res(L);
    };
    if (window.pdfjsLib) return done();
    window.addEventListener("pdfjsready", done, { once: true });
    setTimeout(() => window.pdfjsLib ? done() : rej(new Error("Le lecteur PDF n'a pas pu se charger.")), 20000);
  });
}
async function openPdf(bytes, password){
  const L = await pdfjsReady();
  return L.getDocument({ data: bytes.slice(), password: password || undefined, isEvalSupported: false }).promise;
}
function getPdf(i){
  const s = sources[i];
  if (!s.pdfP) {
    s.pdfP = (async () => {
      let wrong = false;
      for (;;) {
        try { return await openPdf(s.bytes, s.password); }
        catch (e) {
          if (e?.name !== "PasswordException") throw e;
          const pw = await askPassword(s.name, wrong);
          if (pw == null) throw new Error("Mot de passe requis");
          s.password = pw; wrong = true;
        }
      }
    })();
    s.pdfP.catch(() => { s.pdfP = null; });
  }
  return s.pdfP;
}

/* ============ Chargement des fichiers ============ */
async function readFile(f){ return new Uint8Array(await f.arrayBuffer()); }
async function addImage(blob){
  const kind = await FI.sniff(blob), src = await FI.image(blob, { max: 2600 });
  const c = document.createElement("canvas");
  c.width = Math.max(1, src.width); c.height = Math.max(1, src.height);
  const jpg = ["jpg", "webp", "bmp", "heic", "tiff", "avif"].includes(kind) || /jpe?g|webp|bmp/.test(blob.type);
  const ctx = c.getContext("2d");
  if (jpg) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(src, 0, 0, c.width, c.height); src.close?.();
  const out = await new Promise(r => c.toBlob(r, jpg ? "image/jpeg" : "image/png", .9));
  return storeImage(new Uint8Array(await out.arrayBuffer()), jpg ? "jpg" : "png", c.width, c.height);
}
async function storeImage(bytes, kind, w, h, id = uid()){
  const url = URL.createObjectURL(new Blob([bytes], { type: kind === "jpg" ? "image/jpeg" : "image/png" }));
  const el = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  images[id] = { bytes, kind, url, el, w, h };
  return id;
}
function blankPage(w = A4[0], h = A4[1]){ return { id: uid(), kind: "blank", w, h, ox: 0, oy: 0, baseRot: 0, rot: 0, annots: [] }; }

async function loadPdfBytes(bytes, name){
  let password, pdf, wrong = false;
  for (;;) {
    try { pdf = await openPdf(bytes, password); break; }
    catch (e) {
      if (e?.name === "PasswordException") {
        $("#toast").hidden = true;
        password = await askPassword(name, wrong);
        if (password == null) return null;
        wrong = true; continue;
      }
      throw e;
    }
  }
  let raster = password ? "password" : null;
  if (!raster) {
    try { const d = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }); if (d.isEncrypted) raster = "restricted"; }
    catch { raster = "broken"; }
  }
  const src = sources.push({ bytes, name, raster, password, pageCount: pdf.numPages, size: bytes.length, pdfP: Promise.resolve(pdf) }) - 1;
  const out = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const pg = await pdf.getPage(i + 1);
    const [x1, y1, x2, y2] = pg.view;
    out.push({ id: uid(), kind: "pdf", src, index: i, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), ox: Math.min(x1, x2), oy: Math.min(y1, y2), baseRot: pg.rotate || 0, rot: 0, annots: [] });
  }
  return out;
}
async function imagePage(file){
  const id = await addImage(file);
  const p = blankPage(); p.fromImg = id; p.annots.push({ id: uid(), type: "image", img: id, x: 0, y: 0, w: 10, h: 10, fromImg: true });
  layoutImagePage(p);
  return p;
}
function layoutImagePage(p){
  const o = S.doc.imgOpts, im = images[p.fromImg]; if (!im) return;
  const a = p.annots.find(x => x.fromImg); if (!a) return;
  const marg = { none: 0, small: 20, big: 48 }[o.margin] ?? 20;
  const land = o.orient === "land" || (o.orient === "auto" && im.w > im.h);
  let W, H;
  if (o.page === "fit") { const k = 0.75; W = im.w * k + marg * 2; H = im.h * k + marg * 2; if (Math.max(W, H) > 2000) { const f = 2000 / Math.max(W, H); W *= f; H *= f; } }
  else { const base = o.page === "letter" ? LETTER : A4; [W, H] = land ? [base[1], base[0]] : base; }
  const k = Math.min((W - marg * 2) / im.w, (H - marg * 2) / im.h);
  const w = im.w * k, h = im.h * k;
  p.w = W; p.h = H; Object.assign(a, { x: (W - w) / 2, y: (H - h) / 2, w, h });
}

async function loadFiles(files, { accept = "any" } = {}){
  toast("Ouverture…", 0);
  const added = [], errors = [];
  for (const f of files) {
    try {
      const { fam } = await FI.familyOf(f);
      if (fam === "empty") errors.push(`${f.name} : fichier vide (pas encore téléchargé ?)`);
      else if (fam === "pdf" && accept !== "img") { const r = await loadPdfBytes(await readFile(f), f.name); if (r) added.push(...r); }
      else if (fam === "image" && accept !== "pdf") added.push(await imagePage(f));
      else errors.push(`${f.name} : ${fam === "pdf" ? "un PDF, pas une image" : fam === "image" ? "une image, pas un PDF" : fam === "unknown" ? "format non pris en charge" : FI.wrong(fam, accept === "img" ? "une image" : "un PDF").replace(/^Ce fichier est /, "").replace(/\.$/, "")}`);
    } catch (err) {
      console.error(err);
      errors.push(`${f.name} : ${err.friendly ? err.message.replace(/\.$/, "") : "fichier illisible ou abîmé"}`);
    }
  }
  $("#toast").hidden = true;
  if (errors.length) setTimeout(() => toast(errors.join(" · "), 5500), 50);
  return added;
}

/* ============ Enregistrement des fichiers ============ */
const downloadsP = window.claude?.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function saveFile(filename, data, mime = "application/pdf"){
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const dl = await downloadsP;
  if (dl) {
    try { await dl.save({ filename, data: blob }); return true; }
    catch (e) {
      if (e?.code === "declined") return false;
      if (e?.code === "rate_limited") throw new Error("Une demande d'enregistrement est déjà ouverte.");
      if (e?.code === "too_large") throw new Error("Le fichier est trop volumineux pour être enregistré ici.");
      throw new Error("L'enregistrement n'est pas disponible dans cette vue.");
    }
  }
  if (window.idlpNative?.saveFile) return window.idlpNative.saveFile(filename, new Uint8Array(await blob.arrayBuffer()));
  const Cap = window.Capacitor;
  if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem) {
    const { Filesystem, Share } = Cap.Plugins;
    const b64 = await blobToB64(blob);
    let saved = false;
    try { await Filesystem.writeFile({ path: "IdontlovePDF/" + filename, data: b64, directory: "DOCUMENTS", recursive: true }); saved = true; } catch {}
    try {
      const r = await Filesystem.writeFile({ path: filename, data: b64, directory: "CACHE" });
      if (Share) await Share.share({ title: filename, files: [r.uri] });
    } catch {}
    if (saved) toast("Enregistré dans Documents/IdontlovePDF");
    return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/* ============ Zip (sans compression) ============ */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b){ let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files){
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nm);
    offset += 30 + nm.length + sz;
  }
  const cd = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

/* ============ Persistance locale (IndexedDB) ============ */
const DB = (() => {
  let dbP;
  const open = () => dbP ||= new Promise((res, rej) => {
    try { const r = indexedDB.open("idontlovepdf", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("kv", mode); const st = t.objectStore("kv"); const out = fn(st); t.oncomplete = () => res(out?.result); t.onerror = () => rej(t.error); }); };
  return {
    get: k => tx("readonly", st => st.get(k)).catch(() => undefined),
    set: (k, v) => tx("readwrite", st => st.put(v, k)).catch(() => {}),
    del: k => tx("readwrite", st => st.delete(k)).catch(() => {}),
    keys: () => tx("readonly", st => st.getAllKeys()).catch(() => [])
  };
})();
const written = new Set();
let persistT;
function persistSoon(){ clearTimeout(persistT); persistT = setTimeout(persist, 700); }
async function persist(){
  if (!S.doc.pages.length) return;
  try {
    for (let i = 0; i < sources.length; i++) if (!written.has("src:" + i)) { await DB.set("src:" + i, sources[i].bytes); written.add("src:" + i); }
    for (const id of Object.keys(images)) if (!written.has("img:" + id)) { const im = images[id]; await DB.set("img:" + id, { bytes: im.bytes, kind: im.kind, w: im.w, h: im.h }); written.add("img:" + id); }
    const d = S.doc;
    await DB.set("state", {
      v: 1, savedAt: Date.now(), tool: S.tool, wview: S.wview, cur: S.cur,
      doc: { ...d, wm: { ...d.wm }, hf: { ...d.hf } },
      sources: sources.map(s => ({ name: s.name, raster: s.raster, pageCount: s.pageCount, size: s.size })),
      images: Object.keys(images)
    });
  } catch (e) { console.warn("persist", e); }
}
async function clearStore(){
  const keys = await DB.keys();
  for (const k of keys) if (k !== "sigs") await DB.del(k);
  written.clear();
}
async function restoreSaved(st){
  sources.length = 0;
  for (let i = 0; i < st.sources.length; i++) {
    const bytes = await DB.get("src:" + i); if (!bytes) throw new Error("source manquante");
    sources.push({ ...st.sources[i], bytes, password: null, pdfP: null }); written.add("src:" + i);
  }
  for (const k of Object.keys(images)) delete images[k];
  for (const id of st.images) { const im = await DB.get("img:" + id); if (im) { await storeImage(im.bytes, im.kind, im.w, im.h, id); written.add("img:" + id); } }
  S.doc = Object.assign(freshDoc(), st.doc);
  S.doc.wm = Object.assign(freshDoc().wm, st.doc.wm); S.doc.num = Object.assign(freshDoc().num, st.doc.num); S.doc.hf = Object.assign(freshDoc().hf, st.doc.hf);
  S.cur = clamp(st.cur || 0, 0, S.doc.pages.length - 1); S.sel.clear(); resetHistory();
}

/* ============ Rendu ============ */
const FONTS = {
  Helvetica: { label: "Sans", css: "Helvetica, Arial, sans-serif", std: ["Helvetica", "HelveticaBold"] },
  Times: { label: "Serif", css: '"Times New Roman", Times, serif', std: ["TimesRoman", "TimesRomanBold"] },
  Courier: { label: "Machine", css: '"Courier New", Courier, monospace', std: ["Courier", "CourierBold"] }
};

const rq = []; let rqActive = 0;
function queueRender(fn){ return new Promise((res, rej) => { rq.push({ fn, res, rej }); pumpRq(); }); }
function pumpRq(){ while (rqActive < 2 && rq.length) { const t = rq.shift(); rqActive++; t.fn().then(t.res, t.rej).finally(() => { rqActive--; pumpRq(); }); } }

const baseCache = new Map();
function renderBase(p, pxW, nocache){
  const W = nocache ? Math.round(pxW) : Math.ceil(pxW / 64) * 64;
  const key = `${p.src}:${p.index}:${W}`;
  if (!nocache && baseCache.has(key)) return baseCache.get(key);
  const prom = (async () => {
    const pdf = await getPdf(p.src);
    const pg = await pdf.getPage(p.index + 1);
    const vp = pg.getViewport({ scale: W / p.w, rotation: 0 });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(vp.width)); c.height = Math.max(1, Math.ceil(vp.height));
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  })();
  if (!nocache) {
    prom.catch(() => baseCache.delete(key));
    baseCache.set(key, prom);
    if (baseCache.size > 120) baseCache.delete(baseCache.keys().next().value);
  }
  return prom;
}

/* Géométrie des formes, en coordonnées de la boîte (pt) */
function shapePath(a, dx = 0, dy = 0){
  const f = n => n.toFixed(2), X = v => f(dx + v), Y = v => f(dy + v), w = a.w, h = a.h;
  if (a.shape === "check") return `M${X(w * .1)} ${Y(h * .55)} L${X(w * .4)} ${Y(h * .88)} L${X(w * .92)} ${Y(h * .12)}`;
  if (a.shape === "cross") return `M${X(w * .12)} ${Y(h * .12)} L${X(w * .88)} ${Y(h * .88)} M${X(w * .88)} ${Y(h * .12)} L${X(w * .12)} ${Y(h * .88)}`;
  const x1 = a.fx ? w : 0, y1 = a.fy ? h : 0, x2 = a.fx ? 0 : w, y2 = a.fy ? 0 : h;
  let d = `M${X(x1)} ${Y(y1)} L${X(x2)} ${Y(y2)}`;
  if (a.shape === "arrow") {
    const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.max(9, a.width * 4), s = 0.5;
    d += ` M${X(x2 - L * Math.cos(ang - s))} ${Y(y2 - L * Math.sin(ang - s))} L${X(x2)} ${Y(y2)} L${X(x2 - L * Math.cos(ang + s))} ${Y(y2 - L * Math.sin(ang + s))}`;
  }
  return d;
}
const isPathShape = a => a.type === "shape" && !["rect", "ellipse"].includes(a.shape);

function drawAnnots(ctx, p, s, onlyRedact){
  for (const a of p.annots) {
    if (onlyRedact ? a.kind !== "redact" : a.kind === "redact" && onlyRedact === false) continue;
    ctx.save();
    if (a.type === "rect") {
      if (a.kind === "highlight") { ctx.globalAlpha = .4; ctx.globalCompositeOperation = "multiply"; }
      ctx.fillStyle = a.kind === "redact" ? "#000" : a.color; ctx.fillRect(a.x * s, a.y * s, a.w * s, a.h * s);
    } else if (a.type === "draw") {
      ctx.strokeStyle = a.color; ctx.lineWidth = a.width * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      a.pts.forEach(([x, y], i) => { const X = (a.x + x) * s, Y = (a.y + y) * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      if (a.pts.length === 1) ctx.lineTo((a.x + a.pts[0][0]) * s + .01, (a.y + a.pts[0][1]) * s);
      ctx.stroke();
    } else if (a.type === "shape") {
      ctx.strokeStyle = a.color; ctx.lineWidth = a.width * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (a.shape === "rect") ctx.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
      else if (a.shape === "ellipse") { ctx.beginPath(); ctx.ellipse((a.x + a.w / 2) * s, (a.y + a.h / 2) * s, a.w / 2 * s, a.h / 2 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.scale(s, s); ctx.lineWidth = a.width; ctx.stroke(new Path2D(shapePath(a, a.x, a.y))); }
    } else if (a.type === "text") {
      ctx.fillStyle = a.color; ctx.font = `${a.bold ? "700 " : ""}${a.size * s}px ${FONTS[a.font].css}`;
      a.text.split("\n").forEach((l, i) => ctx.fillText(l, a.x * s, (a.y + a.size * (0.9 + 1.2 * i)) * s));
    } else if (a.type === "image") {
      const im = images[a.img]; if (im?.el) ctx.drawImage(im.el, a.x * s, a.y * s, a.w * s, a.h * s);
    }
    ctx.restore();
  }
}

/* Boîte visible (recadrage) en coordonnées non pivotées */
function visualBox(p){ const c = p.crop || { l: 0, t: 0, r: 0, b: 0 }; return { x: c.l, y: c.t, w: Math.max(10, p.w - c.l - c.r), h: Math.max(10, p.h - c.t - c.b) }; }
function visDims(p, box){ const r = rotOf(p); return r % 180 ? [box.h, box.w] : [box.w, box.h]; }
/* Coin haut-gauche (visuel) de la boîte dans la page pivotée complète */
function boxVisualOffset(p, box){
  const r = rotOf(p);
  if (r === 90) return [p.h - (box.y + box.h), box.x];
  if (r === 180) return [p.w - (box.x + box.w), p.h - (box.y + box.h)];
  if (r === 270) return [box.y, p.w - (box.x + box.w)];
  return [box.x, box.y];
}
/* Marges visuelles <-> marges non pivotées */
function cropToUnrot(r, v){
  if (r === 90) return { l: v.t, t: v.r, r: v.b, b: v.l };
  if (r === 180) return { l: v.r, t: v.b, r: v.l, b: v.t };
  if (r === 270) return { l: v.b, t: v.l, r: v.t, b: v.r };
  return { ...v };
}
function cropToVis(r, u){
  if (r === 90) return { t: u.l, r: u.t, b: u.r, l: u.b };
  if (r === 180) return { r: u.l, b: u.t, l: u.r, t: u.b };
  if (r === 270) return { b: u.l, l: u.t, t: u.r, r: u.b };
  return { ...u };
}

/* Tampons (filigrane, numéros) dans le repère visuel */
function numLabel(k, n){
  const nm = S.doc.num, skip = nm.skipFirst ? 1 : 0;
  if (k < skip) return null;
  const v = nm.start + k - skip, t = nm.start + n - skip - 1;
  return ({ n: `${v}`, page: `Page ${v}`, nof: `${v} / ${t}`, pageof: `Page ${v} sur ${t}`, dash: `– ${v} –` })[nm.fmt] || `${v}`;
}
const POS = { tl: [0, 0], tc: [.5, 0], tr: [1, 0], ml: [0, .5], mc: [.5, .5], mr: [1, .5], bl: [0, 1], bc: [.5, 1], br: [1, 1] };
function stampItems(p, k, n, vw, vh, measure){
  const out = [], wm = S.doc.wm, nm = S.doc.num;
  if (wm.on && (wm.mode === "text" ? wm.text.trim() : images[wm.img])) {
    const tw = vw * wm.size / 100;
    let size, iw, ih;
    if (wm.mode === "text") { size = tw / Math.max(1, measure(wm.text.trim(), 1, true)); ih = size * .72; iw = tw; }
    else { const im = images[wm.img]; iw = tw; ih = tw * im.h / im.w; }
    const pts = [];
    if (wm.tile) {
      const stepX = Math.max(iw * .9, 60) + 40, stepY = Math.max(ih * 3, 80);
      for (let y = stepY / 2, row = 0; y < vh + stepY; y += stepY, row++)
        for (let x = (row % 2 ? stepX / 2 : 0) + stepX / 4; x < vw + stepX; x += stepX) pts.push([x, y]);
    } else {
      const [ax, ay] = POS[wm.pos] || POS.mc, m = 36;
      const ex = Math.abs(Math.cos(wm.angle * Math.PI / 180)) * iw / 2 + Math.abs(Math.sin(wm.angle * Math.PI / 180)) * ih / 2;
      const ey = Math.abs(Math.sin(wm.angle * Math.PI / 180)) * iw / 2 + Math.abs(Math.cos(wm.angle * Math.PI / 180)) * ih / 2;
      pts.push([ax === .5 ? vw / 2 : ax ? vw - m - ex : m + ex, ay === .5 ? vh / 2 : ay ? vh - m - ey : m + ey]);
    }
    for (const [x, y] of pts) out.push({ kind: wm.mode, text: wm.text.trim(), size, iw, ih, x, y, align: .5, angle: wm.angle, color: wm.color, opacity: wm.opacity, bold: true });
  }
  if (nm.on) {
    const t = numLabel(k, n);
    if (t) {
      const [ax, ay] = POS[nm.pos] || POS.bc, m = nm.margin, size = nm.size, capH = size * .72;
      out.push({ kind: "text", text: t, size, x: ax === .5 ? vw / 2 : ax ? vw - m : m, y: ay ? vh - m - capH / 2 : m + capH / 2, align: ax, angle: 0, color: "#3d4048", opacity: 1, bold: false });
    }
  }
  const hf = S.doc.hf;
  if (hf?.on && !(hf.skipFirst && k === 0)) {
    const today = new Date().toLocaleDateString("fr-FR"), vars = s => s.replace(/\{page\}/gi, k + 1).replace(/\{total\}/gi, n).replace(/\{date\}/gi, today).replace(/\{nom\}/gi, S.doc.name);
    const m = hf.margin, size = hf.size, capH = size * .72;
    for (const [key, ax, top] of [["tl", 0, 1], ["tc", .5, 1], ["tr", 1, 1], ["bl", 0, 0], ["bc", .5, 0], ["br", 1, 0]]) {
      const t = (hf[key] || "").trim(); if (!t) continue;
      out.push({ kind: "text", text: vars(t), size, x: ax === .5 ? vw / 2 : ax ? vw - m : m, y: top ? m + capH / 2 : vh - m - capH / 2, align: ax, angle: 0, color: hf.color, opacity: 1, bold: false });
    }
  }
  return out;
}
let measureCtx;
function canvasMeasure(text, size, bold){ measureCtx ||= document.createElement("canvas").getContext("2d"); measureCtx.font = `${bold ? "700 " : ""}100px Helvetica, Arial, sans-serif`; return measureCtx.measureText(text).width / 100 * size; }
function drawStampsCanvas(ctx, p, box, k, n, s){
  const [vw, vh] = visDims(p, box);
  for (const it of stampItems(p, k, n, vw, vh, canvasMeasure)) {
    ctx.save();
    ctx.globalAlpha = it.opacity;
    ctx.translate(it.x * s, it.y * s); ctx.rotate(-it.angle * Math.PI / 180);
    if (it.kind === "image") { const im = images[S.doc.wm.img]; ctx.drawImage(im.el, -it.iw / 2 * s, -it.ih / 2 * s, it.iw * s, it.ih * s); }
    else {
      ctx.fillStyle = it.color; ctx.font = `${it.bold ? "700 " : ""}${it.size * s}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = "middle"; ctx.textAlign = it.align === 0 ? "left" : it.align === 1 ? "right" : "center";
      ctx.fillText(it.text, 0, it.size * s * .04);
    }
    ctx.restore();
  }
}

/* Rendu complet d'une page dans son repère visuel */
async function renderPageCanvas(p, k, n, pxPerPt, o = {}){
  const box = o.crop === false ? { x: 0, y: 0, w: p.w, h: p.h } : visualBox(p);
  const U = document.createElement("canvas");
  U.width = Math.max(1, Math.round(p.w * pxPerPt)); U.height = Math.max(1, Math.round(p.h * pxPerPt));
  const u = U.getContext("2d"); u.fillStyle = "#fff"; u.fillRect(0, 0, U.width, U.height);
  if (p.kind === "pdf") { try { const b = await renderBase(p, U.width, o.nocache); u.drawImage(b, 0, 0, U.width, U.height); } catch (e) { if (o.throwOnError) throw e; } }
  if (o.annots !== false) drawAnnots(u, p, pxPerPt);
  const r = rotOf(p), sw = box.w * pxPerPt, sh = box.h * pxPerPt;
  const O = document.createElement("canvas");
  O.width = Math.max(1, Math.round(r % 180 ? sh : sw)); O.height = Math.max(1, Math.round(r % 180 ? sw : sh));
  const c = O.getContext("2d");
  c.save(); c.translate(O.width / 2, O.height / 2); c.rotate(r * Math.PI / 180);
  c.drawImage(U, box.x * pxPerPt, box.y * pxPerPt, sw, sh, -sw / 2, -sh / 2, sw, sh); c.restore();
  if (o.stamps !== false) drawStampsCanvas(c, p, box, k, n, pxPerPt);
  return O;
}
const thumbKey = (p, k, n) => JSON.stringify([p, S.doc.wm.on ? S.doc.wm : 0, S.doc.num.on ? [S.doc.num, k, n] : 0, S.doc.hf?.on ? [S.doc.hf, k, n, S.doc.name] : 0]);
async function paintThumb(canvas, p, k, n, maxW, maxH){
  const key = thumbKey(p, k, n) + maxW + "x" + maxH;
  if (canvas.dataset.key === key) return;
  canvas.dataset.key = key;
  const box = visualBox(p), [vw, vh] = visDims(p, box);
  const dpr = Math.min(devicePixelRatio || 1, 2), s = Math.min(maxW / vw, maxH / vh);
  const c = await queueRender(() => renderPageCanvas(p, k, n, s * dpr));
  if (canvas.dataset.key !== key) return;
  canvas.width = c.width; canvas.height = c.height;
  canvas.style.width = Math.round(vw * s) + "px"; canvas.style.height = Math.round(vh * s) + "px";
  canvas.getContext("2d").drawImage(c, 0, 0);
}

/* ============ Texte d'une page (pdf.js) ============ */
const textCache = new Map();
function getTextItems(p){
  if (p.kind !== "pdf") return Promise.resolve([]);
  const key = p.src + ":" + p.index;
  if (!textCache.has(key)) {
    textCache.set(key, (async () => {
      const L = await pdfjsReady(), pdf = await getPdf(p.src), pg = await pdf.getPage(p.index + 1);
      const vp = pg.getViewport({ scale: 1, rotation: 0 }), tc = await pg.getTextContent();
      const out = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) { if (it.hasEOL && out.length) out[out.length - 1].eol = true; continue; }
        const t = L.Util.transform(vp.transform, it.transform);
        const size = Math.hypot(t[2], t[3]);
        const st = tc.styles[it.fontName] || {};
        const asc = st.ascent || .8;
        out.push({
          str: it.str, x: t[4], base: t[5], size, w: it.width, top: t[5] - size * asc, h: size * (asc + .22),
          horiz: Math.abs(t[1]) < .01 && Math.abs(t[2]) < .01 && t[0] > 0,
          font: /mono/i.test(st.fontFamily) ? "Courier" : /serif/i.test(st.fontFamily) && !/sans/i.test(st.fontFamily) ? "Times" : "Helvetica",
          eol: !!it.hasEOL
        });
      }
      return out;
    })());
    textCache.get(key).catch(() => textCache.delete(key));
  }
  return textCache.get(key);
}
async function pageText(p){
  const items = await getTextItems(p);
  let s = "", lastBase = null;
  for (const it of items) {
    if (lastBase !== null && Math.abs(it.base - lastBase) > it.size * .5 && !s.endsWith("\n")) s += "\n";
    else if (lastBase !== null && s && !s.endsWith("\n") && !s.endsWith(" ") && !it.str.startsWith(" ")) s += " ";
    s += it.str; lastBase = it.base;
    if (it.eol) { s += "\n"; lastBase = null; }
  }
  return s.replace(/[ \t]+\n/g, "\n").trim();
}

/* ============ Construction du PDF ============ */
const safeCache = new Map();
function safeText(font, str){
  let m = safeCache.get(font); if (!m) safeCache.set(font, m = new Map());
  let out = "";
  for (const ch of str) {
    let ok = m.get(ch);
    if (ok === undefined) { try { font.encodeText(ch); ok = true; } catch { ok = false; } m.set(ch, ok); }
    out += ok ? ch : ({ "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", " ": " ", "\t": "    " })[ch] ?? "?";
  }
  return out;
}
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const canvasBytes = (c, type = "image/jpeg", q = .88) => new Promise(r => c.toBlob(b => b.arrayBuffer().then(a => r(new Uint8Array(a))), type, q));
const hasRedact = p => p.annots.some(a => a.kind === "redact");

function visToUser(p, box, vx, vy){
  const r = rotOf(p), W = box.w, H = box.h; let ux, uy;
  if (r === 90) { ux = vy; uy = H - vx; } else if (r === 180) { ux = W - vx; uy = H - vy; } else if (r === 270) { ux = W - vy; uy = vx; } else { ux = vx; uy = vy; }
  return { x: p.ox + box.x + ux, y: p.oy + p.h - (box.y + uy) };
}

function applyForms(doc, i, flatten){
  const vals = S.doc.forms[i]; const L = PDFLib;
  if (!vals || !Object.keys(vals).length) return false;
  let form; try { form = doc.getForm(); } catch { return false; }
  let helv; try { helv = doc.embedStandardFont(L.StandardFonts.Helvetica); } catch {}
  for (const [name, v] of Object.entries(vals)) {
    try {
      const f = form.getField(name);
      if (f instanceof L.PDFTextField) f.setText(helv ? safeText(helv, String(v)) : String(v));
      else if (f instanceof L.PDFCheckBox) v ? f.check() : f.uncheck();
      else if (f instanceof L.PDFDropdown || f instanceof L.PDFOptionList) { if (v) f.select(v); }
      else if (f instanceof L.PDFRadioGroup) { if (v) f.select(v); }
    } catch (e) { console.warn("champ", name, e); }
  }
  if (flatten) { try { form.flatten(); } catch (e) { console.warn("flatten", e); } }
  return true;
}

async function buildPdf(list, o = {}){
  const L = PDFLib, prog = o.onProgress || (() => {});
  const pl = list.map(i => S.doc.pages[i]);
  const s0 = pl[0]?.src;
  const needsRaster = p => p.kind === "pdf" && (o.raster || sources[p.src].raster || hasRedact(p));
  const fast = pl.length && pl.every((p, k) => p.kind === "pdf" && p.src === s0 && p.index === k && !needsRaster(p)) && sources[s0].pageCount === pl.length;
  let out, outPages;
  if (fast) {
    out = await L.PDFDocument.load(sources[s0].bytes, { updateMetadata: false });
    applyForms(out, s0, S.doc.formsFlatten);
    outPages = out.getPages();
  } else {
    out = await L.PDFDocument.create(); outPages = [];
    const libs = {};
    for (let k = 0; k < pl.length; k++) {
      const p = pl[k]; let pg;
      if (p.kind === "pdf" && !needsRaster(p)) {
        if (!libs[p.src]) { libs[p.src] = await L.PDFDocument.load(sources[p.src].bytes, { updateMetadata: false }); applyForms(libs[p.src], p.src, true); }
        [pg] = await out.copyPages(libs[p.src], [p.index]); out.addPage(pg);
      } else if (p.kind === "pdf") {
        const dpi = o.rasterDpi || 200;
        const c = await renderPageCanvas({ ...p, rot: 0, baseRot: 0, crop: null, annots: p.annots.filter(a => a.kind === "redact") }, 0, 1, dpi / 72, { stamps: false, crop: false, nocache: true, throwOnError: true });
        const im = await out.embedJpg(await canvasBytes(c, "image/jpeg", o.rasterQ ?? .9));
        pg = out.addPage([p.w, p.h]); pg.setMediaBox(p.ox, p.oy, p.w, p.h);
        pg.drawImage(im, { x: p.ox, y: p.oy, width: p.w, height: p.h });
      } else pg = out.addPage([p.w, p.h]);
      outPages.push(pg);
      prog(k / pl.length * .6);
    }
  }
  const fonts = {}, emb = {};
  const font = async key => fonts[key] ||= await out.embedFont(L.StandardFonts[key]);
  for (let k = 0; k < pl.length; k++) {
    const p = pl[k], pg = outPages[k];
    pg.setRotation(L.degrees(rotOf(p)));
    const X = x => p.ox + x, Y = y => p.oy + p.h - y;
    for (const a of p.annots) {
      if (a.kind === "redact" && needsRaster(p)) continue;
      if (a.type === "rect") {
        const r = { x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h, color: hexRgb(a.kind === "redact" ? "#000000" : a.color) };
        if (a.kind === "highlight") { r.opacity = .4; if (L.BlendMode) r.blendMode = L.BlendMode.Multiply; }
        pg.drawRectangle(r);
      } else if (a.type === "draw") {
        const d = a.pts.map(([x, y], i) => `${i ? "L" : "M"}${(a.x + x).toFixed(2)} ${(a.y + y).toFixed(2)}`).join(" ") + (a.pts.length === 1 ? ` L${(a.x + a.pts[0][0] + .05).toFixed(2)} ${(a.y + a.pts[0][1]).toFixed(2)}` : "");
        pg.drawSvgPath(d, { x: p.ox, y: p.oy + p.h, borderColor: hexRgb(a.color), borderWidth: a.width, borderLineCap: L.LineCapStyle?.Round });
      } else if (a.type === "shape") {
        const col = hexRgb(a.color);
        if (a.shape === "rect") pg.drawRectangle({ x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h, borderColor: col, borderWidth: a.width });
        else if (a.shape === "ellipse") pg.drawEllipse({ x: X(a.x + a.w / 2), y: Y(a.y + a.h / 2), xScale: a.w / 2, yScale: a.h / 2, borderColor: col, borderWidth: a.width });
        else pg.drawSvgPath(shapePath(a, a.x, a.y), { x: p.ox, y: p.oy + p.h, borderColor: col, borderWidth: a.width, borderLineCap: L.LineCapStyle?.Round });
      } else if (a.type === "text") {
        const f = await font(FONTS[a.font].std[a.bold ? 1 : 0]);
        a.text.split("\n").forEach((line, i) => { if (line) pg.drawText(safeText(f, line), { x: X(a.x), y: Y(a.y + a.size * (0.9 + 1.2 * i)), size: a.size, font: f, color: hexRgb(a.color) }); });
      } else if (a.type === "image") {
        const im = images[a.img]; if (!im) continue;
        const e = emb[a.img] ||= await (im.kind === "jpg" ? out.embedJpg(im.bytes) : out.embedPng(im.bytes));
        pg.drawImage(e, { x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h });
      }
    }
    if (p.crop) {
      const b = visualBox(p);
      pg.setMediaBox(p.ox + b.x, p.oy + p.h - b.y - b.h, b.w, b.h);
      pg.setCropBox(p.ox + b.x, p.oy + p.h - b.y - b.h, b.w, b.h);
    }
    const box = visualBox(p), [vw, vh] = visDims(p, box);
    const fb = await font("HelveticaBold"), fr = await font("Helvetica");
    for (const it of stampItems(p, k, pl.length, vw, vh, (t, s, bold) => (bold ? fb : fr).widthOfTextAtSize(safeText(bold ? fb : fr, t), s))) {
      const C = visToUser(p, box, it.x, it.y), phi = (rotOf(p) + it.angle) * Math.PI / 180;
      const d = [Math.cos(phi), Math.sin(phi)], u = [-Math.sin(phi), Math.cos(phi)];
      if (it.kind === "image") {
        const im = images[S.doc.wm.img];
        const e = emb["wm" + S.doc.wm.img] ||= await (im.kind === "jpg" ? out.embedJpg(im.bytes) : out.embedPng(im.bytes));
        pg.drawImage(e, { x: C.x - d[0] * it.iw / 2 - u[0] * it.ih / 2, y: C.y - d[1] * it.iw / 2 - u[1] * it.ih / 2, width: it.iw, height: it.ih, rotate: L.degrees(rotOf(p) + it.angle), opacity: it.opacity });
      } else {
        const f = it.bold ? fb : fr, t = safeText(f, it.text), tw = f.widthOfTextAtSize(t, it.size), ch = it.size * .72;
        pg.drawText(t, { x: C.x - d[0] * tw * it.align - u[0] * ch / 2, y: C.y - d[1] * tw * it.align - u[1] * ch / 2, size: it.size, font: f, color: hexRgb(it.color), opacity: it.opacity, rotate: L.degrees(rotOf(p) + it.angle) });
      }
    }
  }
  prog(.7);
  const m = S.doc.meta;
  if (m?.clear) {
    out.context.trailerInfo.Info = out.context.register(out.context.obj({}));
    try { out.catalog.delete(L.PDFName.of("Metadata")); } catch {}
  } else {
    if (m) { out.setTitle(m.title || ""); out.setAuthor(m.author || ""); out.setSubject(m.subject || ""); out.setKeywords((m.keywords || "").split(/[,;]/).map(s => s.trim()).filter(Boolean)); }
    else if (!fast) out.setTitle(S.doc.name);
    out.setProducer("IdontlovePDF"); out.setModificationDate(new Date());
  }
  if (o.compress) await compressImages(out, o.compress.maxDim, o.compress.q, f => prog(.7 + f * .2));
  prog(.92);
  if (o.protect) { await encryptPdf(out, o.protect); return out.save({ useObjectStreams: false, updateFieldAppearances: false }); }
  try { return await out.save({ useObjectStreams: true }); }
  catch (e) { console.warn("save", e); return out.save({ useObjectStreams: true, updateFieldAppearances: false }); }
}

/* ============ Chiffrement AES-128 (norme PDF, R4) ============ */
const MD5K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
const MD5R = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
function md5(bytes){
  const len = bytes.length, nb = ((len + 8) >>> 6) + 1, w = new Uint32Array(nb * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[nb * 16 - 2] = (len * 8) >>> 0; w[nb * 16 - 1] = Math.floor(len / 0x20000000);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let j = 0; j < w.length; j += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5K[i] + w[j + g]) >>> 0; A = D; D = C; C = B;
      const r = MD5R[(i >> 4) * 4 + (i % 4)];
      B = (B + ((F << r) | (F >>> (32 - r)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const o = new Uint8Array(16); [a0, b0, c0, d0].forEach((v, i) => { for (let k = 0; k < 4; k++) o[i * 4 + k] = (v >>> (8 * k)) & 255; });
  return o;
}
function rc4(key, data){
  const s = new Uint8Array(256); for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
  return out;
}
const PDF_PAD = new Uint8Array([0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);
const latin1Ok = s => [...s].every(c => c.charCodeAt(0) < 256);
function padPw(pw){ const raw = [...pw].map(c => c.charCodeAt(0) & 255).slice(0, 32), b = new Uint8Array(32); b.set(raw); b.set(PDF_PAD.subarray(0, 32 - raw.length), raw.length); return b; }
async function encryptPdf(doc, { user, owner, print, copy, modify }){
  const L = PDFLib, ctx = doc.context;
  await doc.flush();
  try { if (doc.catalog.get(L.PDFName.of("AcroForm"))) doc.getForm().updateFieldAppearances(); } catch {}
  owner = owner || toHex(crypto.getRandomValues(new Uint8Array(12)));
  let P = 0xFFFFF0C0 | 0;
  if (print) P |= (1 << 2) | (1 << 11);
  if (modify) P |= (1 << 3) | (1 << 5) | (1 << 8) | (1 << 10);
  else P |= (1 << 8);
  if (copy) P |= (1 << 4) | (1 << 9); else P |= (1 << 9);
  const id = crypto.getRandomValues(new Uint8Array(16));
  let h = md5(padPw(owner)); for (let i = 0; i < 50; i++) h = md5(h);
  let O = rc4(h, padPw(user)); for (let i = 1; i <= 19; i++) O = rc4(h.map(b => b ^ i), O);
  const Pb = new Uint8Array(4); new DataView(Pb.buffer).setInt32(0, P, true);
  let k = md5(cat(padPw(user), O, Pb, id)); for (let i = 0; i < 50; i++) k = md5(k.subarray(0, 16));
  const key = k.subarray(0, 16);
  let U = rc4(key, md5(cat(PDF_PAD, id))); for (let i = 1; i <= 19; i++) U = rc4(key.map(b => b ^ i), U);
  U = cat(U, new Uint8Array(16));
  const useAes = !!globalThis.crypto?.subtle;
  const objKey = (n, g) => md5(cat(key, new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, (g >> 8) & 255]), useAes ? new Uint8Array([0x73, 0x41, 0x6C, 0x54]) : new Uint8Array(0)));
  const aes = async (kk, data) => {
    if (!useAes) return rc4(kk, data);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const ck = await crypto.subtle.importKey("raw", kk, "AES-CBC", false, ["encrypt"]);
    return cat(iv, new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, ck, data)));
  };
  async function encTree(obj, kk){
    if (obj instanceof L.PDFString || obj instanceof L.PDFHexString) return L.PDFHexString.of(toHex(await aes(kk, obj.asBytes())));
    if (obj instanceof L.PDFDict) { for (const [nm, v] of obj.entries()) { const n2 = await encTree(v, kk); if (n2 !== v) obj.set(nm, n2); } }
    else if (obj instanceof L.PDFArray) { for (let i = 0; i < obj.size(); i++) { const v = obj.get(i), n2 = await encTree(v, kk); if (n2 !== v) obj.set(i, n2); } }
    return obj;
  }
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const kk = objKey(ref.objectNumber, ref.generationNumber);
    if (obj instanceof L.PDFStream) {
      const data = obj instanceof L.PDFRawStream ? obj.contents : obj.getContents();
      await encTree(obj.dict, kk);
      ctx.assign(ref, L.PDFRawStream.of(obj.dict, await aes(kk, data)));
    } else await encTree(obj, kk);
  }
  const enc = useAes ? ctx.obj({ Filter: "Standard", V: 4, R: 4, Length: 128, P, StmF: "StdCF", StrF: "StdCF", CF: { StdCF: { AuthEvent: "DocOpen", CFM: "AESV2", Length: 16 } } })
    : ctx.obj({ Filter: "Standard", V: 2, R: 3, Length: 128, P });
  enc.set(L.PDFName.of("O"), L.PDFHexString.of(toHex(O)));
  enc.set(L.PDFName.of("U"), L.PDFHexString.of(toHex(U)));
  ctx.trailerInfo.Encrypt = ctx.register(enc);
  ctx.trailerInfo.ID = ctx.obj([L.PDFHexString.of(toHex(id)), L.PDFHexString.of(toHex(id))]);
  try { ctx.header = L.PDFHeader.forVersion(1, 7); } catch {}
}

/* ============ Compression des images ============ */
async function inflate(bytes){
  const ds = new DecompressionStream("deflate");
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
function pngUnfilter(data, cols, bpp){
  const row = cols * bpp, rows = Math.floor(data.length / (row + 1)), out = new Uint8Array(rows * row);
  for (let y = 0; y < rows; y++) {
    const ft = data[y * (row + 1)], src = y * (row + 1) + 1, dst = y * row;
    for (let x = 0; x < row; x++) {
      const raw = data[src + x], a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - row + x] : 0, c = x >= bpp && y ? out[dst - row + x - bpp] : 0;
      let v;
      if (ft === 1) v = raw + a; else if (ft === 2) v = raw + b; else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      else v = raw;
      out[dst + x] = v & 255;
    }
  }
  return out;
}
async function compressImages(doc, maxDim, quality, prog){
  const L = PDFLib, ctx = doc.context, N = n => L.PDFName.of(n);
  const lookup = v => v instanceof L.PDFRef ? ctx.lookup(v) : v;
  const all = ctx.enumerateIndirectObjects();
  const smasks = new Set();
  for (const [, o] of all) if (o instanceof L.PDFRawStream) { const m = o.dict.get(N("SMask")); if (m instanceof L.PDFRef) smasks.add(m.toString()); const mk = o.dict.get(N("Mask")); if (mk instanceof L.PDFRef) smasks.add(mk.toString()); }
  const imgs = all.filter(([r, o]) => o instanceof L.PDFRawStream && o.dict.get(N("Subtype")) === N("Image") && !smasks.has(r.toString()));
  let done = 0;
  for (const [ref, obj] of imgs) {
    prog(done++ / Math.max(1, imgs.length));
    try {
      const d = obj.dict;
      if (lookup(d.get(N("ImageMask")))?.asBoolean?.() || d.get(N("Decode"))) continue;
      const W = lookup(d.get(N("Width")))?.asNumber(), H = lookup(d.get(N("Height")))?.asNumber(), bpc = lookup(d.get(N("BitsPerComponent")))?.asNumber();
      if (!W || !H || bpc !== 8 || obj.contents.length < 15000) continue;
      let cs = lookup(d.get(N("ColorSpace"))), comps = 0;
      if (cs === N("DeviceRGB")) comps = 3; else if (cs === N("DeviceGray")) comps = 1;
      else if (cs instanceof L.PDFArray && lookup(cs.get(0)) === N("ICCBased")) comps = lookup(lookup(cs.get(1))?.dict?.get(N("N")))?.asNumber?.() || 0;
      if (comps !== 1 && comps !== 3) continue;
      let filt = lookup(d.get(N("Filter"))); filt = filt instanceof L.PDFArray ? filt.asArray().map(lookup) : filt ? [filt] : [];
      const k = Math.min(1, maxDim / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      if (filt.length === 1 && filt[0] === N("DCTDecode")) {
        const bmp = await createImageBitmap(new Blob([obj.contents], { type: "image/jpeg" }));
        g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
      } else if (filt.length <= 1 && (!filt.length || filt[0] === N("FlateDecode"))) {
        let px = filt.length ? await inflate(obj.contents) : obj.contents;
        const dp = lookup(d.get(N("DecodeParms")));
        const pred = dp instanceof L.PDFDict ? lookup(dp.get(N("Predictor")))?.asNumber() || 1 : 1;
        if (pred >= 10) px = pngUnfilter(px, W, comps); else if (pred !== 1) continue;
        if (px.length < W * H * comps) continue;
        const id = new ImageData(W, H), dd = id.data;
        for (let i = 0, j = 0; i < W * H; i++, j += comps) { const r = px[j], gg = comps === 3 ? px[j + 1] : r, b = comps === 3 ? px[j + 2] : r; dd[i * 4] = r; dd[i * 4 + 1] = gg; dd[i * 4 + 2] = b; dd[i * 4 + 3] = 255; }
        const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; tmp.getContext("2d").putImageData(id, 0, 0);
        g.drawImage(tmp, 0, 0, w, h);
      } else continue;
      const jpg = await canvasBytes(c, "image/jpeg", quality);
      if (jpg.length > obj.contents.length * .9) continue;
      const nd = d.clone(ctx);
      nd.delete(N("DecodeParms")); nd.delete(N("Length"));
      nd.set(N("Filter"), N("DCTDecode")); nd.set(N("Width"), L.PDFNumber.of(w)); nd.set(N("Height"), L.PDFNumber.of(h));
      nd.set(N("ColorSpace"), N("DeviceRGB")); nd.set(N("BitsPerComponent"), L.PDFNumber.of(8));
      ctx.assign(ref, L.PDFRawStream.of(nd, jpg));
    } catch (e) { console.warn("image", e); }
  }
  prog(1);
}

/* ============ Texte -> PDF ============ */
async function textToPdf(text, o){
  const L = PDFLib, doc = await L.PDFDocument.create();
  const [W, H] = o.page === "letter" ? LETTER : A4;
  const reg = await doc.embedFont(L.StandardFonts[FONTS[o.font].std[0]]), bold = await doc.embedFont(L.StandardFonts[FONTS[o.font].std[1]]);
  const m = o.margin * MM, maxW = W - m * 2;
  let pg = doc.addPage([W, H]), y = H - m;
  const newPage = () => { pg = doc.addPage([W, H]); y = H - m; };
  const wrap = (str, f, size, width) => {
    const words = str.split(/(\s+)/), lines = []; let line = "";
    for (const w of words) {
      const t = line + w;
      if (f.widthOfTextAtSize(t, size) <= width || !line.trim()) { line = t; continue; }
      lines.push(line.trimEnd()); line = w.trimStart();
      while (f.widthOfTextAtSize(line, size) > width && line.length > 1) { let n = line.length - 1; while (n > 1 && f.widthOfTextAtSize(line.slice(0, n), size) > width) n--; lines.push(line.slice(0, n)); line = line.slice(n); }
    }
    lines.push(line.trimEnd()); return lines;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    let f = reg, size = o.size, indent = 0, bullet = null, str = raw, before = 0;
    const hm = raw.match(/^(#{1,3})\s+(.*)$/);
    if (hm) { f = bold; size = o.size * [0, 1.9, 1.45, 1.2][hm[1].length]; str = hm[2]; before = size * .5; }
    else if (/^\s*[-*•]\s+/.test(raw)) { bullet = "•"; indent = o.size * 1.3; str = raw.replace(/^\s*[-*•]\s+/, ""); }
    str = safeText(f, str);
    const lh = size * 1.42;
    if (!str.trim()) { y -= lh * .7; if (y < m) newPage(); continue; }
    y -= before;
    for (const [i, ln] of wrap(str, f, size, maxW - indent).entries()) {
      if (y - size < m) newPage();
      y -= size;
      if (bullet && i === 0) pg.drawText(bullet, { x: m + indent * .3, y, size, font: f, color: L.rgb(.1, .1, .12) });
      pg.drawText(ln, { x: m + indent, y, size, font: f, color: L.rgb(.1, .1, .12) });
      y -= lh - size;
    }
  }
  doc.setTitle(S.doc.name); doc.setProducer("IdontlovePDF");
  return doc.save();
}

/* ============ PDF -> Word (texte) ============ */
function makeDocx(pagesText){
  const x = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  let body = "";
  pagesText.forEach((t, i) => {
    const paras = t.split(/\n{2,}/);
    for (const para of paras) {
      const runs = para.split("\n").map((l, j) => (j ? "<w:br/>" : "") + `<w:t xml:space="preserve">${x(l)}</w:t>`).join("");
      body += `<w:p><w:r>${runs}</w:r></w:p>`;
    }
    if (i < pagesText.length - 1) body += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  });
  const enc = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: "word/document.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`) }
  ];
  return makeZip(files);
}

/* ============ Éditeur de page ============ */
const INK = ["#16171b", "#e5484d", "#2a62d6", "#1f9d6a", "#ffffff"];
const HL = ["#ffd84d", "#7be38f", "#ff9ecb", "#8fd3ff"];
const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96];
const WIDTHS = [[1.5, "Fin"], [3, "Moyen"], [6, "Épais"]];
const SHAPES = [["rect", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Ligne"], ["arrow", "Flèche"], ["check", "Coche"], ["cross", "Croix"]];
const ETOOLS = [
  ["select", "Sélection", "select"], ["text", "Texte", "text"], ["retouch", "Retoucher", "retouch"], ["draw", "Dessin", "pen"],
  ["highlight", "Surligner", "marker"], ["shape", "Formes", "shape"], ["whiteout", "Masquer", "mask"], ["redact", "Caviarder", "redact"],
  null, ["image", "Image", "image", true], ["sign", "Signature", "sign", true]
];
const EHINTS = {
  select: "Touchez un élément pour le déplacer. Touchez un texte sélectionné pour le modifier.",
  text: "Touchez la page à l'endroit où écrire.",
  retouch: "Touchez un texte du PDF pour le remplacer par le vôtre.",
  draw: "Dessinez à main levée sur la page.",
  highlight: "Faites glisser sur la zone à surligner.",
  shape: "Faites glisser pour tracer la forme.",
  whiteout: "Faites glisser pour couvrir une zone d'un rectangle blanc.",
  redact: "Faites glisser sur ce qui doit disparaître. À l'enregistrement, le contenu caché est réellement effacé."
};
let scale = 1;
const sheet = () => $("#sheet"), frame = () => $("#frame"), stage = () => $("#stage");
const findAnnot = id => cur()?.annots.find(a => a.id === id);
const narrow = () => matchMedia("(max-width:720px)").matches;

function buildEditorChrome(){
  $("#etools").innerHTML = ETOOLS.map(t => t ? `<button class="tool" data-etool="${t[0]}" ${t[3] ? 'data-action="1"' : ""}>${icon(t[2])}<span>${t[1]}</span></button>` : `<span class="sep"></span>`).join("");
  $("#etools").addEventListener("click", e => {
    const b = e.target.closest(".tool"); if (!b || !cur()) return;
    const t = b.dataset.etool;
    if (t === "image") return $("#imgIn").click();
    if (t === "sign") return openSign();
    setETool(t);
  });
  $("#imgIn").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const id = await addImage(f); placeImage(id, Math.min(images[id].w * .75, 260)); } catch (e) { toast(e.friendly ? e.message : "Cette image n'a pas pu être lue.", 6000); }
  });
  $("#strip").addEventListener("click", e => { const t = e.target.closest(".thumb"); if (t) goTo(+t.dataset.i); });
  $("#pager").addEventListener("click", e => { const b = e.target.closest("[data-pg]"); if (b) goTo(S.cur + +b.dataset.pg); });
  $("#zoom").addEventListener("click", e => {
    const b = e.target.closest("[data-z]"); if (!b) return;
    const z = b.dataset.z;
    S.zoom = z === "fit" ? null : clamp(scale * (z === "+" ? 1.25 : .8), .2, 4);
    renderEditor();
  });
  $("#props").addEventListener("pointerdown", e => { if (e.target.closest("button") && S.editing) e.preventDefault(); });
  $("#props").addEventListener("click", onPropsClick);
  $("#props").addEventListener("change", e => { if (e.target.dataset.act === "font") setProp("font", e.target.value); });
  sheet().addEventListener("pointerdown", onSheetDown);
}
function renderETools(){
  $$("#etools .tool").forEach(b => { if (!b.dataset.action) b.setAttribute("aria-pressed", S.etool === b.dataset.etool); });
}
function setETool(t){
  if (S.editing) finishEditing();
  S.etool = t; sheet().dataset.tool = t;
  if (!["select", "text"].includes(t) && S.annSel) { S.annSel = null; markSelection(); }
  renderETools(); renderProps(); renderTextBoxes();
}

/* ----- Rendu ----- */
let renderToken = 0;
function renderEditor(){
  const p = cur(); if (!p) return;
  const st = stage(), fr = frame(), sh = sheet();
  const r = rotOf(p), rw = r % 180 ? p.h : p.w, rh = r % 180 ? p.w : p.h;
  const availW = Math.max(120, st.clientWidth - (narrow() ? 20 : 48));
  const availH = Math.max(160, st.clientHeight - (narrow() ? 40 : 60));
  const fit = narrow() ? availW / rw : Math.min(availW / rw, availH / rh);
  scale = S.zoom ?? clamp(fit, .15, 2.5);
  $("#zpct").textContent = Math.round(scale * 100) + " %";
  $("#ppLabel").textContent = `${S.cur + 1} / ${pages().length}`;
  fr.style.width = rw * scale + "px"; fr.style.height = rh * scale + "px";
  sh.style.width = p.w * scale + "px"; sh.style.height = p.h * scale + "px";
  sh.style.transform = `translate(-50%,-50%) rotate(${r}deg)`;
  sh.dataset.tool = S.etool;
  const base = sh.querySelector("canvas.base");
  const key = p.kind === "pdf" ? `${p.src}:${p.index}` : "blank";
  if (base.dataset.key !== key) { base.dataset.key = key; base.hidden = true; }
  const tok = ++renderToken;
  if (p.kind === "pdf") {
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    renderBase(p, p.w * scale * dpr).then(c => {
      if (tok !== renderToken) return;
      base.width = c.width; base.height = c.height; base.getContext("2d").drawImage(c, 0, 0); base.hidden = false;
    }).catch(e => { if (tok === renderToken) toast(e?.message === "Mot de passe requis" ? "Ce PDF est protégé : mot de passe requis pour l'afficher." : "Impossible d'afficher cette page."); });
  } else base.hidden = true;
  renderAnnots();
  renderStampLayer();
  renderTextBoxes();
}
function renderStampLayer(){
  const p = cur(), c = $("#stampl"); if (!p || !c) return;
  const fr = frame(), dpr = Math.min(devicePixelRatio || 1, 2);
  const W = parseFloat(fr.style.width), H = parseFloat(fr.style.height);
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const box = visualBox(p), [ox, oy] = boxVisualOffset(p, box), [vw, vh] = visDims(p, box);
  if (p.crop) {
    g.fillStyle = "rgba(15,16,20,.55)";
    g.fillRect(0, 0, W, H); g.clearRect(ox * scale, oy * scale, vw * scale, vh * scale);
    g.strokeStyle = "#e5484d"; g.setLineDash([6, 4]); g.lineWidth = 1.5; g.strokeRect(ox * scale, oy * scale, vw * scale, vh * scale); g.setLineDash([]);
  }
  g.save(); g.translate(ox * scale, oy * scale);
  drawStampsCanvas(g, p, box, S.cur, pages().length, scale);
  g.restore();
}

function annotEl(a){
  let el;
  if (a.type === "draw" || a.type === "shape") {
    el = document.createElementNS(svgNS, "svg");
    el.setAttribute("class", "annot " + a.type); el.setAttribute("viewBox", `0 0 ${Math.max(a.w, .1)} ${Math.max(a.h, .1)}`);
    let node;
    if (a.type === "shape" && a.shape === "rect") { node = document.createElementNS(svgNS, "rect"); node.setAttribute("width", a.w); node.setAttribute("height", a.h); }
    else if (a.type === "shape" && a.shape === "ellipse") { node = document.createElementNS(svgNS, "ellipse"); node.setAttribute("cx", a.w / 2); node.setAttribute("cy", a.h / 2); node.setAttribute("rx", a.w / 2); node.setAttribute("ry", a.h / 2); }
    else { node = document.createElementNS(svgNS, "path"); node.setAttribute("d", a.type === "draw" ? ptsPath(a.pts) : shapePath(a)); }
    for (const [k, v] of Object.entries({ fill: "none", stroke: a.color, "stroke-width": a.width, "stroke-linecap": "round", "stroke-linejoin": "round" })) node.setAttribute(k, v);
    el.appendChild(node);
  } else {
    el = document.createElement("div");
    if (a.type === "text") {
      el.className = "annot text"; el.textContent = a.text;
      el.style.fontSize = a.size * scale + "px"; el.style.fontFamily = FONTS[a.font].css;
      el.style.fontWeight = a.bold ? 700 : 400; el.style.color = a.color;
      el.spellcheck = false;
      el.addEventListener("input", () => { a.text = el.innerText.replace(/\n$/, ""); updateSelbox(); });
      el.addEventListener("blur", () => { if (S.editing === a.id) finishEditing(); });
      el.addEventListener("paste", e => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); });
      el.addEventListener("keydown", e => { if (e.key === "Escape") el.blur(); });
    } else if (a.type === "rect") {
      el.className = "annot rect " + a.kind; el.style.background = a.color;
    } else if (a.type === "image") {
      el.className = "annot img"; const im = images[a.img];
      if (im) { const img = document.createElement("img"); img.src = im.url; img.alt = ""; img.draggable = false; el.appendChild(img); }
    }
  }
  el.style.left = a.x * scale + "px"; el.style.top = a.y * scale + "px";
  if (a.type !== "text") { el.style.width = Math.max(a.w, .1) * scale + "px"; el.style.height = Math.max(a.h, .1) * scale + "px"; }
  el.dataset.id = a.id;
  return el;
}
const ptsPath = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + (pts.length === 1 ? ` L${(pts[0][0] + .01).toFixed(2)} ${pts[0][1].toFixed(2)}` : "");

function renderAnnots(){
  if (S.editing) finishEditing(true);
  sheet().querySelectorAll(".annot,.selbox,.tmp").forEach(n => n.remove());
  const p = cur(); if (!p) return;
  const frag = document.createDocumentFragment();
  p.annots.forEach(a => frag.appendChild(annotEl(a)));
  sheet().appendChild(frag);
  markSelection();
}
function refreshAnnot(a){
  const old = sheet().querySelector(`.annot[data-id="${a.id}"]`), el = annotEl(a);
  if (old) old.replaceWith(el); else sheet().appendChild(el);
  updateSelbox();
}
function markSelection(){
  sheet().querySelectorAll(".selbox").forEach(n => n.remove());
  const a = S.annSel && findAnnot(S.annSel);
  if (!a || S.editing === a.id) return;
  const box = document.createElement("div"); box.className = "selbox";
  box.innerHTML = `<button class="h h-del" title="Supprimer" aria-label="Supprimer">${icon("x")}</button>` +
    (a.type !== "text" ? `<button class="h h-resize" title="Redimensionner" aria-label="Redimensionner">${icon("crop")}</button>` : "");
  sheet().appendChild(box); updateSelbox();
}
function updateSelbox(){
  const box = sheet().querySelector(".selbox"), a = S.annSel && findAnnot(S.annSel);
  if (!box || !a) return;
  let w, h;
  if (a.type === "text") { const el = sheet().querySelector(`.annot[data-id="${a.id}"]`); w = el?.offsetWidth || 10; h = el?.offsetHeight || 10; }
  else { w = a.w * scale; h = a.h * scale; }
  Object.assign(box.style, { left: a.x * scale + "px", top: a.y * scale + "px", width: w + "px", height: h + "px" });
}
function selectAnnot(id){ S.annSel = id; markSelection(); renderProps(); }

/* ----- Texte existant (Retoucher) ----- */
let tboxTok = 0;
async function renderTextBoxes(){
  const sh = sheet(); sh.querySelectorAll(".tbox").forEach(n => n.remove());
  const p = cur(); if (!p || S.etool !== "retouch") return;
  if (p.kind !== "pdf") { toast("Cette page ne contient pas de texte d'origine."); return; }
  const tok = ++tboxTok;
  let items;
  try { items = await getTextItems(p); } catch { return; }
  if (tok !== tboxTok || S.etool !== "retouch" || cur() !== p) return;
  const used = new Set(p.annots.filter(a => a.srcText != null).map(a => a.srcText));
  const frag = document.createDocumentFragment();
  items.forEach((it, i) => {
    if (!it.horiz || used.has(i)) return;
    const d = document.createElement("div"); d.className = "tbox"; d.dataset.ti = i;
    Object.assign(d.style, { left: (it.x - p.ox * 0 - 1) * scale + "px", top: (it.top - 1) * scale + "px", width: (it.w + 2) * scale + "px", height: (it.h + 2) * scale + "px" });
    frag.appendChild(d);
  });
  sh.appendChild(frag);
  if (!frag.childNodes.length && !sh.querySelector(".tbox")) toast(items.length ? "Tout le texte de cette page a déjà été retouché." : "Aucun texte modifiable sur cette page (document scanné ?).");
}
async function retouch(i){
  const p = cur(), items = await getTextItems(p), it = items[i]; if (!it) return;
  snapshot();
  const rect = { id: uid(), type: "rect", kind: "whiteout", color: "#ffffff", x: it.x - 1, y: it.top - 1, w: it.w + 2, h: it.h + 2 };
  const size = Math.round(it.size * 2) / 2;
  const t = { id: uid(), type: "text", x: it.x, y: it.base - size * .9, text: it.str, size, font: it.font, bold: false, color: "#000000", pair: rect.id, srcText: i };
  p.annots.push(rect, t);
  sheet().appendChild(annotEl(rect)); sheet().appendChild(annotEl(t));
  S.annSel = t.id; renderTextBoxes();
  startEditing(t.id, false, true);
  renderProps(); docChanged(true);
}

/* ----- Interaction ----- */
function toPt(e){
  const p = cur(), r = frame().getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const t = rotOf(p) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: (dx * c + dy * s) / scale + p.w / 2, y: (-dx * s + dy * c) / scale + p.h / 2 };
}
function capture(move, up){
  const mv = e => move(e);
  const end = e => { removeEventListener("pointermove", mv); removeEventListener("pointerup", end); removeEventListener("pointercancel", end); up(e); };
  addEventListener("pointermove", mv); addEventListener("pointerup", end); addEventListener("pointercancel", end);
}
function onSheetDown(e){
  const p = cur(); if (!p) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.target.closest(".h-del")) { e.preventDefault(); deleteAnnot(); return; }
  if (e.target.closest(".h-resize")) { startResize(e); return; }
  const tb = e.target.closest(".tbox");
  if (tb && S.etool === "retouch") { e.preventDefault(); retouch(+tb.dataset.ti); return; }
  const annEl = e.target.closest(".annot");
  if (annEl && S.editing === annEl.dataset.id) return;
  if (annEl && (S.etool === "select" || (S.etool === "text" && annEl.classList.contains("text")))) { startDrag(e, annEl); return; }
  if (S.editing) finishEditing();
  const pt = toPt(e);
  if (S.etool === "select") { if (S.annSel) selectAnnot(null); }
  else if (S.etool === "text") { e.preventDefault(); createText(pt); }
  else if (S.etool === "draw") startStroke(e, pt);
  else if (["highlight", "whiteout", "redact", "shape"].includes(S.etool)) startRect(e, pt);
}
function startDrag(e, el){
  const a = findAnnot(el.dataset.id); if (!a) return;
  if (S.editing) finishEditing();
  const wasSel = S.annSel === a.id;
  e.preventDefault();
  if (!wasSel) selectAnnot(a.id);
  const pt0 = toPt(e), ox = a.x, oy = a.y; let moved = false;
  const pair = a.pair ? findAnnot(a.pair) : null, px = pair?.x, py = pair?.y;
  capture(ev => {
    const q = toPt(ev), dx = q.x - pt0.x, dy = q.y - pt0.y;
    if (!moved && Math.hypot(dx, dy) * scale < 4) return;
    if (!moved) { moved = true; snapshot(); }
    a.x = ox + dx; a.y = oy + dy;
    el.style.left = a.x * scale + "px"; el.style.top = a.y * scale + "px"; updateSelbox();
  }, () => {
    if (moved) docChanged(true);
    else if (a.type === "text" && (wasSel || S.etool === "text")) startEditing(a.id);
  });
}
function startResize(e){
  e.preventDefault(); e.stopPropagation();
  const a = findAnnot(S.annSel); if (!a) return;
  const pt0 = toPt(e), ow = a.w, oh = a.h;
  const keep = a.type === "draw" || a.type === "image" || (a.type === "shape" && ["check", "cross"].includes(a.shape));
  const pts0 = a.type === "draw" ? a.pts.map(q => [...q]) : null;
  let moved = false;
  capture(ev => {
    const q = toPt(ev);
    let w = Math.max(4, ow + q.x - pt0.x), h = Math.max(4, oh + q.y - pt0.y);
    if (keep) { const k = Math.max(w / ow, h / oh, 4 / Math.min(ow, oh)); w = ow * k; h = oh * k; }
    if (!moved) { moved = true; snapshot(); }
    a.w = w; a.h = h;
    if (pts0) { const k = w / ow; a.pts = pts0.map(([x, y]) => [x * k, y * k]); }
    refreshAnnot(a);
  }, () => { if (moved) docChanged(true); });
}

let editSnap = null, editIsNew = false, editOrig = "";
function createText(pt){
  snapshot();
  const pr = S.props;
  const a = { id: uid(), type: "text", x: pt.x, y: pt.y - pr.size * .6, text: "", size: pr.size, font: pr.font, bold: pr.bold, color: pr.color };
  cur().annots.push(a); S.annSel = a.id;
  sheet().appendChild(annotEl(a));
  startEditing(a.id, true);
  renderProps();
}
function startEditing(id, isNew = false, selectAll = false){
  const el = sheet().querySelector(`.annot[data-id="${id}"]`), a = findAnnot(id);
  if (!el || !a) return;
  editIsNew = isNew; editOrig = a.text;
  editSnap = isNew ? null : snapState();
  S.editing = id; S.annSel = id;
  el.contentEditable = "true"; el.classList.add("editing");
  markSelection();
  el.focus({ preventScroll: true });
  const r = document.createRange(); r.selectNodeContents(el); if (!selectAll) r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function finishEditing(silent){
  const id = S.editing; if (!id) return;
  S.editing = null;
  const el = sheet().querySelector(`.annot[data-id="${id}"]`);
  if (el) { el.contentEditable = "false"; el.classList.remove("editing"); }
  const a = findAnnot(id);
  if (a && !a.text.trim() && a.pair == null) {
    cur().annots = cur().annots.filter(x => x.id !== id);
    if (editIsNew) { undoS.pop(); updUndo(); }
    else if (editSnap) { undoS.push(editSnap); updUndo(); }
    if (S.annSel === id) S.annSel = null;
    el?.remove();
  } else if (a && !editIsNew && a.text !== editOrig && editSnap) { undoS.push(editSnap); redoS.length = 0; updUndo(); }
  editSnap = null;
  if (!silent) { markSelection(); renderProps(); }
  docChanged(true);
}
function startStroke(e, pt){
  e.preventDefault();
  const p = cur(), pts = [[pt.x, pt.y]], color = S.props.color, width = S.props.width;
  const tmp = document.createElementNS(svgNS, "svg");
  tmp.setAttribute("class", "tmp"); tmp.setAttribute("viewBox", `0 0 ${p.w} ${p.h}`);
  Object.assign(tmp.style, { left: 0, top: 0, width: "100%", height: "100%" });
  const path = document.createElementNS(svgNS, "path");
  for (const [k, v] of Object.entries({ fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", d: ptsPath(pts) })) path.setAttribute(k, v);
  tmp.appendChild(path); sheet().appendChild(tmp);
  capture(ev => {
    const q = toPt(ev), l = pts[pts.length - 1];
    if (Math.hypot(q.x - l[0], q.y - l[1]) < .8) return;
    pts.push([q.x, q.y]); path.setAttribute("d", ptsPath(pts));
  }, () => {
    tmp.remove();
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), pad = width;
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    const a = { id: uid(), type: "draw", x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad, pts: pts.map(([px, py]) => [px - x, py - y]), color, width };
    snapshot(); p.annots.push(a); sheet().appendChild(annotEl(a)); docChanged(true);
  });
}
function startRect(e, pt){
  e.preventDefault();
  const kind = S.etool, isShape = kind === "shape";
  const color = kind === "highlight" ? S.props.hl : kind === "whiteout" ? "#ffffff" : kind === "redact" ? "#000000" : S.props.color;
  let tmp;
  if (isShape) { tmp = document.createElementNS(svgNS, "svg"); tmp.setAttribute("class", "tmp"); }
  else { tmp = document.createElement("div"); tmp.className = "tmp annot rect " + kind; tmp.style.background = color; if (kind === "whiteout") tmp.style.boxShadow = "0 0 0 1px #e5484d"; }
  sheet().appendChild(tmp);
  let box = null;
  capture(ev => {
    const q = toPt(ev);
    box = { x: Math.min(pt.x, q.x), y: Math.min(pt.y, q.y), w: Math.abs(q.x - pt.x), h: Math.abs(q.y - pt.y), fx: q.x < pt.x, fy: q.y < pt.y };
    if (isShape) {
      const sq = ["check", "cross"].includes(S.props.shape);
      if (sq) { const m = Math.max(box.w, box.h); box.w = box.h = m; if (box.fx) box.x = pt.x - m; if (box.fy) box.y = pt.y - m; }
      const a = { ...box, type: "shape", shape: S.props.shape, color, width: S.props.width, id: "tmp" };
      const el = annotEl(a); el.classList.add("tmp"); tmp.replaceWith(el); tmp = el;
    } else Object.assign(tmp.style, { left: box.x * scale + "px", top: box.y * scale + "px", width: box.w * scale + "px", height: box.h * scale + "px" });
  }, () => {
    tmp.remove();
    let a;
    if (isShape) {
      const sq = ["check", "cross"].includes(S.props.shape);
      if (!box || (Math.max(box.w, box.h) < 3)) { if (sq) box = { x: pt.x - 9, y: pt.y - 9, w: 18, h: 18 }; else return; }
      const line = ["line", "arrow"].includes(S.props.shape);
      if (!line && (box.w < 3 || box.h < 3) && !sq) return;
      a = { id: uid(), type: "shape", shape: S.props.shape, color, width: S.props.width, ...box };
      if (line) { a.w = Math.max(a.w, .5); a.h = Math.max(a.h, .5); }
    } else {
      if (!box || box.w < 3 || box.h < 3) return;
      a = { id: uid(), type: "rect", kind, color, x: box.x, y: box.y, w: box.w, h: box.h };
    }
    snapshot(); cur().annots.push(a); sheet().appendChild(annotEl(a)); docChanged(true);
  });
}
function deleteAnnot(){
  const a = S.annSel && findAnnot(S.annSel); if (!a) return;
  snapshot(); cur().annots = cur().annots.filter(x => x.id !== a.id && x.id !== a.pair);
  S.annSel = null; S.editing = null; renderAnnots(); renderProps(); renderTextBoxes(); docChanged(true);
}
function duplicateAnnot(){
  const a = S.annSel && findAnnot(S.annSel); if (!a) return;
  snapshot(); const c = clone(a); c.id = uid(); c.x += 14; c.y += 14; delete c.pair; delete c.srcText;
  cur().annots.push(c); sheet().appendChild(annotEl(c)); selectAnnot(c.id); docChanged(true);
}
function placeImage(id, widthPt){
  if (!cur()) return;
  if (S.wview !== "edit") setWView("edit");
  const p = cur(), im = images[id];
  const w = Math.min(widthPt, p.w * .8), h = w * im.h / im.w;
  const a = { id: uid(), type: "image", img: id, x: (p.w - w) / 2, y: clamp((p.h - h) / 2, 10, p.h), w, h };
  snapshot(); p.annots.push(a); setETool("select"); sheet().appendChild(annotEl(a)); selectAnnot(a.id); docChanged(true);
}
function addTextAnnot(text, size = 12){
  if (!cur()) return;
  if (S.wview !== "edit") setWView("edit");
  const p = cur();
  snapshot();
  const a = { id: uid(), type: "text", x: p.w * .1, y: p.h * .82, text, size, font: S.props.font, bold: false, color: S.props.color };
  p.annots.push(a); setETool("select"); sheet().appendChild(annotEl(a)); selectAnnot(a.id); docChanged(true);
  toast("Ajouté · faites-le glisser à sa place");
}

/* ----- Barre de réglages ----- */
function swatches(list, current, act){
  return `<div class="sws">${list.map(c => `<button class="sw ${c.toLowerCase() === (current || "").toLowerCase() ? "on" : ""}" style="background:${c}" data-act="${act}" data-v="${c}" aria-label="Couleur ${c}"></button>`).join("")}</div>`;
}
function renderProps(){
  const box = $("#props"); if (!box) return;
  if (!cur()) { box.innerHTML = ""; return; }
  const a = S.annSel ? findAnnot(S.annSel) : null;
  const type = a ? (a.type === "rect" ? a.kind : a.type) : S.etool;
  const v = a || S.props, out = [];
  if (type === "text" || (type === "retouch" && !a)) {
    if (type === "text") out.push(`<label class="fld"><select data-act="font" aria-label="Police">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${k === v.font ? "selected" : ""}>${f.label}</option>`).join("")}</select></label>`,
      `<div class="stepper" title="Taille"><button data-act="size-" aria-label="Plus petit">−</button><span class="num">${v.size}</span><button data-act="size+" aria-label="Plus grand">+</button></div>`,
      `<button class="tog ${v.bold ? "on" : ""}" data-act="bold" aria-pressed="${!!v.bold}" title="Gras"><b>G</b></button>`,
      swatches(INK, v.color, "color"));
  } else if (type === "draw" || type === "shape") {
    if (type === "shape") out.push(`<div class="widths">${SHAPES.map(([k, l]) => `<button class="${(a ? a.shape : S.props.shape) === k ? "on" : ""}" data-act="shape" data-v="${k}" title="${l}" aria-label="${l}">${icon("s_" + k)}</button>`).join("")}</div>`);
    out.push(swatches(INK.slice(0, 4), v.color, "color"),
      `<div class="widths">${WIDTHS.map(([w, l]) => `<button class="${v.width === w ? "on" : ""}" data-act="width" data-v="${w}" title="${l}" aria-label="Trait ${l}"><i style="width:${w + 3}px;height:${w + 3}px"></i></button>`).join("")}</div>`);
  } else if (type === "highlight") out.push(swatches(HL, a ? a.color : S.props.hl, "hl"));
  if (a) out.push(`<span class="grow"></span><button class="btn ghost sm" data-act="dup">${icon("copy")}<span>Dupliquer</span></button><button class="btn ghost sm danger" data-act="del">${icon("trash")}<span>Supprimer</span></button>`);
  else out.push(`<span class="hint">${EHINTS[S.etool] || ""}</span>`);
  box.innerHTML = out.join("");
}
function setProp(key, val){
  if (S.editing) finishEditing(true);
  const a = S.annSel ? findAnnot(S.annSel) : null;
  if (key === "hl") { S.props.hl = val; if (a?.kind === "highlight") { snapshot(); a.color = val; refreshAnnot(a); docChanged(true); } }
  else {
    S.props[key] = val;
    if (a && key in a) { snapshot(); a[key] = val; refreshAnnot(a); docChanged(true); }
  }
  renderProps();
}
function onPropsClick(e){
  const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act, a = S.annSel ? findAnnot(S.annSel) : null, v = a || S.props;
  if (act === "dup") return duplicateAnnot();
  if (act === "del") return deleteAnnot();
  if (act === "bold") return setProp("bold", !v.bold);
  if (act === "size+" || act === "size-") {
    const s = v.size, next = act === "size+" ? SIZES.find(x => x > s) ?? s : [...SIZES].reverse().find(x => x < s) ?? s;
    return setProp("size", next);
  }
  if (act === "color") return setProp("color", b.dataset.v);
  if (act === "width") return setProp("width", +b.dataset.v);
  if (act === "hl") return setProp("hl", b.dataset.v);
  if (act === "shape") return setProp("shape", b.dataset.v);
}

/* ----- Vignettes latérales ----- */
let stripIO;
function renderStrip(){
  const st = $("#strip"); if (!st) return;
  stripIO?.disconnect();
  stripIO = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { const i = +x.target.dataset.i, p = pages()[i]; if (p) paintThumb(x.target.querySelector("canvas"), p, i, pages().length, 100, 130); } }), { root: st, rootMargin: "400px" });
  st.innerHTML = pages().map((p, i) => `<button class="thumb ${i === S.cur ? "on" : ""}" data-i="${i}" aria-label="Page ${i + 1}"><canvas width="1" height="1"></canvas><span class="n">${i + 1}</span></button>`).join("");
  st.querySelectorAll(".thumb").forEach(t => stripIO.observe(t));
}
function refreshStripThumb(i){
  const t = $(`#strip .thumb[data-i="${i}"]`); if (t && pages()[i]) paintThumb(t.querySelector("canvas"), pages()[i], i, pages().length, 100, 130);
}
function goTo(i){
  if (!pages().length) return;
  if (S.editing) finishEditing();
  S.cur = clamp(i, 0, pages().length - 1); S.annSel = null;
  $$("#strip .thumb").forEach(t => t.classList.toggle("on", +t.dataset.i === S.cur));
  $(`#strip .thumb[data-i="${S.cur}"]`)?.scrollIntoView({ block: "nearest" });
  renderEditor(); renderProps(); stage().scrollTop = 0;
  persistSoon();
}

/* ----- Signature ----- */
const pad = () => $("#sigpad");
let sigStrokes = [], sigColor = "#16171b";
function drawSig(){
  const pd = pad(), dpr = devicePixelRatio || 1, r = pd.getBoundingClientRect();
  pd.width = r.width * dpr; pd.height = r.height * dpr;
  const ctx = pd.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.strokeStyle = "#d8dce1"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, r.height - 44); ctx.lineTo(r.width - 20, r.height - 44); ctx.stroke();
  ctx.strokeStyle = sigColor; ctx.lineWidth = 2.6; ctx.lineCap = ctx.lineJoin = "round";
  sigStrokes.forEach(s => { ctx.beginPath(); s.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]); ctx.stroke(); });
  $$("#sigColors .sw").forEach(b => b.classList.toggle("on", b.dataset.c === sigColor));
}
function openSign(){ if (S.editing) finishEditing(); sigStrokes = []; openModal("#mSign"); requestAnimationFrame(drawSig); }
function bindSignature(){
  $("#sigColors").innerHTML = ["#16171b", "#2a62d6"].map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Encre"></button>`).join("");
  pad().addEventListener("pointerdown", e => {
    e.preventDefault(); const r = pad().getBoundingClientRect(); const s = [[e.clientX - r.left, e.clientY - r.top]]; sigStrokes.push(s); drawSig();
    capture(ev => { s.push([ev.clientX - r.left, ev.clientY - r.top]); drawSig(); }, () => {});
  });
  $("#sigColors").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b) { sigColor = b.dataset.c; drawSig(); } });
  $("#sigClear").onclick = () => { sigStrokes = []; drawSig(); };
  $("#sigOk").onclick = async () => {
    if (!sigStrokes.length) return toast("Signez d'abord dans le cadre.");
    const all = sigStrokes.flat(), xs = all.map(q => q[0]), ys = all.map(q => q[1]), m = 6;
    const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, w = Math.max(...xs) - x0 + m, h = Math.max(...ys) - y0 + m;
    const k = 3, c = document.createElement("canvas"); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const ctx = c.getContext("2d"); ctx.scale(k, k); ctx.translate(-x0, -y0);
    ctx.strokeStyle = sigColor; ctx.lineWidth = 2.6; ctx.lineCap = ctx.lineJoin = "round";
    sigStrokes.forEach(s => { ctx.beginPath(); s.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]); ctx.stroke(); });
    const bytes = await canvasBytes(c, "image/png");
    closeModal("#mSign");
    if ($("#sigKeep").checked) await saveSignature(bytes, c.width, c.height);
    const id = await storeImage(bytes, "png", c.width, c.height);
    placeImage(id, Math.min(170, w * .75));
    toast("Signature ajoutée · faites-la glisser à sa place");
    if (S.tool === "sign") renderPanel();
  };
}
let sigCache = null;
async function loadSignatures(){ if (!sigCache) { sigCache = (await DB.get("sigs")) || []; } return sigCache; }
async function saveSignature(bytes, w, h){ const l = await loadSignatures(); l.unshift({ id: uid(), bytes, w, h }); l.length = Math.min(l.length, 6); await DB.set("sigs", l); }
async function useSignature(id){
  const s = (await loadSignatures()).find(x => x.id === id); if (!s) return;
  const iid = await storeImage(s.bytes, "png", s.w, s.h);
  placeImage(iid, Math.min(170, s.w / 3 * .75));
}
async function deleteSignature(id){ const l = await loadSignatures(); const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); await DB.set("sigs", l); }

/* ============ Vue Pages ============ */
const cardEls = new Map();
let gridIO, lastClicked = null;
const GROUP_COLORS = ["#3b6fe0", "#e5484d", "#1f9d6a", "#d48806", "#7c4ddb", "#0f9bb5", "#c2418f", "#6b7280"];
function cardSize(){ return narrow() ? [140, 150] : [150, 190]; }

function renderGrid(){
  const grid = $("#pgrid"); if (!grid) return;
  if (!gridIO) gridIO = new IntersectionObserver(en => en.forEach(x => { x.target.dataset.vis = x.isIntersecting ? 1 : ""; if (x.isIntersecting) paintCard(x.target); }), { root: grid, rootMargin: "500px" });
  const T = TOOLS[S.tool] || {};
  const seen = new Set(), n = pages().length;
  pages().forEach((p, i) => {
    let el = cardEls.get(p.id);
    if (!el) {
      el = document.createElement("div"); el.className = "card"; el.dataset.pid = p.id; el.tabIndex = 0;
      el.innerHTML = `<span class="ck">${icon("check")}</span><div class="cv"><canvas width="1" height="1"></canvas></div><span class="n"></span>
        <div class="acts"><button data-ca="rotate" title="Pivoter" aria-label="Pivoter">${icon("rotate")}</button><button data-ca="del" title="Supprimer la page" aria-label="Supprimer la page">${icon("trash")}</button></div>`;
      cardEls.set(p.id, el); gridIO.observe(el);
    }
    el.dataset.i = i;
    el.querySelector(".n").textContent = i + 1;
    el.classList.toggle("sel", S.sel.has(p.id));
    el.classList.toggle("mark-del", T.selMode === "del");
    let badge = el.querySelector(".src");
    const b = T.cardBadge ? T.cardBadge(p, i) : null;
    if (b) { if (!badge) { badge = document.createElement("span"); badge.className = "src"; el.appendChild(badge); } badge.textContent = b.text; badge.style.color = b.color || ""; badge.style.boxShadow = b.color ? `inset 0 0 0 1.5px ${b.color}` : ""; }
    else badge?.remove();
    seen.add(p.id);
    if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
    if (el.dataset.vis) paintCard(el);
  });
  for (const [id, el] of cardEls) if (!seen.has(id)) { gridIO.unobserve(el); el.remove(); cardEls.delete(id); }
  let add = $("#addCard");
  if (!add) { add = document.createElement("button"); add.id = "addCard"; add.className = "add-card"; add.innerHTML = `${icon("plus")}<span>Ajouter</span>`; }
  grid.appendChild(add);
  renderSelbar();
}
function paintCard(el){
  const i = +el.dataset.i, p = pages()[i]; if (!p) return;
  const [w, h] = cardSize();
  paintThumb(el.querySelector("canvas"), p, i, pages().length, w, h);
}
function refreshVisibleCards(){ for (const el of cardEls.values()) if (el.dataset.vis) paintCard(el); }

function renderSelbar(){
  const bar = $("#selbar"); if (!bar) return;
  const n = pages().length, k = S.sel.size, T = TOOLS[S.tool] || {};
  bar.classList.toggle("has-sel", k > 0);
  if (!k) {
    const hint = T.selHint || (narrow() ? "Touchez une page pour la sélectionner" : "Cliquez pour sélectionner, glissez pour réordonner");
    bar.innerHTML = `<span class="cnt">${plural(n, "page")}<small>${hint}</small></span>
      <button class="btn ghost sm" data-sb="all">Tout sélectionner</button>
      <button class="btn line sm" data-sb="add">${icon("plus")}<span class="lbl">Ajouter</span></button>`;
  } else {
    const single = k === 1;
    bar.innerHTML = `<span class="cnt">${plural(k, T.selMode === "del" ? "page à supprimer" : "page sélectionnée", T.selMode === "del" ? "pages à supprimer" : "pages sélectionnées")}<small><button class="linkbtn" data-sb="none">Désélectionner</button></small></span>
      <button class="ib" data-sb="rotl" title="Pivoter à gauche" aria-label="Pivoter à gauche">${icon("rotl")}</button>
      <button class="ib" data-sb="rotr" title="Pivoter à droite" aria-label="Pivoter à droite">${icon("rotate")}</button>
      <button class="ib" data-sb="left" title="Déplacer avant" aria-label="Déplacer avant">${icon("back")}</button>
      <button class="ib" data-sb="right" title="Déplacer après" aria-label="Déplacer après">${icon("next")}</button>
      <button class="ib" data-sb="dup" title="Dupliquer" aria-label="Dupliquer">${icon("copy")}</button>
      ${single ? `<button class="ib" data-sb="edit" title="Ouvrir dans l'éditeur" aria-label="Ouvrir dans l'éditeur">${icon("pen")}</button>` : ""}
      <button class="ib danger" data-sb="del" title="Supprimer" aria-label="Supprimer" style="color:var(--accent)">${icon("trash")}</button>`;
  }
}
function selectedIdx(){ return pages().map((p, i) => S.sel.has(p.id) ? i : -1).filter(i => i >= 0); }

async function addMenu(){
  const v = await choose("Ajouter des pages", `Elles seront placées ${S.sel.size ? "après la sélection" : "à la fin du document"}.`,
    [{ v: null, label: "Annuler" }, { v: "blank", label: "Page vierge" }, { v: "files", label: "PDF ou images…", primary: true }]);
  const at = S.sel.size ? Math.max(...selectedIdx()) + 1 : pages().length;
  if (v === "blank") { const ref = pages()[Math.max(0, at - 1)]; snapshot(); const b = blankPage(ref?.w || A4[0], ref?.h || A4[1]); pages().splice(at, 0, b); S.sel.clear(); S.sel.add(b.id); docChanged(); }
  if (v === "files") pickFiles("append", null, at);
}
async function deletePages(idxs){
  if (!idxs.length) return;
  if (idxs.length >= pages().length) {
    const v = await choose("Fermer le document ?", "Supprimer toutes les pages ferme le document.", [{ v: false, label: "Annuler" }, { v: true, label: "Fermer", primary: true }]);
    if (v) closeDoc(); return;
  }
  snapshot();
  const ids = new Set(idxs.map(i => pages()[i].id));
  S.doc.pages = pages().filter(p => !ids.has(p.id));
  for (const id of ids) S.sel.delete(id);
  S.cur = clamp(S.cur, 0, pages().length - 1);
  docChanged();
  toast(`${plural(ids.size, "page supprimée", "pages supprimées")} · Annuler pour revenir`);
}
function rotatePages(idxs, d){ if (!idxs.length) return; snapshot(); idxs.forEach(i => pages()[i].rot = (pages()[i].rot + d + 360) % 360); docChanged(); }
function duplicatePages(idxs){
  snapshot();
  const sorted = [...idxs].sort((a, b) => b - a);
  for (const i of sorted) { const c = clone(pages()[i]); c.id = uid(); c.annots.forEach(a => a.id = uid()); pages().splice(i + 1, 0, c); }
  docChanged();
}
function movePages(ids, target){ // target = index d'insertion dans la liste actuelle
  const list = pages(), moving = list.filter(p => ids.has(p.id));
  let t = target - list.slice(0, target).filter(p => ids.has(p.id)).length;
  const rest = list.filter(p => !ids.has(p.id));
  t = clamp(t, 0, rest.length);
  const next = [...rest.slice(0, t), ...moving, ...rest.slice(t)];
  if (next.every((p, i) => p === list[i])) return false;
  snapshot(); S.doc.pages = next; docChanged(); return true;
}

function bindGrid(){
  const grid = $("#pgrid");
  $("#selbar").addEventListener("click", e => {
    const b = e.target.closest("[data-sb]"); if (!b) return;
    const a = b.dataset.sb, idx = selectedIdx();
    if (a === "all") { pages().forEach(p => S.sel.add(p.id)); afterSel(); }
    else if (a === "none") { S.sel.clear(); afterSel(); }
    else if (a === "add") addMenu();
    else if (a === "rotl") rotatePages(idx, -90);
    else if (a === "rotr") rotatePages(idx, 90);
    else if (a === "dup") duplicatePages(idx);
    else if (a === "del") deletePages(idx);
    else if (a === "edit") { S.cur = idx[0]; setWView("edit"); }
    else if (a === "left") movePages(new Set(S.sel), Math.max(0, idx[0] - 1));
    else if (a === "right") movePages(new Set(S.sel), Math.min(pages().length, idx[idx.length - 1] + 2));
  });
  grid.addEventListener("click", e => {
    if (dragJustEnded) return;
    if (e.target.closest("#addCard")) return addMenu();
    const card = e.target.closest(".card"); if (!card) return;
    const i = +card.dataset.i, p = pages()[i];
    const act = e.target.closest("[data-ca]")?.dataset.ca;
    if (act === "rotate") return rotatePages([i], 90);
    if (act === "del") return deletePages([i]);
    if (e.shiftKey && lastClicked != null) { const [a, b] = [Math.min(lastClicked, i), Math.max(lastClicked, i)]; for (let k = a; k <= b; k++) S.sel.add(pages()[k].id); }
    else if (S.sel.has(p.id)) S.sel.delete(p.id); else S.sel.add(p.id);
    lastClicked = i; afterSel();
  });
  grid.addEventListener("dblclick", e => { const card = e.target.closest(".card"); if (card && !e.target.closest("[data-ca]")) { S.cur = +card.dataset.i; setWView("edit"); } });
  grid.addEventListener("keydown", e => { const card = e.target.closest(".card"); if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); card.click(); } });
  grid.addEventListener("pointerdown", onCardDown);
  document.addEventListener("touchmove", e => { if (drag?.active) e.preventDefault(); }, { passive: false });
}
function afterSel(){
  $$("#pgrid .card").forEach(el => el.classList.toggle("sel", S.sel.has(el.dataset.pid)));
  renderSelbar(); TOOLS[S.tool]?.onSel?.(); renderPanelFoot();
}

/* Glisser pour réordonner (souris : déplacement ; tactile : appui long) */
let drag = null, dragJustEnded = false;
function onCardDown(e){
  const card = e.target.closest(".card"); if (!card || e.target.closest("[data-ca]")) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const start = { x: e.clientX, y: e.clientY };
  drag = { card, start, active: false, timer: null, pointerId: e.pointerId };
  if (e.pointerType !== "mouse") drag.timer = setTimeout(() => { if (drag && !drag.active) beginDrag(start); }, 380);
  const move = ev => {
    if (!drag) return;
    const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
    if (!drag.active) {
      if (e.pointerType === "mouse" && dist > 6) beginDrag(start);
      else if (e.pointerType !== "mouse" && dist > 8) { clearTimeout(drag.timer); cleanup(); return; }
      else return;
    }
    moveDrag(ev);
  };
  const up = ev => { if (drag?.active) endDrag(ev); cleanup(); };
  const cleanup = () => { if (drag) clearTimeout(drag.timer); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); if (!drag?.active) drag = null; };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function beginDrag(pt){
  const id = drag.card.dataset.pid;
  if (!S.sel.has(id)) { S.sel.clear(); S.sel.add(id); afterSel(); }
  drag.active = true; drag.ids = new Set(S.sel);
  navigator.vibrate?.(15);
  const src = drag.card.querySelector("canvas"), g = document.createElement("canvas");
  g.width = src.width; g.height = src.height; g.getContext("2d").drawImage(src, 0, 0);
  g.className = "ghost-card"; g.style.width = parseFloat(src.style.width) * .8 + "px"; g.style.height = parseFloat(src.style.height) * .8 + "px";
  g.style.left = pt.x + "px"; g.style.top = pt.y + "px"; document.body.appendChild(g); drag.ghost = g;
  $$("#pgrid .card").forEach(el => { if (drag.ids.has(el.dataset.pid)) el.classList.add("dragging"); });
  drag.scroller = setInterval(() => {
    if (!drag?.last) return; const r = $("#pgrid").getBoundingClientRect(), y = drag.last.y;
    if (y < r.top + 60) $("#pgrid").scrollTop -= 14; else if (y > r.bottom - 60) $("#pgrid").scrollTop += 14;
  }, 16);
}
function moveDrag(ev){
  drag.last = { x: ev.clientX, y: ev.clientY };
  drag.ghost.style.left = ev.clientX + "px"; drag.ghost.style.top = ev.clientY + "px";
  $$("#pgrid .card").forEach(el => el.classList.remove("drop-before", "drop-after"));
  const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".card");
  drag.target = null;
  if (el) {
    const r = el.getBoundingClientRect(), after = ev.clientX > r.left + r.width / 2;
    el.classList.add(after ? "drop-after" : "drop-before");
    drag.target = +el.dataset.i + (after ? 1 : 0);
  } else if (document.elementFromPoint(ev.clientX, ev.clientY)?.closest("#addCard")) drag.target = pages().length;
}
function endDrag(){
  clearInterval(drag.scroller); drag.ghost.remove();
  $$("#pgrid .card").forEach(el => el.classList.remove("drop-before", "drop-after", "dragging"));
  if (drag.target != null) movePages(drag.ids, drag.target);
  drag = null; dragJustEnded = true; setTimeout(() => dragJustEnded = false, 60);
}

/* ============ Outils ============ */
const CATS = { org: ["Organiser", "--c-org"], opt: ["Optimiser", "--c-opt"], conv: ["Convertir", "--c-conv"], edit: ["Modifier", "--c-edit"], sec: ["Sécurité", "--c-sec"] };
const H = {
  sec: (label, inner, hint) => `<div class="pf">${label ? `<div class="pl">${label}</div>` : ""}${inner}${hint ? `<p class="ph">${hint}</p>` : ""}</div>`,
  radios: (name, opts, val) => `<div class="radios" data-radio="${name}">${opts.map(o => `<button class="radio ${o.v === val ? "on" : ""}" data-v="${o.v}"><span class="dot"></span><span><b>${o.label}</b>${o.desc ? `<span>${o.desc}</span>` : ""}</span></button>`).join("")}</div>`,
  seg: (name, opts, val) => `<div class="seg full" data-seg="${name}">${opts.map(o => `<button class="${String(o.v) === String(val) ? "on" : ""}" data-v="${o.v}">${o.label}</button>`).join("")}</div>`,
  range: (name, min, max, step, val, unit = "") => `<div class="range"><input type="range" id="r-${name}" data-range="${name}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${name}"><output>${val}${unit}</output></div>`,
  check: (name, label, val) => `<label class="check"><input type="checkbox" id="c-${name}" data-check="${name}" ${val ? "checked" : ""}> ${label}</label>`,
  input: (name, val, ph, type = "text") => `<input class="input" id="i-${name}" data-input="${name}" type="${type}" value="${esc(val ?? "")}" placeholder="${esc(ph || "")}" autocomplete="off" spellcheck="false">`,
  btn: (act, label, ic, cls = "line") => `<button class="btn ${cls}" data-act="${act}">${ic ? icon(ic) : ""}<span>${label}</span></button>`,
  note: html => `<div class="note">${html}</div>`
};
const allIdx = () => pages().map((_, i) => i);
const outName = (suffix = "", ext = "pdf") => `${baseName(S.doc.name)}${suffix}.${ext}`;
async function deliver(name, data, mime){ const ok = await saveFile(name, data, mime); return ok ? `Enregistré : ${name}` : "Enregistrement annulé."; }
function parseRanges(str, n){
  const out = [];
  for (const part of String(str).split(/[,;]+/).map(s => s.trim()).filter(Boolean)) {
    const m = part.replace(/\s/g, "").match(/^(\d+)(?:-(\d*))?$/); if (!m) return null;
    const a = +m[1], b = m[2] === "" ? n : m[2] ? +m[2] : a;
    if (a < 1 || b < 1 || a > n || b > n) return null;
    const r = []; if (a <= b) for (let i = a; i <= b; i++) r.push(i - 1); else for (let i = a; i >= b; i--) r.push(i - 1);
    out.push(r);
  }
  return out.length ? out : null;
}
const rangeText = idx => { const s = [...idx].sort((a, b) => a - b), out = []; for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i] + 1}-${s[j] + 1}` : `${s[i] + 1}`); i = j; } return out.join(", "); };
function srcGroups(){ const order = []; pages().forEach(p => { const k = p.kind === "pdf" ? "s" + p.src : p.fromImg ? "i" : "b"; if (!order.includes(k)) order.push(k); }); return order; }
const groupKey = p => p.kind === "pdf" ? "s" + p.src : p.fromImg ? "i" : "b";
const groupName = k => k[0] === "s" ? sources[+k.slice(1)].name : k === "i" ? "Images" : "Pages vierges";
const docSize = () => { const used = new Set(pages().filter(p => p.kind === "pdf").map(p => p.src)); return [...used].reduce((s, i) => s + sources[i].size, 0); };
const rasterSources = () => [...new Set(pages().filter(p => p.kind === "pdf" && sources[p.src].raster).map(p => p.src))];

const UI = {
  split: { mode: "each", ranges: "", every: 2 },
  extract: { each: false },
  cmp: { level: "rec" },
  crop: { t: 10, r: 10, b: 10, l: 10, link: true, scope: "all" },
  img: { fmt: "jpg", dpi: 150, scope: "all" },
  txtPreview: null,
  forms: null
};

const TOOLS = {
  merge: {
    cat: "org", icon: "merge", name: "Fusionner", desc: "Assembler plusieurs PDF en un seul, dans l'ordre de votre choix.",
    accept: "any", multi: true, view: "grid", landText: "Sélectionner des fichiers PDF",
    cardBadge: p => { const g = srcGroups(); if (g.length < 2) return null; const k = groupKey(p); return { text: groupName(k), color: GROUP_COLORS[g.indexOf(k) % GROUP_COLORS.length] }; },
    panel(){
      const g = srcGroups();
      return H.sec("Fichiers", `<div class="radios">${g.map((k, i) => `<div class="radio" style="align-items:center"><span class="dot" style="border-color:${GROUP_COLORS[i % GROUP_COLORS.length]};background:${GROUP_COLORS[i % GROUP_COLORS.length]}"></span><span style="flex:1;min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(groupName(k))}</b><span>${plural(pages().filter(p => groupKey(p) === k).length, "page")}</span></span>
        <button class="ib" data-act="gup" data-k="${k}" ${i ? "" : "disabled"} aria-label="Monter">${icon("up")}</button><button class="ib" data-act="gdown" data-k="${k}" ${i < g.length - 1 ? "" : "disabled"} aria-label="Descendre">${icon("down")}</button></div>`).join("")}</div>`,
        g.length < 2 ? "Ajoutez au moins un autre fichier à fusionner." : "Vous pouvez aussi glisser les pages une à une.") +
        H.sec("", `<div class="prow">${H.btn("add", "Ajouter des fichiers", "plus")}${H.btn("sort", "Trier A→Z", "reverse")}</div>`);
    },
    act(a, el){
      if (a === "add") pickFiles("append");
      if (a === "gup" || a === "gdown" || a === "sort") {
        const g = srcGroups();
        if (a === "sort") g.sort((x, y) => groupName(x).localeCompare(groupName(y), "fr", { numeric: true }));
        else { const i = g.indexOf(el.dataset.k), j = a === "gup" ? i - 1 : i + 1; [g[i], g[j]] = [g[j], g[i]]; }
        snapshot(); S.doc.pages = [...pages()].sort((p, q) => g.indexOf(groupKey(p)) - g.indexOf(groupKey(q))); docChanged();
      }
    },
    go: () => "Fusionner le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  split: {
    cat: "org", icon: "split", name: "Diviser", desc: "Séparer un PDF en plusieurs fichiers : par page, par plages ou toutes les N pages.",
    accept: "pdf", view: "grid",
    groups(){
      const n = pages().length, u = UI.split;
      if (u.mode === "each") return allIdx().map(i => [i]);
      if (u.mode === "every") { const k = Math.max(1, +u.every || 1), g = []; for (let i = 0; i < n; i += k) g.push(allIdx().slice(i, i + k)); return g; }
      if (u.mode === "sel") return S.sel.size ? [selectedIdx()] : [];
      return parseRanges(u.ranges, n) || [];
    },
    cardBadge(p, i){ const g = this.groups(), k = g.findIndex(x => x.includes(i)); return k < 0 ? null : { text: "Fichier " + (k + 1), color: GROUP_COLORS[k % GROUP_COLORS.length] }; },
    panel(){
      const u = UI.split, n = pages().length;
      return H.sec("Méthode", H.radios("mode", [
        { v: "each", label: "Une page par fichier", desc: `${plural(n, "fichier")} PDF` },
        { v: "every", label: "Toutes les N pages", desc: "Des fichiers de même longueur" },
        { v: "ranges", label: "Plages personnalisées", desc: "Par exemple 1-3, 4-8, 9" },
        { v: "sel", label: "Pages sélectionnées", desc: "Un seul fichier avec votre sélection" }
      ], u.mode)) +
        (u.mode === "every" ? H.sec("Pages par fichier", H.input("every", u.every, "2", "number")) : "") +
        (u.mode === "ranges" ? H.sec("Plages", H.input("ranges", u.ranges, "1-3, 4-8, 9"), `Chaque plage devient un fichier. Pages 1 à ${n}.`) : "") +
        (u.mode === "sel" ? H.note(S.sel.size ? `<b>${plural(S.sel.size, "page")}</b> sélectionnée${S.sel.size > 1 ? "s" : ""}.` : "Touchez les pages à garder dans la vue Pages.") : "");
    },
    set(k, v){ UI.split[k] = v; if (k === "mode") renderPanel(); renderGrid(); renderPanelFoot(); },
    onSel(){ if (UI.split.mode === "sel") { renderPanel(); renderGrid(); } },
    go(){ const g = this.groups(); return g.length > 1 ? `Diviser en ${g.length} fichiers` : g.length ? "Créer le PDF" : "Choisissez des pages"; },
    disabled(){ return !this.groups().length; },
    validate(){ if (UI.split.mode === "ranges" && !parseRanges(UI.split.ranges, pages().length)) return `Plages invalides. Exemple : 1-3, 4-${pages().length}.`; },
    async run(){
      const g = this.groups();
      if (g.length === 1) return deliver(outName("-extrait"), await buildPdf(g[0], { onProgress: setProg }));
      const files = [];
      for (let k = 0; k < g.length; k++) { setProg(k / g.length); files.push({ name: `${baseName(S.doc.name)}-${String(k + 1).padStart(String(g.length).length, "0")}${g[k].length > 1 ? `_p${g[k][0] + 1}-${g[k][g[k].length - 1] + 1}` : `_p${g[k][0] + 1}`}.pdf`, data: await buildPdf(g[k]) }); }
      return deliver(outName("-divise", "zip"), makeZip(files), "application/zip");
    }
  },
  remove: {
    cat: "org", icon: "trash", name: "Supprimer des pages", desc: "Retirer les pages inutiles de votre PDF.",
    accept: "pdf", view: "grid", selMode: "del", selHint: "Touchez les pages à supprimer",
    panel(){ return H.note("Touchez les pages à supprimer, ou indiquez leurs numéros.") + H.sec("Pages à supprimer", H.input("ranges", rangeText(selectedIdx()), "ex. 2, 5-7")); },
    set(k, v){ const r = parseRanges(v, pages().length); if (r) { S.sel.clear(); r.flat().forEach(i => S.sel.add(pages()[i].id)); afterSel(); } },
    onSel(){ const i = $("#i-ranges"); if (i && document.activeElement !== i) i.value = rangeText(selectedIdx()); },
    go: () => S.sel.size ? `Supprimer ${plural(S.sel.size, "page")}` : "Choisissez des pages",
    disabled: () => !S.sel.size || S.sel.size >= pages().length,
    async run(){
      const keep = allIdx().filter(i => !S.sel.has(pages()[i].id));
      const msg = await deliver(outName(), await buildPdf(keep, { onProgress: setProg }));
      if (!msg.includes("annulé")) { snapshot(); const del = new Set(S.sel); S.doc.pages = pages().filter(p => !del.has(p.id)); S.sel.clear(); S.cur = 0; docChanged(); }
      return msg;
    }
  },
  extract: {
    cat: "org", icon: "extract", name: "Extraire des pages", desc: "Créer un nouveau PDF avec seulement les pages choisies.",
    accept: "pdf", view: "grid", selHint: "Touchez les pages à extraire",
    cardBadge: p => S.sel.has(p.id) ? { text: "Extraite", color: "#1f9d6a" } : null,
    panel(){ return H.sec("Pages à extraire", H.input("ranges", rangeText(selectedIdx()), "ex. 1-3, 8"), "Touchez les pages ou indiquez leurs numéros.") + H.sec("", H.check("each", "Un fichier par page (zip)", UI.extract.each)); },
    set(k, v){ if (k === "each") { UI.extract.each = v; renderPanelFoot(); return; } const r = parseRanges(v, pages().length); if (r) { S.sel.clear(); r.flat().forEach(i => S.sel.add(pages()[i].id)); afterSel(); renderGrid(); } },
    onSel(){ const i = $("#i-ranges"); if (i && document.activeElement !== i) i.value = rangeText(selectedIdx()); renderGrid(); },
    go: () => S.sel.size ? `Extraire ${plural(S.sel.size, "page")}` : "Choisissez des pages",
    disabled: () => !S.sel.size,
    async run(){
      const idx = selectedIdx();
      if (UI.extract.each && idx.length > 1) { const files = []; for (const i of idx) { setProg(files.length / idx.length); files.push({ name: `${baseName(S.doc.name)}_p${i + 1}.pdf`, data: await buildPdf([i]) }); } return deliver(outName("-pages", "zip"), makeZip(files), "application/zip"); }
      return deliver(outName("-extrait"), await buildPdf(idx, { onProgress: setProg }));
    }
  },
  organize: {
    cat: "org", icon: "organize", name: "Organiser", desc: "Réordonner, pivoter, dupliquer, ajouter ou supprimer des pages.",
    accept: "any", multi: true, view: "grid",
    panel(){ return H.note(narrow() ? "Appui long sur une page pour la déplacer. Touchez pour sélectionner." : "Glissez les pages pour les réordonner. Sélectionnez-en plusieurs avec Maj.") + H.sec("Actions", `<div class="radios">${H.btn("add", "Ajouter des fichiers", "plus")}${H.btn("blank", "Ajouter une page vierge", "blank")}${H.btn("reverse", "Inverser l'ordre des pages", "reverse")}</div>`); },
    act(a){
      if (a === "add") pickFiles("append");
      if (a === "blank") { const l = pages()[pages().length - 1]; snapshot(); pages().push(blankPage(l?.w, l?.h)); docChanged(); }
      if (a === "reverse") { snapshot(); S.doc.pages.reverse(); docChanged(); }
    },
    go: () => "Enregistrer le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  rotate: {
    cat: "org", icon: "rotate", name: "Pivoter", desc: "Tourner une page ou tout le document d'un quart de tour.",
    accept: "pdf", view: "grid",
    panel(){ return H.sec(S.sel.size ? `${plural(S.sel.size, "page sélectionnée", "pages sélectionnées")}` : "Toutes les pages", `<div class="prow">${H.btn("l", "Vers la gauche", "rotl")}${H.btn("r", "Vers la droite", "rotate")}</div>`, S.sel.size ? "" : "Sélectionnez des pages pour ne pivoter qu'elles."); },
    act(a){ rotatePages(S.sel.size ? selectedIdx() : allIdx(), a === "l" ? -90 : 90); },
    onSel(){ renderPanel(); },
    go: () => "Enregistrer le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  compress: {
    cat: "opt", icon: "compress", name: "Compresser", desc: "Réduire le poids du PDF en optimisant ses images.",
    accept: "pdf", view: "grid",
    levels: { light: null, rec: { maxDim: 1800, q: .72 }, strong: { maxDim: 1200, q: .55 }, max: "raster" },
    panel(){
      return H.note(`Taille actuelle : <b>${fmtSize(docSize())}</b>`) + H.sec("Niveau", H.radios("level", [
        { v: "light", label: "Légère", desc: "Réorganise le fichier sans toucher aux images." },
        { v: "rec", label: "Recommandée", desc: "Bonne qualité, gain important sur les photos." },
        { v: "strong", label: "Forte", desc: "Images plus légères, qualité correcte à l'écran." },
        { v: "max", label: "Maximale", desc: "Chaque page devient une image : le texte n'est plus sélectionnable." }
      ], UI.cmp.level));
    },
    set(k, v){ UI.cmp[k] = v; renderPanel(); },
    go: () => "Compresser le PDF",
    async run(){
      const before = docSize(), L = this.levels[UI.cmp.level];
      const bytes = await buildPdf(allIdx(), L === "raster" ? { raster: true, rasterDpi: 110, rasterQ: .55, onProgress: setProg } : { compress: L, onProgress: setProg });
      const msg = await deliver(outName("-compresse"), bytes);
      if (msg.includes("annulé")) return msg;
      const gain = before ? Math.round((1 - bytes.length / before) * 100) : 0;
      return `${fmtSize(before)} → ${fmtSize(bytes.length)}${gain > 0 ? ` · −${gain} %` : " · déjà optimisé"}`;
    }
  },
  crop: {
    cat: "opt", icon: "crop", name: "Recadrer", desc: "Rogner les marges des pages, pour tout le document ou une sélection.",
    accept: "pdf", view: "grid",
    scopeIdx(){ return UI.crop.scope === "sel" && S.sel.size ? selectedIdx() : allIdx(); },
    onEnter(){ const p = pages()[this.scopeIdx()[0]]; if (p?.crop) { const v = cropToVis(rotOf(p), p.crop); Object.assign(UI.crop, { t: Math.round(v.t / MM), r: Math.round(v.r / MM), b: Math.round(v.b / MM), l: Math.round(v.l / MM) }); } },
    panel(){
      const u = UI.crop, sides = u.link ? [["all", "Marges"]] : [["t", "Haut"], ["b", "Bas"], ["l", "Gauche"], ["r", "Droite"]];
      return H.sec("Pages concernées", H.seg("scope", [{ v: "all", label: "Toutes" }, { v: "sel", label: `Sélection${S.sel.size ? ` (${S.sel.size})` : ""}` }], u.scope)) +
        H.sec("", H.check("link", "Même marge des 4 côtés", u.link)) +
        sides.map(([k, l]) => H.sec(l, H.range(k, 0, 80, 1, k === "all" ? u.t : u[k], " mm"))).join("") +
        H.sec("", H.btn("clear", "Retirer le recadrage", "x"), "L'aperçu se met à jour sur les vignettes.");
    },
    apply(){
      const u = UI.crop;
      for (const i of this.scopeIdx()) {
        const p = pages()[i], v = { t: u.t * MM, r: u.r * MM, b: u.b * MM, l: u.l * MM };
        const c = cropToUnrot(rotOf(p), v);
        c.l = Math.min(c.l, p.w * .45); c.r = Math.min(c.r, p.w * .45); c.t = Math.min(c.t, p.h * .45); c.b = Math.min(c.b, p.h * .45);
        p.crop = (c.l || c.r || c.t || c.b) ? c : null;
      }
    },
    snapTaken: false,
    set(k, v, kind){
      const u = UI.crop;
      if (k === "scope" || k === "link") { u[k] = v; if (k === "link" && v) u.r = u.b = u.l = u.t; renderPanel(); return; }
      if (!this.snapTaken) { snapshot(); this.snapTaken = true; }
      if (k === "all") u.t = u.r = u.b = u.l = +v; else u[k] = +v;
      this.apply(); docChanged(true, true);
      if (kind === "change") this.snapTaken = false;
    },
    act(a){ if (a === "clear") { snapshot(); pages().forEach(p => p.crop = null); Object.assign(UI.crop, { t: 0, r: 0, b: 0, l: 0 }); renderPanel(); docChanged(); } },
    go: () => "Enregistrer le PDF",
    async run(){ if (!pages().some(p => p.crop)) { this.apply(); docChanged(); } return deliver(outName("-recadre"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  img2pdf: {
    cat: "conv", icon: "img2pdf", name: "Images en PDF", desc: "Transformer des photos ou des scans en un seul PDF.",
    accept: "img", multi: true, view: "grid", landText: "Sélectionner des images",
    panel(){
      const o = S.doc.imgOpts;
      return H.sec("Format de page", H.seg("page", [{ v: "A4", label: "A4" }, { v: "letter", label: "Lettre" }, { v: "fit", label: "Image" }], o.page)) +
        (o.page !== "fit" ? H.sec("Orientation", H.seg("orient", [{ v: "auto", label: "Auto" }, { v: "port", label: "Portrait" }, { v: "land", label: "Paysage" }], o.orient)) : "") +
        H.sec("Marges", H.seg("margin", [{ v: "none", label: "Aucune" }, { v: "small", label: "Petites" }, { v: "big", label: "Grandes" }], o.margin)) +
        H.sec("", H.btn("add", "Ajouter des images", "plus"));
    },
    set(k, v){ S.doc.imgOpts[k] = v; pages().forEach(p => { if (p.fromImg) layoutImagePage(p); }); renderPanel(); docChanged(); },
    act(a){ if (a === "add") pickFiles("append", "image/*"); },
    go: () => "Créer le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  pdf2img: {
    cat: "conv", icon: "pdf2img", name: "PDF en images", desc: "Exporter chaque page en JPG ou en PNG.",
    accept: "pdf", view: "grid",
    panel(){
      const u = UI.img;
      return H.sec("Format", H.seg("fmt", [{ v: "jpg", label: "JPG" }, { v: "png", label: "PNG" }], u.fmt)) +
        H.sec("Qualité", H.radios("dpi", [{ v: 72, label: "Légère · 72 ppp", desc: "Pour un aperçu ou un e-mail." }, { v: 150, label: "Standard · 150 ppp", desc: "Pour l'écran et les réseaux." }, { v: 300, label: "Haute · 300 ppp", desc: "Pour imprimer." }], u.dpi)) +
        H.sec("Pages", H.seg("scope", [{ v: "all", label: "Toutes" }, { v: "sel", label: `Sélection${S.sel.size ? ` (${S.sel.size})` : ""}` }], u.scope));
    },
    set(k, v){ UI.img[k] = k === "dpi" ? +v : v; renderPanel(); },
    onSel(){ renderPanel(); },
    go: () => `Convertir en ${UI.img.fmt.toUpperCase()}`,
    async run(){
      const u = UI.img, idx = u.scope === "sel" && S.sel.size ? selectedIdx() : allIdx(), n = pages().length, files = [];
      for (const i of idx) {
        setProg(files.length / idx.length);
        const c = await renderPageCanvas(pages()[i], i, n, u.dpi / 72, { nocache: true, throwOnError: true });
        files.push({ name: `${baseName(S.doc.name)}_p${i + 1}.${u.fmt}`, data: await canvasBytes(c, u.fmt === "png" ? "image/png" : "image/jpeg", .9) });
      }
      if (files.length === 1) return deliver(files[0].name, files[0].data, u.fmt === "png" ? "image/png" : "image/jpeg");
      return deliver(outName("-images", "zip"), makeZip(files), "application/zip");
    }
  },
  txt2pdf: {
    cat: "conv", icon: "txt", name: "Texte en PDF", desc: "Écrire ou coller du texte et obtenir un PDF propre.",
    accept: "none", view: "grid", landing: "text",
    panel(){
      const o = S.doc.txtOpts;
      return H.sec("Votre texte", `<textarea class="input" id="txtArea" style="height:220px;padding:12px;line-height:1.5;resize:vertical">${esc(S.doc.txt || "")}</textarea>`, "Astuce : « # » pour un titre, « - » pour une liste.") +
        H.sec("Police", H.seg("font", Object.entries(FONTS).map(([k, f]) => ({ v: k, label: f.label })), o.font)) +
        H.sec("Taille du texte", H.range("size", 8, 18, 1, o.size, " pt")) +
        H.sec("Marges", H.seg("margin", [{ v: 12, label: "Étroites" }, { v: 20, label: "Normales" }, { v: 30, label: "Larges" }], o.margin)) +
        H.sec("Format", H.seg("page", [{ v: "A4", label: "A4" }, { v: "letter", label: "Lettre" }], o.page)) +
        H.sec("", H.btn("import", "Importer un fichier .txt", "upload"));
    },
    afterPanel(){ $("#txtArea")?.addEventListener("input", e => { S.doc.txt = e.target.value; regenTxtSoon(); }); },
    set(k, v, kind){ S.doc.txtOpts[k] = k === "size" || k === "margin" ? +v : v; if (kind !== "input") renderPanel(); else $("#r-size")?.nextElementSibling && ($("#r-size").nextElementSibling.textContent = v + " pt"); regenTxtSoon(); },
    act(a){ if (a === "import") pickText(); },
    go: () => "Créer le PDF",
    async run(){ await regenTxt(); return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  pdf2txt: {
    cat: "conv", icon: "lines", name: "PDF en texte", desc: "Récupérer tout le texte d'un PDF dans un fichier .txt.",
    accept: "pdf", view: "grid",
    async onEnter(){ UI.txtPreview = null; UI.txtPreview = await extractAllText(); if (S.tool === "pdf2txt") renderPanel(); },
    panel(){
      const t = UI.txtPreview;
      return H.sec("Aperçu", t == null ? `<p class="ph">Lecture du texte…</p>` : t.join("").trim() ? `<textarea class="input" readonly style="height:300px;padding:12px;line-height:1.45;font-size:13px;resize:vertical">${esc(t.join("\n\n").slice(0, 20000))}</textarea>` : H.note("Aucun texte trouvé. Ce PDF est sans doute une image scannée."), "") +
        (t?.join("").trim() ? H.sec("", H.btn("copy", "Copier le texte", "copy")) : "");
    },
    async act(a){ if (a === "copy") { const t = UI.txtPreview.join("\n\n"); try { await navigator.clipboard.writeText(t); toast("Texte copié"); } catch { const ta = $("#pbody textarea"); ta.select(); toast("Texte sélectionné : copiez-le avec Ctrl+C"); } } },
    go: () => "Télécharger le .txt",
    async run(){ const t = UI.txtPreview || await extractAllText(); return deliver(outName("", "txt"), new Blob([t.map((x, i) => `--- Page ${i + 1} ---\n${x}`).join("\n\n")], { type: "text/plain;charset=utf-8" }), "text/plain"); }
  },
  pdf2word: {
    cat: "conv", icon: "word", name: "PDF en Word", desc: "Convertir le texte d'un PDF en document Word modifiable.",
    accept: "pdf", view: "grid",
    panel(){ return H.note("Le texte est repris paragraphe par paragraphe, avec un saut de page entre chaque page. <b>La mise en page, les images et les tableaux ne sont pas conservés.</b>"); },
    go: () => "Convertir en Word",
    async run(){ const t = await extractAllText(); if (!t.join("").trim()) throw new Error("Aucun texte trouvé dans ce PDF."); return deliver(outName("", "docx"), makeDocx(t), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
  },
  edit: {
    cat: "edit", icon: "pen", name: "Modifier un PDF", desc: "Ajouter du texte, retoucher l'existant, dessiner, surligner, insérer des images.",
    accept: "any", multi: true, view: "edit", etool: "text", blank: true, sample: true,
    panel(){
      return H.note("<b>Retoucher</b> remplace un texte du PDF par le vôtre. <b>Masquer</b> couvre une zone en blanc.") +
        H.sec("Ajouts rapides", `<div class="radios">${H.btn("date", "Ajouter la date du jour", "calendar")}${H.btn("blank", "Ajouter une page vierge", "blank")}</div>`);
    },
    act(a){
      if (a === "date") addTextAnnot(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }));
      if (a === "blank") { const c = cur(); snapshot(); pages().splice(S.cur + 1, 0, blankPage(c?.w, c?.h)); S.cur++; docChanged(); }
    },
    go: () => "Enregistrer le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  sign: {
    cat: "edit", icon: "sign", name: "Signer", desc: "Signer à la main et réutiliser vos signatures.",
    accept: "pdf", view: "edit", etool: "select", blank: true,
    panel(){
      const l = sigCache || [];
      return H.sec("Vos signatures", (l.length ? `<div class="siglist">${l.map(s => `<button data-act="use" data-id="${s.id}" aria-label="Utiliser cette signature"><img alt="" src="${URL.createObjectURL(new Blob([s.bytes], { type: "image/png" }))}"></button>`).join("")}</div>` : `<p class="ph">Aucune signature enregistrée pour l'instant.</p>`) + `<div class="prow" style="margin-top:4px">${H.btn("new", "Nouvelle signature", "sign", "primary")}${l.length ? H.btn("clear", "Tout effacer", "trash", "ghost") : ""}</div>`, l.length ? "Touchez une signature pour l'ajouter à la page." : "") +
        H.sec("Compléter", `<div class="radios">${H.btn("date", "Ajouter la date du jour", "calendar")}${H.btn("lu", "Ajouter « Lu et approuvé »", "text")}</div>`);
    },
    async onEnter(){ await loadSignatures(); if (S.tool === "sign") renderPanel(); },
    async act(a, el){
      if (a === "new") openSign();
      if (a === "use") useSignature(el.dataset.id);
      if (a === "clear") { const v = await choose("Effacer les signatures ?", "Elles ne seront plus proposées sur cet appareil.", [{ v: false, label: "Annuler" }, { v: true, label: "Effacer", primary: true }]); if (v) { sigCache = []; await DB.set("sigs", []); renderPanel(); } }
      if (a === "date") addTextAnnot(new Date().toLocaleDateString("fr-FR"));
      if (a === "lu") addTextAnnot("Lu et approuvé");
    },
    go: () => "Enregistrer le PDF signé",
    async run(){ return deliver(outName("-signe"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  redact: {
    cat: "edit", icon: "redact", name: "Caviarder", desc: "Effacer définitivement des informations sensibles.",
    accept: "pdf", view: "edit", etool: "redact",
    count: () => pages().reduce((s, p) => s + p.annots.filter(a => a.kind === "redact").length, 0),
    panel(){
      return H.sec("Rechercher et caviarder", `<div class="prow">${H.input("q", this.q || "", "Nom, numéro, adresse…")}${H.btn("search", "Caviarder", "search")}</div>`, "Toutes les occurrences sont masquées, sur toutes les pages.") +
        H.note(`<b>${plural(this.count(), "zone caviardée", "zones caviardées")}</b>. À l'enregistrement, les pages concernées sont converties en image : le contenu masqué disparaît vraiment.`);
    },
    set(k, v){ this.q = v; },
    async act(a){
      if (a !== "search") return;
      const q = (this.q || "").trim(); if (!q) return toast("Saisissez le texte à caviarder.");
      const norm = s => [...s].map(c => c.normalize("NFD")[0].toLowerCase()).join(""), nq = norm(q);
      let n = 0; const adds = [];
      for (const p of pages()) {
        if (p.kind !== "pdf") continue;
        const items = await getTextItems(p).catch(() => []);
        for (const it of items) {
          if (!it.horiz) continue;
          const s = norm(it.str); let k = s.indexOf(nq);
          while (k >= 0) { const x = it.x + it.w * k / s.length, w = it.w * nq.length / s.length; adds.push([p, { id: uid(), type: "rect", kind: "redact", color: "#000000", x: x - 1, y: it.top - .5, w: w + 2, h: it.h + 1 }]); n++; k = s.indexOf(nq, k + nq.length); }
        }
      }
      if (!n) return toast("Aucune occurrence trouvée.");
      snapshot(); adds.forEach(([p, a]) => p.annots.push(a)); docChanged(); renderPanel();
      toast(`${plural(n, "occurrence caviardée", "occurrences caviardées")}`);
    },
    go: () => "Enregistrer le PDF caviardé",
    async run(){ return deliver(outName("-caviarde"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  watermark: {
    cat: "edit", icon: "drop", name: "Filigrane", desc: "Apposer un texte ou un logo sur toutes les pages.",
    accept: "pdf", view: "grid",
    onEnter(){ S.doc.wm.on = true; },
    panel(){
      const w = S.doc.wm;
      return H.sec("", H.check("on", "Filigrane activé", w.on)) +
        H.sec("Type", H.seg("mode", [{ v: "text", label: "Texte" }, { v: "image", label: "Image" }], w.mode)) +
        (w.mode === "text" ? H.sec("Texte", H.input("text", w.text, "CONFIDENTIEL")) + H.sec("Couleur", swatches(["#e5484d", "#16171b", "#2a62d6", "#1f9d6a", "#8a8f99"], w.color, "color"))
          : H.sec("Image", `${w.img && images[w.img] ? `<img src="${images[w.img].url}" alt="" style="max-height:70px;max-width:100%;border-radius:8px;border:1px solid var(--line);background:#fff;align-self:flex-start">` : ""}${H.btn("img", w.img ? "Changer d'image" : "Choisir une image", "image")}`, "Un logo en PNG transparent rend mieux.")) +
        H.sec("Taille", H.range("size", 10, 100, 1, w.size, " %")) +
        H.sec("Opacité", H.range("opacity", 5, 100, 1, Math.round(w.opacity * 100), " %")) +
        H.sec("Inclinaison", H.seg("angle", [{ v: 0, label: "0°" }, { v: 35, label: "35°" }, { v: 45, label: "45°" }, { v: 90, label: "90°" }], w.angle)) +
        H.sec("Position", `<div class="posgrid" data-pos="pos">${Object.keys(POS).map(k => `<button class="${w.pos === k && !w.tile ? "on" : ""}" data-v="${k}" aria-label="${k}"></button>`).join("")}</div>${H.check("tile", "Répéter sur toute la page", w.tile)}`);
    },
    set(k, v, kind){
      const w = S.doc.wm;
      if (k === "opacity") w.opacity = v / 100; else if (k === "size" || k === "angle") w[k] = +v; else w[k] = v;
      if (k !== "on" && k !== "tile" && k !== "pos") w.on = true;
      if (k === "pos") w.tile = false;
      if (["mode", "on", "angle", "pos", "tile", "color"].includes(k)) renderPanel();
      else { const o = $(`#r-${k}`)?.nextElementSibling; if (o) o.textContent = v + " %"; }
      stampsChanged();
    },
    act(a, el){ if (a === "img") $("#wmIn").click(); if (a === "color") this.set("color", el.dataset.v); },
    go: () => "Enregistrer avec filigrane",
    async run(){ return deliver(outName("-filigrane"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  numbers: {
    cat: "edit", icon: "hash", name: "Numéroter", desc: "Ajouter les numéros de page, à l'endroit et au format voulus.",
    accept: "pdf", view: "grid",
    onEnter(){ S.doc.num.on = true; },
    panel(){
      const m = S.doc.num;
      return H.sec("", H.check("on", "Numéros activés", m.on)) +
        H.sec("Position", `<div class="posgrid" data-pos="pos" style="aspect-ratio:3/4">${["tl", "tc", "tr"].map(k => `<button class="${m.pos === k ? "on" : ""}" data-v="${k}" aria-label="Haut"></button>`).join("")}${["", "", ""].map(() => `<span></span>`).join("")}${["bl", "bc", "br"].map(k => `<button class="${m.pos === k ? "on" : ""}" data-v="${k}" aria-label="Bas"></button>`).join("")}</div>`) +
        H.sec("Format", H.radios("fmt", [{ v: "n", label: "1" }, { v: "nof", label: "1 / 12" }, { v: "page", label: "Page 1" }, { v: "pageof", label: "Page 1 sur 12" }, { v: "dash", label: "– 1 –" }], m.fmt)) +
        H.sec("Commencer à", H.input("start", m.start, "1", "number")) +
        H.sec("Taille", H.range("size", 7, 20, 1, m.size, " pt")) +
        H.sec("Distance du bord", H.range("margin", 10, 60, 1, m.margin, " pt")) +
        H.sec("", H.check("skipFirst", "Ne pas numéroter la première page", m.skipFirst));
    },
    set(k, v){
      const m = S.doc.num;
      m[k] = ["start", "size", "margin"].includes(k) ? Math.max(k === "start" ? 0 : 1, parseInt(v) || 0) : v;
      if (k !== "on") m.on = true;
      if (["pos", "fmt", "on", "skipFirst"].includes(k)) renderPanel();
      else { const o = $(`#r-${k}`)?.nextElementSibling; if (o) o.textContent = v + " pt"; }
      stampsChanged();
    },
    go: () => "Enregistrer avec numéros",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  forms: {
    cat: "edit", icon: "forms", name: "Remplir un formulaire", desc: "Compléter les champs d'un formulaire PDF.",
    accept: "pdf", view: "grid",
    async onEnter(){ UI.forms = null; UI.forms = await readForms(); if (S.tool === "forms") renderPanel(); },
    panel(){
      const F = UI.forms;
      if (F == null) return `<p class="ph">Lecture du formulaire…</p>`;
      if (!F.length) return H.note("Ce PDF ne contient pas de champs à remplir.") + H.sec("", H.btn("toedit", "Écrire directement sur la page", "pen", "primary"), "Utilisez l'outil Texte de l'éditeur pour compléter un formulaire scanné.");
      return F.map(g => H.sec(sources.length > 1 ? esc(sources[g.src].name) : "Champs", g.fields.map(f => {
        const v = S.doc.forms[g.src]?.[f.name] ?? f.value;
        const lbl = `<label for="ff-${esc(f.key)}">${esc(f.name)}</label>`;
        if (f.type === "check") return `<label class="check"><input type="checkbox" id="ff-${esc(f.key)}" data-ff="${g.src}" data-fn="${esc(f.name)}" ${v ? "checked" : ""}> ${esc(f.name)}</label>`;
        if (f.type === "choice") return `<div class="formf">${lbl}<select class="selinp" id="ff-${esc(f.key)}" data-ff="${g.src}" data-fn="${esc(f.name)}"><option value=""></option>${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
        return `<div class="formf">${lbl}<input class="input" id="ff-${esc(f.key)}" data-ff="${g.src}" data-fn="${esc(f.name)}" value="${esc(v || "")}" autocomplete="off"></div>`;
      }).join(""))).join("") + H.sec("", H.check("flatten", "Figer les champs (plus modifiables ensuite)", S.doc.formsFlatten));
    },
    set(k, v){ if (k === "flatten") S.doc.formsFlatten = v; persistSoon(); },
    act(a){ if (a === "toedit") setTool("edit"); },
    go: () => "Enregistrer le formulaire",
    async run(){ return deliver(outName("-rempli"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  protect: {
    cat: "sec", icon: "lock", name: "Protéger", desc: "Chiffrer le PDF avec un mot de passe.",
    accept: "pdf", view: "grid",
    panel(){
      const p = S.protect, t = p.show ? "text" : "password";
      return H.sec("Mot de passe", H.input("user", p.user, "Mot de passe", t) + H.input("confirm", p.confirm, "Confirmer le mot de passe", t) + H.check("show", "Afficher", p.show)) +
        H.sec("Autorisations", H.check("print", "Autoriser l'impression", p.print) + H.check("copy", "Autoriser la copie du texte", p.copy) + H.check("modify", "Autoriser les modifications", p.modify)) +
        H.note(`Chiffrement <b>${globalThis.crypto?.subtle ? "AES" : "RC4"} 128 bits</b>. Gardez ce mot de passe : sans lui, le fichier ne peut plus être ouvert.`);
    },
    set(k, v){ S.protect[k] = v; if (k === "show") renderPanel(); },
    validate(){
      const p = S.protect;
      if (!p.user) return "Choisissez un mot de passe.";
      if (p.user !== p.confirm) return "Les deux mots de passe ne correspondent pas.";
      if (!latin1Ok(p.user)) return "Évitez les emojis et caractères spéciaux dans le mot de passe.";
    },
    go: () => "Protéger le PDF",
    async run(){ return deliver(outName("-protege"), await buildPdf(allIdx(), { onProgress: setProg, protect: { ...S.protect } })); }
  },
  unlock: {
    cat: "sec", icon: "unlock", name: "Déverrouiller", desc: "Retirer le mot de passe d'un PDF dont vous connaissez le code.",
    accept: "pdf", view: "grid",
    panel(){
      const r = rasterSources();
      if (!r.length) return H.note("Ce PDF n'est pas protégé. Vous pouvez l'enregistrer tel quel.");
      return H.note(`<b>Déverrouillé pour cette session.</b> En l'enregistrant, le mot de passe et les restrictions sont retirés.`) + H.note("Les pages sont enregistrées comme des images haute définition : le texte ne sera plus sélectionnable.");
    },
    go: () => rasterSources().length ? "Enregistrer sans mot de passe" : "Enregistrer le PDF",
    async run(){ return deliver(outName("-deverrouille"), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  meta: {
    cat: "sec", icon: "info", name: "Infos du document", desc: "Modifier le titre et l'auteur, ou effacer les métadonnées.",
    accept: "pdf", view: "grid",
    async onEnter(){
      if (!S.doc.meta) {
        const m = { title: "", author: "", subject: "", keywords: "", clear: false };
        const p = pages().find(x => x.kind === "pdf");
        if (p) try { const info = (await (await getPdf(p.src)).getMetadata())?.info || {}; Object.assign(m, { title: info.Title || "", author: info.Author || "", subject: info.Subject || "", keywords: info.Keywords || "" }); } catch {}
        this.draft = m;
      } else this.draft = S.doc.meta;
      if (S.tool === "meta") renderPanel();
    },
    panel(){
      const m = this.draft || { title: "", author: "", subject: "", keywords: "", clear: false };
      return (m.clear ? "" : H.sec("Titre", H.input("title", m.title, "Titre du document")) + H.sec("Auteur", H.input("author", m.author, "Nom")) + H.sec("Sujet", H.input("subject", m.subject, "")) + H.sec("Mots-clés", H.input("keywords", m.keywords, "séparés par des virgules"))) +
        H.sec("", H.check("clear", "Effacer toutes les métadonnées", m.clear), "Retire le titre, l'auteur, le logiciel et les dates du fichier.");
    },
    set(k, v){ this.draft[k] = v; S.doc.meta = this.draft; if (k === "clear") renderPanel(); renderPanelFoot(); persistSoon(); },
    go: () => "Enregistrer le PDF",
    async run(){ if (!S.doc.meta && this.draft) S.doc.meta = this.draft; return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  }
};
Object.entries(TOOLS).forEach(([id, t]) => t.id = id);

async function extractAllText(){ const out = []; for (const p of pages()) out.push(p.kind === "pdf" ? await pageText(p).catch(() => "") : ""); return out; }
async function readForms(){
  const L = PDFLib, out = [];
  const used = [...new Set(pages().filter(p => p.kind === "pdf" && !sources[p.src].raster).map(p => p.src))];
  for (const i of used) {
    try {
      const d = await L.PDFDocument.load(sources[i].bytes, { updateMetadata: false });
      const fields = [];
      for (const f of d.getForm().getFields()) {
        const name = f.getName(), key = i + "-" + name.replace(/[^\w-]/g, "_");
        if (f instanceof L.PDFTextField) fields.push({ name, key, type: "text", value: f.getText() || "" });
        else if (f instanceof L.PDFCheckBox) fields.push({ name, key, type: "check", value: f.isChecked() });
        else if (f instanceof L.PDFDropdown || f instanceof L.PDFOptionList) fields.push({ name, key, type: "choice", options: f.getOptions(), value: f.getSelected()[0] || "" });
        else if (f instanceof L.PDFRadioGroup) fields.push({ name, key, type: "choice", options: f.getOptions(), value: f.getSelected() || "" });
      }
      if (fields.length) out.push({ src: i, fields });
    } catch (e) { console.warn("forms", e); }
  }
  return out;
}

/* Texte -> PDF : régénération */
let txtT, txtSrc = null;
const SAMPLE_TXT = `# Lettre de résiliation

Madame, Monsieur,

Par la présente, je vous informe de ma décision de résilier mon abonnement n° 48213, conformément aux conditions générales de vente.

Je vous remercie de bien vouloir :
- confirmer la résiliation par écrit ;
- m'adresser le solde de tout compte ;
- cesser tout prélèvement à compter de ce jour.

Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

Camille Martin`;
function regenTxtSoon(){ clearTimeout(txtT); txtT = setTimeout(regenTxt, 450); }
async function regenTxt(){
  clearTimeout(txtT);
  const bytes = await textToPdf(S.doc.txt || " ", S.doc.txtOpts);
  const pdf = await openPdf(bytes);
  if (txtSrc == null || !sources[txtSrc]) txtSrc = sources.push({}) - 1;
  sources[txtSrc] = { bytes, name: S.doc.name + ".pdf", raster: null, pageCount: pdf.numPages, size: bytes.length, pdfP: Promise.resolve(pdf) };
  written.delete("src:" + txtSrc);
  for (const k of [...baseCache.keys()]) if (k.startsWith(txtSrc + ":")) baseCache.delete(k);
  for (const k of [...textCache.keys()]) if (k.startsWith(txtSrc + ":")) textCache.delete(k);
  const out = [];
  for (let i = 0; i < pdf.numPages; i++) { const pg = await pdf.getPage(i + 1); const [x1, y1, x2, y2] = pg.view; out.push({ id: pages()[i]?.id && pages()[i].src === txtSrc ? pages()[i].id : uid(), kind: "pdf", src: txtSrc, index: i, w: x2 - x1, h: y2 - y1, ox: x1, oy: y1, baseRot: 0, rot: 0, annots: [] }); }
  S.doc.pages = out; S.cur = 0;
  for (const el of cardEls.values()) { const c = el.querySelector("canvas"); if (c) delete c.dataset.key; }
  docChanged();
}
function pickText(){
  const fi = document.createElement("input"); fi.type = "file"; fi.accept = ".txt,.md,text/plain";
  fi.onchange = async () => { const f = fi.files[0]; if (!f) return; S.doc.txt = await f.text(); S.doc.name = baseName(f.name); $("#docName").value = S.doc.name; renderPanel(); regenTxt(); };
  fi.click();
}

/* ============ Panneau ============ */
function renderPanel(){
  const T = TOOLS[S.tool]; if (!T) return;
  const c = getComputedStyle(document.documentElement).getPropertyValue(CATS[T.cat][1]).trim();
  $("#phead").innerHTML = `<span class="tile" style="--c:${c};color:${c};background:color-mix(in srgb,${c} 14%,transparent)">${icon(T.icon)}</span><div><b>${T.name}</b><span>${T.desc}</span></div>`;
  $("#pbody").innerHTML = T.panel ? T.panel() : "";
  T.afterPanel?.();
  renderPanelFoot();
}
function activeEffects(){
  const d = S.doc, out = [];
  if (d.wm.on && S.tool !== "watermark") out.push(["wm", "Filigrane", "watermark"]);
  if (d.num.on && S.tool !== "numbers") out.push(["num", "Numéros", "numbers"]);
  if (pages().some(p => p.crop) && S.tool !== "crop") out.push(["crop", "Recadrage", "crop"]);
  if (d.meta && S.tool !== "meta") out.push(["meta", "Infos modifiées", "meta"]);
  if (Object.values(d.forms).some(v => Object.keys(v).length) && S.tool !== "forms") out.push(["forms", "Formulaire rempli", "forms"]);
  return out;
}
function renderPanelFoot(){
  const T = TOOLS[S.tool]; if (!T) return;
  const go = $("#pGo");
  go.innerHTML = `${icon(["pdf2img", "pdf2txt", "pdf2word"].includes(S.tool) ? "install" : S.tool === "protect" ? "lock" : "install")}<span>${T.go ? T.go.call(T) : "Enregistrer"}</span>`;
  go.disabled = S.busy || !pages().length || !!(T.disabled && T.disabled.call(T));
  const fx = activeEffects();
  $("#pchips").innerHTML = fx.length ? `<span class="ph" style="width:100%">Aussi appliqué :</span>` + fx.map(([k, l, t]) => `<span class="pchip"><span role="button" tabindex="0" data-goto="${t}">${l}</span><button data-off="${k}" aria-label="Retirer ${l}">${icon("x")}</button></span>`).join("") : "";
}
let statT;
function setStat(msg, kind = ""){ const s = $("#pstat"); s.textContent = msg; s.className = "pstat " + kind; clearTimeout(statT); if (kind === "ok") statT = setTimeout(() => { s.textContent = ""; }, 9000); }
function setProg(f){ const p = $("#prog"); if (f == null) { p.hidden = true; return; } p.hidden = false; p.firstElementChild.style.width = Math.round(clamp(f, 0, 1) * 100) + "%"; }
function openPanel(v){ $("#panel").classList.toggle("open", v ?? !$("#panel").classList.contains("open")); }
async function runGo(){
  const T = TOOLS[S.tool]; if (S.busy || !T?.run) return;
  if (S.editing) finishEditing();
  const err = T.validate?.call(T); if (err) { setStat(err, "err"); if (narrow()) openPanel(true); return; }
  S.busy = true; renderPanelFoot(); setStat("Préparation…"); setProg(.02);
  try { const msg = await T.run.call(T); setStat(msg || "", msg && !msg.includes("annulé") ? "ok" : ""); if (narrow() && msg) toast(msg, 4000); }
  catch (e) { console.error(e); setStat(e?.message && !/[A-Z][a-zA-Z]+Error|undefined|null|is not/.test(e.message) && e.message.length < 140 ? e.message : "Une erreur est survenue. Le fichier est peut-être endommagé.", "err"); }
  finally { S.busy = false; setProg(null); renderPanelFoot(); }
}
function bindPanel(){
  const body = $("#pbody");
  body.addEventListener("click", e => {
    const T = TOOLS[S.tool]; if (!T) return;
    const r = e.target.closest("[data-radio] .radio, [data-seg] button, [data-pos] button");
    if (r) { const host = r.closest("[data-radio],[data-seg],[data-pos]"), name = host.dataset.radio || host.dataset.seg || host.dataset.pos; T.set?.call(T, name, r.dataset.v, "click"); return; }
    const a = e.target.closest("[data-act]"); if (a) { T.act?.call(T, a.dataset.act, a); }
  });
  body.addEventListener("input", e => {
    const T = TOOLS[S.tool], el = e.target;
    if (el.dataset.range) { T.set?.call(T, el.dataset.range, el.value, "input"); }
    else if (el.dataset.input) T.set?.call(T, el.dataset.input, el.value, "input");
    else if (el.dataset.ff != null && el.type !== "checkbox") { (S.doc.forms[el.dataset.ff] ||= {})[el.dataset.fn] = el.value; persistSoon(); renderPanelFoot(); }
  });
  body.addEventListener("change", e => {
    const T = TOOLS[S.tool], el = e.target;
    if (el.dataset.range) T.set?.call(T, el.dataset.range, el.value, "change");
    else if (el.dataset.check) T.set?.call(T, el.dataset.check, el.checked, "change");
    else if (el.dataset.ff != null) { (S.doc.forms[el.dataset.ff] ||= {})[el.dataset.fn] = el.type === "checkbox" ? el.checked : el.value; persistSoon(); renderPanelFoot(); }
  });
  body.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "i-q") TOOLS.redact.act("search"); });
  $("#pGo").addEventListener("click", runGo);
  $("#pToggle").addEventListener("click", () => openPanel());
  $("#pchips").addEventListener("click", e => {
    const off = e.target.closest("[data-off]")?.dataset.off, go = e.target.closest("[data-goto]")?.dataset.goto;
    if (off === "wm") S.doc.wm.on = false;
    if (off === "num") S.doc.num.on = false;
    if (off === "crop") { snapshot(); pages().forEach(p => p.crop = null); }
    if (off === "meta") { S.doc.meta = null; TOOLS.meta.draft = null; }
    if (off === "forms") S.doc.forms = {};
    if (off) { docChanged(); return; }
    if (go) setTool(go);
  });
  $("#wmIn").addEventListener("change", async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { S.doc.wm.img = await addImage(f); S.doc.wm.mode = "image"; S.doc.wm.on = true; renderPanel(); stampsChanged(); } catch { toast("Cette image n'a pas pu être lue."); } });
}
function stampsChanged(){
  clearTimeout(stampsChanged.t);
  stampsChanged.t = setTimeout(() => { if (S.wview === "grid") refreshVisibleCards(); else { renderStampLayer(); $$("#strip .thumb").forEach(t => refreshStripThumb(+t.dataset.i)); } renderPanelFoot(); persistSoon(); }, 60);
}

/* ============ OCR : reconnaître le texte d'un scan (Pro) ============
   Moteur Tesseract chargé à la demande (≈ 15 Mo la première fois, ensuite en cache).
   Le texte reste sur l'appareil : rien n'est envoyé. */
P.ocr = "M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M8 9h8 M8 12h8 M8 15h5";
UI.ocr = { lang: "fra", out: "pdf", scope: "all" };

async function ocrPages(idx, lang){
  toast("Chargement du moteur de lecture… (la première fois seulement, ≈ 15 Mo)", 0);
  const T = await FI.lib("Tesseract");
  let pageK = 0;
  const lb = FI.localBase(), paths = lb ? { workerPath: lb + "tesseract/worker.min.js", corePath: lb + "tesseract/core", langPath: lb + "tesseract/lang" } : {};
  const worker = await T.createWorker(lang, 1, { ...paths, logger: m => { if (m.status === "recognizing text") setProg((pageK + (m.progress || 0)) / idx.length); } })
    .catch(e => { throw new Error("Le moteur de lecture n'a pas pu démarrer : vérifiez la connexion Internet (premier usage), puis réessayez."); });
  $("#toast").hidden = true;
  const n = pages().length, out = [];
  try {
    for (const i of idx) {
      const c = await renderPageCanvas(pages()[i], i, n, 220 / 72, { nocache: true, throwOnError: true });
      const { data } = await worker.recognize(c);
      out.push({ i, cw: c.width, ch: c.height, text: (data.text || "").trim(), words: (data.words || []).filter(w => w.text.trim() && w.confidence > 25).map(w => ({ t: w.text.trim(), ...w.bbox })) });
      pageK++;
    }
  } finally { await worker.terminate().catch(() => {}); }
  return out;
}
/* Ajoute une couche de texte invisible (copiable, cherchable) sur chaque page du PDF produit */
async function addTextLayer(bytes, res){
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }), font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  res.forEach((r, j) => {
    const page = doc.getPage(j); if (!page) return;
    const box = page.getCropBox(), rot = ((page.getRotation().angle % 360) + 360) % 360, W = box.width, Hh = box.height;
    const visW = rot % 180 ? Hh : W, s = visW / r.cw;
    for (const w of r.words) {
      const txt = safeText(font, w.t); if (!txt.trim()) continue;
      const vx = w.x0 * s, vyB = w.y1 * s, bw = (w.x1 - w.x0) * s, bh = (w.y1 - w.y0) * s;
      const unit = font.widthOfTextAtSize(txt, 1) || 1, size = clamp(bw / unit, 1, Math.max(2, bh * 1.4));
      const base = vyB - bh * .18; // ligne de base un peu au-dessus du bas de la boîte
      let x, y;
      if (rot === 0) { x = vx; y = Hh - base; }
      else if (rot === 90) { x = base; y = vx; }
      else if (rot === 180) { x = W - vx; y = base; }
      else { x = W - base; y = Hh - vx; }
      page.drawText(txt, { x: box.x + x, y: box.y + y, size, font, opacity: 0, rotate: PDFLib.degrees(rot) });
    }
  });
  return doc.save();
}

TOOLS.ocr = {
  cat: "conv", icon: "ocr", name: "Reconnaître le texte (OCR)", desc: "Rendre un scan ou une photo de document cherchable, copiable, et exportable en Word.",
  accept: "any", multi: true, view: "grid", pro: true,
  panel(){
    const u = UI.ocr;
    return H.sec("Langue du document", H.seg("lang", [{ v: "fra", label: "Français" }, { v: "eng", label: "Anglais" }, { v: "fra+eng", label: "Les deux" }], u.lang)) +
      H.sec("Résultat", H.radios("out", [
        { v: "pdf", label: "PDF cherchable", desc: "Même apparence, avec le texte sélectionnable et cherchable." },
        { v: "docx", label: "Document Word", desc: "Le texte reconnu, page par page, à modifier." },
        { v: "txt", label: "Texte brut (.txt)", desc: "Juste le texte." }], u.out)) +
      H.sec("Pages", H.seg("scope", [{ v: "all", label: "Toutes" }, { v: "sel", label: `Sélection${S.sel.size ? ` (${S.sel.size})` : ""}` }], u.scope)) +
      H.note("La lecture se fait sur votre appareil. La première fois, l'app télécharge le moteur (≈ 15 Mo) : il faut Internet une fois, ensuite il reste en mémoire. Comptez quelques secondes par page.");
  },
  set(k, v){ UI.ocr[k] = v; renderPanel(); },
  onSel(){ renderPanel(); },
  go: () => UI.ocr.out === "pdf" ? "Créer le PDF cherchable" : UI.ocr.out === "docx" ? "Créer le Word" : "Extraire le texte",
  async run(){
    const u = UI.ocr, idx = u.scope === "sel" && S.sel.size ? selectedIdx() : allIdx();
    const res = await ocrPages(idx, u.lang);
    const words = res.reduce((a, r) => a + r.words.length, 0);
    if (!words) throw new Error("Aucun texte reconnu. Vérifiez la langue choisie, ou que la page n'est pas trop floue ou trop petite.");
    if (u.out === "txt") return deliver(outName("-texte", "txt"), new TextEncoder().encode(res.map(r => r.text).join("\n\n\f\n\n")), "text/plain");
    if (u.out === "docx") return deliver(outName("", "docx"), makeDocx(res.map(r => r.text)), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    setProg(.98);
    const bytes = await buildPdf(idx, {});
    return deliver(outName("-ocr"), await addTextLayer(bytes, res));
  }
};
{ // PDF en Word : si le PDF n'a pas de texte, proposer l'OCR
  const w = TOOLS.pdf2word, run0 = w.run;
  w.run = async function(){ try { return await run0.call(this); } catch (e) { if (/Aucun texte/.test(e.message)) throw new Error("Ce PDF ne contient pas de texte : c'est sans doute un scan. Utilisez « Reconnaître le texte (OCR) » et choisissez « Document Word »."); throw e; } };
}

/* ============ Outils Pro ============ */
Object.assign(P, {
  headers: "M5 3h14v18H5z M8 6h8 M8 18h8 M8 10h8 M8 14h5",
  nup: "M3 4h18v16H3z M12 4v16 M3 12h18",
  pagesize: "M6 3h12v18H6z M3 8v8 M21 8v8 M9 7h6",
  batch: "M8 3h12v14 M5 6h12v15H5z M8 12l2 2 4-4"
});
const SHEETS = { A4: [595.28, 841.89], A3: [841.89, 1190.55], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008] };
Object.assign(UI, {
  nup: { mode: "nup", per: 4, sheet: "A4", orient: "auto", margin: 8, gap: 5, border: false, order: "row" },
  ps: { size: "A4", orient: "auto", margin: 0 },
  batch: { level: "none", rotate: 0, num: false, wm: "", pw: "", clear: false }
});
const HF_PRESETS = {
  report: { tl: "{nom}", tc: "", tr: "{date}", bl: "", bc: "Page {page} sur {total}", br: "" },
  conf: { tl: "", tc: "CONFIDENTIEL", tr: "", bl: "{nom}", bc: "", br: "{page} / {total}" },
  none: { tl: "", tc: "", tr: "", bl: "", bc: "", br: "" }
};

/* Pose une page intégrée (avec sa rotation) dans une boîte, centrée et à l'échelle */
function placeEmbedded(pg, it, x, y, bw, bh, border){
  const L = PDFLib, r = it.rot, [vw, vh] = r % 180 ? [it.h, it.w] : [it.w, it.h];
  const s = Math.min(bw / vw, bh / vh), dw = vw * s, dh = vh * s, ox = x + (bw - dw) / 2, oy = y + (bh - dh) / 2;
  const at = { 0: [ox, oy], 90: [ox, oy + dh], 180: [ox + dw, oy + dh], 270: [ox + dw, oy] }[r] || [ox, oy];
  pg.drawPage(it.emb, { x: at[0], y: at[1], xScale: s, yScale: s, rotate: L.degrees(-r) });
  if (border) pg.drawRectangle({ x: ox, y: oy, width: dw, height: dh, borderColor: L.rgb(.6, .62, .66), borderWidth: .6 });
}
async function embedAll(bytes){
  const L = PDFLib, src = await L.PDFDocument.load(bytes), out = await L.PDFDocument.create(), sp = src.getPages();
  const boxes = sp.map(p => { const b = p.getCropBox(); return { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height }; });
  const embs = await out.embedPages(sp, boxes);
  return { out, items: sp.map((p, i) => ({ emb: embs[i], rot: ((p.getRotation().angle % 360) + 360) % 360, w: boxes[i].right - boxes[i].left, h: boxes[i].top - boxes[i].bottom })) };
}
const visOf = it => it.rot % 180 ? [it.h, it.w] : [it.w, it.h];
function gridFor(per){ return { 2: [[1, 2], [2, 1]], 4: [[2, 2]], 6: [[2, 3], [3, 2]], 9: [[3, 3]], 16: [[4, 4]] }[per] || [[2, 2]]; }
function nupLayout(per, sheet, orient, first){
  const [a, b] = SHEETS[sheet], m = UI.nup.margin * MM, g = UI.nup.gap * MM, [vw, vh] = first ? visOf(first) : [a, b];
  let best = null;
  for (const [W, H] of orient === "portrait" ? [[a, b]] : orient === "landscape" ? [[b, a]] : [[a, b], [b, a]])
    for (const [c, r] of gridFor(per)) {
      const cw = (W - 2 * m - g * (c - 1)) / c, ch = (H - 2 * m - g * (r - 1)) / r, s = Math.min(cw / vw, ch / vh);
      if (!best || s > best.s + 1e-6) best = { W, H, c, r, cw, ch, s, m, g };
    }
  return best;
}
function sheetsInfo(){
  const n = pages().length, u = UI.nup;
  if (u.mode === "booklet") { const pad = Math.ceil(n / 4) * 4; return `${plural(n, "page")} → livret de ${plural(pad / 4, "feuille")} recto verso${pad > n ? ` (${plural(pad - n, "page blanche ajoutée", "pages blanches ajoutées")})` : ""}. Imprimez en recto verso, bord court, puis pliez au milieu.`; }
  return `${plural(n, "page")} → ${plural(Math.ceil(n / u.per), "feuille")} ${u.sheet}.`;
}

Object.assign(TOOLS, {
  headers: {
    cat: "edit", icon: "headers", name: "En-tête et pied de page", desc: "Ajouter un titre, la date, le nom du fichier ou « Page 1 sur 12 » en haut et en bas.",
    accept: "pdf", view: "grid", pro: true,
    onEnter(){ const h = S.doc.hf; if (!["tl", "tc", "tr", "bl", "bc", "br"].some(k => h[k].trim())) Object.assign(h, HF_PRESETS.report); h.on = true; stampsChanged(); },
    panel(){
      const h = S.doc.hf, row = keys => `<div class="hfrow">${keys.map(([k, ph]) => H.input(k, h[k], ph)).join("")}</div>`;
      return H.sec("", H.check("on", "En-tête et pied de page activés", h.on)) +
        H.sec("Modèle", H.seg("preset", [{ v: "report", label: "Rapport" }, { v: "conf", label: "Confidentiel" }, { v: "none", label: "Vide" }], "")) +
        H.sec("En-tête · gauche, centre, droite", row([["tl", "Gauche"], ["tc", "Centre"], ["tr", "Droite"]])) +
        H.sec("Pied de page · gauche, centre, droite", row([["bl", "Gauche"], ["bc", "Centre"], ["br", "Droite"]]),
          "Variables : <b>{page}</b>, <b>{total}</b>, <b>{date}</b>, <b>{nom}</b> (nom du document).") +
        H.sec("Taille", H.range("size", 6, 18, 1, h.size, " pt")) +
        H.sec("Distance du bord", H.range("margin", 10, 60, 1, h.margin, " pt")) +
        H.sec("Couleur", swatches(["#3d4048", "#16171b", "#8a8f99", "#2a62d6", "#e5484d"], h.color, "color")) +
        H.sec("", H.check("skipFirst", "Ne rien mettre sur la première page", h.skipFirst));
    },
    set(k, v){
      const h = S.doc.hf;
      if (k === "preset") { Object.assign(h, HF_PRESETS[v], { on: v !== "none" }); renderPanel(); stampsChanged(); return; }
      if (k === "size" || k === "margin") { h[k] = +v; const o = $(`#r-${k}`)?.nextElementSibling; if (o) o.textContent = v + " pt"; }
      else h[k] = v;
      if (k !== "on") h.on = true;
      if (k === "on" || k === "skipFirst") renderPanel();
      stampsChanged();
    },
    act(a, el){
      if (a === "color") this.set("color", el.dataset.v);
    },
    go: () => "Enregistrer le PDF",
    async run(){ return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg })); }
  },
  nup: {
    cat: "org", icon: "nup", name: "Pages par feuille", desc: "Imprimer 2, 4, 9 ou 16 pages par feuille, ou monter un livret à plier.",
    accept: "pdf", view: "grid", pro: true,
    panel(){
      const u = UI.nup, bk = u.mode === "booklet";
      return H.sec("Mise en page", H.radios("mode", [{ v: "nup", label: "Plusieurs pages par feuille", desc: "Pour économiser du papier ou relire un document." }, { v: "booklet", label: "Livret", desc: "Pages remises dans l'ordre d'impression, 2 par face, à plier au centre." }], u.mode)) +
        (bk ? "" : H.sec("Pages par feuille", H.seg("per", [2, 4, 6, 9, 16].map(v => ({ v, label: String(v) })), u.per)) + H.sec("Ordre", H.seg("order", [{ v: "row", label: "Par lignes" }, { v: "col", label: "Par colonnes" }], u.order))) +
        H.sec("Feuille", H.seg("sheet", ["A4", "A3", "Letter"].map(v => ({ v, label: v })), u.sheet)) +
        (bk ? "" : H.sec("Orientation", H.seg("orient", [{ v: "auto", label: "Auto" }, { v: "portrait", label: "Portrait" }, { v: "landscape", label: "Paysage" }], u.orient))) +
        H.sec("Marges", H.range("margin", 0, 30, 1, u.margin, " mm")) + H.sec("Espacement", H.range("gap", 0, 20, 1, u.gap, " mm")) +
        H.sec("", H.check("border", "Bordure fine autour de chaque page", u.border)) + H.note(sheetsInfo());
    },
    set(k, v, kind){
      const u = UI.nup;
      if (k === "margin" || k === "gap") { u[k] = +v; const o = $(`#r-${k}`)?.nextElementSibling; if (o) o.textContent = v + " mm"; return; }
      u[k] = k === "per" ? +v : v; renderPanel(); renderPanelFoot();
    },
    go: () => UI.nup.mode === "booklet" ? "Créer le livret" : "Créer le PDF",
    async run(){
      const L = PDFLib, u = UI.nup, bytes = await buildPdf(allIdx(), { onProgress: f => setProg(f * .6) });
      const { out, items } = await embedAll(bytes);
      if (u.mode === "booklet") {
        const n = items.length, pad = Math.ceil(n / 4) * 4, seq = [...items, ...Array(pad - n).fill(null)];
        const [a, b] = SHEETS[u.sheet], W = b, H = a, m = u.margin * MM, g = u.gap * MM, cw = (W - 2 * m - g) / 2, ch = H - 2 * m;
        for (let i = 0; i < pad / 4; i++) for (const [l, r] of [[pad - 1 - 2 * i, 2 * i], [2 * i + 1, pad - 2 - 2 * i]]) {
          const pg = out.addPage([W, H]);
          if (seq[l]) placeEmbedded(pg, seq[l], m, m, cw, ch, u.border);
          if (seq[r]) placeEmbedded(pg, seq[r], m + cw + g, m, cw, ch, u.border);
        }
      } else {
        const lay = nupLayout(u.per, u.sheet, u.orient, items[0]), per = lay.c * lay.r;
        for (let i = 0; i < items.length; i += per) {
          const pg = out.addPage([lay.W, lay.H]);
          for (let j = 0; j < per && i + j < items.length; j++) {
            const col = u.order === "row" ? j % lay.c : Math.floor(j / lay.r), row = u.order === "row" ? Math.floor(j / lay.c) : j % lay.r;
            placeEmbedded(pg, items[i + j], lay.m + col * (lay.cw + lay.g), lay.H - lay.m - (row + 1) * lay.ch - row * lay.g, lay.cw, lay.ch, u.border);
          }
          setProg(.6 + i / items.length * .35);
        }
      }
      out.setTitle(S.doc.name); out.setProducer("IdontlovePDF Pro");
      return deliver(outName(u.mode === "booklet" ? "-livret" : `-${u.per}par-feuille`), await out.save({ useObjectStreams: true }));
    }
  },
  pagesize: {
    cat: "opt", icon: "pagesize", name: "Format des pages", desc: "Mettre toutes les pages au même format : A4, A3, A5, Letter ou Legal.",
    accept: "pdf", view: "grid", pro: true,
    panel(){
      const u = UI.ps, sizes = [...new Set(pages().map(p => { const [w, h] = visDims(p, visualBox(p)); return `${Math.round(w / MM)}×${Math.round(h / MM)} mm`; }))];
      return H.note(`Format${sizes.length > 1 ? "s" : ""} actuel${sizes.length > 1 ? "s" : ""} : <b>${sizes.slice(0, 4).join(", ")}${sizes.length > 4 ? "…" : ""}</b>`) +
        H.sec("Nouveau format", H.seg("size", Object.keys(SHEETS).map(v => ({ v, label: v })), u.size)) +
        H.sec("Orientation", H.seg("orient", [{ v: "auto", label: "Comme chaque page" }, { v: "portrait", label: "Portrait" }, { v: "landscape", label: "Paysage" }], u.orient)) +
        H.sec("Marge ajoutée", H.range("margin", 0, 25, 1, u.margin, " mm"), "Le contenu est agrandi ou réduit pour tenir dans la page, sans être déformé.");
    },
    set(k, v){ const u = UI.ps; if (k === "margin") { u.margin = +v; const o = $("#r-margin")?.nextElementSibling; if (o) o.textContent = v + " mm"; return; } u[k] = v; renderPanel(); },
    go: () => `Passer en ${UI.ps.size}`,
    async run(){
      const u = UI.ps, bytes = await buildPdf(allIdx(), { onProgress: f => setProg(f * .6) }), { out, items } = await embedAll(bytes);
      const [a, b] = SHEETS[u.size], m = u.margin * MM;
      items.forEach(it => {
        const [vw, vh] = visOf(it), land = u.orient === "landscape" || (u.orient === "auto" && vw > vh), W = land ? b : a, H = land ? a : b;
        placeEmbedded(out.addPage([W, H]), it, m, m, W - 2 * m, H - 2 * m, false);
      });
      out.setTitle(S.doc.name); out.setProducer("IdontlovePDF Pro");
      return deliver(outName("-" + u.size.toLowerCase()), await out.save({ useObjectStreams: true }));
    }
  },
  batch: {
    cat: "opt", icon: "batch", name: "Traitement par lot", desc: "Compresser, numéroter, filigraner ou protéger plusieurs PDF d'un coup.",
    accept: "pdf", multi: true, view: "grid", pro: true, landText: "Sélectionner des fichiers PDF",
    cardBadge: p => { const g = srcGroups(); if (g.length < 2) return null; const k = groupKey(p); return { text: groupName(k), color: GROUP_COLORS[g.indexOf(k) % GROUP_COLORS.length] }; },
    files(){ return [...new Set(pages().filter(p => p.kind === "pdf").map(p => p.src))]; },
    panel(){
      const u = UI.batch, f = this.files(), locked = f.filter(i => sources[i].raster).length;
      return H.note(`<b>${plural(f.length, "fichier")}</b> à traiter${f.length > 1 ? ", chacun séparément" : ""}. ${H.btn("add", "Ajouter des fichiers", "plus")}`) +
        (locked ? H.note(`${plural(locked, "fichier protégé ou endommagé")} sera ignoré.`) : "") +
        H.sec("Compression", H.seg("level", [{ v: "none", label: "Aucune" }, { v: "rec", label: "Recommandée" }, { v: "strong", label: "Forte" }], u.level)) +
        H.sec("Rotation", H.seg("rotate", [{ v: 0, label: "Aucune" }, { v: 90, label: "90° →" }, { v: 180, label: "180°" }, { v: 270, label: "← 90°" }], u.rotate)) +
        H.sec("", H.check("num", "Numéroter les pages (1 / 12, en bas au centre)", u.num)) +
        H.sec("Filigrane (facultatif)", H.input("wm", u.wm, "Ex. : CONFIDENTIEL")) +
        H.sec("Mot de passe (facultatif)", H.input("pw", u.pw, "Laisser vide pour ne pas protéger", "password")) +
        H.sec("", H.check("clear", "Effacer les métadonnées (auteur, logiciel, dates)", u.clear)) +
        H.note("Les fichiers sont enregistrés dans un zip, avec leur nom d'origine.");
    },
    set(k, v){ const u = UI.batch; u[k] = k === "rotate" ? +v : v; if (["level", "rotate"].includes(k)) renderPanel(); },
    act(a){ if (a === "add") pickFiles("append"); },
    validate(){ if (!this.files().filter(i => !sources[i].raster).length) return "Aucun fichier exploitable."; if (UI.batch.pw && !latin1Ok(UI.batch.pw)) return "Évitez les emojis et caractères spéciaux dans le mot de passe."; },
    go(){ const n = this.files().length; return n > 1 ? `Traiter ${n} fichiers` : "Traiter le fichier"; },
    async run(){
      const L = PDFLib, u = UI.batch, list = this.files().filter(i => !sources[i].raster), outFiles = [], names = new Set();
      const lv = { rec: { maxDim: 1800, q: .72 }, strong: { maxDim: 1200, q: .55 } }[u.level];
      for (let fi = 0; fi < list.length; fi++) {
        const s = sources[list[fi]], doc = await L.PDFDocument.load(s.bytes, { updateMetadata: false });
        const fr = await doc.embedFont(L.StandardFonts.Helvetica), fb = await doc.embedFont(L.StandardFonts.HelveticaBold), pgs = doc.getPages(), n = pgs.length;
        pgs.forEach((pg, k) => {
          if (u.rotate) pg.setRotation(L.degrees((pg.getRotation().angle + u.rotate) % 360));
          const mb = pg.getCropBox(), p = { w: mb.width, h: mb.height, ox: mb.x, oy: mb.y, rot: ((pg.getRotation().angle % 360) + 360) % 360, baseRot: 0 }, box = { x: 0, y: 0, w: mb.width, h: mb.height }, [vw, vh] = visDims(p, box);
          const text = (t, vx, vy, size, f, color, opacity, angle, align) => {
            t = safeText(f, t); const C = visToUser(p, box, vx, vy), phi = (rotOf(p) + angle) * Math.PI / 180, d = [Math.cos(phi), Math.sin(phi)], up = [-Math.sin(phi), Math.cos(phi)], tw = f.widthOfTextAtSize(t, size), ch = size * .72;
            pg.drawText(t, { x: C.x - d[0] * tw * align - up[0] * ch / 2, y: C.y - d[1] * tw * align - up[1] * ch / 2, size, font: f, color: hexRgb(color), opacity, rotate: L.degrees(rotOf(p) + angle) });
          };
          if (u.wm.trim()) { const t = u.wm.trim(), size = vw * .6 / Math.max(1, fb.widthOfTextAtSize(safeText(fb, t), 1)); text(t, vw / 2, vh / 2, size, fb, "#e5484d", .18, 35, .5); }
          if (u.num) text(`${k + 1} / ${n}`, vw / 2, vh - 26 - 3.6, 10, fr, "#3d4048", 1, 0, .5);
        });
        if (u.clear) { doc.context.trailerInfo.Info = doc.context.register(doc.context.obj({})); try { doc.catalog.delete(L.PDFName.of("Metadata")); } catch {} }
        else { doc.setProducer("IdontlovePDF Pro"); doc.setModificationDate(new Date()); }
        if (lv) await compressImages(doc, lv.maxDim, lv.q, () => {});
        let bytes;
        if (u.pw) { await encryptPdf(doc, { user: u.pw, owner: "", print: true, copy: true, modify: false }); bytes = await doc.save({ useObjectStreams: false, updateFieldAppearances: false }); }
        else bytes = await doc.save({ useObjectStreams: true });
        let nm = baseName(s.name) + ".pdf", i = 2; while (names.has(nm)) nm = `${baseName(s.name)}-${i++}.pdf`; names.add(nm);
        outFiles.push({ name: nm, data: bytes });
        setProg((fi + 1) / list.length * .95);
      }
      const before = list.reduce((t, i) => t + sources[i].size, 0), after = outFiles.reduce((t, f) => t + f.data.length, 0);
      const msg = outFiles.length === 1 ? await deliver(outFiles[0].name.replace(/\.pdf$/, "-traite.pdf"), outFiles[0].data) : await deliver(`${baseName(S.doc.name)}-lot.zip`, makeZip(outFiles), "application/zip");
      if (msg.includes("annulé")) return msg;
      return `${plural(outFiles.length, "fichier traité", "fichiers traités")} · ${fmtSize(before)} → ${fmtSize(after)}`;
    }
  }
});
Object.entries(TOOLS).forEach(([id, t]) => t.id = id);
{
  const base = activeEffects;
  activeEffects = function(){ const o = base(); if (S.doc.hf?.on && S.tool !== "headers") o.push(["hf", "En-tête / pied", "headers"]); return o; };
  $("#pchips").addEventListener("click", e => { if (e.target.closest("[data-off]")?.dataset.off === "hf") S.doc.hf.on = false; });
}
{
  const order = Object.keys(CATS), ent = Object.entries(TOOLS).sort((a, b) => order.indexOf(a[1].cat) - order.indexOf(b[1].cat));
  for (const k of Object.keys(TOOLS)) delete TOOLS[k];
  ent.forEach(([k, v]) => TOOLS[k] = v);
}

/* ============ Scanner de documents ============
   Caméra (ou photos importées) → détection des bords → coins ajustables → redressement → filtre → pages du PDF.
   Tout se fait sur l'appareil, en JavaScript pur. */
P.scan = "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M3 12h18";
P.camera = "M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";
P.flash = "M13 2L5 14h6l-1 8 8-12h-6z";

const SCAN = {
  /* --- Détection des bords : seuil d'Otsu + plus grande zone claire + coins extrêmes --- */
  detect(src){
    const SW = src.videoWidth || src.width, SH = src.videoHeight || src.height;
    const MAXW = 360, k = Math.min(1, MAXW / Math.max(SW, SH));
    const w = Math.max(8, Math.round(SW * k)), h = Math.max(8, Math.round(SH * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, n = w * h;
    let g = new Float32Array(n);
    for (let i = 0; i < n; i++) g[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114;
    g = SCAN.boxBlur(g, w, h, 2);
    const hist = new Array(256).fill(0); for (let i = 0; i < n; i++) hist[g[i] | 0]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
    const fallback = () => { const m = .06; return [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]].map(([a, b]) => [a * SW, b * SH]); };
    // zone claire la plus grande (4-connexité)
    const lab = new Int32Array(n).fill(-1); let bestA = 0, bestL = -1; const stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (lab[s] !== -1 || g[s] <= thr) continue;
      let top = 0, area = 0; stack[top++] = s; lab[s] = s;
      while (top) { const p = stack[--top]; area++; const px = p % w, py = (p / w) | 0;
        if (px > 0 && lab[p - 1] === -1 && g[p - 1] > thr) { lab[p - 1] = s; stack[top++] = p - 1; }
        if (px < w - 1 && lab[p + 1] === -1 && g[p + 1] > thr) { lab[p + 1] = s; stack[top++] = p + 1; }
        if (py > 0 && lab[p - w] === -1 && g[p - w] > thr) { lab[p - w] = s; stack[top++] = p - w; }
        if (py < h - 1 && lab[p + w] === -1 && g[p + w] > thr) { lab[p + w] = s; stack[top++] = p + w; } }
      if (area > bestA) { bestA = area; bestL = s; }
    }
    if (bestA < n * .12 || bestA > n * .985) return fallback();
    let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (let p = 0; p < n; p++) { if (lab[p] !== bestL) continue; const px = p % w, py = (p / w) | 0, s = px + py, df = px - py;
      if (s < tl[2]) tl = [px, py, s]; if (s > br[2]) br = [px, py, s]; if (df > tr[2]) tr = [px, py, df]; if (df < bl[2]) bl = [px, py, df]; }
    const q = [tl, tr, br, bl].map(([a, b]) => [(a + .5) / w * SW, (b + .5) / h * SH]);
    return SCAN.area(q) < SW * SH * .1 ? fallback() : q;
  },
  /* Proportion largeur/hauteur réelle d'un rectangle vu en perspective (Zhang & He, 2006) */
  ratio(q, iw, ih){
    const cx = iw / 2, cy = ih / 2, m = ([x, y]) => [x - cx, y - cy, 1];
    const m1 = m(q[0]), m2 = m(q[1]), m3 = m(q[3]), m4 = m(q[2]);
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const k2 = dot(cr(m1, m4), m3) / dot(cr(m2, m4), m3), k3 = dot(cr(m1, m4), m2) / dot(cr(m3, m4), m2);
    const n2 = m2.map((v, i) => k2 * v - m1[i]), n3 = m3.map((v, i) => k3 * v - m1[i]);
    let r;
    const f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
    if (Math.abs(n2[2]) > 1e-6 && Math.abs(n3[2]) > 1e-6 && f2 > 0 && Math.sqrt(f2) > Math.max(iw, ih) * .3 && Math.sqrt(f2) < Math.max(iw, ih) * 8)
      r = Math.sqrt((n2[0] ** 2 + n2[1] ** 2) / f2 + n2[2] ** 2) / Math.sqrt((n3[0] ** 2 + n3[1] ** 2) / f2 + n3[2] ** 2);
    else r = Math.hypot(n2[0], n2[1]) / Math.hypot(n3[0], n3[1]);
    return isFinite(r) && r > .15 && r < 7 ? r : 0;
  },
  area(q){ let a = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2); },
  boxBlur(a, w, h, r){
    const t = new Float32Array(a.length), o = new Float32Array(a.length);
    for (let y = 0; y < h; y++) { let acc = 0; const row = y * w; for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { t[row + x] = acc / (2 * r + 1); acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { o[y * w + x] = acc / (2 * r + 1); acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o;
  },
  /* --- Homographie : rectangle de sortie → quadrilatère source --- */
  homography(dst, src){
    const A = [], B = [];
    for (let i = 0; i < 4; i++) { const [u, v] = dst[i], [x, y] = src[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
      for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
    return B.map((b, i) => b / A[i][i]);
  },
  warp(img, q, maxSide = 2400){
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    const r = SCAN.ratio(q, img.width, img.height); // vraie proportion de la feuille, corrigée de la perspective
    if (r) { if (W / H > r) H = W / r; else W = H * r; }
    const f = Math.min(1, maxSide / Math.max(W, H)); W = Math.max(16, Math.round(W * f)); H = Math.max(16, Math.round(H * f));
    const sc = document.createElement("canvas"); sc.width = img.width; sc.height = img.height;
    const sx = sc.getContext("2d", { willReadFrequently: true }); sx.drawImage(img, 0, 0);
    const sd = sx.getImageData(0, 0, sc.width, sc.height).data, SW = sc.width, SH = sc.height;
    const [a, b, c, d, e, ff, g, h] = SCAN.homography([[0, 0], [W, 0], [W, H], [0, H]], q);
    const out = new ImageData(W, H), od = out.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x + .5, v = y + .5, z = g * u + h * v + 1, X = (a * u + b * v + c) / z - .5, Y = (d * u + e * v + ff) / z - .5;
      const x0 = Math.max(0, Math.min(SW - 2, X | 0)), y0 = Math.max(0, Math.min(SH - 2, Y | 0)), fx = Math.max(0, Math.min(1, X - x0)), fy = Math.max(0, Math.min(1, Y - y0));
      const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) od[o + ch] = (sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx) * (1 - fy) + (sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx) * fy;
      od[o + 3] = 255;
    }
    return out;
  },
  /* --- Filtres : aplanit l'éclairage (ombres, reflets) puis règle le contraste --- */
  background(img){
    const W = img.width, H = img.height, bw = 48, bh = Math.max(8, Math.round(48 * H / W));
    const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(img, 0, 0);
    const s = document.createElement("canvas"); s.width = bw; s.height = bh; const sx = s.getContext("2d", { willReadFrequently: true });
    sx.imageSmoothingQuality = "high"; sx.drawImage(c, 0, 0, bw, bh);
    const sd = sx.getImageData(0, 0, bw, bh);
    for (let pass = 0; pass < 2; pass++) { // dilatation : le fond (clair) recouvre le texte (sombre)
      const src = new Uint8ClampedArray(sd.data);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let ch = 0; ch < 3; ch++) { let m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.min(bw - 1, Math.max(0, x + dx)), yy = Math.min(bh - 1, Math.max(0, y + dy)); m = Math.max(m, src[(yy * bw + xx) * 4 + ch]); }
        sd.data[(y * bw + x) * 4 + ch] = m; }
    }
    for (let ch = 0; ch < 3; ch++) { const a = new Float32Array(bw * bh); for (let i = 0; i < a.length; i++) a[i] = sd.data[i * 4 + ch]; const b = SCAN.boxBlur(a, bw, bh, 2); for (let i = 0; i < a.length; i++) sd.data[i * 4 + ch] = b[i]; }
    sx.putImageData(sd, 0, 0);
    const u = document.createElement("canvas"); u.width = W; u.height = H; const ux = u.getContext("2d", { willReadFrequently: true });
    ux.imageSmoothingQuality = "high"; ux.drawImage(s, 0, 0, W, H);
    return ux.getImageData(0, 0, W, H).data;
  },
  filter(img, mode){
    if (mode === "orig") return img;
    const bg = SCAN.background(img), d = img.data, out = new ImageData(img.width, img.height), o = out.data;
    const curve = v => { v = Math.min(1, v); return v < .5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v); };
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / Math.max(24, bg[i]), g = d[i + 1] / Math.max(24, bg[i + 1]), b = d[i + 2] / Math.max(24, bg[i + 2]);
      if (mode === "enh") { // couleur nette, fond blanc
        o[i] = 255 * curve(Math.pow(r, 1.6)); o[i + 1] = 255 * curve(Math.pow(g, 1.6)); o[i + 2] = 255 * curve(Math.pow(b, 1.6));
      } else {
        const y = r * .299 + g * .587 + b * .114;
        const v = mode === "bw" ? (y > .78 ? 255 : y < .6 ? 0 : (y - .6) / .18 * 255) : 255 * curve(Math.pow(y, 1.5));
        o[i] = o[i + 1] = o[i + 2] = v;
      }
      o[i + 3] = 255;
    }
    return out;
  },
  rotate(canvas, quarter){
    const c = document.createElement("canvas"), odd = quarter % 2;
    c.width = odd ? canvas.height : canvas.width; c.height = odd ? canvas.width : canvas.height;
    const x = c.getContext("2d"); x.translate(c.width / 2, c.height / 2); x.rotate(quarter * Math.PI / 2); x.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return c;
  },
  imgToCanvas(src, max = 3200){
    const W = src.videoWidth || src.naturalWidth || src.width, H = src.videoHeight || src.naturalHeight || src.height, f = Math.min(1, max / Math.max(W, H));
    const c = document.createElement("canvas"); c.width = Math.round(W * f); c.height = Math.round(H * f); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c;
  }
};

/* --- Interface --- */
const Scanner = {
  el: null, stream: null, shots: [], mode: "enh", onDone: null, cur: null, liveT: 0,
  open(onDone){
    Scanner.onDone = onDone; Scanner.shots = [];
    if (!Scanner.el) Scanner.build();
    Scanner.el.hidden = false; document.body.classList.add("scanning");
    Scanner.showCam();
  },
  build(){
    const el = document.createElement("div"); el.className = "scanui"; el.id = "scanUI"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Scanner un document");
    el.innerHTML = `
      <div class="sc-top"><button class="sc-ib" data-s="close" aria-label="Fermer le scanner">${icon("x")}</button><b class="sc-title">Scanner</b><span class="sc-count" id="scCount"></span></div>
      <div class="sc-stage" id="scStage">
        <video id="scVid" playsinline muted autoplay></video><canvas id="scLive" class="sc-live"></canvas>
        <div class="sc-edit" id="scEdit" hidden><canvas id="scImg"></canvas><svg id="scQuad" class="sc-quad"></svg></div>
        <div class="sc-msg" id="scMsg" hidden></div>
      </div>
      <div class="sc-strip" id="scStrip"></div>
      <div class="sc-bar" id="scCamBar">
        <button class="sc-side" data-s="import">${icon("image")}<span>Importer</span></button>
        <button class="sc-shut" data-s="shoot" aria-label="Prendre la photo"><i></i></button>
        <button class="sc-side sc-done" data-s="done" disabled>${icon("check")}<span>Terminer</span></button>
      </div>
      <div class="sc-bar sc-adj" id="scAdjBar" hidden>
        <div class="seg full sc-filters" id="scFilters">${[["enh", "Améliorée"], ["gray", "Gris"], ["bw", "N&B"], ["orig", "Originale"]].map(([v, l]) => `<button data-f="${v}">${l}</button>`).join("")}</div>
        <div class="sc-row">
          <button class="btn ghost" data-s="retake">${icon("back")}<span>Reprendre</span></button>
          <button class="btn ghost" data-s="full" title="Garder toute la photo">${icon("scan")}<span>Tout</span></button>
          <button class="btn ghost" data-s="rot" aria-label="Pivoter">${icon("rotate")}</button>
          <span class="sp"></span>
          <button class="btn primary" data-s="keep">${icon("check")}<span>Valider</span></button>
        </div>
      </div>
      <input type="file" id="scFile" accept="image/*" capture="environment" multiple hidden aria-label="Importer des photos à scanner">`;
    document.body.appendChild(el); Scanner.el = el;
    el.addEventListener("click", e => {
      const f = e.target.closest("[data-f]"); if (f) { Scanner.mode = f.dataset.f; Scanner.paintFilters(); Scanner.preview(); return; }
      const del = e.target.closest("[data-del]"); if (del) { Scanner.shots.splice(+del.dataset.del, 1); Scanner.paintStrip(); return; }
      const a = e.target.closest("[data-s]")?.dataset.s; if (!a) return;
      if (a === "close") Scanner.close(false);
      if (a === "shoot") Scanner.shoot();
      if (a === "import") $("#scFile").click();
      if (a === "done") Scanner.close(true);
      if (a === "retake") Scanner.next();
      if (a === "rot") { Scanner.cur.rot = (Scanner.cur.rot + 1) % 4; Scanner.preview(); }
      if (a === "full") { const c = Scanner.cur.canvas; Scanner.cur.q = [[0, 0], [c.width, 0], [c.width, c.height], [0, c.height]]; Scanner.drawEdit(); }
      if (a === "keep") Scanner.keep();
    });
    $("#scFile").addEventListener("change", async e => {
      const files = [...e.target.files]; e.target.value = "";
      Scanner.queue = files; Scanner.nextFile();
    });
    Scanner.bindQuad();
    document.addEventListener("keydown", e => { if (Scanner.el.hidden) return; if (e.key === "Escape") Scanner.close(false); else if (e.key === " " && !Scanner.cur) { e.preventDefault(); Scanner.shoot(); } else if (e.key === "Enter" && Scanner.cur) { e.preventDefault(); Scanner.keep(); } if (e.key !== "Tab") e.stopPropagation(); }, true);
    window.addEventListener("resize", () => { if (!Scanner.el.hidden && Scanner.cur) Scanner.drawEdit(); });
  },
  async nextFile(){
    const f = Scanner.queue?.shift(); if (!f) return;
    try { const bmp = await FI.image(f, { max: 3200 }); Scanner.edit(SCAN.imgToCanvas(bmp)); bmp.close?.(); }
    catch (e) { toast(`${f.name} : ${e.friendly ? e.message : "image illisible"}`, 6000); Scanner.nextFile(); }
  },
  async showCam(){
    Scanner.cur = null; Scanner.paintStrip();
    $("#scEdit").hidden = true; $("#scAdjBar").hidden = true; $("#scCamBar").hidden = false; $("#scVid").hidden = false; $("#scLive").hidden = false;
    const msg = $("#scMsg"); msg.hidden = true;
    if (Scanner.queue?.length) return Scanner.nextFile();
    if (Scanner.stream) return Scanner.live();
    if (!navigator.mediaDevices?.getUserMedia) return Scanner.noCam("La caméra n'est pas disponible ici. Importez des photos de vos pages : elles seront redressées de la même façon.");
    try {
      Scanner.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
      const v = $("#scVid"); v.srcObject = Scanner.stream; await v.play().catch(() => {});
      Scanner.live();
    } catch (err) {
      Scanner.noCam(err?.name === "NotAllowedError" ? "L'accès à la caméra a été refusé. Autorisez-le dans le navigateur, ou importez des photos de vos pages." : "Aucune caméra trouvée. Importez des photos de vos pages : elles seront redressées de la même façon.");
    }
  },
  noCam(text){
    $("#scVid").hidden = true; $("#scLive").hidden = true;
    const m = $("#scMsg"); m.hidden = false;
    m.innerHTML = `<span class="tile">${icon("camera")}</span><p>${text}</p><button class="btn primary" data-s="import">${icon("image")}Choisir des photos</button>`;
    $(".sc-shut").disabled = true;
  },
  live(){
    $(".sc-shut").disabled = false;
    const v = $("#scVid"), c = $("#scLive");
    cancelAnimationFrame(Scanner.liveT);
    let last = 0;
    const loop = t => {
      if (Scanner.el.hidden || Scanner.cur || !Scanner.stream) return;
      Scanner.liveT = requestAnimationFrame(loop);
      if (t - last < 280 || !v.videoWidth) return; last = t;
      const r = v.getBoundingClientRect(); c.width = r.width * devicePixelRatio; c.height = r.height * devicePixelRatio;
      const q = SCAN.detect(v), vw = v.videoWidth, vh = v.videoHeight, k = Math.min(r.width / vw, r.height / vh), ox = (r.width - vw * k) / 2, oy = (r.height - vh * k) / 2;
      const x = c.getContext("2d"); x.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); x.clearRect(0, 0, r.width, r.height);
      x.beginPath(); q.forEach(([a, b], i) => x[i ? "lineTo" : "moveTo"](ox + a * k, oy + b * k)); x.closePath();
      x.fillStyle = "rgba(229,72,77,.14)"; x.fill(); x.lineWidth = 2.5; x.strokeStyle = "#ff6369"; x.stroke();
    };
    Scanner.liveT = requestAnimationFrame(loop);
  },
  shoot(){
    const v = $("#scVid"); if (!v.videoWidth) return;
    const c = SCAN.imgToCanvas(v);
    Scanner.el.classList.add("flash"); setTimeout(() => Scanner.el.classList.remove("flash"), 160);
    Scanner.edit(c);
  },
  edit(canvas){
    Scanner.cur = { canvas, q: SCAN.detect(canvas), rot: 0 };
    $("#scVid").hidden = true; $("#scLive").hidden = true; $("#scMsg").hidden = true;
    $("#scEdit").hidden = false; $("#scCamBar").hidden = true; $("#scAdjBar").hidden = false;
    Scanner.paintFilters(); Scanner.drawEdit();
  },
  paintFilters(){ $$("#scFilters button").forEach(b => b.classList.toggle("on", b.dataset.f === Scanner.mode)); },
  geom: null,
  drawEdit(){
    const cur = Scanner.cur; if (!cur) return;
    $("#scEdit").classList.remove("pv");
    const box = $("#scStage").getBoundingClientRect(), c = $("#scImg"), src = cur.canvas;
    const k = Math.min((box.width - 40) / src.width, (box.height - 40) / src.height), w = src.width * k, h = src.height * k;
    c.width = Math.round(w * devicePixelRatio); c.height = Math.round(h * devicePixelRatio); c.style.width = w + "px"; c.style.height = h + "px";
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    Scanner.geom = { k, w, h };
    Scanner.drawQuad();
  },
  drawQuad(){
    const { k, w, h } = Scanner.geom, q = Scanner.cur.q.map(([a, b]) => [a * k, b * k]), s = $("#scQuad");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.style.width = w + "px"; s.style.height = h + "px";
    const pts = q.map(p => p.join(",")).join(" ");
    s.innerHTML = `<path class="sc-dim" fill-rule="evenodd" d="M0 0H${w}V${h}H0z M${q.map(p => p.join(" ")).join(" L")}z"/><polygon class="sc-edge" points="${pts}"/>` +
      q.map(([x, y], i) => `<circle class="sc-h" data-c="${i}" cx="${x}" cy="${y}" r="13"><title>Coin ${i + 1}</title></circle>`).join("");
  },
  bindQuad(){
    const s = $("#scQuad"); let drag = -1;
    s.addEventListener("pointerdown", e => {
      const r = s.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, { k } = Scanner.geom;
      let best = -1, bd = 44; Scanner.cur.q.forEach(([a, b], i) => { const d = Math.hypot(a * k - x, b * k - y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) return; drag = best; s.setPointerCapture(e.pointerId); e.preventDefault();
    });
    s.addEventListener("pointermove", e => {
      if (drag < 0) return; const r = s.getBoundingClientRect(), { k } = Scanner.geom, c = Scanner.cur.canvas;
      Scanner.cur.q[drag] = [clamp((e.clientX - r.left) / k, 0, c.width), clamp((e.clientY - r.top) / k, 0, c.height)];
      Scanner.drawQuad();
    });
    const up = () => { drag = -1; }; s.addEventListener("pointerup", up); s.addEventListener("pointercancel", up);
  },
  render(){
    const cur = Scanner.cur, warped = SCAN.warp(cur.canvas, cur.q), f = SCAN.filter(warped, Scanner.mode);
    let c = document.createElement("canvas"); c.width = f.width; c.height = f.height; c.getContext("2d").putImageData(f, 0, 0);
    if (cur.rot) c = SCAN.rotate(c, cur.rot);
    return c;
  },
  preview(){ /* aperçu du rendu final (filtre + rotation) le temps d'un appui */
    if (!Scanner.cur) return;
    const c = Scanner.render(), box = $("#scStage").getBoundingClientRect(), v = $("#scImg");
    const k = Math.min((box.width - 40) / c.width, (box.height - 40) / c.height);
    v.width = Math.round(c.width * k * devicePixelRatio); v.height = Math.round(c.height * k * devicePixelRatio); v.style.width = c.width * k + "px"; v.style.height = c.height * k + "px";
    v.getContext("2d").drawImage(c, 0, 0, v.width, v.height);
    $("#scQuad").innerHTML = ""; $("#scEdit").classList.add("pv");
    clearTimeout(Scanner.pvT); Scanner.pvT = setTimeout(() => { if (Scanner.cur && $("#scEdit").classList.contains("pv")) Scanner.drawEdit(); }, 1600);
  },
  async keep(){
    const c = Scanner.render();
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", Scanner.mode === "bw" ? .82 : .86));
    const t = document.createElement("canvas"), k = 120 / Math.max(c.width, c.height); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
    Scanner.shots.push({ blob, thumb: t.toDataURL("image/jpeg", .7) });
    Scanner.next();
  },
  next(){ Scanner.cur = null; Scanner.showCam(); },
  paintStrip(){
    const n = Scanner.shots.length;
    $("#scStrip").innerHTML = Scanner.shots.map((s, i) => `<span class="sc-th"><img src="${s.thumb}" alt="Page ${i + 1}"><button data-del="${i}" aria-label="Retirer la page ${i + 1}">${icon("x")}</button><i>${i + 1}</i></span>`).join("");
    $("#scCount").textContent = n ? plural(n, "page") : "";
    $(".sc-done").disabled = !n;
  },
  close(done){
    cancelAnimationFrame(Scanner.liveT);
    Scanner.stream?.getTracks().forEach(t => t.stop()); Scanner.stream = null; $("#scVid").srcObject = null;
    Scanner.el.hidden = true; document.body.classList.remove("scanning"); Scanner.cur = null; Scanner.queue = null;
    const shots = Scanner.shots; Scanner.shots = [];
    if (done && shots.length) {
      const stamp = new Date().toISOString().slice(0, 10);
      Scanner.onDone?.(shots.map((s, i) => new File([s.blob], `scan-${stamp}-${i + 1}.jpg`, { type: "image/jpeg" })));
    }
  }
};

/* --- Outil « Scanner » --- */
TOOLS.scan = {
  cat: "conv", icon: "scan", name: "Scanner un document", desc: "Photographier des pages, les redresser et en faire un PDF net.",
  accept: "img", multi: true, view: "grid", landing: "scan",
  panel(){
    const o = S.doc.imgOpts;
    return H.sec("", H.btn("scan", "Scanner d'autres pages", "camera", "primary")) +
      H.sec("Format de page", H.seg("page", [{ v: "A4", label: "A4" }, { v: "letter", label: "Lettre" }, { v: "fit", label: "Image" }], o.page)) +
      (o.page !== "fit" ? H.sec("Marges", H.seg("margin", [{ v: "none", label: "Aucune" }, { v: "small", label: "Petites" }, { v: "big", label: "Grandes" }], o.margin)) : "") +
      (TOOLS.ocr ? H.sec("Texte cherchable (OCR)", H.seg("ocr", [{ v: "0", label: "Non" }, { v: "1", label: "Oui" }], Scanner.ocr ? "1" : "0"), "Rend le texte du scan sélectionnable et cherchable. La langue est celle de l'outil OCR (" + ({ fra: "français", eng: "anglais", "fra+eng": "français et anglais" }[UI.ocr.lang]) + ").") : "") +
      H.note("Astuce : posez la feuille sur un fond sombre, bien à plat et sans contre-jour, les bords sont trouvés tout seuls.");
  },
  set(k, v){ if (k === "ocr") { Scanner.ocr = v === "1"; return renderPanel(); } S.doc.imgOpts[k] = v; pages().forEach(p => { if (p.fromImg) layoutImagePage(p); }); renderPanel(); docChanged(); },
  act(a){ if (a === "scan") Scanner.open(files => handleFiles(files, "append")); },
  go: () => "Créer le PDF",
  async run(){
    if (Scanner.ocr && TOOLS.ocr) { const idx = allIdx(), res = await ocrPages(idx, UI.ocr.lang), bytes = await buildPdf(idx, {}); return deliver(outName(), res.some(r => r.words.length) ? await addTextLayer(bytes, res) : bytes); }
    return deliver(outName(), await buildPdf(allIdx(), { onProgress: setProg }));
  }
};
function scanStart(){
  Scanner.open(async files => {
    await handleFiles(files, "tool:scan");
    if (S.tool !== "scan") return;
    S.doc.imgOpts = { page: "A4", orient: "auto", margin: "none" };
    if (S.doc.name.startsWith("scan-")) { S.doc.name = "scan-" + new Date().toISOString().slice(0, 10); $("#docName").value = S.doc.name; }
    pages().forEach(p => { if (p.fromImg) layoutImagePage(p); }); renderPanel(); docChanged();
  });
}
{ // le scanner en tête de liste
  const rest = Object.entries(TOOLS).filter(([k]) => k !== "scan");
  for (const [k] of rest) delete TOOLS[k];
  for (const [k, v] of rest) TOOLS[k] = v;
}
if (location.hostname === "localhost") window.__scan = { Scanner, SCAN };

/* ============ Édition Lite / Pro ============ */
const EDITION = "pro";
const LITE_TOOLS = ["scan", "merge", "split", "remove", "organize", "rotate", "compress", "img2pdf", "pdf2img", "edit", "sign", "numbers", "protect"];
if (EDITION === "lite") for (const k of Object.keys(TOOLS)) if (!LITE_TOOLS.includes(k)) delete TOOLS[k];
document.querySelectorAll(".brand").forEach(b => b.insertAdjacentHTML("beforeend", `<span class="edb ${EDITION}">${EDITION === "lite" ? "Lite" : "Pro"}</span>`));
{
  const n = Object.keys(TOOLS).length, h1 = document.querySelector(".hero h1"), p = document.querySelector(".hero p"), f = document.querySelector(".hfoot");
  if (EDITION === "lite") {
    h1.innerHTML = `L'essentiel du PDF. <span>Simple, rapide, sans rien envoyer en ligne.</span>`;
    p.textContent = `Fusionner, diviser, compresser, signer : les ${n} outils du quotidien, sans réglages compliqués. Vos fichiers restent sur votre appareil.`;
    f.textContent = "IdontlovePDF Pro ajoute le caviardage, le filigrane, les formulaires, les livrets, la conversion Word et le traitement par lot.";
  } else {
    p.textContent = `Fusionner, compresser, signer, caviarder, convertir, monter un livret ou traiter tout un dossier d'un coup : ${n} outils, et vos fichiers restent sur votre appareil.`;
  }
}

/* Palette de commandes partagée : Cmdk.open(items) avec items = [{ id, label, sub, cat, icon (html), color, run }] */
const Cmdk = (() => {
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let el = null;
  function open(items, ph = "Rechercher un outil ou une action…"){
    close(); let sel = 0, shown = items;
    el = document.createElement("div"); el.className = "cmdk";
    el.innerHTML = `<div class="cmdk-box" role="dialog" aria-label="Palette de commandes"><div class="cmdk-in"><svg class="i" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input placeholder="${ph}" aria-label="${ph}" autocomplete="off" spellcheck="false"><span class="kbd">Échap</span></div><div class="cmdk-list" role="listbox"></div><div class="cmdk-foot"><span>↑↓ naviguer</span><span>↵ ouvrir</span></div></div>`;
    document.body.appendChild(el);
    const inp = el.querySelector("input"), list = el.querySelector(".cmdk-list");
    const paint = () => {
      list.innerHTML = shown.length ? shown.map((it, i) => `<button class="cmdk-it ${i === sel ? "on" : ""}" data-i="${i}" role="option" style="${it.color ? `--c:${it.color}` : ""}"><span class="ic">${it.icon || ""}</span><span><b>${it.label}</b>${it.sub ? `<small>${it.sub}</small>` : ""}</span><span class="cat">${it.cat || ""}</span></button>`).join("") : `<div class="cmdk-empty">Aucun résultat</div>`;
      list.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    };
    const filter = () => { const q = norm(inp.value).trim().split(/\s+/).filter(Boolean); shown = items.filter(it => { const h = norm(it.label + " " + (it.sub || "") + " " + (it.cat || "") + " " + (it.keys || "")); return q.every(w => h.includes(w)); }); sel = 0; paint(); };
    const go = i => { const it = shown[i]; if (!it) return; close(); it.run(); };
    inp.addEventListener("input", filter);
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === "Enter") { e.preventDefault(); go(sel); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("mousemove", e => { const b = e.target.closest("[data-i]"); if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; list.querySelectorAll(".cmdk-it").forEach((x, i) => x.classList.toggle("on", i === sel)); } });
    list.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) go(+b.dataset.i); });
    el.addEventListener("pointerdown", e => { if (e.target === el) close(); });
    paint(); setTimeout(() => inp.focus(), 10);
  }
  function close(){ el?.remove(); el = null; }
  const isOpen = () => !!el;
  const isShortcut = e => (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
  return { open, close, isOpen, isShortcut };
})();

/* ============ Palette de commandes (⌘K / Ctrl+K) ============ */
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
function openPalette(){
  const work = S.view === "work" && pages().length;
  const items = Object.entries(TOOLS).map(([id, T]) => ({ label: T.name, sub: T.desc, cat: CATS[T.cat][0], keys: id, icon: icon(T.icon), color: `var(${CATS[T.cat][1]})`, run: () => work ? setTool(id) : openTool(id) }));
  if (S.view !== "home") items.push({ label: "Accueil", sub: "Revenir à la liste des outils", cat: "Aller à", icon: icon("back"), run: () => showView("home") });
  if (work) items.push({ label: "Annuler", sub: "Dernière modification", cat: "Action", icon: icon("undo"), keys: "ctrl z", run: () => undo() }, { label: "Rétablir", cat: "Action", icon: icon("redo"), run: () => redo() });
  Cmdk.open(items, "Rechercher un outil : fusionner, signer, compresser…");
}
addEventListener("keydown", e => { if (Cmdk.isShortcut(e)) { e.preventDefault(); e.stopPropagation(); Cmdk.isOpen() ? Cmdk.close() : openPalette(); } }, true);
document.querySelectorAll(".hbar .sp").forEach(sp => sp.insertAdjacentHTML("afterend", `<button class="cmdbtn" data-cmdk aria-label="Rechercher un outil">${icon("search")}<span>Rechercher un outil</span><span class="kbd">${IS_MAC ? "⌘" : "Ctrl"} K</span></button>`));
document.addEventListener("click", e => { if (e.target.closest("[data-cmdk]")) openPalette(); });

/* ============ Application ============ */
const OPEN_ON_MOBILE = new Set(["protect", "txt2pdf", "compress", "meta", "forms", "pdf2txt", "pdf2word", "unlock"]);
let homeCat = "all", landTool = null;

function showView(v){
  S.view = v;
  $("#vHome").hidden = v !== "home"; $("#vLand").hidden = v !== "land"; $("#vWork").hidden = v !== "work";
  document.body.classList.toggle("work", v === "work");
  if (v === "home") renderHome();
}
function toolCard(id, T){
  const c = `var(${CATS[T.cat][1]})`;
  return `<button class="tcard" data-tool="${id}" style="--c:${c}"><span class="tile">${icon(T.icon)}</span><span class="cat">${CATS[T.cat][0]}${T.pro ? `<i class="newb">Pro</i>` : ""}</span><b>${T.name}</b><span>${T.desc}</span></button>`;
}
async function renderHome(){
  $("#chips").innerHTML = [["all", "Tous les outils"], ...Object.entries(CATS).map(([k, v]) => [k, v[0]])].map(([k, l]) => `<button class="chip ${homeCat === k ? "on" : ""}" data-cat="${k}">${l}</button>`).join("");
  $("#tgrid").innerHTML = Object.entries(TOOLS).filter(([, T]) => homeCat === "all" || T.cat === homeCat).map(([id, T]) => toolCard(id, T)).join("");
  const box = $("#resume");
  if (pages().length) {
    box.hidden = false;
    box.innerHTML = `<canvas width="1" height="1"></canvas><div class="rt"><b>${esc(S.doc.name)}</b><span>${plural(pages().length, "page")} · document ouvert</span></div><button class="btn primary" data-res="back">Continuer</button><button class="btn ghost" data-res="close">Fermer</button>`;
    paintThumb(box.querySelector("canvas"), pages()[0], 0, pages().length, 44, 56);
    return;
  }
  const st = await DB.get("state");
  if (st?.doc?.pages?.length && S.view === "home" && !pages().length) {
    const ago = Math.round((Date.now() - st.savedAt) / 60000);
    const when = ago < 1 ? "à l'instant" : ago < 60 ? `il y a ${ago} min` : ago < 1440 ? `il y a ${Math.round(ago / 60)} h` : new Date(st.savedAt).toLocaleDateString("fr-FR");
    box.hidden = false;
    box.innerHTML = `<span class="tile" style="--c:var(--c-edit)">${icon("file")}</span><div class="rt"><b>${esc(st.doc.name)}</b><span>${plural(st.doc.pages.length, "page")} · enregistré ${when}</span></div><button class="btn primary" data-res="resume">Reprendre</button><button class="btn ghost" data-res="discard">Effacer</button>`;
  } else box.hidden = true;
}
function openTool(id){
  const T = TOOLS[id]; landTool = id;
  const has = pages().length > 0;
  const c = `var(${CATS[T.cat][1]})`;
  const accept = T.accept === "img" ? "des images" : T.accept === "any" ? (T.multi ? "vos fichiers" : "un fichier") : T.multi ? "des fichiers PDF" : "un fichier PDF";
  let main;
  if (T.landing === "scan") {
    main = `<div class="dropzone"><button class="btn primary big" data-l="scan">${icon("camera")}Ouvrir le scanner</button><small>Photographiez vos pages : les bords sont détectés, la page est redressée et nettoyée.</small></div>`;
  } else if (T.landing === "text") {
    main = `<div class="dropzone"><button class="btn primary big" data-l="write">${icon("pen")}Commencer à écrire</button><button class="btn line" data-l="importtxt">${icon("upload")}Importer un fichier .txt</button></div>`;
  } else {
    main = `<div class="dropzone"><button class="btn primary big" data-l="pick">${icon("upload")}${T.landText || (T.multi ? "Sélectionner des fichiers" : "Sélectionner un fichier PDF")}</button><small>ou déposez ${accept} ici</small></div>`;
  }
  const alts = [];
  if (has && T.accept !== "none") alts.push(`<button class="btn line" data-l="continue">${icon("next")}Continuer avec « ${esc(S.doc.name.slice(0, 32))} »</button>`);
  if (T.blank) alts.push(`<button class="btn ghost" data-l="blank">${icon("blank")}Page vierge</button>`);
  if (T.sample) alts.push(`<button class="btn ghost" data-l="sample">${icon("eye")}Essayer avec un exemple</button>`);
  $("#land").innerHTML = `<span class="tile" style="--c:${c}">${icon(T.icon)}</span><h1>${T.name}</h1><p>${T.desc}</p>${main}${alts.length ? `<div class="alt">${alts.join("")}</div>` : ""}<p class="ph" style="margin-top:6px">Vos fichiers restent sur cet appareil.</p>`;
  showView("land");
  $("#land .btn.primary")?.focus({ preventScroll: true });
}

function enterWork(id){ showView("work"); $("#docName").value = S.doc.name; setTool(id); }
function setTool(id){
  const T = TOOLS[id]; if (!T) return;
  if (S.editing) finishEditing(true);
  closeModal("#mTools");
  S.tool = id; S.sel.clear(); S.annSel = null;
  S.etool = T.etool || "select";
  setStat("");
  const ret = T.onEnter?.call(T);
  renderPanel();
  setWView(T.view || "grid");
  openPanel(narrow() && OPEN_ON_MOBILE.has(id));
  if (ret?.then) ret.then(() => { if (S.tool === id) renderPanelFoot(); });
  persistSoon();
}
function setWView(v){
  S.wview = v;
  $("#gridView").hidden = v !== "grid"; $("#editView").hidden = v !== "edit";
  $$("#viewSeg button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  if (v === "edit") { if (S.cur >= pages().length) S.cur = 0; renderETools(); renderStrip(); requestAnimationFrame(() => { renderEditor(); renderProps(); }); }
  else { if (S.editing) finishEditing(true); renderGrid(); }
}
let lightT;
function docChanged(light, keepPanel){
  if (!pages().length && S.view === "work") { closeDoc(); return; }
  pruneSel();
  if (light) {
    clearTimeout(lightT);
    lightT = setTimeout(() => { if (S.wview === "edit") { refreshStripThumb(S.cur); renderStampLayer(); } else refreshVisibleCards(); }, 220);
  } else if (S.view === "work") {
    if (S.wview === "edit") { S.cur = clamp(S.cur, 0, pages().length - 1); renderStrip(); renderEditor(); renderProps(); }
    else renderGrid();
  }
  if (!keepPanel && S.view === "work") { const T = TOOLS[S.tool]; if (T && !light && ["merge", "split", "compress", "crop", "redact", "rotate", "unlock"].includes(S.tool)) { const f = document.activeElement; if (!f?.closest?.("#pbody")) renderPanel(); } }
  renderPanelFoot(); updUndo(); persistSoon();
}
function compactSources(){
  const used = [...new Set(pages().filter(p => p.kind === "pdf").map(p => p.src))].sort((a, b) => a - b);
  const map = new Map(used.map((s, i) => [s, i]));
  const next = used.map(i => sources[i]);
  sources.length = 0; sources.push(...next);
  pages().forEach(p => { if (p.kind === "pdf") p.src = map.get(p.src); });
  if (txtSrc != null) txtSrc = map.has(txtSrc) ? map.get(txtSrc) : null;
  baseCache.clear(); textCache.clear();
  const usedImg = new Set(); pages().forEach(p => p.annots.forEach(a => a.img && usedImg.add(a.img))); if (S.doc.wm.img) usedImg.add(S.doc.wm.img);
  for (const id of Object.keys(images)) if (!usedImg.has(id)) { URL.revokeObjectURL(images[id].url); delete images[id]; }
  for (const el of cardEls.values()) el.remove(); cardEls.clear();
}
async function startDoc(newPages, name, toolId){
  const keepTxt = S.doc.txt;
  S.doc = freshDoc(); S.doc.pages = newPages; S.doc.name = name; S.cur = 0; S.sel.clear();
  if (toolId === "txt2pdf") S.doc.txt = keepTxt;
  resetHistory(); compactSources();
  await clearStore();
  enterWork(toolId); persistSoon();
}
async function closeDoc(){
  S.doc = freshDoc(); S.cur = 0; S.sel.clear(); txtSrc = null; resetHistory(); compactSources();
  await clearStore();
  showView("home");
}

let fileMode = "replace", fileAt = null;
function pickFiles(mode, accept, at = null){
  fileMode = mode; fileAt = at;
  const T = TOOLS[mode.startsWith("tool:") ? mode.slice(5) : S.tool] || {};
  const fi = $("#fileIn");
  fi.accept = accept || (T.accept === "img" ? "image/*" : T.accept === "pdf" ? "application/pdf,.pdf" : "application/pdf,.pdf,image/*");
  fi.multiple = mode === "append" || !!T.multi;
  fi.click();
}
async function handleFiles(files, mode, at){
  if (!files.length) return;
  if (mode.startsWith("tool:")) {
    const id = mode.slice(5), T = TOOLS[id];
    if (pages().length) {
      const v = await choose("Un document est déjà ouvert", `Que faire de « ${S.doc.name} » ?`, [{ v: null, label: "Annuler" }, { v: "append", label: "Y ajouter ces fichiers" }, { v: "replace", label: "Le remplacer", primary: true }]);
      if (!v) return;
      if (v === "append") { const add = await loadFiles(files, { accept: T.accept }); if (!add.length) return; snapshot(); pages().push(...add); enterWork(id); toast(`${plural(add.length, "page ajoutée", "pages ajoutées")}`); return; }
    }
    const loaded = await loadFiles(files, { accept: T.accept });
    if (!loaded.length) return;
    const name = files.length > 1 ? (id === "merge" ? "fusion" : id === "img2pdf" ? "images" : baseName(files[0].name)) : baseName(files[0].name);
    return startDoc(loaded, name, id);
  }
  const T = TOOLS[S.tool] || {};
  const added = await loadFiles(files, { accept: T.accept === "img" ? "img" : "any" });
  if (!added.length) return;
  snapshot();
  const pos = at ?? (S.wview === "edit" ? S.cur + 1 : pages().length);
  pages().splice(pos, 0, ...added);
  if (S.wview === "edit") S.cur = pos;
  docChanged();
  toast(`${plural(added.length, "page ajoutée", "pages ajoutées")}`);
}

function sampleDoc(){
  const p = blankPage(); const t = (x, y, text, size, o = {}) => ({ id: uid(), type: "text", x, y, text, size, font: "Helvetica", bold: false, color: "#16171b", ...o });
  p.annots.push(
    t(56, 60, "Atelier Morel", 13, { bold: true, color: "#e5484d" }),
    t(56, 80, "12 rue des Tanneurs\n69001 Lyon", 10, { color: "#62656e" }),
    t(56, 150, "Devis n° 2026-118", 24, { bold: true }),
    t(56, 186, "Date : 5 novembre 2026\nValable 30 jours", 11, { color: "#62656e" }),
    t(56, 250, "Prestation", 11, { bold: true }), t(420, 250, "Montant HT", 11, { bold: true }),
    t(56, 274, "Refonte du site vitrine (6 pages)\nPhotos produits, retouche\nMise en ligne et formation", 11),
    t(420, 274, "1 800,00 €\n420,00 €\n180,00 €", 11, { font: "Courier" }),
    t(56, 352, "Total HT", 12, { bold: true }), t(420, 352, "2 400,00 €", 12, { bold: true, font: "Courier" }),
    { id: uid(), type: "rect", kind: "highlight", color: "#ffd84d", x: 412, y: 347, w: 96, h: 22 },
    { id: uid(), type: "shape", shape: "rect", color: "#2a62d6", width: 1.5, x: 52, y: 700, w: 240, h: 70 },
    t(62, 712, "Bon pour accord, date et signature :", 10, { color: "#62656e" })
  );
  return [p];
}

function bindApp(){
  $("#chips").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) { homeCat = b.dataset.cat; renderHome(); } });
  $("#tgrid").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (b) openTool(b.dataset.tool); });
  $("#resume").addEventListener("click", async e => {
    const a = e.target.closest("[data-res]")?.dataset.res; if (!a) return;
    if (a === "back") enterWork(S.tool || "edit");
    if (a === "close") closeDoc();
    if (a === "discard") { await clearStore(); renderHome(); }
    if (a === "resume") {
      const st = await DB.get("state");
      try { toast("Ouverture…", 0); await restoreSaved(st); $("#toast").hidden = true; S.wview = st.wview; enterWork(TOOLS[st.tool] ? st.tool : "edit"); }
      catch (err) { console.error(err); toast("Ce document n'a pas pu être rouvert."); await clearStore(); renderHome(); }
    }
  });
  $("#landBack").onclick = () => showView("home");
  $("#land").addEventListener("click", async e => {
    const a = e.target.closest("[data-l]")?.dataset.l; if (!a) return;
    const T = TOOLS[landTool];
    if (a === "pick") pickFiles("tool:" + landTool);
    if (a === "scan") scanStart();
    if (a === "continue") enterWork(landTool);
    if (a === "blank") startDoc([blankPage()], "nouveau-document", landTool);
    if (a === "sample") startDoc(sampleDoc(), "exemple-devis", landTool);
    if (a === "write" || a === "importtxt") {
      if (a === "write") { S.doc.txt = S.doc.txt || SAMPLE_TXT; }
      const go = async () => { txtSrc = null; await startDoc([], "mon-document", "txt2pdf"); await regenTxt(); if (narrow()) openPanel(true); };
      if (a === "importtxt") {
        const fi = document.createElement("input"); fi.type = "file"; fi.accept = ".txt,.md,text/plain";
        fi.onchange = async () => { const f = fi.files[0]; if (!f) return; S.doc.txt = await f.text(); await go(); S.doc.name = baseName(f.name); $("#docName").value = S.doc.name; renderPanel(); };
        fi.click();
      } else go();
    }
  });
  $("#fileIn").addEventListener("change", e => { const files = [...e.target.files]; e.target.value = ""; handleFiles(files, fileMode, fileAt); });
  $("#goHome").addEventListener("click", () => showView("home"));
  $("#goHome").addEventListener("keydown", e => { if (e.key === "Enter") showView("home"); });
  $("#docName").addEventListener("input", e => { S.doc.name = e.target.value.trim() || "document"; persistSoon(); });
  $("#docName").addEventListener("blur", e => { e.target.value = S.doc.name; });
  $("#docName").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
  $("#viewSeg").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) { setWView(b.dataset.view); persistSoon(); } });
  $("#btnUndo").onclick = undo; $("#btnRedo").onclick = redo;
  $("#btnTools").onclick = () => {
    $("#mtGrid").innerHTML = Object.entries(TOOLS).map(([id, T]) => toolCard(id, T)).join("");
    openModal("#mTools");
  };
  $("#mtGrid").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (b) setTool(b.dataset.tool); });
  $("#pgrid").addEventListener("contextmenu", e => { if (e.target.closest(".card")) e.preventDefault(); });

  let dragDepth = 0;
  addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { dragDepth++; document.body.classList.add("dragging"); } });
  addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("dragging"); } });
  addEventListener("dragover", e => e.preventDefault());
  addEventListener("drop", e => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging");
    const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
    if (S.view === "work") handleFiles(files, "append");
    else if (S.view === "land") handleFiles(files, "tool:" + landTool);
    else { const id = files.every(isImgFile) ? "img2pdf" : files.filter(isPdfFile).length > 1 ? "merge" : "edit"; handleFiles(files, "tool:" + id); }
  });

  addEventListener("keydown", e => {
    const inField = e.target.closest?.("input,select,textarea,[contenteditable=true]");
    const modalOpen = $$(".modal").some(m => !m.hidden);
    if (e.key === "Escape" && modalOpen) { $$(".modal").forEach(m => { if (!m.hidden) { if (m.id === "mPass") return pwResolve?.(null); m.hidden = true; if (m.id === "mChoose") chooseResolve?.(null); } }); return; }
    if (modalOpen || S.view !== "work") return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "z" && !inField) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === "y" && !inField) { e.preventDefault(); redo(); return; }
    if (inField) return;
    if (S.wview === "grid") {
      if (mod && k === "a") { e.preventDefault(); pages().forEach(p => S.sel.add(p.id)); afterSel(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && S.sel.size && TOOLS[S.tool].selMode !== "del") { e.preventDefault(); deletePages(selectedIdx()); }
      else if (e.key === "Escape" && S.sel.size) { S.sel.clear(); afterSel(); }
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && S.annSel) { e.preventDefault(); deleteAnnot(); }
    else if (e.key === "Escape" && S.annSel) selectAnnot(null);
    else if (e.key === "PageDown" || (e.key === "ArrowRight" && !S.annSel)) goTo(S.cur + 1);
    else if (e.key === "PageUp" || (e.key === "ArrowLeft" && !S.annSel)) goTo(S.cur - 1);
  });

  let rzT, lastNarrow = narrow();
  addEventListener("resize", () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (S.view !== "work") return;
      if (narrow() !== lastNarrow) { lastNarrow = narrow(); for (const el of cardEls.values()) { const c = el.querySelector("canvas"); delete c.dataset.key; } renderPanel(); }
      if (S.wview === "edit") { if (S.zoom == null) renderEditor(); else updateSelbox(); } else renderGrid();
    }, 140);
  });
  addEventListener("pagehide", () => persist());
  document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });

  let deferredInstall = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("#btnInstall").hidden = false; });
  $("#btnInstall").onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; $("#btnInstall").hidden = true; };

  const App = window.Capacitor?.Plugins?.App;
  if (App?.addListener) App.addListener("backButton", () => {
    const m = $$(".modal").find(x => !x.hidden);
    if (m) { m.hidden = true; if (m.id === "mChoose") chooseResolve?.(null); if (m.id === "mPass") pwResolve?.(null); return; }
    if (S.view === "work" && $("#panel").classList.contains("open") && narrow()) return openPanel(false);
    if (S.view === "work" || S.view === "land") return showView("home");
    App.exitApp?.();
  });
}

function init(){
  paintIcons();
  bindModals(); buildEditorChrome(); bindSignature(); bindGrid(); bindPanel(); bindApp();
  showView("home");
  if (document.querySelector('meta[name="idlp-pwa"]') && "serviceWorker" in navigator && /^https?:/.test(location.protocol) && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (!window.PDFLib) toast("Les outils PDF n'ont pas pu se charger. Rechargez la page.", 0);
  pdfjsReady().catch(() => toast("Le lecteur PDF n'a pas pu se charger. Rechargez la page.", 0));
}
init();

})();