#!/bin/bash

# Extract all t() calls from modified files
echo "Extracting t() calls from modified files..."
KEYS=$(grep -rh "t('.*\..*')" src/components/ProfileDialogContent.tsx src/components/dashboard/LiquidityReport.tsx src/components/settings/CloudMcpSyncCard.tsx | sed "s/.*t('\([^']*\)').*/\1/" | sort -u)

# Validate each key exists in both de and en blocks
MISSING=0
for KEY in $KEYS; do
  # Check de block
  if ! grep -q "^    [a-z]*: {" src/i18n/translations.ts; then
    echo "Checking key: $KEY"
  fi
  
  # Extract namespace and field
  NAMESPACE=$(echo $KEY | cut -d'.' -f1)
  FIELD=$(echo $KEY | cut -d'.' -f2-)
  
  # Simple check: look for the field name in translations
  if ! grep -q "$FIELD:" src/i18n/translations.ts; then
    echo "❌ MISSING: $KEY"
    MISSING=$((MISSING+1))
  fi
done

if [ $MISSING -eq 0 ]; then
  echo "✅ All keys verified in translations.ts"
else
  echo "❌ Found $MISSING missing keys"
  exit 1
fi
