#!/bin/bash
set -euo pipefail
OUT="/workspace/.agent-command-output.txt"
{
  echo "========== 1. git -C /workspace status =========="
  git -C /workspace status 2>&1 || true
  echo ""
  echo "========== 2. git -C /workspace log --oneline -5 =========="
  git -C /workspace log --oneline -5 2>&1 || true
  echo ""
  echo "========== 3. ls -la /workspace/flowlary =========="
  ls -la /workspace/flowlary 2>&1 || true
  echo ""
  echo "========== 4. npm test =========="
  cd /workspace/Moomen/Projects/flowlary && npm test 2>&1 || true
  echo ""
  echo "========== 5. npm run build =========="
  cd /workspace/Moomen/Projects/flowlary && npm run build 2>&1 || true
  echo ""
  echo "========== 6. rg stale paths =========="
  rg "/workspace/flowlary" /workspace --glob '!node_modules' --glob '!.git' 2>&1 || true
  echo ""
  echo "========== 7. commit and push if needed =========="
  cd /workspace
  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "Move Flowlary to Moomen/Projects/flowlary" 2>&1 || true
    git push -u origin main 2>&1 || true
    echo "COMMIT_PUSH_ATTEMPTED: yes"
  else
    echo "COMMIT_PUSH_ATTEMPTED: no (clean working tree)"
  fi
  echo ""
  echo "========== DONE =========="
} > "$OUT" 2>&1
