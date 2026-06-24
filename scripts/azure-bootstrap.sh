#!/usr/bin/env bash
# Bootstrap typeform-alt on Azure: Bicep, secrets, image, migrate, GitHub Actions secrets.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -x "$ROOT_DIR/.azure/venv/bin/az" ]]; then
  export PATH="$ROOT_DIR/.azure/venv/bin:$PATH"
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-typeform-alt}"
LOCATION="${LOCATION:-eastus}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-main}"
IMAGE_NAME="${IMAGE_NAME:-typeform-alt}"
CONTAINER_APP="${CONTAINER_APP:-typeform-alt}"
MIGRATE_JOB="${MIGRATE_JOB:-typeform-alt-migrate}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
STATE_FILE="${STATE_FILE:-$ROOT_DIR/.azure/bootstrap.env}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

save_state() {
  mkdir -p "$(dirname "$STATE_FILE")"
  umask 077
  cat >"$STATE_FILE" <<EOF
RESOURCE_GROUP=$RESOURCE_GROUP
LOCATION=$LOCATION
APP_FQDN=$APP_FQDN
APP_URL=$APP_URL
ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER
KEY_VAULT_NAME=$KEY_VAULT_NAME
POSTGRES_HOST=$POSTGRES_HOST
EOF
}

read_state() {
  if [[ -f "$STATE_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  fi
}

ensure_postgres_password() {
  if [[ -z "${POSTGRES_ADMIN_PASSWORD:-}" ]]; then
    if [[ -f "$STATE_FILE" ]] && [[ -n "${POSTGRES_ADMIN_PASSWORD:-}" ]]; then
      return
    fi
    POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
    echo "Generated POSTGRES_ADMIN_PASSWORD (saved in $STATE_FILE)."
  fi
}

step_login() {
  echo "==> Checking Azure login"
  az account show >/dev/null
  echo "    Subscription: $(az account show --query name -o tsv)"
}

step_deploy_bicep() {
  echo "==> Deploying Azure infrastructure (Bicep)"
  load_env_file
  ensure_postgres_password

  : "${AUTH_SECRET:?Set AUTH_SECRET in $ENV_FILE}"
  : "${AUTH_MICROSOFT_ENTRA_ID_ID:?Set AUTH_MICROSOFT_ENTRA_ID_ID in $ENV_FILE}"
  : "${AUTH_MICROSOFT_ENTRA_ID_SECRET:?Set AUTH_MICROSOFT_ENTRA_ID_SECRET in $ENV_FILE}"
  : "${AUTH_MICROSOFT_ENTRA_ID_ISSUER:?Set AUTH_MICROSOFT_ENTRA_ID_ISSUER in $ENV_FILE}"

  if ! az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" >/dev/null
  fi

  az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file infra/main.bicep \
    --parameters @infra/main.bicepparam \
    --parameters \
      postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
      authSecret="$AUTH_SECRET" \
      authMicrosoftEntraIdId="$AUTH_MICROSOFT_ENTRA_ID_ID" \
      authMicrosoftEntraIdSecret="$AUTH_MICROSOFT_ENTRA_ID_SECRET" \
      authMicrosoftEntraIdIssuer="$AUTH_MICROSOFT_ENTRA_ID_ISSUER" \
      deployerPrincipalId="$(az ad signed-in-user show --query id -o tsv)" \
    --output none

  echo "    Waiting for Key Vault RBAC propagation..."
  sleep 25

  APP_FQDN="$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.containerAppFqdn.value -o tsv)"
  ACR_LOGIN_SERVER="$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.containerRegistryLoginServer.value -o tsv)"
  KEY_VAULT_NAME="$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.keyVaultName.value -o tsv)"
  POSTGRES_HOST="$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query properties.outputs.postgresHostname.value -o tsv)"
  APP_URL="https://${APP_FQDN}"

  mkdir -p "$(dirname "$STATE_FILE")"
  umask 077
  cat >"$STATE_FILE" <<EOF
POSTGRES_ADMIN_PASSWORD=$POSTGRES_ADMIN_PASSWORD
RESOURCE_GROUP=$RESOURCE_GROUP
LOCATION=$LOCATION
APP_FQDN=$APP_FQDN
APP_URL=$APP_URL
ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER
KEY_VAULT_NAME=$KEY_VAULT_NAME
POSTGRES_HOST=$POSTGRES_HOST
EOF

  echo "    App URL: $APP_URL"
  echo "    Key Vault: $KEY_VAULT_NAME"
}

step_entra_redirect() {
  echo "==> Adding Entra redirect URI for production"
  load_env_file
  read_state

  : "${AUTH_MICROSOFT_ENTRA_ID_ID:?Missing Entra client ID}"
  : "${APP_URL:?Deploy infrastructure first}"

  local callback="${APP_URL}/api/auth/callback/microsoft-entra-id"
  local localhost_callback="http://localhost:3000/api/auth/callback/microsoft-entra-id"

  mapfile -t existing < <(az ad app show --id "$AUTH_MICROSOFT_ENTRA_ID_ID" \
    --query "web.redirectUris[]" -o tsv 2>/dev/null || true)

  local uris=()
  local seen=""
  for uri in "${existing[@]}" "$callback" "$localhost_callback"; do
    [[ -z "$uri" ]] && continue
    if [[ "$seen" != *"|$uri|"* ]]; then
      uris+=("$uri")
      seen+="|$uri|"
    fi
  done

  az ad app update --id "$AUTH_MICROSOFT_ENTRA_ID_ID" --web-redirect-uris "${uris[@]}" >/dev/null
  echo "    Registered: $callback"
}

step_build_and_push() {
  echo "==> Building and pushing Docker image"
  read_state
  : "${ACR_LOGIN_SERVER:?Deploy infrastructure first}"

  local acr_name="${ACR_LOGIN_SERVER%%.azurecr.io}"
  local image_tag="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

  az acr login --name "$acr_name" >/dev/null
  docker build -t "$image_tag" .
  docker push "$image_tag"
  echo "    Pushed: $image_tag"
}

step_migrate_and_deploy() {
  echo "==> Running migrations and deploying Container App"
  read_state
  : "${ACR_LOGIN_SERVER:?Deploy infrastructure first}"

  local image_tag="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

  az containerapp job update \
    --name "$MIGRATE_JOB" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$image_tag" \
    --output none

  local execution_name
  execution_name="$(az containerapp job start \
    --name "$MIGRATE_JOB" \
    --resource-group "$RESOURCE_GROUP" \
    --query name -o tsv)"

  echo "    Migration job: $execution_name"
  for _ in $(seq 1 36); do
    local status
    status="$(az containerapp job execution show \
      --name "$MIGRATE_JOB" \
      --resource-group "$RESOURCE_GROUP" \
      --job-execution-name "$execution_name" \
      --query properties.status -o tsv)"
    echo "    Status: $status"
    if [[ "$status" == "Succeeded" ]]; then
      break
    fi
    if [[ "$status" == "Failed" ]]; then
      echo "Migration job failed." >&2
      exit 1
    fi
    sleep 10
  done

  az containerapp update \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$image_tag" \
    --output none

  # Restart so Key Vault RBAC + secret references are picked up reliably.
  az containerapp revision restart \
    --name "$CONTAINER_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --revision "$(az containerapp revision list \
      --name "$CONTAINER_APP" \
      --resource-group "$RESOURCE_GROUP" \
      --query "[0].name" -o tsv)" \
    --output none 2>/dev/null || true

  echo "    Deployed: $APP_URL"
}

step_github_secrets() {
  echo "==> Configuring GitHub Actions secrets"
  read_state
  require_cmd gh
  : "${ACR_LOGIN_SERVER:?Deploy infrastructure first}"

  local acr_name="${ACR_LOGIN_SERVER%%.azurecr.io}"
  local acr_user acr_pass subscription_id
  acr_user="$(az acr credential show --name "$acr_name" --query username -o tsv)"
  acr_pass="$(az acr credential show --name "$acr_name" --query "passwords[0].value" -o tsv)"
  subscription_id="$(az account show --query id -o tsv)"

  if ! az ad sp list --display-name "typeform-alt-deploy" --query "[0].appId" -o tsv | grep -q .; then
    az ad sp create-for-rbac \
      --name typeform-alt-deploy \
      --role contributor \
      --scopes "/subscriptions/${subscription_id}/resourceGroups/${RESOURCE_GROUP}" \
      --sdk-auth >"$ROOT_DIR/.azure/azure-credentials.json"
    echo "    Created service principal typeform-alt-deploy"
  else
    echo "    Reusing service principal typeform-alt-deploy"
    if [[ ! -f "$ROOT_DIR/.azure/azure-credentials.json" ]]; then
      echo "    Missing .azure/azure-credentials.json"
      echo "    Recreate with: az ad sp create-for-rbac --name typeform-alt-deploy --role contributor --scopes /subscriptions/${subscription_id}/resourceGroups/${RESOURCE_GROUP} --sdk-auth > .azure/azure-credentials.json" >&2
      exit 1
    fi
  fi

  gh secret set AZURE_CREDENTIALS <"$ROOT_DIR/.azure/azure-credentials.json"
  gh secret set ACR_LOGIN_SERVER --body "$ACR_LOGIN_SERVER"
  gh secret set ACR_USERNAME --body "$acr_user"
  gh secret set ACR_PASSWORD --body "$acr_pass"

  echo "    GitHub secrets set for $(gh repo view --json nameWithOwner -q .nameWithOwner)"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [all|bicep|entra|image|deploy|github]

  all     Run every step (default)
  bicep   Deploy infrastructure + Key Vault secrets via Bicep
  entra   Add production OAuth redirect URI
  image   Build and push Docker image to ACR
  deploy  Run migrate job and update Container App
  github  Configure GitHub Actions secrets

Environment:
  RESOURCE_GROUP (default: rg-typeform-alt)
  LOCATION       (default: eastus)
  ENV_FILE       (default: .env)
EOF
}

main() {
  require_cmd az
  require_cmd docker
  require_cmd openssl

  local step="${1:-all}"
  case "$step" in
    all)
      step_login
      step_deploy_bicep
      step_entra_redirect
      step_build_and_push
      step_migrate_and_deploy
      step_github_secrets
      save_state
      echo ""
      echo "Done."
      echo "  App:   $APP_URL"
      echo "  Admin: $APP_URL/admin/forms"
      echo "  Quiz:  $APP_URL/q/claude-comfort"
      ;;
    bicep) step_login; step_deploy_bicep; save_state ;;
    entra) step_login; step_entra_redirect ;;
    image) step_login; step_build_and_push ;;
    deploy) step_login; step_migrate_and_deploy ;;
    github) step_login; step_github_secrets ;;
    -h|--help) usage ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
