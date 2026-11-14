#!/bin/zsh
# usage: shoot3.sh page outname W H scale
cd "$(dirname $0)"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=$5 --allow-file-access-from-files --virtual-time-budget=3000 --window-size=$3,$4 --screenshot="$PWD/../shots/$2" "file://$PWD/$1.html" 2>/dev/null
