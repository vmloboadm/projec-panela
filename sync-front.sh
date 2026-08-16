#!/bin/bash
# sync-front.sh — Copia frontend do OpenDesign para o projeto
# Uso: ./sync-front.sh

set -e

OD_PROJECT="/root/projetos/open-design/.od/projects/373a9625-fe47-4635-9413-674afdd936ae"
DESTINO="$(cd "$(dirname "$0")" && pwd)/public"

echo "→ Sincronizando frontend do OpenDesign → $DESTINO"

cp "$OD_PROJECT"/*.html "$DESTINO/"
cp "$OD_PROJECT"/*.png "$DESTINO/" 2>/dev/null || true
cp "$OD_PROJECT"/brand-spec.md "$DESTINO/../" 2>/dev/null || true

echo "→ OK — $(ls -1 "$DESTINO"/*.html 2>/dev/null | wc -l) HTMLs copiados"
echo ""
echo "Arquivos:"
ls -lh "$DESTINO"/*.html "$DESTINO"/*.png 2>/dev/null