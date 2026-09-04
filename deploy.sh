#!/usr/bin/env bash
# Developer/repo entry point. On the VPS, copy deploy/production/deploy.sh
# to /var/www/flowlary/deploy.sh (see docs/operations/FLOWLARY_DEPLOY.md).
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
exec "$root/deploy/production/deploy.sh" "$@"
