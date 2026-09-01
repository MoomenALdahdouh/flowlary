#!/usr/bin/env bash
# Create the isolated flowlary-deploy user and /var/www/flowlary.
# Run ON THE VPS as root (interactive sudo). Does not deploy the app,
# does not modify nginx/DNS/firewall/ZAIXOS, does not grant sudo.
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL51BDpA+LxlLVBxjLF2C7cE3/abRNBL1oHFk+WamPVa zaixos-production'
USER_NAME='flowlary-deploy'
HOME_DIR='/home/flowlary-deploy'
APP_DIR='/var/www/flowlary'

if getent passwd "${USER_NAME}" >/dev/null; then
  echo "Refusing: ${USER_NAME} already exists." >&2
  getent passwd "${USER_NAME}"
  exit 1
fi

if [[ -e ${APP_DIR} ]]; then
  echo "Refusing: ${APP_DIR} already exists." >&2
  ls -ld "${APP_DIR}"
  exit 1
fi

# No extra groups (not sudo, docker, postgres, redis, www-data, users).
adduser --disabled-password --gecos 'Flowlary Deploy' \
  --home "${HOME_DIR}" --shell /bin/bash "${USER_NAME}"

passwd -l "${USER_NAME}"
usermod -p '!' "${USER_NAME}"

install -d -m 700 -o "${USER_NAME}" -g "${USER_NAME}" "${HOME_DIR}/.ssh"
printf '%s\n' "${PUBKEY}" > "${HOME_DIR}/.ssh/authorized_keys"
chmod 600 "${HOME_DIR}/.ssh/authorized_keys"
chown "${USER_NAME}:${USER_NAME}" "${HOME_DIR}/.ssh/authorized_keys"
chmod 750 "${HOME_DIR}"

install -d -m 750 -o "${USER_NAME}" -g "${USER_NAME}" "${APP_DIR}"

# Explicitly not in privileged groups (no-op if already absent).
for grp in sudo docker postgres redis www-data adm lxd; do
  if getent group "${grp}" >/dev/null; then
    gpasswd -d "${USER_NAME}" "${grp}" 2>/dev/null || true
  fi
done

echo
echo '=== passwd ==='
getent passwd "${USER_NAME}"
echo '=== id ==='
id "${USER_NAME}"
echo '=== groups ==='
groups "${USER_NAME}"
echo '=== shadow lock ==='
passwd -S "${USER_NAME}"
echo '=== home / app dir ==='
ls -ld "${HOME_DIR}" "${HOME_DIR}/.ssh" "${APP_DIR}"
echo '=== authorized_keys mode ==='
ls -l "${HOME_DIR}/.ssh/authorized_keys"
echo '=== sudoers (must be empty for this user) ==='
if [[ -e /etc/sudoers.d/${USER_NAME} ]]; then
  echo "UNEXPECTED sudoers file exists" >&2
  exit 1
fi
echo 'none'
echo 'OK'
