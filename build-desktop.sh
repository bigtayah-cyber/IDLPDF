#!/bin/bash
# Construit Ateliers pour Mac (Apple Silicon et Intel) et Windows, sans signature Apple (signature ad hoc).
# Usage : ./build-desktop.sh mac-arm64 mac-x64 win-x64
set -e
cd "$(dirname "$0")"
[ -f www/lib/lame.min.js ] || node fetch-assets.mjs
EV=${ELECTRON_VERSION:-$(npm view electron@38 version 2>/dev/null | tail -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | tail -1)}
echo "Electron $EV"
IGN='^/(out|node_modules|\.assets|\.fonts|build-desktop\.sh|fetch-assets\.mjs|fonts\.json|LISEZMOI\.md)'
for t in "${@:-mac-arm64}"; do
  plat=${t%-*}; arch=${t#*-}
  case $plat in
    mac) npx --yes @electron/packager@18 . Ateliers --platform=darwin --arch=$arch --electron-version=$EV --icon=assets/icon.icns \
           --app-bundle-id=fr.ateliers.suite --app-version=1.0.0 --app-category-type=public.app-category.productivity \
           --extend-info=assets/Info-extra.plist --out=out --overwrite --no-prune --ignore="$IGN" ;;
    win) npx --yes @electron/packager@18 . Ateliers --platform=win32 --arch=$arch --electron-version=$EV \
           --out=out --overwrite --no-prune --ignore="$IGN" ;;
  esac
done
ls out
