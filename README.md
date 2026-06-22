# Typeform Alternative — Internal Survey Tool

An internal survey platform built with **Next.js 16 (App Router)**, **Prisma**, and **PostgreSQL**. Ships with a seeded demo quiz: *"How comfortable with Claude are you?"*

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Local Development (Docker Compose)](#local-development-docker-compose)
3. [Demo Quiz — Claude Comfort Survey](#demo-quiz--claude-comfort-survey)
4. [Azure Architecture](#azure-architecture)
5. [Azure Deployment Guide](#azure-deployment-guide)
6. [Environment Variables Reference](#environment-variables-reference)
7. [CI/CD](#cicd)
8. [Decisions & Open Questions](#decisions--open-questions)

---

## Project Overview

| Layer | Original design | Azure mapping |
|---|---|---|
| Compute | Next.js monolith, `next start` | Azure Container Apps (single revision) |
| Database | PostgreSQL 16 via Docker Compose | Azure Database for PostgreSQL Flexible Server |
| Secrets | `.env` file | Azure Key Vault (referenced via Container Apps secrets) |
| Identity | None (internal use) | Microsoft Entra ID (OIDC / Easy Auth) |
| Networking | localhost | VNet integration + private endpoints |
| Storage | None | Azure Blob Storage (future: CSV exports) |
| CI/CD | Manual | GitHub Actions → Azure Container Registry → Container Apps |

---

## Local Development (Docker Compose)

Docker Compose spins up a local PostgreSQL instance. No Azure account needed.

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose v2
- `npm` (or `pnpm` / `yarn`)

### Quick start

```bash
# 1. Copy env file and leave defaults as-is for local dev
cp .env.example .env

# 2. Start Postgres
docker compose up -d

# 3. Install dependencies
npm install

# 4. Apply migrations and seed the demo quiz
npx prisma migrate dev
npx prisma db seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo quiz is available at **`/q/claude-comfort`** once the seed runs (see below).

### Reset local database

```bash
docker compose down -v   # removes the postgres_data volume
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

---

## Demo Quiz — Claude Comfort Survey

The seed script (`prisma/seed.ts`) upserts a form with slug `claude-comfort`:

| # | Type | Prompt |
|---|---|---|
| 1 | Scale 1–5 | How comfortable are you using Claude? |
| 2 | Single choice | How often do you use Claude? |
| 3 | Single choice | What is your primary use of Claude? |
| 4 | Scale 1–5 | How confident are you explaining Claude's capabilities to a colleague? |
| 5 | Short text (optional) | Anything else you'd like to share? |

**URL:** `http://localhost:3000/q/claude-comfort` (local) or `https://<your-app>.azurecontainerapps.io/q/claude-comfort` (Azure).

**Re-seeding is safe** — the seed uses `upsert` on the slug, so running it multiple times is idempotent and won't duplicate the form.

**Verify persistence:**

```bash
# Query via Prisma CLI (local)
npx prisma studio
# or
psql postgresql://typeform:typeform@localhost:5432/typeform \
  -c "SELECT slug, title, \"createdAt\" FROM \"Form\";"
```

On Azure, run the same psql command against the Flexible Server private endpoint after connecting via VPN or bastion.

---

## Azure Architecture

### Architecture diagram (text)

```
┌─────────────────────────────────────────────────────────────────┐
│  Azure                                  VNet (10.0.0.0/16)      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Subnet: apps (10.0.1.0/24)                                │  │
│  │                                                             │  │
│  │   ┌──────────────────────────────────────────────────┐     │  │
│  │   │  Azure Container Apps Environment                │     │  │
│  │   │                                                   │     │  │
│  │   │   ┌──────────────────────┐                       │     │  │
│  │   │   │  Container App       │                       │     │  │
│  │   │   │  typeform-alt        │                       │     │  │
│  │   │   │  Next.js 16 (Node)   │                       │     │  │
│  │   │   │  min 1, max 3 replicas│                      │     │  │
│  │   │   └──────────────────────┘                       │     │  │
│  │   └──────────────────────────────────────────────────┘     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Subnet: data (10.0.2.0/24)                                │  │
│  │                                                             │  │
│  │   ┌──────────────────────┐   ┌──────────────────────┐     │  │
│  │   │  PostgreSQL           │   │  Key Vault            │     │  │
│  │   │  Flexible Server      │   │  (private endpoint)   │     │  │
│  │   │  (private endpoint)   │   └──────────────────────┘     │  │
│  │   └──────────────────────┘                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Azure Container Registry   Azure Blob Storage (future exports)  │
│  Microsoft Entra ID (Easy Auth on Container Apps)                │
└─────────────────────────────────────────────────────────────────┘
```

### Compute — Azure Container Apps ✅ (recommended)

**Why Container Apps over App Service or AKS:**

- **vs App Service**: Container Apps supports scale-to-zero (zero cost when idle overnight/weekends, important for an internal tool), has built-in revision management for zero-downtime deploys, and is container-native without needing App Service Plans or SKU management.
- **vs AKS**: AKS requires a dedicated cluster (≥ 3 nodes), a platform team to manage upgrades/patches, and significantly higher operational overhead. For a single internal application at a medium company, AKS is severe overkill.
- **Container Apps sweet spot**: managed container runtime, HTTP-triggered autoscaling (min 1 replica to avoid cold starts during business hours, max 3), VNet integration, Dapr-ready if you later decompose services, pay-per-use pricing.

**Configuration:**
- Ingress: external HTTPS, port 3000
- Min replicas: **1** (always warm during business hours; optionally use scaling rules to drop to 0 on weekends)
- Max replicas: **3**
- CPU: 0.5 vCPU, Memory: 1 Gi (adjust based on load)
- Image source: Azure Container Registry

### Database — Azure Database for PostgreSQL Flexible Server

- Drop-in replacement for the local `postgres:16` Docker container; just change `DATABASE_URL`.
- Use **Flexible Server** (not Single Server, which is deprecated).
- SKU: `Standard_B2ms` (burstable) for a medium internal app; upgrade to `Standard_D2ds_v5` if load increases.
- Storage: 32 GB with auto-grow enabled.
- Private endpoint in the `data` subnet — the app connects over the VNet, never over the public internet.
- Backups: 7-day retention (default); increase to 35 days for compliance if needed.
- **Prisma migrations** run as a one-off Container Apps Job on each deployment (see CI/CD section).

### Secrets — Azure Key Vault

Stored secrets:

| Secret name | Value |
|---|---|
| `database-url` | Full PostgreSQL connection string |
| `nextauth-secret` | Random 32-byte hex (for future auth) |

Container Apps pulls secrets from Key Vault at startup using a managed identity — no credentials in environment variables or code.

```
Container App managed identity → Key Vault (GET secret) → injected as env var
```

### Identity — Microsoft Entra ID (Easy Auth)

For an internal tool, use **Container Apps Easy Auth** with the Entra ID provider. This adds authentication at the platform layer with zero code changes:

1. Register an app in Entra ID → copy Client ID and Tenant ID.
2. Enable authentication on the Container App (`--auth-enabled true`).
3. Set the Entra ID provider with your Client ID/Tenant ID.
4. All requests are redirected to the Microsoft login page; only users in your tenant can access the app.

This is the fastest path to SSO for an internal app. If you need role-based access (e.g., only admins can view results), add Entra ID App Roles and check them in the application layer.

### Networking — VNet + Private Endpoints

- **VNet**: `/16` CIDR with two subnets: `apps` (Container Apps environment) and `data` (private endpoints).
- **Private DNS zones**: `privatelink.postgres.database.azure.com` and `privatelink.vaultcore.azure.net` linked to the VNet.
- PostgreSQL and Key Vault are **not accessible from the public internet** — only from within the VNet.
- Container Apps environment uses **VNet injection** (workload profiles environment) so outbound traffic to data subnet is routed internally.

### Storage — Azure Blob Storage (optional, future)

Not required for the current feature set. Add when implementing:
- CSV export of survey responses
- File upload question type
- Static asset offloading

Use a private storage account with a blob container; access via SAS tokens or managed identity.

### Cost estimate (rough, single region)

| Resource | SKU | Est. monthly |
|---|---|---|
| Container Apps | 0.5 vCPU × 1 replica (business hours) | ~$10–25 |
| PostgreSQL Flexible | Standard_B2ms, 32 GB | ~$35–45 |
| Container Registry | Basic | ~$5 |
| Key Vault | Standard (< 10k ops/mo) | ~$1–2 |
| VNet / Private DNS | Minimal traffic | ~$5 |
| **Total** | | **~$55–80/mo** |

Scale-to-zero on weekends can cut Container Apps cost by ~30%.

---

## Azure Deployment Guide

### Prerequisites

- Azure CLI: `az login`
- Docker (for building images)
- GitHub repo with secrets configured (see CI/CD section)

### 1. Deploy infrastructure (Bicep)

```bash
# Create resource group
az group create \
  --name rg-typeform-alt \
  --location eastus

# Deploy all Azure resources
az deployment group create \
  --resource-group rg-typeform-alt \
  --template-file infra/main.bicep \
  --parameters @infra/main.bicepparam
```

This provisions: VNet, Container Registry, PostgreSQL Flexible Server, Key Vault, Container Apps Environment, and the Container App itself.

### 2. Store secrets in Key Vault

```bash
# Get the Key Vault name from the deployment output
KV_NAME=$(az deployment group show \
  --resource-group rg-typeform-alt \
  --name main \
  --query properties.outputs.keyVaultName.value -o tsv)

# Store the database connection string
az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name database-url \
  --value "postgresql://<user>:<pass>@<pg-host>:5432/typeform?schema=public&sslmode=require"
```

### 3. Run Prisma migrations + seed

Migrations run automatically as a Container Apps Job during CI/CD. To run manually:

```bash
# Trigger the migrate job
az containerapp job start \
  --name typeform-alt-migrate \
  --resource-group rg-typeform-alt
```

The seed is idempotent (`upsert`) — include it in the migrate job for first-time setup.

### 4. Configure Entra ID Easy Auth

```bash
# Replace with your Entra app registration values
az containerapp auth microsoft update \
  --name typeform-alt \
  --resource-group rg-typeform-alt \
  --client-id "<entra-app-client-id>" \
  --tenant-id "<your-tenant-id>"

az containerapp auth update \
  --name typeform-alt \
  --resource-group rg-typeform-alt \
  --enabled true \
  --action RedirectToLoginPage
```

### 5. Verify the demo quiz

```bash
# Get the app URL
APP_URL=$(az containerapp show \
  --name typeform-alt \
  --resource-group rg-typeform-alt \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Demo quiz: https://$APP_URL/q/claude-comfort"
```

---

## Environment Variables Reference

Copy `.env.example` to `.env` for local development. On Azure, all secrets come from Key Vault via Container Apps secret references — do not set them as plain environment variables in production.

| Variable | Required | Description | Local default |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Prisma) | `postgresql://typeform:typeform@localhost:5432/typeform?schema=public` |
| `AZURE_KEY_VAULT_URI` | Azure only | Key Vault URI for secret fetching | — |
| `AZURE_CLIENT_ID` | Azure only | Managed identity / service principal | — |
| `NEXTAUTH_SECRET` | Future | NextAuth.js signing secret | — |
| `NEXTAUTH_URL` | Future | Public app URL for OAuth redirects | — |

---

## CI/CD

### GitHub Actions → Azure Container Apps

The workflow in `.github/workflows/azure-deploy.yml`:

1. **On push to `main`**: build Docker image, push to Azure Container Registry.
2. Run the `typeform-alt-migrate` Container Apps Job (Prisma migrations + seed).
3. Deploy the new image revision to the `typeform-alt` Container App.

**Required GitHub secrets:**

| Secret | How to get |
|---|---|
| `AZURE_CREDENTIALS` | `az ad sp create-for-rbac --name typeform-alt-deploy --role contributor --scopes /subscriptions/<id>/resourceGroups/rg-typeform-alt --sdk-auth` |
| `ACR_LOGIN_SERVER` | `<registryname>.azurecr.io` |
| `ACR_USERNAME` | Admin username (or use managed identity) |
| `ACR_PASSWORD` | Admin password |

### Local dev vs Azure deployment summary

| Concern | Local dev | Azure |
|---|---|---|
| Database | `docker compose up -d` | PostgreSQL Flexible Server (private endpoint) |
| Secrets | `.env` file | Key Vault → Container Apps env refs |
| Auth | None (open) | Entra ID Easy Auth |
| Image build | `npm run dev` (hot reload) | `docker build` → ACR → Container Apps |
| Migrations | `npx prisma migrate dev` | Container Apps Job on deploy |
| Seed | `npx prisma db seed` | Included in migrate job (idempotent) |

---

## Decisions & Open Questions

| Decision | Recommendation | Notes |
|---|---|---|
| Entra ID Easy Auth vs custom NextAuth | **Easy Auth** for now | Zero code; add NextAuth only if you need fine-grained role logic inside the app |
| Scale-to-zero on Container Apps | **Set min=0 nights/weekends** via scaling rule | Saves ~30% cost; adds ~2–3s cold start on first request |
| PostgreSQL HA standby | **No** for now | Enable Zone Redundant HA if this becomes business-critical |
| Prisma migrate deploy vs dev | **`prisma migrate deploy`** in CI | `migrate dev` is for local only; deploy is safe for production |
| Blob Storage | **Skip for now** | Add when CSV export or file upload is implemented |
| Azure DevOps vs GitHub Actions | **GitHub Actions** | Simpler if you're already on GitHub; switch to Azure DevOps pipelines if your org requires it |
