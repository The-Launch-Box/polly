#!/usr/bin/env bash
# One-time install: systemd user service + cron watchdog for typeform-alt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="$(id -un)"
NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"
DAEMON_SH="$ROOT/scripts/local-daemon.sh"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/typeform-alt.service"
CRON_MARKER="# typeform-alt local daemon"

chmod +x "$ROOT/scripts/local-daemon.sh"
chmod +x "$ROOT/scripts/install-local-daemon.sh"

mkdir -p "$SERVICE_DIR"

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Typeform-alt survey app (local production)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=PATH=$(dirname "$NPM_BIN"):$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-$ROOT/.env
ExecStart=$DAEMON_SH start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

loginctl enable-linger "$USER_NAME" 2>/dev/null || true

systemctl --user daemon-reload
systemctl --user enable typeform-alt.service
systemctl --user restart typeform-alt.service

CRON_TMP="$(mktemp)"
(crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | grep -v "scripts/local-daemon.sh" || true) >"$CRON_TMP"
{
  cat "$CRON_TMP"
  echo "$CRON_MARKER"
  echo "@reboot sleep 45 && $DAEMON_SH ensure-postgres >> $ROOT/.local-daemon.log 2>&1"
  echo "*/5 * * * * $DAEMON_SH health >> $ROOT/.local-daemon.log 2>&1"
} | crontab -

rm -f "$CRON_TMP"

echo ""
echo "Installed typeform-alt local daemon."
echo "  App:     http://localhost:3000"
echo "  Service: systemctl --user status typeform-alt"
echo "  Logs:    journalctl --user -u typeform-alt -f"
echo "  Cron:    crontab -l"
echo ""
systemctl --user status typeform-alt.service --no-pager || true
