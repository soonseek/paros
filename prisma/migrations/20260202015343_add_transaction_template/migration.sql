-- CreateTable
CREATE TABLE "transaction_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "description" TEXT NOT NULL,
    "identifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "columnSchema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_templates_name_key" ON "transaction_templates"("name");

-- CreateIndex
CREATE INDEX "transaction_templates_bankName_idx" ON "transaction_templates"("bankName");

-- CreateIndex
CREATE INDEX "transaction_templates_isActive_idx" ON "transaction_templates"("isActive");

-- CreateIndex
CREATE INDEX "transaction_templates_priority_idx" ON "transaction_templates"("priority");
