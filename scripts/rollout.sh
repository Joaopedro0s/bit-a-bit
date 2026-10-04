#!/bin/bash
set -e

ACAO=$1
SHA=$2
PCT=$3

if [ -z "$ACAO" ]; then
  echo "Uso: $0 <acao> [sha] [pct]"
  exit 1
fi

REPO_URL="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
TEMP_DIR=$(mktemp -d)

git clone --branch gh-pages --single-branch "$REPO_URL" "$TEMP_DIR"
cd "$TEMP_DIR"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

if [ ! -f "rollout.json" ]; then
  echo "Erro: rollout.json não encontrado."
  exit 1
fi

case "$ACAO" in
  canario)
    if [ -z "$SHA" ] || [ -z "$PCT" ]; then
      echo "Uso: $0 canario <sha> <pct>"
      exit 1
    fi
    jq --arg sha "$SHA" --argjson pct "$PCT" '.canario = $sha | .percentual = $pct' rollout.json > tmp.json && mv tmp.json rollout.json
    COMMIT_MSG="rollout: canário de $SHA com $PCT% por $GITHUB_ACTOR"
    ;;
  promover)
    ESTAVEL=$(jq -r '.estavel' rollout.json)
    CANARIO=$(jq -r '.canario' rollout.json)
    if [ -z "$CANARIO" ] || [ "$CANARIO" == "null" ] || [ "$CANARIO" == "" ]; then
      echo "Não há canário para promover."
      exit 1
    fi
    jq --arg anterior "$ESTAVEL" --arg estavel "$CANARIO" '.anterior = $anterior | .estavel = $estavel | .canario = "" | .percentual = 0' rollout.json > tmp.json && mv tmp.json rollout.json
    COMMIT_MSG="rollout: promover $CANARIO por $GITHUB_ACTOR"
    ;;
  rollback)
    ANTERIOR=$(jq -r '.anterior' rollout.json)
    ESTAVEL=$(jq -r '.estavel' rollout.json)
    if [ -z "$ANTERIOR" ] || [ "$ANTERIOR" == "null" ] || [ "$ANTERIOR" == "" ]; then
      echo "Não há versão anterior para rollback."
      exit 1
    fi
    jq --arg estavel "$ANTERIOR" '.estavel = $estavel | .anterior = "" | .canario = "" | .percentual = 0' rollout.json > tmp.json && mv tmp.json rollout.json
    COMMIT_MSG="rollout: rollback de $ESTAVEL para $ANTERIOR por $GITHUB_ACTOR"
    ;;
  *)
    echo "Ação inválida: $ACAO"
    exit 1
    ;;
esac

git add rollout.json
git commit -m "$COMMIT_MSG"
git push origin gh-pages
