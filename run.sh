#!/usr/bin/env bash
#
# Lanzador del proyecto. Uso: ./run.sh [comando]
# Sin comando arranca el servidor de desarrollo.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

DEV_PORT=5173
PREVIEW_PORT=4173

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RESET=''
fi

info()  { printf '%s\n' "${DIM}$1${RESET}"; }
ok()    { printf '%s\n' "${GREEN}$1${RESET}"; }
warn()  { printf '%s\n' "${YELLOW}$1${RESET}"; }
title() { printf '\n%s\n' "${BOLD}$1${RESET}"; }

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    warn 'Falta Node.js. Instálalo desde https://nodejs.org y vuelve a intentar.'
    exit 1
  fi
}

# Reinstala solo si hace falta. Se compara contra node_modules/.package-lock.json
# porque npm lo reescribe en cada install; la fecha de node_modules/ no sirve, ya
# que cualquier edición de package.json la deja "más nueva" y provocaría un
# npm install en casi cada arranque.
ensure_deps() {
  local stamp='node_modules/.package-lock.json'
  if [[ ! -d node_modules ]] || [[ ! -f ${stamp} ]] || [[ package-lock.json -nt ${stamp} ]]; then
    title 'Instalando dependencias'
    npm install
  fi
}

local_ip() {
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' && return 0
  fi
  ip -4 -o addr show scope global 2>/dev/null | awk '{gsub(/\/.*/, "", $4); print $4; exit}'
}

print_urls() {
  local base="$1"
  printf '  %-12s %s\n' 'Portafolio' "${base}/"
  printf '  %-12s %s\n' 'Finanzas'   "${base}/finanzas/"
}

cmd_dev() {
  require_node; ensure_deps
  title "Servidor de desarrollo  ${DIM}(Ctrl+C para detener)${RESET}"
  print_urls "http://localhost:${DEV_PORT}"
  echo
  npm run dev
}

cmd_host() {
  require_node; ensure_deps
  local ip; ip="$(local_ip || true)"

  title "Servidor expuesto en la red  ${DIM}(Ctrl+C para detener)${RESET}"
  if [[ -n "${ip}" ]]; then
    print_urls "http://${ip}:${DEV_PORT}"
  else
    info '  No pude detectar la IP local; Vite la imprime abajo.'
  fi

  # Aviso que ahorra un diagnóstico equivocado: una IP LAN por http no es
  # "secure context", así que el micrófono y los service workers quedan
  # bloqueados por el navegador, no por un error del código.
  warn $'\n  Ojo: por http://IP el iPhone bloquea el micrófono (no es contexto seguro).'
  info  '  Para probar el dictado en el celular, usa un deploy de rama en Netlify (HTTPS).'
  echo
  npm run dev -- --host
}

cmd_build() {
  require_node; ensure_deps
  title 'Compilando para producción'
  npm run build
  ok $'\nListo. Salida en dist/'
}

cmd_preview() {
  cmd_build
  title "Sirviendo el build  ${DIM}(Ctrl+C para detener)${RESET}"
  print_urls "http://localhost:${PREVIEW_PORT}"
  echo
  npm run preview
}

cmd_test() {
  require_node; ensure_deps
  title 'Pruebas'
  npm test
}

cmd_lint() {
  require_node; ensure_deps
  title 'Lint'
  npm run lint
}

cmd_icons() {
  require_node
  title 'Regenerando iconos de la app de finanzas'
  node scripts/generate-finance-icons.mjs
}

cmd_check() {
  require_node; ensure_deps
  title 'Lint'
  npm run lint
  title 'Pruebas'
  npm test
  title 'Compilación'
  npm run build
  ok $'\nTodo en verde.'
}

cmd_help() {
  cat <<EOF
${BOLD}Uso:${RESET} ./run.sh [comando]

  ${BOLD}dev${RESET}       Servidor de desarrollo en localhost (por defecto)
  ${BOLD}host${RESET}      Igual, pero accesible desde otros equipos de la red
  ${BOLD}build${RESET}     Compila para producción en dist/
  ${BOLD}preview${RESET}   Compila y sirve el resultado como en producción
  ${BOLD}test${RESET}      Corre la suite de pruebas
  ${BOLD}lint${RESET}      Corre el linter
  ${BOLD}check${RESET}     Lint + pruebas + compilación
  ${BOLD}icons${RESET}     Regenera los iconos PNG de la app de finanzas
  ${BOLD}help${RESET}      Muestra esta ayuda

${BOLD}Rutas:${RESET}
  /            Portafolio público
  /finanzas/   Asistente de finanzas (privado, no indexado)
EOF
}

case "${1:-dev}" in
  dev)             cmd_dev ;;
  host)            cmd_host ;;
  build)           cmd_build ;;
  preview)         cmd_preview ;;
  test)            cmd_test ;;
  lint)            cmd_lint ;;
  check)           cmd_check ;;
  icons)           cmd_icons ;;
  help|-h|--help)  cmd_help ;;
  *)
    warn "Comando desconocido: $1"
    echo
    cmd_help
    exit 1
    ;;
esac
