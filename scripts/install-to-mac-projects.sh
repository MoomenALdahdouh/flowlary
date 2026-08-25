#!/usr/bin/env bash
# Copy Flowlary into ~/Projects/flowlary on THIS machine.
# Run on your Mac (Finder home is "moomen" → Projects).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${FLOWLARY_DEST:-$HOME/Projects/flowlary}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This Cloud Agent cannot write to your Mac disk."
  echo "Flowlary source is here: $SRC"
  echo
  echo "On your Mac, open Terminal and run this after you have the repo:"
  echo "  bash \"$SRC/scripts/install-to-mac-projects.sh\""
  echo "Destination on your Mac: /Users/moomen/Projects/flowlary"
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude node_modules --exclude .git --exclude .vite "$SRC/" "$DEST/"
else
  mkdir -p "$DEST"
  tar -C "$SRC" --exclude node_modules --exclude .git --exclude .vite -cf - . | tar -C "$DEST" -xf -
fi

echo "Flowlary is in Finder at:"
echo "  $DEST"
echo
echo "Then:"
echo "  cd \"$DEST\" && npm install && npm run build"
echo "Load unpacked in Chrome: $DEST/extension/dist"
