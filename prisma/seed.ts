/**
 * Prisma Seed File
 *
 * 초기 테스트 데이터를 생성합니다.
 *
 * 실행 방법:
 * npm run db:seed
 * 또는
 * npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. 기존 데이터 삭제 (선택적 - 개발용)
  console.log("🧹 Cleaning existing data...");
  await prisma.classificationJob.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.fileAnalysisResult.deleteMany();
  await prisma.document.deleteMany();
  await prisma.case.deleteMany();
  await prisma.user.deleteMany();

  // 2. 테스트 사용자 생성
  console.log("👤 Creating test users...");

  const adminUser = await prisma.user.create({
    data: {
      id: "admin-user-1",
      email: "admin@pharos-bmad.com",
      name: "관리자",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`  ✅ Created admin: ${adminUser.email}`);

  const lawyerUser = await prisma.user.create({
    data: {
      id: "lawyer-user-1",
      email: "lawyer@pharos-bmad.com",
      name: "김변호사",
      password: await bcrypt.hash("lawyer123", 10),
      role: "LAWYER",
      isActive: true,
    },
  });
  console.log(`  ✅ Created lawyer: ${lawyerUser.email}`);

  // 3. 테스트 케이스 생성
  console.log("📁 Creating test cases...");

  const testCase = await prisma.case.create({
    data: {
      id: "case-1",
      lawyerId: lawyerUser.id,
      caseNumber: "2024-001",
      debtorName: "채무자회사",
      status: "IN_PROGRESS",
    },
  });
  console.log(`  ✅ Created case: ${testCase.caseNumber}`);

  // 4. 테스트 문서 생성
  console.log("📄 Creating test documents...");

  const testDocument = await prisma.document.create({
    data: {
      id: "doc-1",
      caseId: testCase.id,
      originalFileName: "거래내역_2024년1분기.xlsx",
      s3Key: `test-doc-${Date.now()}.xlsx`,
      fileSize: 51200,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      uploaderId: lawyerUser.id,
      uploadedAt: new Date(),
    },
  });
  console.log(`  ✅ Created document: ${testDocument.originalFileName}`);

  // 5. 파일 분석 결과 생성
  console.log("🔍 Creating file analysis results...");

  const fileAnalysisResult = await prisma.fileAnalysisResult.create({
    data: {
      id: "far-1",
      documentId: testDocument.id,
      caseId: testCase.id,
      status: "completed",
      columnMapping: {
        date: "날짜",
        deposit: "입금액",
        withdrawal: "출금액",
        memo: "적요",
        balance: "잔액",
      },
      headerRowIndex: 0,
      totalRows: 100,
      detectedFormat: "excel",
      hasHeaders: true,
      confidence: 0.95,
      analyzedAt: new Date(),
    },
  });
  console.log(`  ✅ Created file analysis result`);

  // 6. 테스트 거래 데이터 생성
  console.log("💰 Creating test transactions...");

  const testTransactions = [
    {
      id: "tx-1",
      transactionDate: new Date("2024-01-05"),
      depositAmount: "3000000.0000",
      withdrawalAmount: null,
      balance: "3000000.0000",
      memo: "홍길동급여",
      category: "입금",
      subcategory: "급여",
      confidenceScore: 0.95,
    },
    {
      id: "tx-2",
      transactionDate: new Date("2024-01-10"),
      depositAmount: null,
      withdrawalAmount: "50000.0000",
      balance: "2950000.0000",
      memo: "편의점",
      category: "출금",
      subcategory: "생활비",
      confidenceScore: 0.88,
    },
    {
      id: "tx-3",
      transactionDate: new Date("2024-01-15"),
      depositAmount: "150000.0000",
      withdrawalAmount: null,
      balance: "3100000.0000",
      memo: "이자수익",
      category: "입금",
      subcategory: "이자",
      confidenceScore: 0.92,
    },
    {
      id: "tx-4",
      transactionDate: new Date("2024-01-20"),
      depositAmount: null,
      withdrawalAmount: "250000.0000",
      balance: "2850000.0000",
      memo: "카드값",
      category: "출금",
      subcategory: "카드대금",
      confidenceScore: 0.85,
    },
    {
      id: "tx-5",
      transactionDate: new Date("2024-01-25"),
      depositAmount: null,
      withdrawalAmount: "150000.0000",
      balance: "2700000.0000",
      memo: "식비",
      category: "출금",
      subcategory: "식비",
      confidenceScore: 0.90,
    },
  ];

  for (const tx of testTransactions) {
    await prisma.transaction.create({
      data: {
        ...tx,
        caseId: testCase.id,
        documentId: testDocument.id,
      },
    });
  }
  console.log(`  ✅ Created ${testTransactions.length} transactions`);

  // 7. 분류 작업 생성 (Story 4.1 테스트용)
  console.log("🤖 Creating classification job...");

  const classificationJob = await prisma.classificationJob.create({
    data: {
      id: "job-1",
      fileAnalysisResultId: fileAnalysisResult.id,
      status: "completed",
      progress: 5,
      total: 5,
    },
  });
  console.log(`  ✅ Created classification job`);

  console.log("\n✅ Database seeded successfully!");
  console.log("\n📊 Summary:");
  console.log(`  - Users: 2 (admin, lawyer)`);
  console.log(`  - Cases: 1`);
  console.log(`  - Documents: 1`);
  console.log(`  - Transactions: ${testTransactions.length}`);
  console.log(`  - Classification Jobs: 1`);
  console.log("\n🔑 Test Credentials:");
  console.log(`  Admin: admin@pharos-bmad.com / admin123`);
  console.log(`  Lawyer: lawyer@pharos-bmad.com / lawyer123`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
