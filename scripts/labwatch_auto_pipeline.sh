#!/usr/bin/env bash
# ============================================================
# 🧠 LABWATCH ONE-CLICK BUILD + DEPLOY PIPELINE
# Mirrors the documented npm troubleshooting flow (A–F) before
# building and deploying the application to Firebase Hosting.
# ============================================================

set -euo pipefail

STEP=1
TOTAL=10
LOG_DIR="logs"
INSTALL_LOG="$LOG_DIR/install.log"
DIAG_LOG="$LOG_DIR/environment.log"
mkdir -p "$LOG_DIR"

log_step() {
  local message=$1
  printf "\n[%d/%d] %s\n" "$STEP" "$TOTAL" "$message"
  STEP=$((STEP + 1))
}

log_step "Detecting environment"
env_context="Local Machine"
if pwd | grep -qi "firebase"; then
  env_context="Firebase Studio"
elif [[ -n "${CODESPACES-}" ]]; then
  env_context="GitHub Codespaces"
fi
printf "Environment: %s\n" "$env_context"

log_step "Checking Node and npm"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi
node_major=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if (( node_major < 18 )); then
  echo "Node.js 18 or newer is required." >&2
  exit 1
fi
printf "Node version: %s\n" "$(node -v)"
printf "npm version: %s\n" "$(npm -v)"

log_step "Confirming npm registry (Step A)"
current_registry=$(npm config get registry 2>/dev/null || echo "")
printf "Current registry: %s\n" "$current_registry"
if [[ "$current_registry" != "https://registry.npmjs.org/" ]]; then
  echo "Resetting registry to https://registry.npmjs.org/"
  npm config delete registry >/dev/null 2>&1 || true
  npm config set registry https://registry.npmjs.org/
fi
if ! npm ping >/dev/null 2>&1; then
  echo "npm ping failed against the canonical registry; continuing with diagnostics."
fi

log_step "Capturing environment diagnostics (Step B)"
{
  echo "===== ENV (filtered) ====="
  env | grep -E "HTTP|PROXY|NODE|CI" || true
  echo
  echo "===== ~/.npmrc ====="
  cat ~/.npmrc 2>/dev/null || echo "<missing>"
  echo
  echo "===== ./ .npmrc ====="
  cat .npmrc 2>/dev/null || echo "<missing>"
} >"$DIAG_LOG"
printf "Diagnostics written to %s\n" "$DIAG_LOG"

log_step "Installing dependencies (Steps C & D)"
rm -rf node_modules package-lock.json pnpm-lock.yaml yarn.lock
success=false
mirror_used=false
npm config set registry https://registry.npmjs.org/ >/dev/null 2>&1
if npm install --legacy-peer-deps >"$INSTALL_LOG" 2>&1; then
  success=true
else
  echo "Primary npm install failed. See $INSTALL_LOG for details."
  mirrors=(
    "https://registry.npmmirror.com/"
    "https://registry.yarnpkg.com/"
    "https://skimdb.npmjs.com/registry/"
  )
  for mirror in "${mirrors[@]}"; do
    echo "Attempting npm install via mirror: $mirror" | tee -a "$INSTALL_LOG"
    npm config set registry "$mirror" >/dev/null 2>&1
    if npm ping >>"$INSTALL_LOG" 2>&1 && npm install --legacy-peer-deps >>"$INSTALL_LOG" 2>&1; then
      success=true
      mirror_used=true
      break
    fi
  done
  npm config set registry https://registry.npmjs.org/ >/dev/null 2>&1

  if [[ "$success" != true ]]; then
    echo "npm install via mirrors failed. Trying pnpm/yarn fallbacks." | tee -a "$INSTALL_LOG"
    if ! command -v pnpm >/dev/null 2>&1; then
      npm install -g pnpm >>"$INSTALL_LOG" 2>&1 || true
    fi
    if command -v pnpm >/dev/null 2>&1; then
      pnpm config set registry https://registry.npmmirror.com/ >>"$INSTALL_LOG" 2>&1 || true
      if pnpm install --no-frozen-lockfile >>"$INSTALL_LOG" 2>&1; then
        success=true
        mirror_used=true
      fi
    fi
    if [[ "$success" != true ]]; then
      if ! command -v yarn >/dev/null 2>&1; then
        npm install -g yarn >>"$INSTALL_LOG" 2>&1 || true
      fi
      if command -v yarn >/dev/null 2>&1; then
        yarn config set registry https://registry.npmmirror.com/ >>"$INSTALL_LOG" 2>&1 || true
        if yarn install --network-timeout 600000 >>"$INSTALL_LOG" 2>&1; then
          success=true
          mirror_used=true
        fi
      fi
    fi
  fi
fi

if [[ "$mirror_used" == true ]]; then
  echo "Restoring npm registry to https://registry.npmjs.org/"
  npm config set registry https://registry.npmjs.org/ >/dev/null 2>&1
fi

if [[ "$success" != true ]]; then
  echo "All automated installation attempts failed. Review $INSTALL_LOG and consider the manual node_modules archive fallback (Step E)." >&2
  exit 1
fi

echo "Dependency installation complete." | tee -a "$INSTALL_LOG"

log_step "Validating toolchain (Step F)"
if ! npm ping >/dev/null 2>&1; then
  echo "npm ping still failing after install; proxy may require additional configuration." >&2
fi
if ! npm run lint >/dev/null 2>&1; then
  echo "npm run lint did not complete successfully. Review the output above." >&2
fi
if ! npm run build >/dev/null 2>&1; then
  echo "npm run build did not complete successfully. Review the output above." >&2
fi

log_step "Preparing Firebase CLI"
if ! command -v firebase >/dev/null 2>&1; then
  npm install -g firebase-tools >/dev/null 2>&1 || {
    echo "Firebase CLI installation failed." >&2
    exit 1
  }
fi
if ! firebase projects:list >/dev/null 2>&1; then
  echo "Firebase CLI not authenticated. Run 'firebase login' or provide a CI token." >&2
  exit 1
fi

log_step "Ensuring firebase.json"
if [[ ! -f firebase.json ]]; then
  cat > firebase.json <<'JSON'
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
JSON
fi

log_step "Deploying to Firebase Hosting"
if firebase deploy --only hosting >/tmp/firebase-deploy.log 2>&1; then
  cat /tmp/firebase-deploy.log
else
  cat /tmp/firebase-deploy.log
  echo "Firebase deployment failed. Resolve the errors above and retry." >&2
  exit 1
fi

site_url=$(firebase hosting:sites:list --json 2>/dev/null | grep -oE 'https://[a-zA-Z0-9.-]+\.web\.app' | head -n1)
if [[ -n "$site_url" ]]; then
  printf "Deployment URL: %s\n" "$site_url"
  if curl -Is "$site_url" | grep -q "200"; then
    echo "Site responded with HTTP 200"
  else
    echo "Site reachable but not returning HTTP 200 (may require propagation)."
  fi
else
  echo "Unable to detect deployed site URL."
fi

log_step "Pipeline complete"
printf "Logs:\n  install -> %s\n  diagnostics -> %s\n" "$INSTALL_LOG" "$DIAG_LOG"
