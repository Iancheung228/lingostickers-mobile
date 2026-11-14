#!/bin/zsh
cd "$(dirname $0)"
node gen2.mjs
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
sh() { "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=$4 --allow-file-access-from-files --virtual-time-budget=3000 --window-size=$2 --screenshot="$PWD/../shots/$3" "file://$PWD/$1" 2>/dev/null }
for d in "$@"; do
  sh v2-$d.html 2200,960 v2-$d.png 2
  sh v2d-$d.html 1300,520 v2-$d-states.png 2
  sh v2z-$d.html 820,260 v2-$d-zoom.png 3
done
