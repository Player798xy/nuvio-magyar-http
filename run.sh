#!/usr/bin/env bash
# Magyar TV platform – indító script
# ACCESS_KEY: env > .access-key > automatikusan generált (és elmentett)
set -uo pipefail
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-7000}"
LOG_FILE="${LOG_FILE:-/tmp/nuvio-magyar-tv.log}"
PID_FILE=".run.pid"
KEY_FILE=".access-key"
export PORT

if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 18 ]; then
  echo "Node.js >= 18 szükséges (van: $(node -v 2>/dev/null || echo 'nincs'))"
  exit 1
fi

# --- ACCESS_KEY kezelés -------------------------------------------------------
if [ "${NO_ACCESS_KEY:-0}" = "1" ]; then
  ACCESS_KEY=""
elif [ -n "${ACCESS_KEY:-}" ]; then
  :
elif [ -s "$KEY_FILE" ]; then
  ACCESS_KEY="$(cat "$KEY_FILE")"
else
  if command -v openssl >/dev/null 2>&1; then
    ACCESS_KEY="$(openssl rand -hex 16)"
  else
    ACCESS_KEY="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  printf '%s\n' "$ACCESS_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE" 2>/dev/null
  echo "🔑 Új ACCESS_KEY generálva: $KEY_FILE"
fi
export ACCESS_KEY
PREFIX=""
[ -n "$ACCESS_KEY" ] && PREFIX="/p/$ACCESS_KEY"

install_if_needed() {
  if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    echo "→ npm install…"
    npm install --no-audit --no-fund || { echo "npm install hiba"; exit 1; }
  fi
}

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

lan_ip() { hostname -I 2>/dev/null | awk '{print $1}'; }

urls() {
  local ip; ip="$(lan_ip)"
  local base="http://localhost:$PORT"
  echo "  Főoldal:  $base$PREFIX/"
  echo "  Néző:     $base$PREFIX/tv"
  echo "  Profil:   $base$PREFIX/profile"
  echo "  Forgalom: $base$PREFIX/traffic"
  echo "  M3U:      $base$PREFIX/tv.m3u"
  echo "  EPG:      $base$PREFIX/xmltv.php"
  if [ -n "$ip" ]; then
    echo "  LAN/TV:   http://$ip:$PORT$PREFIX"
  fi
  if [ -n "$ACCESS_KEY" ]; then
    echo "  Xtream:   host=$base$PREFIX  user/pass=bármi"
  else
    echo "  ⚠ ACCESS_KEY kikapcsolva — mindenki elérheti a listát!"
  fi
}

port_used() {
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$PORT$"
}

cmd="${1:-start}"

case "$cmd" in
  start)
    install_if_needed
    port_used && { echo "A $PORT port foglalt. Használd: PORT=8000 $0"; exit 1; }
    echo "▶ Indítás a $PORT porton (Ctrl+C = stop)…"
    urls
    exec node --max-old-space-size=220 --max-semi-space-size=8 server.js
    ;;
  bg|background|-d)
    if is_running; then
      echo "Már fut (PID $(cat "$PID_FILE"))."
      urls
      exit 0
    fi
    install_if_needed
    port_used && { echo "A $PORT port foglalt. Használd: PORT=8000 $0 bg"; exit 1; }
    nohup node --max-old-space-size=220 --max-semi-space-size=8 server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if is_running; then
      echo "✓ Fut háttérben (PID $(cat "$PID_FILE")), log: $LOG_FILE"
      urls
    else
      echo "✗ Nem indult el. Log:"; tail -20 "$LOG_FILE"; rm -f "$PID_FILE"; exit 1
    fi
    ;;
  stop)
    if is_running; then
      pid="$(cat "$PID_FILE")"; kill "$pid" 2>/dev/null
      for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
      kill -9 "$pid" 2>/dev/null; rm -f "$PID_FILE"
      echo "■ Leállítva (PID $pid)."
    else
      echo "Nem fut."; rm -f "$PID_FILE"
    fi
    ;;
  restart) "$0" stop; "$0" bg ;;
  status)
    if is_running; then echo "✓ Fut (PID $(cat "$PID_FILE"))"; urls; else echo "✗ Nem fut."; fi
    ;;
  logs) tail -n 50 -f "$LOG_FILE" ;;
  key)
    if [ -n "$ACCESS_KEY" ]; then
      echo "$ACCESS_KEY"
      urls
    else
      echo "ACCESS_KEY nincs beállítva."
    fi
    ;;
  *)
    echo "Használat: $0 {start|bg|stop|restart|status|logs|key}"
    echo "  NO_ACCESS_KEY=1 $0 bg   → ACCESS_KEY nélkül (nyilvános)"
    exit 1
    ;;
esac
