#!/bin/bash
# Decompile every Timberborn.*.dll into one .cs file each (investigation/decompiled, gitignored).
G="/c/Program Files (x86)/Steam/steamapps/common/Timberborn/Timberborn_Data/Managed"
OUT="$(dirname "$0")/decompiled"
mkdir -p "$OUT"
ls "$G" | grep '^Timberborn\..*\.dll$' | xargs -P 8 -I{} sh -c 'n=$(basename "{}" .dll); [ -s "'"$OUT"'/$n.cs" ] || ilspycmd "'"$G"'/{}" > "'"$OUT"'/$n.cs" 2>/dev/null'
ls "$OUT" | wc -l
