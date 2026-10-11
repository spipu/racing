#!/bin/bash
# Builds the trace recorder against the libretro.h of a PicoDrive source tree.
set -e
cd "$(dirname "$0")"
PICODRIVE_DIR="${1:-../../.source/picodrive}"
gcc -O2 -Wall -Wextra -std=c11 -D_DEFAULT_SOURCE \
    -I "$PICODRIVE_DIR/platform/libretro/libretro-common/include" \
    -o vrTraceRecorder vrTraceRecorder.c -ldl
