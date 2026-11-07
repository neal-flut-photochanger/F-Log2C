#!/bin/bash
set -euo pipefail

GITHUB_USER="neal-flut-photochanger"
REPO_NAME="F-Log2C"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
SITE_URL="https://${GITHUB_USER}.github.io/${REPO_NAME}/"

cd "$(dirname "$0")"

if [ ! -d .git ]; then
    git init -b main
fi

if ! git config user.name >/dev/null; then
    git config user.name "$GITHUB_USER"
fi

if ! git config user.email >/dev/null; then
    git config user.email "${GITHUB_USER}@users.noreply.github.com"
fi

if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE_URL"
else
    git remote add origin "$REMOTE_URL"
fi

git add -A

if git diff --cached --quiet; then
    echo "没有新的改动 / No changes to publish"
else
    git commit -m "${1:-Update site $(date '+%Y-%m-%d %H:%M')}"
fi

git push -u origin main

echo ""
echo "已发布 / Published: ${SITE_URL}"
echo "首次发布需在 GitHub 仓库 Settings → Pages 中选择 main 分支 /(root)，约 1–2 分钟后生效。"
