// Rapatrie en local tout ce que la suite chargeait depuis Internet : polices et modules (MP3, HEIC, TIFF, OCR).
// Lancer depuis le dossier Ateliers : node fetch-assets.mjs
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
const W = path.resolve("www");

// 1) polices : paquets Fontsource (npm), seulement les alphabets latins, avec les mêmes noms que Google Fonts
const urls = JSON.parse(fs.readFileSync("fonts.json", "utf8")), FT = path.resolve(".fonts"); fs.mkdirSync(FT, { recursive: true }); fs.mkdirSync(path.join(W, "fonts"), { recursive: true });
const specs = Object.fromEntries(Object.entries(urls).map(([k, u]) => [k, new URL(u).searchParams.getAll("family").map(f => { const [name, ax = ""] = f.split(":"); const w = ax.includes("@") ? ax.split("@")[1] : ""; return { name, variable: /\.\./.test(w), weights: w && !/\.\./.test(w) ? w.split(";").map(x => x.split(",").pop()) : ["400"] }; })]));
const pkgOf = f => f.variable ? `@fontsource-variable/${f.name.toLowerCase().replace(/ /g, "-")}` : `@fontsource/${f.name.toLowerCase().replace(/ /g, "-")}`;
const pkgs = [...new Set(Object.values(specs).flat().map(pkgOf))];
if (!fs.existsSync(path.join(FT, "package.json"))) fs.writeFileSync(path.join(FT, "package.json"), '{"name":"fonts","private":true}');
execSync(`npm install --no-audit --no-fund --loglevel=error ${pkgs.join(" ")}`, { cwd: FT, stdio: "inherit" });
const copied = new Set();
for (const [k, fams] of Object.entries(specs)) {
  let out = "";
  for (const f of fams) {
    const dir = path.join(FT, "node_modules", pkgOf(f)), files = f.variable ? ["standard.css"] : f.weights.map(w => `${w}.css`);
    for (const cssf of files) {
      if (!fs.existsSync(path.join(dir, cssf))) { console.warn("police absente :", pkgOf(f), cssf); continue; }
      const css = fs.readFileSync(path.join(dir, cssf), "utf8");
      for (const block of css.split(/(?=\/\* )/)) {
        if (!/-latin-(ext-)?[\w-]*\*\/|-latin-[\w-]*normal \*\//.test(block.split("\n")[0]) || /italic/.test(block.split("\n")[0])) continue;
        out += block.replace(/'([^']+) Variable'/, "'$1'").replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('([^']+)'\)(, url\([^)]*\.woff\) format\('woff'\))?/, (m, file, fmt) => {
          if (!copied.has(file)) { fs.copyFileSync(path.join(dir, "files", file), path.join(W, "fonts", file)); copied.add(file); }
          return `url(${file}) format('${fmt}')`;
        });
      }
    }
  }
  fs.writeFileSync(path.join(W, "fonts", k + ".css"), out);
}
console.log(`polices : ${copied.size} fichiers`);

// 2) modules
const T = path.resolve(".assets"); fs.mkdirSync(T, { recursive: true });
if (!fs.existsSync(path.join(T, "package.json"))) fs.writeFileSync(path.join(T, "package.json"), '{"name":"assets","private":true}');
execSync("npm install --no-audit --no-fund --loglevel=error lamejs@1.2.1 heic2any@0.0.4 utif@3.1.0 pako@2.1.0 tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/fra @tesseract.js-data/eng", { cwd: T, stdio: "inherit" });
const NM = path.join(T, "node_modules"), L = path.join(W, "lib"), cp = (a, b) => { fs.mkdirSync(path.dirname(path.join(L, b)), { recursive: true }); fs.copyFileSync(path.join(NM, a), path.join(L, b)); };
cp("lamejs/lame.min.js", "lame.min.js"); cp("heic2any/dist/heic2any.min.js", "heic2any.min.js"); cp("utif/UTIF.js", "UTIF.js"); cp("pako/dist/pako.min.js", "pako.min.js");
cp("tesseract.js/dist/tesseract.min.js", "tesseract/tesseract.min.js"); cp("tesseract.js/dist/worker.min.js", "tesseract/worker.min.js");
for (const f of fs.readdirSync(path.join(NM, "tesseract.js-core"))) if (/^tesseract-core.*lstm.*\.(js|wasm)$/.test(f)) cp(`tesseract.js-core/${f}`, `tesseract/core/${f}`);
for (const lang of ["fra", "eng"]) {
  const base = path.join(NM, "@tesseract.js-data", lang), dir = fs.readdirSync(base).find(d => d === "4.0.0_best_int") || fs.readdirSync(base).find(d => /best_int/.test(d)) || fs.readdirSync(base).find(d => /^4/.test(d));
  cp(`@tesseract.js-data/${lang}/${dir}/${lang}.traineddata.gz`, `tesseract/lang/${lang}.traineddata.gz`);
}
const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`modules : ${(size(L) / 1e6).toFixed(1)} Mo dans www/lib`);
