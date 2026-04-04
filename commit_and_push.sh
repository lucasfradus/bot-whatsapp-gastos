#!/bin/bash

# Script para hacer commit + push automático
# Uso: ./commit_and_push.sh "Descripción del cambio"

if [ -z "$1" ]; then
  echo "❌ Error: Debes proporcionar un mensaje de commit"
  echo "Uso: $0 \"Descripción del cambio\""
  exit 1
fi

COMMIT_MESSAGE="$1"

# Cambiar a la carpeta del repo
cd "$(dirname "$0")" || exit

# 1. Verificar estado
echo "📊 Estado actual:"
git status --short

# 2. Agregar todos los cambios
echo ""
echo "➕ Agregando cambios..."
git add -A
git status --short

# 3. Crear commit
echo ""
echo "💾 Creando commit: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE" || {
  echo "❌ No hay cambios para commitear"
  exit 1
}

# 4. Push a origin
echo ""
echo "🚀 Haciendo push..."
git push origin main

# 5. Confirmar
echo ""
echo "✅ Commit y push completados"
git log -1 --pretty=format:"[%h] %s by %an (%ar)"
echo ""
