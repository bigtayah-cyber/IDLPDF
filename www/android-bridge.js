/* ============ Pont Android (Capacitor) ============
   Enregistrer = écrire le fichier puis ouvrir le menu Partager d'Android (Enregistrer dans Fichiers, Drive, WhatsApp…).
   Le logo de chaque app et le bouton Retour ramènent au launcher Ateliers. */
(() => {
  const C = window.Capacitor; if (!C?.isNativePlatform?.()) return;
  const P = C.Plugins || {};
  document.documentElement.classList.add("is-android");
  const toB64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(s); };
  if (!window.idlpNative && P.Filesystem && P.Share) {
    window.idlpNative = {
      saveFile: async (name, bytes) => {
        const safe = String(name).replace(/[\\/:*?"<>|]+/g, "-");
        const r = await P.Filesystem.writeFile({ path: safe, data: toB64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), directory: "CACHE" });
        try { await P.Share.share({ title: safe, files: [r.uri], dialogTitle: "Enregistrer ou partager" }); }
        catch (e) { if (!/cancel/i.test(String(e?.message || e))) await P.Share.share({ title: safe, url: r.uri, dialogTitle: "Enregistrer ou partager" }); }
        return true;
      }
    };
  }
  const home = () => { location.href = window.SUITE_APP ? "../index.html" : "index.html"; };
  if (window.SUITE_APP) document.addEventListener("click", e => { if (e.target.closest("[data-suite-logo]")) { e.preventDefault(); e.stopPropagation(); home(); } }, true);
  P.App?.addListener?.("backButton", ({ canGoBack }) => {
    const open = [...document.querySelectorAll(".modal:not([hidden]), dialog[open], #scanUI:not([hidden])")].pop();
    if (open) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return; }
    if (window.SUITE_APP) home(); else if (canGoBack) history.back(); else P.App.exitApp();
  });
})();
