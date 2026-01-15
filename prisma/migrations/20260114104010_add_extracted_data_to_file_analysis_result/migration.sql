/*
  Warnings:

  - Added the required column `updatedAt` to the `saved_filters` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "file_analysis_results" ADD COLUMN     "extractedData" JSONB;

-- AlterTable
ALTER TABLE "saved_filters" ADD COLUMN     "filterType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "saved_filters_filterType_idx" ON "saved_filters"("filterType");
