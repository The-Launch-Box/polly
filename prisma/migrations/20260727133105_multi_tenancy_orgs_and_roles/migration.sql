-- Multi-tenancy: shared catalog + roles + ownerUserId on Form template tables.
-- Per-org survey data lives in tenant_<slug> schemas (created by seed / sync-tenants).

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('CREATOR', 'MANAGER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPERADMIN');

-- CreateEnum
CREATE TYPE "FormAccessRole" AS ENUM ('VIEWER', 'ANALYST', 'COLLABORATOR');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "entraOid" TEXT NOT NULL,
    "platformRole" "PlatformRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'CREATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicFormRoute" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicFormRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAccess" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "role" "FormAccessRole" NOT NULL,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormAccess_pkey" PRIMARY KEY ("id")
);

-- Placeholder owner for existing Form rows (seed replaces with real users)
INSERT INTO "User" ("id", "email", "name", "entraOid", "platformRole", "createdAt", "updatedAt")
VALUES (
  'migration_placeholder_owner',
  'migration-placeholder@improvizations.com',
  'Migration Placeholder',
  'migration-placeholder-oid',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- AlterTable Form: add ownerUserId safely for existing rows
ALTER TABLE "Form" ADD COLUMN "ownerUserId" TEXT;
UPDATE "Form" SET "ownerUserId" = 'migration_placeholder_owner' WHERE "ownerUserId" IS NULL;
ALTER TABLE "Form" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_emailDomain_key" ON "Organization"("emailDomain");
CREATE UNIQUE INDEX "Organization_schemaName_key" ON "Organization"("schemaName");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_entraOid_key" ON "User"("entraOid");
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");
CREATE UNIQUE INDEX "PublicFormRoute_slug_key" ON "PublicFormRoute"("slug");
CREATE INDEX "PublicFormRoute_organizationId_idx" ON "PublicFormRoute"("organizationId");
CREATE INDEX "PublicFormRoute_formId_idx" ON "PublicFormRoute"("formId");
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");
CREATE INDEX "Group_createdByUserId_idx" ON "Group"("createdByUserId");
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");
CREATE INDEX "FormAccess_formId_idx" ON "FormAccess"("formId");
CREATE INDEX "FormAccess_userId_idx" ON "FormAccess"("userId");
CREATE INDEX "FormAccess_groupId_idx" ON "FormAccess"("groupId");
CREATE INDEX "Form_ownerUserId_idx" ON "Form"("ownerUserId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicFormRoute" ADD CONSTRAINT "PublicFormRoute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormAccess" ADD CONSTRAINT "FormAccess_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormAccess" ADD CONSTRAINT "FormAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
