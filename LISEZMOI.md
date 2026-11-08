# Ateliers — la suite sur Mac et PC

Ateliers réunit les 4 apps dans une seule application : un écran titre, un launcher, puis chaque outil dans sa propre fenêtre.

| Raccourci | Action |
|---|---|
| ⌘1 à ⌘4 (Ctrl sur PC) | IdontlovePDF Pro, Moulinette, LyricDrop, Pixel Crypte Pro |
| ⌘0 | Revenir au launcher |
| Glisser un fichier sur le launcher | Il s'ouvre dans le bon outil |

Tout fonctionne hors ligne : polices, conversion MP3, photos HEIC et TIFF, reconnaissance de texte (OCR) sont inclus.

## Mac
- **Ateliers.app** : glissez-la dans Applications, puis ouvrez-la.
- L'app n'est pas signée par Apple. Si macOS refuse de l'ouvrir la première fois : clic droit sur l'app › Ouvrir › Ouvrir. Ou Réglages Système › Confidentialité et sécurité › « Ouvrir quand même ».
- La caméra (scanner de documents) est demandée la première fois qu'on s'en sert.

## Windows
- **Ateliers-win32-x64** : dézippez le dossier où vous voulez et lancez **Ateliers.exe**.
- Windows peut afficher « Windows a protégé votre ordinateur » : Informations complémentaires › Exécuter quand même.
- Pour un installateur classique (.exe d'installation), sur un PC Windows avec Node.js : `npm install` puis `npm run build:win`.

## Reconstruire
- Sur une machine connectée : `./build-desktop.sh mac-arm64 mac-x64 win-x64` (télécharge les modules puis fabrique les apps dans `out/`).
- Pour un Mac avec signature Apple et .dmg : sur un Mac avec Xcode, `npm install` puis `npm run build:mac`.
