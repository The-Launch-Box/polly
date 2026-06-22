using './main.bicep'

// ── Required parameters ────────────────────────────────────────────────────────
// Fill these in before deploying. Do NOT commit real passwords.

param environmentName = 'prod'

// PostgreSQL admin credentials — store the password in a secret manager before deploy
param postgresAdminLogin = 'typeformadmin'
@secure()
param postgresAdminPassword = ''   // Set via: --parameters postgresAdminPassword='...'

// Container image — updated by CI/CD after each build
// Format: <acrName>.azurecr.io/typeform-alt:<git-sha>
param containerImage = 'acrtypeformaltprod.azurecr.io/typeform-alt:latest'
