/**
 * 기존 거래 데이터의 rowNumber 필드 복원 마이그레이션 스크립트
 * 
 * rawMetadata.rowNumber에서 Transaction.rowNumber로 값을 복사합니다.
 * 
 * 실행: npx tsx scripts/migrate-row-numbers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RawMetadata {
  rowNumber?: number;
  originalData?: unknown;
}

async function migrateRowNumbers() {
  console.log("Starting rowNumber migration...");

  // rowNumber가 null인 거래만 조회
  const transactions = await prisma.transaction.findMany({
    where: {
      rowNumber: null,
      rawMetadata: { not: null },
    },
    select: {
      id: true,
      rawMetadata: true,
    },
  });

  console.log(`Found ${transactions.length} transactions with null rowNumber`);

  let updated = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const metadata = tx.rawMetadata as RawMetadata | null;
    
    if (metadata?.rowNumber) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { rowNumber: metadata.rowNumber },
      });
      updated++;
    } else {
      skipped++;
    }

    if ((updated + skipped) % 100 === 0) {
      console.log(`Progress: ${updated} updated, ${skipped} skipped`);
    }
  }

  console.log(`Migration complete: ${updated} updated, ${skipped} skipped`);

  await prisma.$disconnect();
}

migrateRowNumbers().catch(console.error);
