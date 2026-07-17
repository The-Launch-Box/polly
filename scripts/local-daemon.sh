#!/usr/bin/env bash
# Local daemon helpers for typeform-alt (systemd + cron).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_BIN="${NODE_BIN:-$(command -v node)}"
NPM_BIN="${NPM_BIN:-$(command -v npm)}"
COMPOSE_CMD=(docker compose)

log() { printf '[typeform-alt] %s\n' "$*"; }

docker_compose() {
  if docker info >/dev/null 2>&1; then
    "${COMPOSE_CMD[@]}" "$@"
  elif command -v sg >/dev/null 2>&1; then
    sg docker -c "cd $(printf '%q' "$ROOT") && docker compose $(printf '%q ' "$@")"
  else
    log "ERROR: cannot access Docker (add user to docker group or fix socket permissions)"
    exit 1
  fi
}

cmd_ensure_postgres() {
  log "Ensuring Postgres is up..."
  docker_compose up -d postgres
  docker_compose ps postgres
}

cmd_build() {
  log "Building production app..."
  "$NPM_BIN" run build
  "$ROOT/node_modules/.bin/prisma" migrate deploy
}

cmd_start() {
  cmd_ensure_postgres
  export NODE_ENV=production
  export PORT="${PORT:-3000}"
  export HOSTNAME="${HOSTNAME:-0.0.0.0}"
  log "Starting on http://${HOSTNAME}:${PORT} ..."

  if [[ -f "$ROOT/.next/standalone/server.js" ]]; then
    mkdir -p "$ROOT/.next/standalone/.next"
    rsync -a --delete "$ROOT/.next/static/" "$ROOT/.next/standalone/.next/static/" 2>/dev/null || \
      cp -r "$ROOT/.next/static" "$ROOT/.next/standalone/.next/static"
    rsync -a --delete "$ROOT/public/" "$ROOT/.next/standalone/public/" 2>/dev/null || \
      cp -r "$ROOT/public" "$ROOT/.next/standalone/public"
    cd "$ROOT/.next/standalone"
    exec "$NODE_BIN" server.js
  fi

  exec "$NPM_BIN" run start
}

cmd_health() {
  if curl -sf --max-time 10 "http://127.0.0.1:${PORT:-3000}/" >/dev/null; then
    exit 0
  fi
  log "Health check failed — restarting systemd service..."
  systemctl --user restart typeform-alt.service
}

cmd_status() {
  systemctl --user status typeform-alt.service --no-pager || true
  echo ""
  docker_compose ps || true
  curl -sf --max-time 5 "http://127.0.0.1:${PORT:-3000}/" >/dev/null && \
    log "HTTP OK on port ${PORT:-3000}" || \
    log "HTTP not responding on port ${PORT:-3000}"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  ensure-postgres   Start Postgres via Docker Compose (cron @reboot)
  build             npm run build + prisma migrate deploy
  start             Foreground production server (used by systemd)
  health            Curl homepage; restart service if down (cron)
  status            Show systemd + docker + HTTP status
EOF
}

case "${1:-}" in
  ensure-postgres) cmd_ensure_postgres ;;
  build)           cmd_build ;;
  start)           cmd_start ;;
  health)          cmd_health ;;
  status)          cmd_status ;;
  *)               usage; exit 1 ;;
esac
