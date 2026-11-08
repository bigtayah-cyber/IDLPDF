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

window.FI = FI;
