#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""
watchdog_pid=""
is_stopping=0
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
session_leader_pid="$(ps -o sid= -p $$ | tr -d ' ')"

sanitize_local_env() {
  # Ignore incompatible global overrides and let each app load its local .env files.
  if [[ -n "${DATABASE_URL:-}" ]] && [[ "${DATABASE_URL}" != file:* ]]; then
    unset DATABASE_URL
  fi

  case "${JWT_SECRET:-}" in
    "replace-with-a-secure-random-secret"|"change_this_in_production")
      unset JWT_SECRET
      ;;
  esac

  case "${JWT_REFRESH_SECRET:-}" in
    "replace-with-a-different-secure-random-secret"|"change_this_refresh_secret_too")
      unset JWT_REFRESH_SECRET
      ;;
  esac
}

find_pids_on_port() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp "( sport = :$port )" 2>/dev/null | awk -F',' '/pid=/ {for(i=1;i<=NF;i++){ if($i ~ /pid=/){gsub(/[^0-9]/,"",$i); print $i}}}' | tr '\n' ' ' || true)"
  elif command -v netstat >/dev/null 2>&1; then
    pids="$(netstat -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port {match($7,/([0-9]+)/,a); if(a[1]) print a[1]}' | tr '\n' ' ' || true)"
  fi

  echo "$pids"
}

read_env_value() {
  local key="$1"
  local env_file="${repo_root}/.env"
  local value

  value="${!key:-}"
  if [[ -n "$value" ]]; then
    echo "$value"
    return
  fi

  if [[ ! -f "$env_file" ]]; then
    return
  fi

  awk -F= -v key="$key" '
    $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^["'\'']|["'\'']$/, "", value)
      print value
      exit
    }
  ' "$env_file"
}

kill_existing_port() {
  local port="$1"
  local pids

  if [[ -z "$port" ]]; then
    return
  fi

  pids="$(find_pids_on_port "$port")"
  if [[ -n "$pids" ]]; then
    echo "[dev] Killing processes listening on port ${port}: ${pids}" >&2
    kill -TERM $pids 2>/dev/null || true
    sleep 0.5
  fi
}

find_previous_dev_pids() {
  ps -eo pid=,command= | awk -v root="$repo_root" -v self="$$" '
    $1 == self { next }
    index($0, root "/backend/dist/backend/src/main.js") { print $1; next }
    index($0, root "/backend/scripts/dev-watch.js") { print $1; next }
    index($0, root "/backend/node_modules/.bin/nest build --watch") { print $1; next }
    index($0, root "/frontend/scripts/dev-watch.js") { print $1; next }
    index($0, root "/frontend/node_modules/next/dist/bin/next dev") { print $1; next }
    index($0, root) && index($0, "npm --prefix backend run start:dev:migrate") { print $1; next }
    index($0, root) && index($0, "npm --prefix frontend run dev") { print $1; next }
  ' | sort -u | tr '\n' ' '
}

kill_processes() {
  local reason="$1"
  shift
  local pids="$*"

  if [[ -z "$pids" ]]; then
    return
  fi

  echo "[dev] Killing ${reason}: ${pids}" >&2
  kill -TERM $pids 2>/dev/null || true
  sleep 0.5

  local survivors=""
  local pid
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      survivors="${survivors} ${pid}"
    fi
  done

  if [[ -n "$survivors" ]]; then
    echo "[dev] Force killing ${reason}:${survivors}" >&2
    kill -KILL $survivors 2>/dev/null || true
  fi
}

cleanup_port_conflicts() {
  local backend_port frontend_port

  backend_port="$(read_env_value BACKEND_PORT)"
  if [[ -z "$backend_port" ]]; then
    backend_port="$(read_env_value PORT)"
  fi
  frontend_port="$(read_env_value FRONTEND_PORT)"

  printf '%s\n' 5555 5678 "${backend_port:-5678}" "${frontend_port:-5555}" \
    | sort -u \
    | while read -r port; do
      kill_existing_port "$port"
    done
}

cleanup_previous_dev_processes() {
  local pids

  pids="$(find_previous_dev_pids)"
  kill_processes "previous dev processes" $pids
}

start_process() {
  local pid_var_name="$1"
  local label="$2"
  shift 2

  echo "[dev] Starting ${label}..." >&2

  "$@" </dev/null >&2 &

  local pid=$!
  echo "[dev] ${label} pid=${pid}" >&2
  printf -v "$pid_var_name" '%s' "$pid"
}

stop_process() {
  local pid="$1"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  # If the process started in its own process group, kill the whole group.
  kill -TERM "-${pid}" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

stop_watchdog() {
  if [[ -z "$watchdog_pid" ]] || ! kill -0 "$watchdog_pid" 2>/dev/null; then
    return
  fi

  kill -TERM "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true
}

start_session_watchdog() {
  if [[ -z "$session_leader_pid" ]] || [[ "$session_leader_pid" -le 1 ]]; then
    return
  fi

  (
    while kill -0 "$session_leader_pid" 2>/dev/null; do
      sleep 1
    done

    echo "[dev] Terminal session ${session_leader_pid} ended. Stopping services..." >&2
    kill -TERM "$$" 2>/dev/null || true
  ) &

  watchdog_pid=$!
}

shutdown() {
  local reason="${1:-EXIT}"

  if [[ "$is_stopping" -eq 1 ]]; then
    return
  fi
  is_stopping=1

  echo "[dev] Stopping services (${reason})..." >&2

  stop_watchdog
  stop_process "$backend_pid"
  stop_process "$frontend_pid"

  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}

trap 'shutdown SIGINT; exit 130' INT
trap 'shutdown SIGTERM; exit 143' TERM
trap 'shutdown SIGHUP; exit 129' HUP
trap 'shutdown EXIT' EXIT

sanitize_local_env

cleanup_previous_dev_processes
cleanup_port_conflicts

start_process backend_pid backend npm run dev:backend
start_process frontend_pid frontend npm run dev:frontend
start_session_watchdog

# macOS bash does not support `wait -n`; poll the child PIDs instead.
child_status=0
while true; do
  if [[ -n "$backend_pid" ]] && ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid" 2>/dev/null || true
    child_status=$?
    break
  fi

  if [[ -n "$frontend_pid" ]] && ! kill -0 "$frontend_pid" 2>/dev/null; then
    wait "$frontend_pid" 2>/dev/null || true
    child_status=$?
    break
  fi

  sleep 0.1
done

shutdown CHILD_EXIT
exit "$child_status"
