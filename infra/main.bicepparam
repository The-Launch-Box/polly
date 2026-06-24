using './main.bicep'

param environmentName = 'prod'

param postgresAdminLogin = 'typeformadmin'
@secure()
param postgresAdminPassword = ''

param containerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@secure()
param authSecret = ''

param authMicrosoftEntraIdId = ''

@secure()
param authMicrosoftEntraIdSecret = ''

param authMicrosoftEntraIdIssuer = ''

param deployerPrincipalId = ''
