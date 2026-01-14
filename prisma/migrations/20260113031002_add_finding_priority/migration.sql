-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LAWYER', 'PARALEGAL', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionNature" AS ENUM ('CREDITOR', 'COLLATERAL', 'PRIORITY_REPAYMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ClassificationErrorType" AS ENUM ('WRONG_CATEGORY', 'MISSED', 'LOW_CONFIDENCE');

-- CreateEnum
CREATE TYPE "ClassificationRulePatternType" AS ENUM ('KEYWORD', 'AMOUNT_RANGE', 'CREDITOR');

-- CreateEnum
CREATE TYPE "TransactionRelationType" AS ENUM ('DIRECT_TRANSFER', 'PROBABLE_TRANSFER', 'RELATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pendingEmail" TEXT,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARALEGAL',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "courtName" TEXT,
    "filingDate" TIMESTAMP(3),
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDING',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lawyerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaderId" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_analysis_results" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL DEFAULT '{}',
    "headerRowIndex" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "detectedFormat" TEXT NOT NULL,
    "hasHeaders" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ocrProvider" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "analyzedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_jobs" (
    "id" TEXT NOT NULL,
    "fileAnalysisResultId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "depositAmount" DECIMAL(20,4),
    "withdrawalAmount" DECIMAL(20,4),
    "balance" DECIMAL(20,4),
    "memo" TEXT,
    "rawMetadata" JSONB,
    "rowNumber" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "subcategory" TEXT,
    "confidenceScore" DOUBLE PRECISION DEFAULT 0.0,
    "isManuallyClassified" BOOLEAN DEFAULT false,
    "aiClassificationStatus" TEXT,
    "originalCategory" TEXT,
    "originalSubcategory" TEXT,
    "originalConfidenceScore" DOUBLE PRECISION,
    "manualClassificationDate" TIMESTAMP(3),
    "manualClassifiedBy" TEXT,
    "importantTransaction" BOOLEAN DEFAULT false,
    "importantTransactionType" TEXT,
    "importantTransactionKeywords" TEXT,
    "transactionNature" "TransactionNature",
    "creditorName" TEXT,
    "collateralType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "transactionId" TEXT,
    "relatedTransactionIds" TEXT[],
    "relatedCreditorNames" TEXT,
    "findingType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "priority" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_notes" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_feedbacks" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "originalCategory" TEXT,
    "originalSubcategory" TEXT,
    "originalConfidence" DOUBLE PRECISION,
    "userCategory" TEXT,
    "userSubcategory" TEXT,
    "feedbackDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternType" "ClassificationRulePatternType" NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "applyCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_errors" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "errorType" "ClassificationErrorType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_relations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceTxId" TEXT NOT NULL,
    "targetTxId" TEXT NOT NULL,
    "relationType" "TransactionRelationType" NOT NULL DEFAULT 'DIRECT_TRANSFER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "matchReason" TEXT,
    "distance" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_chains" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "startTxId" TEXT NOT NULL,
    "endTxId" TEXT NOT NULL,
    "chainType" TEXT NOT NULL,
    "chainDepth" INTEGER NOT NULL DEFAULT 1,
    "path" TEXT NOT NULL,
    "totalAmount" DECIMAL(20,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_pendingEmail_key" ON "users"("pendingEmail");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "cases_caseNumber_key" ON "cases"("caseNumber");

-- CreateIndex
CREATE INDEX "cases_caseNumber_idx" ON "cases"("caseNumber");

-- CreateIndex
CREATE INDEX "cases_lawyerId_idx" ON "cases"("lawyerId");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_isArchived_idx" ON "cases"("isArchived");

-- CreateIndex
CREATE INDEX "case_notes_caseId_idx" ON "case_notes"("caseId");

-- CreateIndex
CREATE INDEX "case_notes_authorId_idx" ON "case_notes"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_s3Key_key" ON "documents"("s3Key");

-- CreateIndex
CREATE INDEX "documents_caseId_idx" ON "documents"("caseId");

-- CreateIndex
CREATE INDEX "documents_uploaderId_idx" ON "documents"("uploaderId");

-- CreateIndex
CREATE UNIQUE INDEX "file_analysis_results_documentId_key" ON "file_analysis_results"("documentId");

-- CreateIndex
CREATE INDEX "file_analysis_results_caseId_idx" ON "file_analysis_results"("caseId");

-- CreateIndex
CREATE INDEX "file_analysis_results_documentId_idx" ON "file_analysis_results"("documentId");

-- CreateIndex
CREATE INDEX "file_analysis_results_status_idx" ON "file_analysis_results"("status");

-- CreateIndex
CREATE UNIQUE INDEX "classification_jobs_fileAnalysisResultId_key" ON "classification_jobs"("fileAnalysisResultId");

-- CreateIndex
CREATE INDEX "classification_jobs_fileAnalysisResultId_idx" ON "classification_jobs"("fileAnalysisResultId");

-- CreateIndex
CREATE INDEX "classification_jobs_status_idx" ON "classification_jobs"("status");

-- CreateIndex
CREATE INDEX "transactions_caseId_idx" ON "transactions"("caseId");

-- CreateIndex
CREATE INDEX "transactions_documentId_idx" ON "transactions"("documentId");

-- CreateIndex
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "transactions_category_idx" ON "transactions"("category");

-- CreateIndex
CREATE INDEX "transactions_aiClassificationStatus_idx" ON "transactions"("aiClassificationStatus");

-- CreateIndex
CREATE INDEX "transactions_importantTransaction_idx" ON "transactions"("importantTransaction");

-- CreateIndex
CREATE INDEX "transactions_importantTransactionType_idx" ON "transactions"("importantTransactionType");

-- CreateIndex
CREATE INDEX "transactions_transactionNature_idx" ON "transactions"("transactionNature");

-- CreateIndex
CREATE INDEX "transactions_isManuallyClassified_idx" ON "transactions"("isManuallyClassified");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_documentId_transactionDate_depositAmount_withd_key" ON "transactions"("documentId", "transactionDate", "depositAmount", "withdrawalAmount");

-- CreateIndex
CREATE INDEX "findings_caseId_idx" ON "findings"("caseId");

-- CreateIndex
CREATE INDEX "findings_transactionId_idx" ON "findings"("transactionId");

-- CreateIndex
CREATE INDEX "findings_findingType_idx" ON "findings"("findingType");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_priority_idx" ON "findings"("priority");

-- CreateIndex
CREATE INDEX "findings_isResolved_idx" ON "findings"("isResolved");

-- CreateIndex
CREATE INDEX "finding_notes_findingId_idx" ON "finding_notes"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE INDEX "transaction_tags_transactionId_idx" ON "transaction_tags"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_tags_tagId_idx" ON "transaction_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_tags_transactionId_tagId_key" ON "transaction_tags"("transactionId", "tagId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "classification_feedbacks_transactionId_idx" ON "classification_feedbacks"("transactionId");

-- CreateIndex
CREATE INDEX "classification_feedbacks_feedbackDate_idx" ON "classification_feedbacks"("feedbackDate");

-- CreateIndex
CREATE INDEX "classification_feedbacks_userId_idx" ON "classification_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "classification_feedbacks_userCategory_idx" ON "classification_feedbacks"("userCategory");

-- CreateIndex
CREATE INDEX "classification_rules_patternType_idx" ON "classification_rules"("patternType");

-- CreateIndex
CREATE INDEX "classification_rules_confidence_idx" ON "classification_rules"("confidence");

-- CreateIndex
CREATE INDEX "classification_rules_applyCount_idx" ON "classification_rules"("applyCount");

-- CreateIndex
CREATE INDEX "classification_rules_isActive_idx" ON "classification_rules"("isActive");

-- CreateIndex
CREATE INDEX "classification_errors_transactionId_idx" ON "classification_errors"("transactionId");

-- CreateIndex
CREATE INDEX "classification_errors_errorType_idx" ON "classification_errors"("errorType");

-- CreateIndex
CREATE INDEX "classification_errors_severity_idx" ON "classification_errors"("severity");

-- CreateIndex
CREATE INDEX "classification_errors_resolved_idx" ON "classification_errors"("resolved");

-- CreateIndex
CREATE INDEX "classification_errors_userId_idx" ON "classification_errors"("userId");

-- CreateIndex
CREATE INDEX "transaction_relations_caseId_idx" ON "transaction_relations"("caseId");

-- CreateIndex
CREATE INDEX "transaction_relations_sourceTxId_idx" ON "transaction_relations"("sourceTxId");

-- CreateIndex
CREATE INDEX "transaction_relations_targetTxId_idx" ON "transaction_relations"("targetTxId");

-- CreateIndex
CREATE INDEX "transaction_relations_relationType_idx" ON "transaction_relations"("relationType");

-- CreateIndex
CREATE INDEX "transaction_relations_confidence_idx" ON "transaction_relations"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_relations_sourceTxId_targetTxId_key" ON "transaction_relations"("sourceTxId", "targetTxId");

-- CreateIndex
CREATE INDEX "transaction_chains_caseId_idx" ON "transaction_chains"("caseId");

-- CreateIndex
CREATE INDEX "transaction_chains_startTxId_idx" ON "transaction_chains"("startTxId");

-- CreateIndex
CREATE INDEX "transaction_chains_endTxId_idx" ON "transaction_chains"("endTxId");

-- CreateIndex
CREATE INDEX "transaction_chains_chainType_idx" ON "transaction_chains"("chainType");

-- CreateIndex
CREATE INDEX "transaction_chains_chainDepth_idx" ON "transaction_chains"("chainDepth");

-- CreateIndex
CREATE INDEX "saved_filters_userId_idx" ON "saved_filters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_filters_userId_name_key" ON "saved_filters"("userId", "name");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_analysis_results" ADD CONSTRAINT "file_analysis_results_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_analysis_results" ADD CONSTRAINT "file_analysis_results_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_jobs" ADD CONSTRAINT "classification_jobs_fileAnalysisResultId_fkey" FOREIGN KEY ("fileAnalysisResultId") REFERENCES "file_analysis_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_notes" ADD CONSTRAINT "finding_notes_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_feedbacks" ADD CONSTRAINT "classification_feedbacks_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_feedbacks" ADD CONSTRAINT "classification_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_errors" ADD CONSTRAINT "classification_errors_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_errors" ADD CONSTRAINT "classification_errors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_relations" ADD CONSTRAINT "transaction_relations_sourceTxId_fkey" FOREIGN KEY ("sourceTxId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_relations" ADD CONSTRAINT "transaction_relations_targetTxId_fkey" FOREIGN KEY ("targetTxId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_chains" ADD CONSTRAINT "transaction_chains_startTxId_fkey" FOREIGN KEY ("startTxId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_chains" ADD CONSTRAINT "transaction_chains_endTxId_fkey" FOREIGN KEY ("endTxId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
