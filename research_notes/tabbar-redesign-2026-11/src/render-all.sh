#!/bin/zsh
# Regenerates every round-3 shot, the motion demo and v3.html. Icons come from ../icons-v3/icons.json via icons-slot.mjs.
cd "$(dirname $0)"
node pages4.mjs && node pages2.mjs && node pages3.mjs && node motion.mjs
./shoot3.sh g-curv v3-geometry.png 1360 340 2
./shoot3.sh g-prop v3-proportions.png 1260 760 2
./shoot3.sh g-space v3-spacing.png 1300 420 2
./shoot3.sh g-surface v3-surface.png 1300 600 2
./shoot3.sh g-surface2 v3-surface-photos.png 900 380 2
./shoot3.sh g-disc v3-disc.png 700 540 3
./shoot3.sh g-scanscr v3-scan-screen.png 900 960 1.5
./shoot3.sh g-ind v3-active.png 900 560 2
./shoot3.sh g-fade v3-fade.png 880 420 2
./shoot3.sh g-badge v3-badge.png 900 420 2
./shoot3.sh g-labels v3-labels-states.png 1300 800 2
./shoot3.sh g-labels-ph v3-labels-screens.png 1700 800 2
./shoot3.sh g-final v3-final.png 2300 960 2
./shoot3.sh g-final-states v3-final-states.png 1300 620 2
./shoot3.sh g-final-zoom v3-final-zoom.png 1000 540 3
node build-v3.mjs
