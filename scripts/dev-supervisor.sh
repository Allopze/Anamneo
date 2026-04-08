#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""
is_stopping=0

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

start_process() {
  local pid_var_name="$1"
  local label="$2"
  shift 2

  echo "[dev] Starting ${label}..." >&2

  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" </dev/null >&2 &
  else
    "$@" </dev/null >&2 &
  fi

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

shutdown() {
  local reason="${1:-EXIT}"

  if [[ "$is_stopping" -eq 1 ]]; then
    return
  fi
  is_stopping=1

  echo "[dev] Stopping services (${reason})..." >&2

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

start_process backend_pid backend npm run dev:backend
start_process frontend_pid frontend npm run dev:frontend

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