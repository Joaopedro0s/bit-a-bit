#!/bin/bash
set -e

DESTINO=$1
SHA=$2

if [ -z "$DESTINO" ] || [ -z "$SHA" ]; then
  echo "Uso: $0 <destino> <sha>"
  exit 1
fi

REPO_URL="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
TEMP_DIR=$(mktemp -d)

git clone --branch gh-pages --single-branch "$REPO_URL" "$TEMP_DIR" 2>/dev/null || \
(mkdir -p "$TEMP_DIR" && cd "$TEMP_DIR" && git init && git checkout -b gh-pages && git remote add origin "$REPO_URL")

cd "$TEMP_DIR"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

if [ "$DESTINO" = "hml" ]; then
  rm -rf hml
  mkdir -p hml
  unzip -q -o "$GITHUB_WORKSPACE/build.zip" -d hml/
elif [[ "$DESTINO" == releases/* ]]; then
  if [ -d "$DESTINO" ]; then
    echo "Erro: O destino $DESTINO já existe."
    exit 1
  fi
  mkdir -p "$DESTINO"
  unzip -q -o "$GITHUB_WORKSPACE/build.zip" -d "$DESTINO"
else
  echo "Destino inválido."
  exit 1
fi

if [ ! -f "rollout.json" ]; then
  cp -r "$GITHUB_WORKSPACE/pages/index.html" .
  cp -r "$GITHUB_WORKSPACE/pages/status" .
  echo '{"estavel": "", "anterior": "", "canario": "", "percentual": 0}' > rollout.json
fi

git add .
git commit -m "deploy: $DESTINO $SHA por $GITHUB_ACTOR" || echo "Nada para commitar"
git push origin gh-pages
