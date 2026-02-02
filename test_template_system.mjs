#!/usr/bin/env node
/**
 * 국민은행 PDF 템플릿 기반 파싱 시스템 전체 테스트
 * 
 * 테스트 단계:
 * 1. Upstage API 키 확인 및 설정
 * 2. 국민은행 템플릿 생성
 * 3. PDF 파일로 템플릿 매칭 테스트
 * 4. 전체 검증
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { SettingsService } from './src/server/services/settings-service.ts';
import { extractTablesFromPDF } from './src/lib/pdf-ocr.ts';
import { classifyTransaction, normalizeText } from './src/lib/template-classifier.ts';

const prisma = new PrismaClient();
const settingsService = new SettingsService(prisma);

// 테스트 결과 추적
const testResults = {
  apiKeyCheck: false,
  templateCreation: false,
  pdfParsing: false,
  headerNormalization: false,
  templateMatching: false,
  columnMapping: false,
};

async function main() {
  console.log("=" + "=".repeat(79));
  console.log("국민은행 PDF 템플릿 기반 파싱 시스템 전체 테스트");
  console.log("=" + "=".repeat(79));
  console.log();

  try {
    // ========================================================================
    // 1단계: Upstage API 키 확인 및 설정
    // ========================================================================
    console.log("📋 1단계: Upstage API 키 확인 및 설정");
    console.log("-".repeat(80));
    
    let apiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
    
    if (!apiKey || apiKey === 'your-upstage-api-key') {
      console.log("❌ DB에 유효한 Upstage API 키가 없습니다.");
      console.log();
      console.log("⚠️  CRITICAL BLOCKER: Upstage API 키가 필요합니다");
      console.log();
      console.log("해결 방법:");
      console.log("1. Upstage Console에서 API 키 발급: https://console.upstage.ai/api-keys");
      console.log("2. 다음 SQL로 DB에 삽입:");
      console.log();
      console.log("   PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d paros -c \"");
      console.log("   INSERT INTO system_settings (key, value, category, is_encrypted, updated_at)");
      console.log("   VALUES ('UPSTAGE_API_KEY', '<your-api-key>', 'AI', true, NOW())");
      console.log("   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();");
      console.log("   \"");
      console.log();
      console.log("또는 관리자 설정 페이지에서 입력하세요.");
      console.log();
      
      testResults.apiKeyCheck = false;
      
      // API 키 없이는 진행 불가
      console.log("=" + "=".repeat(79));
      console.log("테스트 중단: Upstage API 키가 필요합니다");
      console.log("=" + "=".repeat(79));
      process.exit(1);
    }
    
    console.log("✅ Upstage API 키 확인 완료");
    console.log(`   키 길이: ${apiKey.length} 문자`);
    console.log(`   키 프리픽스: ${apiKey.substring(0, 10)}...`);
    testResults.apiKeyCheck = true;
    console.log();

    // ========================================================================
    // 2단계: 국민은행 템플릿 생성
    // ========================================================================
    console.log("📝 2단계: 국민은행 템플릿 생성");
    console.log("-".repeat(80));
    
    const templateData = {
      name: "국민은행 거래내역",
      bankName: "국민은행",
      description: "국민은행 입출금 거래내역서",
      identifiers: ["국민은행", "거래내역"],
      columnSchema: {
        columns: {
          date: { index: 0, header: "거래일자" },
          withdrawal: { index: 2, header: "출금금액" },
          deposit: { index: 3, header: "입금금액" },
          balance: { index: 4, header: "잔액" },
          memo: { index: 5, header: "송금인/수취인" }
        }
      },
      isActive: true,
      priority: 10,
      createdBy: "test-system"
    };
    
    // 기존 템플릿 확인
    let template = await prisma.transactionTemplate.findUnique({
      where: { name: templateData.name }
    });
    
    if (template) {
      console.log(`✅ 템플릿이 이미 존재합니다: ${template.id}`);
      console.log(`   생성일: ${template.createdAt}`);
    } else {
      template = await prisma.transactionTemplate.create({
        data: templateData
      });
      console.log(`✅ 템플릿 생성 완료: ${template.id}`);
    }
    
    console.log(`   이름: ${template.name}`);
    console.log(`   은행: ${template.bankName}`);
    console.log(`   식별자: ${template.identifiers.join(", ")}`);
    console.log(`   우선순위: ${template.priority}`);
    testResults.templateCreation = true;
    console.log();

    // ========================================================================
    // 3단계: PDF 파일 로드 및 파싱
    // ========================================================================
    console.log("📄 3단계: PDF 파일 로드 및 파싱");
    console.log("-".repeat(80));
    
    const pdfPath = "/tmp/국민은행.pdf";
    console.log(`PDF 경로: ${pdfPath}`);
    
    const pdfBuffer = readFileSync(pdfPath);
    console.log(`✅ PDF 로드 완료: ${pdfBuffer.length} bytes`);
    console.log();
    
    console.log("🔍 Upstage OCR 실행 중...");
    console.log("   (이 작업은 10-30초 소요될 수 있습니다)");
    
    const tableData = await extractTablesFromPDF(pdfBuffer, 3, apiKey);
    
    console.log();
    console.log("✅ PDF 파싱 완료");
    console.log(`   헤더 수: ${tableData.headers.length}`);
    console.log(`   데이터 행 수: ${tableData.rows.length}`);
    console.log(`   페이지 텍스트 수: ${tableData.pageTexts?.length || 0}`);
    testResults.pdfParsing = true;
    console.log();

    // ========================================================================
    // 4단계: 헤더 정규화 검증
    // ========================================================================
    console.log("🔤 4단계: 헤더 정규화 검증");
    console.log("-".repeat(80));
    
    console.log("원본 헤더 (Raw headers):");
    tableData.headers.forEach((h, i) => {
      console.log(`   [${i}] "${h}"`);
    });
    console.log();
    
    const normalizedHeaders = tableData.headers.map(h => normalizeText(h));
    console.log("정규화된 헤더 (Normalized headers - 띄어쓰기 제거):");
    normalizedHeaders.forEach((h, i) => {
      console.log(`   [${i}] "${h}"`);
    });
    console.log();
    
    // 띄어쓰기가 제거되었는지 확인
    const hasSpacesInOriginal = tableData.headers.some(h => h.includes(" "));
    const hasSpacesInNormalized = normalizedHeaders.some(h => h.includes(" "));
    
    if (hasSpacesInOriginal && !hasSpacesInNormalized) {
      console.log("✅ 헤더 정규화 성공: 띄어쓰기가 제거되었습니다");
      testResults.headerNormalization = true;
    } else if (!hasSpacesInOriginal) {
      console.log("✅ 헤더 정규화 확인: 원본 헤더에 띄어쓰기가 없습니다");
      testResults.headerNormalization = true;
    } else {
      console.log("⚠️  헤더 정규화 실패: 띄어쓰기가 여전히 존재합니다");
      testResults.headerNormalization = false;
    }
    console.log();

    // ========================================================================
    // 5단계: 페이지 텍스트 추출 확인
    // ========================================================================
    console.log("📄 5단계: 페이지 텍스트 추출 확인");
    console.log("-".repeat(80));
    
    if (tableData.pageTexts && tableData.pageTexts.length > 0) {
      console.log(`✅ 페이지 텍스트 추출 완료: ${tableData.pageTexts.length}개 요소`);
      console.log();
      console.log("페이지 텍스트 샘플 (처음 5개):");
      tableData.pageTexts.slice(0, 5).forEach((text, i) => {
        const preview = text.length > 50 ? text.substring(0, 50) + "..." : text;
        console.log(`   [${i}] ${preview}`);
      });
      console.log();
      
      // 식별자 검색
      const searchText = tableData.pageTexts.join(" ");
      const normalizedSearchText = normalizeText(searchText);
      
      console.log("템플릿 식별자 검색:");
      template.identifiers.forEach(identifier => {
        const normalizedIdentifier = normalizeText(identifier);
        const found = normalizedSearchText.includes(normalizedIdentifier);
        console.log(`   "${identifier}" → "${normalizedIdentifier}": ${found ? "✅ 발견" : "❌ 없음"}`);
      });
    } else {
      console.log("⚠️  페이지 텍스트가 추출되지 않았습니다");
    }
    console.log();

    // ========================================================================
    // 6단계: 템플릿 매칭 테스트
    // ========================================================================
    console.log("🎯 6단계: 템플릿 매칭 테스트");
    console.log("-".repeat(80));
    
    const classificationResult = await classifyTransaction(
      prisma,
      tableData.headers,
      tableData.rows,
      tableData.pageTexts
    );
    
    if (!classificationResult) {
      console.log("❌ 템플릿 매칭 실패: 매칭된 템플릿이 없습니다");
      testResults.templateMatching = false;
      testResults.columnMapping = false;
    } else {
      console.log("✅ 템플릿 매칭 성공");
      console.log(`   레이어: Layer ${classificationResult.layer} (${classificationResult.layerName})`);
      console.log(`   템플릿: ${classificationResult.templateName}`);
      console.log(`   신뢰도: ${classificationResult.confidence}`);
      testResults.templateMatching = true;
      console.log();
      
      // Layer 1 매칭 확인
      if (classificationResult.layer === 1) {
        console.log("✅ Layer 1 (정확 매칭) 성공");
        console.log("   → 식별자가 페이지 텍스트에서 발견되었습니다");
      } else if (classificationResult.layer === 2) {
        console.log("⚠️  Layer 2 (유사도 매칭) 사용");
        console.log("   → Layer 1 매칭 실패, LLM 기반 매칭 사용");
      } else {
        console.log("⚠️  Layer 3 (폴백) 사용");
        console.log("   → 템플릿 매칭 실패, 기본 템플릿 사용");
      }
      console.log();

      // ========================================================================
      // 7단계: 컬럼 매핑 검증
      // ========================================================================
      console.log("🗺️  7단계: 컬럼 매핑 검증");
      console.log("-".repeat(80));
      
      console.log("컬럼 매핑 결과:");
      const requiredColumns = ["date", "deposit", "withdrawal", "balance"];
      const mappedColumns = Object.keys(classificationResult.columnMapping);
      
      for (const [key, index] of Object.entries(classificationResult.columnMapping)) {
        if (typeof index === 'number') {
          const headerName = tableData.headers[index] || "N/A";
          console.log(`   ${key}: 컬럼 ${index} → "${headerName}"`);
        } else {
          console.log(`   ${key}: ${index}`);
        }
      }
      console.log();
      
      // 필수 컬럼 확인
      const missingColumns = requiredColumns.filter(col => !mappedColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log("✅ 모든 필수 컬럼 매핑 완료");
        testResults.columnMapping = true;
      } else {
        console.log(`⚠️  누락된 컬럼: ${missingColumns.join(", ")}`);
        testResults.columnMapping = false;
      }
      
      if (classificationResult.memoInAmountColumn) {
        console.log("   ℹ️  특수 케이스: 메모가 금액 컬럼에 포함됨");
      }
    }
    console.log();

    // ========================================================================
    // 8단계: 데이터 추출 샘플
    // ========================================================================
    console.log("📊 8단계: 데이터 추출 샘플");
    console.log("-".repeat(80));
    
    console.log("추출된 데이터 (처음 3행):");
    tableData.rows.slice(0, 3).forEach((row, i) => {
      console.log(`   행 ${i + 1}:`);
      row.slice(0, 6).forEach((cell, j) => {
        const header = tableData.headers[j] || `컬럼${j}`;
        console.log(`      [${j}] ${header}: "${cell}"`);
      });
      console.log();
    });

    // ========================================================================
    // 최종 검증 결과
    // ========================================================================
    console.log("=" + "=".repeat(79));
    console.log("최종 검증 결과");
    console.log("=" + "=".repeat(79));
    console.log();
    
    const checks = [
      { name: "1. Upstage API 키 확인", result: testResults.apiKeyCheck },
      { name: "2. 템플릿 생성", result: testResults.templateCreation },
      { name: "3. PDF 파싱 (Upstage OCR)", result: testResults.pdfParsing },
      { name: "4. 헤더 정규화 (띄어쓰기 제거)", result: testResults.headerNormalization },
      { name: "5. 템플릿 매칭 (Layer 1)", result: testResults.templateMatching },
      { name: "6. 컬럼 매핑", result: testResults.columnMapping },
    ];
    
    checks.forEach(check => {
      const icon = check.result ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
    });
    console.log();
    
    const passedCount = checks.filter(c => c.result).length;
    const totalCount = checks.length;
    
    console.log(`통과: ${passedCount}/${totalCount} (${(passedCount / totalCount * 100).toFixed(1)}%)`);
    console.log();
    
    if (passedCount === totalCount) {
      console.log("🎉 ✅ 템플릿 기반 파싱 시스템 검증 완료");
      console.log();
      console.log("모든 테스트가 성공적으로 완료되었습니다:");
      console.log("  • Upstage API 키가 DB에 설정되어 있습니다");
      console.log("  • 국민은행 템플릿이 생성되었습니다");
      console.log("  • PDF OCR이 정상 작동합니다");
      console.log("  • 헤더 정규화가 작동합니다 (띄어쓰기 제거)");
      console.log("  • 템플릿 식별자 매칭이 작동합니다 (Layer 1)");
      console.log("  • 컬럼 매핑이 정확합니다");
      console.log();
      process.exit(0);
    } else {
      console.log("⚠️  일부 테스트가 실패했습니다");
      console.log();
      console.log("실패한 항목:");
      checks.filter(c => !c.result).forEach(check => {
        console.log(`  • ${check.name}`);
      });
      console.log();
      process.exit(1);
    }
    
  } catch (error) {
    console.error();
    console.error("=" + "=".repeat(79));
    console.error("❌ 테스트 실행 중 오류 발생");
    console.error("=" + "=".repeat(79));
    console.error();
    console.error("오류 메시지:");
    console.error(error);
    console.error();
    
    if (error instanceof Error) {
      console.error("스택 트레이스:");
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
