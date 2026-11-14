#!/bin/zsh
# usage: shoot.sh a b c d  -> shots/dir-X.png and shots/detail-X.png
cd "$(dirname $0)"
node gen.mjs
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for d in "$@"; do
  "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --allow-file-access-from-files --virtual-time-budget=3000 --window-size=1780,990 --screenshot="$PWD/../shots/dir-$d.png" "file://$PWD/dir-$d.html" 2>/dev/null
  "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --allow-file-access-from-files --virtual-time-budget=3000 --window-size=920,330 --screenshot="$PWD/../shots/detail-$d.png" "file://$PWD/detail-$d.html" 2>/dev/null
done
