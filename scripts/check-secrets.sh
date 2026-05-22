#!/bin/bash

# Script de verificación de secretos en pre-commit
# Busca llaves privadas hexadecimales de 64 caracteres en el código en proceso de commit.

echo "🔍 Ejecutando verificación de secretos en pre-commit..."

# Obtener la lista de archivos en staging (modificados o agregados)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No hay archivos en staging para verificar."
  exit 0
fi

SECRETS_FOUND=0

for FILE in $STAGED_FILES; do
  # Omitir archivos de configuración comunes, locks, multimedia, tests y mocks
  if [[ "$FILE" =~ pnpm-lock.yaml$ || "$FILE" =~ \.png$ || "$FILE" =~ \.jpg$ || "$FILE" =~ \.ico$ || "$FILE" =~ \.svg$ || "$FILE" =~ \.md$ || "$FILE" =~ \.json$ || "$FILE" =~ \.test\.ts$ || "$FILE" =~ \.spec\.ts$ || "$FILE" =~ mock- || "$FILE" =~ \/mock || "$FILE" =~ deployment\.ts$ || "$FILE" =~ testnet4\.ts$ || "$FILE" =~ deploy-collection\.ts$ ]]; then
    continue
  fi

  # Buscar cadenas hexadecimales de 64 caracteres en las líneas añadidas (que empiezan con +)
  # Omitimos líneas que contengan hashes ficticios obvios como "00000000" o "11111111"
  ADDED_LINES=$(git diff --cached "$FILE" | grep '^\+' | grep -v '^+++')
  
  # Filtrar hashes ficticios con secuencias repetitivas de ceros
  CLEAN_LINES=$(echo "$ADDED_LINES" | grep -v '0000000000' | grep -v '1111111111')
  
  MATCHES=$(echo "$CLEAN_LINES" | grep -E '[a-fA-F0-9]{64}' | wc -l | tr -d ' ')

  if [ "$MATCHES" -gt 0 ]; then
    echo "❌ ERROR: Se detectó un posible secreto o llave privada (hex de 64 caracteres) en el archivo: $FILE"
    echo "$CLEAN_LINES" | grep --color=always -E '[a-fA-F0-9]{64}'
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi
done

if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo "⚠️ El commit ha sido bloqueado para prevenir la filtración accidental de credenciales."
  echo "Por favor, remueve la llave privada expuesta y configúrala a través de variables de entorno (.env)."
  exit 1
fi

echo "✅ Verificación de secretos exitosa. No se encontraron llaves privadas en staging."
exit 0
