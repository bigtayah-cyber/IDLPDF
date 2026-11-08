const { contextBridge, ipcRenderer, webUtils } = require("electron");
let version = "";
ipcRenderer.invoke("app-version").then(v => { version = v; }).catch(() => {});
/* Enregistrement natif (utilisé par toutes les apps de la suite) */
contextBridge.exposeInMainWorld("idlpNative", { saveFile: (name, bytes) => ipcRenderer.invoke("save-file", name, bytes) });
/* Launcher : ouvrir une app, éventuellement avec un fichier déposé */
contextBridge.exposeInMainWorld("suiteNative", {
  get version(){ return version; },
  open: async (k, file) => {
    if (file && typeof file === "object" && file.arrayBuffer) {
      let p = ""; try { p = webUtils.getPathForFile(file); } catch {}
      return ipcRenderer.invoke("open-app", k, p || { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    return ipcRenderer.invoke("open-app", k, typeof file === "string" ? file : undefined);
  },
});
/* Un fichier envoyé par le launcher arrive comme un glisser-déposer dans la page */
ipcRenderer.on("suite-open-file", (_e, { name, type, bytes }) => {
  const f = new File([bytes], name, { type }), dt = new DataTransfer(); dt.items.add(f);
  const ev = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
  (document.querySelector("#app") || document.body).dispatchEvent(ev);
});
