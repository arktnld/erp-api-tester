-- Base única do schema, no lugar das 30 migrations antigas (que dependiam de ajustes
-- manuais e falhavam num banco novo). Bancos que já existiam: rodar antes
-- scripts/once/2026-10-01-repair-prod-schema.sql e marcar esta como aplicada.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ERP" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "authTemplate" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ERP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ERPFieldSchema" (
    "id" SERIAL NOT NULL,
    "erpId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceEndpointId" INTEGER,
    "endpointParam" TEXT NOT NULL DEFAULT '',
    "responsePath" TEXT NOT NULL DEFAULT '',
    "defaultValue" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ERPFieldSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" SERIAL NOT NULL,
    "erpId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "pathTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL DEFAULT '',
    "headers" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT NOT NULL DEFAULT '',
    "requiresClient" BOOLEAN NOT NULL DEFAULT true,
    "isModification" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "authMode" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "erpId" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "environments" JSONB NOT NULL DEFAULT '[]',
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authConfig" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCookieJar" (
    "companyId" INTEGER NOT NULL,
    "cookies" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCookieJar_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "RecordCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRecord" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "shareToken" TEXT,
    "companyId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordBlock" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "endpointId" INTEGER,
    "clientId" INTEGER,
    "response" JSONB,
    "note" TEXT NOT NULL DEFAULT '',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestClient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "fieldsData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostmanCollection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostmanCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" SERIAL NOT NULL,
    "erpId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookStep" (
    "id" SERIAL NOT NULL,
    "playbookId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL DEFAULT '',
    "bodyOverride" TEXT NOT NULL DEFAULT '',
    "responseCapture" TEXT NOT NULL DEFAULT '',
    "assertions" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PlaybookStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookRun" (
    "id" SERIAL NOT NULL,
    "playbookId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "shareToken" TEXT,

    CONSTRAINT "PlaybookRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestHistory" (
    "id" SERIAL NOT NULL,
    "erpName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "endpointName" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL DEFAULT '',
    "requestHeaders" TEXT NOT NULL DEFAULT '{}',
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL DEFAULT '',
    "responseHeaders" TEXT NOT NULL DEFAULT '{}',
    "durationMs" INTEGER NOT NULL,
    "companyId" INTEGER,
    "endpointId" INTEGER,
    "testClientId" INTEGER,
    "userId" TEXT,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ERP_name_key" ON "ERP"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecordCategory_name_key" ON "RecordCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRecord_shareToken_key" ON "ApiRecord"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookRun_shareToken_key" ON "PlaybookRun"("shareToken");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestHistory_companyId_idx" ON "RequestHistory"("companyId");

-- CreateIndex
CREATE INDEX "RequestHistory_endpointId_idx" ON "RequestHistory"("endpointId");

-- CreateIndex
CREATE INDEX "RequestHistory_testClientId_idx" ON "RequestHistory"("testClientId");

-- CreateIndex
CREATE INDEX "RequestHistory_userId_idx" ON "RequestHistory"("userId");

-- CreateIndex
CREATE INDEX "RequestHistory_createdAt_idx" ON "RequestHistory"("createdAt");

-- CreateIndex
CREATE INDEX "RequestHistory_statusCode_idx" ON "RequestHistory"("statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "ERPFieldSchema" ADD CONSTRAINT "ERPFieldSchema_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "ERP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "ERP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "ERP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCookieJar" ADD CONSTRAINT "CompanyCookieJar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRecord" ADD CONSTRAINT "ApiRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRecord" ADD CONSTRAINT "ApiRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecordCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordBlock" ADD CONSTRAINT "RecordBlock_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ApiRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestClient" ADD CONSTRAINT "TestClient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_erpId_fkey" FOREIGN KEY ("erpId") REFERENCES "ERP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookStep" ADD CONSTRAINT "PlaybookStep_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookStep" ADD CONSTRAINT "PlaybookStep_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

