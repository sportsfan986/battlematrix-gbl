#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bump_version.sh [explicit_version]
# Example: ./scripts/bump_version.sh v1.05
# If no version is passed, increments sub-version by 1 (e.g. v1.00 -> v1.01)

CURRENT_TAG=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "v1.00")
CURRENT_NUM="${CURRENT_TAG#v}"

if [ $# -ge 1 ] && [ -n "$1" ]; then
  RAW_ARG="${1#v}"
  NEW_NUM="$RAW_ARG"
else
  MAJOR=$(echo "$CURRENT_NUM" | cut -d. -f1)
  MINOR_STR=$(echo "$CURRENT_NUM" | cut -d. -f2)
  MINOR_VAL=$((10#$MINOR_STR + 1))
  NEW_NUM=$(printf "%d.%02d" "$MAJOR" "$MINOR_VAL")
fi

NEW_TAG="v${NEW_NUM}"
MAJOR_PART=$(echo "$NEW_NUM" | cut -d. -f1)
MINOR_PART=$(echo "$NEW_NUM" | cut -d. -f2)
VERSION_CODE=$((10#$MAJOR_PART * 100 + 10#$MINOR_PART))

echo "$NEW_TAG" > VERSION

sed -i "s/versionCode = [0-9]\+/versionCode = ${VERSION_CODE}/g" app/build.gradle.kts
sed -i "s/versionName = \"[^\"]*\"/versionName = \"${NEW_NUM}\"/g" app/build.gradle.kts

echo "Updated version to ${NEW_TAG} (versionCode=${VERSION_CODE}, versionName=${NEW_NUM})"
