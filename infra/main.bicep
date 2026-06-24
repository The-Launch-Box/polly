// ──────────────────────────────────────────────────────────────────────────────
// typeform-alt — Azure infrastructure (Bicep)
//
// Resources provisioned:
//   - VNet with two subnets (apps, data)
//   - Azure Container Registry (Basic)
//   - Azure Database for PostgreSQL Flexible Server
//   - Azure Key Vault with private endpoint
//   - Container Apps Environment (VNet-injected)
//   - Container App (Next.js)
//   - Container Apps Job (Prisma migrate)
//   - Private DNS zones for PostgreSQL and Key Vault
//
// Deploy:
//   az deployment group create \
//     --resource-group rg-typeform-alt \
//     --template-file infra/main.bicep \
//     --parameters @infra/main.bicepparam
// ──────────────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name prefix (e.g. prod, staging)')
param environmentName string = 'prod'

@description('PostgreSQL administrator login')
param postgresAdminLogin string

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

@description('Container image to deploy (e.g. myacr.azurecr.io/typeform-alt:latest)')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@secure()
@description('Auth.js signing secret (openssl rand -hex 32)')
param authSecret string

@description('Microsoft Entra application (client) ID')
param authMicrosoftEntraIdId string

@secure()
@description('Microsoft Entra client secret')
param authMicrosoftEntraIdSecret string

@description('Microsoft Entra issuer URL')
param authMicrosoftEntraIdIssuer string

@description('Object ID of the principal running this deployment (for Key Vault secret writes)')
param deployerPrincipalId string = ''

var resourcePrefix = 'typeform-alt-${environmentName}'
var vnetName = 'vnet-${resourcePrefix}'
var acrName = replace('acr${resourcePrefix}', '-', '')
var pgName = 'pg-${resourcePrefix}'
var kvName = 'kv-${resourcePrefix}'
var acaEnvName = 'cae-${resourcePrefix}'
var acaAppName = 'typeform-alt'
var acaJobName = 'typeform-alt-migrate'
var kvUri = 'https://${kvName}${environment().suffixes.keyvaultDns}/'
var databaseConnectionString = 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/typeform?schema=public&sslmode=require'
var acrCredentials = acr.listCredentials()
var containerAppFqdn = '${acaAppName}.${acaEnv.properties.defaultDomain}'
var authUrl = 'https://${containerAppFqdn}'

// ── Virtual Network ────────────────────────────────────────────────────────────
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'apps'
        properties: {
          addressPrefix: '10.0.1.0/24'
          // Delegate to Container Apps Environment
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'data'
        properties: {
          addressPrefix: '10.0.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// ── Azure Container Registry ───────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ── PostgreSQL Flexible Server ─────────────────────────────────────────────────
resource pgSubnetRef 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' existing = {
  name: '${vnetName}/data'
}

// Private DNS zone for PostgreSQL
resource pgDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
}

resource pgDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: pgDnsZone
  name: 'pg-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgName
  location: location
  sku: {
    name: 'Standard_B2ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: pgSubnetRef.id
      privateDnsZoneArmResourceId: pgDnsZone.id
    }
  }
  dependsOn: [pgDnsZoneLink]
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'typeform'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// ── Key Vault ──────────────────────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// Private endpoint for Key Vault
resource kvPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: 'pe-${kvName}'
  location: location
  properties: {
    subnet: {
      id: '${vnet.id}/subnets/data'
    }
    privateLinkServiceConnections: [
      {
        name: 'kv-connection'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource kvDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
}

resource kvDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: kvDnsZone
  name: 'kv-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource kvDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: kvPrivateEndpoint
  name: 'kvDnsZoneGroup'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: kvDnsZone.id
        }
      }
    ]
  }
}

// ── Key Vault secrets (created during deploy) ───────────────────────────────────
resource secretDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: databaseConnectionString
  }
  dependsOn: empty(deployerPrincipalId) ? [] : [deployerKvSecretsOfficer]
}

resource secretAuthSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-secret'
  properties: {
    value: authSecret
  }
}

resource secretAuthMicrosoftEntraIdId 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-microsoft-entra-id-id'
  properties: {
    value: authMicrosoftEntraIdId
  }
}

resource secretAuthMicrosoftEntraIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-microsoft-entra-id-secret'
  properties: {
    value: authMicrosoftEntraIdSecret
  }
}

resource secretAuthMicrosoftEntraIdIssuer 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'auth-microsoft-entra-id-issuer'
  properties: {
    value: authMicrosoftEntraIdIssuer
  }
}

resource deployerKvSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerPrincipalId)) {
  name: guid(keyVault.id, deployerPrincipalId, 'b86a8fe2-44ce-4948-aee5-eccb2c155cd7')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe2-44ce-4948-aee5-eccb2c155cd7')
    principalId: deployerPrincipalId
    principalType: 'User'
  }
}

// ── Container Apps Environment ─────────────────────────────────────────────────
resource acaEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: acaEnvName
  location: location
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: '${vnet.id}/subnets/apps'
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ── Container App — Next.js ────────────────────────────────────────────────────
resource acaApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: acaAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.name
          // In production, use managed identity pull instead of admin creds
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acrCredentials.passwords[0].value
        }
        {
          name: 'database-url'
          keyVaultUrl: '${kvUri}secrets/database-url'
          identity: 'system'
        }
        {
          name: 'auth-secret'
          keyVaultUrl: '${kvUri}secrets/auth-secret'
          identity: 'system'
        }
        {
          name: 'auth-microsoft-entra-id-id'
          keyVaultUrl: '${kvUri}secrets/auth-microsoft-entra-id-id'
          identity: 'system'
        }
        {
          name: 'auth-microsoft-entra-id-secret'
          keyVaultUrl: '${kvUri}secrets/auth-microsoft-entra-id-secret'
          identity: 'system'
        }
        {
          name: 'auth-microsoft-entra-id-issuer'
          keyVaultUrl: '${kvUri}secrets/auth-microsoft-entra-id-issuer'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: acaAppName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'AUTH_SECRET'
              secretRef: 'auth-secret'
            }
            {
              name: 'AUTH_URL'
              value: authUrl
            }
            {
              name: 'AUTH_MICROSOFT_ENTRA_ID_ID'
              secretRef: 'auth-microsoft-entra-id-id'
            }
            {
              name: 'AUTH_MICROSOFT_ENTRA_ID_SECRET'
              secretRef: 'auth-microsoft-entra-id-secret'
            }
            {
              name: 'AUTH_MICROSOFT_ENTRA_ID_ISSUER'
              secretRef: 'auth-microsoft-entra-id-issuer'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Container Apps Job — Prisma Migrate ───────────────────────────────────────
// Runs `prisma migrate deploy && prisma db seed` on each deployment.
resource acaJob 'Microsoft.App/jobs@2024-03-01' = {
  name: acaJobName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: acaEnv.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 300
      replicaRetryLimit: 1
      registries: acaApp.properties.configuration.registries
      secrets: acaApp.properties.configuration.secrets
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          command: [
            'sh'
            '-c'
            'npx prisma migrate deploy && npx prisma db seed'
          ]
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
          ]
        }
      ]
    }
  }
}

// ── Role Assignment: Container App → Key Vault ─────────────────────────────────
// Key Vault Secrets User = 4633458b-17de-408a-b874-0445c86b69e0
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, acaApp.id, '4633458b-17de-408a-b874-0445c86b69e0')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e0')
    principalId: acaApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource kvRoleAssignmentJob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, acaJob.id, '4633458b-17de-408a-b874-0445c86b69e0')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e0')
    principalId: acaJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output containerAppFqdn string = containerAppFqdn
output containerRegistryLoginServer string = acr.properties.loginServer
output keyVaultName string = keyVault.name
output postgresHostname string = postgres.properties.fullyQualifiedDomainName
