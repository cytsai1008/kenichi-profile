#!/usr/bin/env bash
set -euo pipefail

REPO="cytsai1008/kenichi-profile"
COMMIT=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)
BRANCH=$(git branch --show-current)

echo "Branch : $BRANCH"
echo "Commit : $SHORT"
echo "GitHub : https://github.com/$REPO/commit/$COMMIT/checks"
echo ""

gh api "repos/$REPO/commits/$COMMIT/check-runs" \
  --jq '.check_runs[] | "\(.name): \(.status | ascii_upcase)\(if .conclusion then " → \(.conclusion | ascii_upcase)" else "" end)\(if .details_url then "\n  \(.details_url)" else "" end)"'
