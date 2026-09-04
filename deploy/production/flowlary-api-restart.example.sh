#!/bin/bash
# Install as root-owned /usr/local/sbin/flowlary-api-restart (mode 755).
# Allow flowlary-deploy NOPASSWD for THIS FILE ONLY — never for supervisorctl generally.
# Does not modify ZAIXOS programs. Does not restart nginx.
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo "must run as root via sudo" >&2
  exit 1
fi
exec /usr/bin/supervisorctl restart flowlary-api
