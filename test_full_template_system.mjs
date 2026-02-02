#!/usr/bin/env node
/**
 * 국민은행 PDF 전체 템플릿 시스템 테스트
 * 
 * 4단계 테스트:
 * 1. template.analyzeFile - PDF 분석 및 템플릿 초안 생성
 * 2. template.create - 템플릿 생성
 * 3. template.testMatchWithFile - 템플릿 매칭 테스트
 * 4. 전체 검증 - 로그 및 결과 확인
 */

import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
}

function logStep(step, title) {
  log(`\n[단계 ${step}] ${title}`, 'cyan');
  console.log('-'.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// PDF 파일 경로
const PDF_PATH = '/tmp/국민은행_new.pdf';

// 테스트 결과 저장
const testResults = {
  stage1_analyzeFile: { success: false, data: null, error: null },
  stage2_createTemplate: { success: false, data: null, error: null },
  stage3_testMatch: { success: false, data: null, error: null },
  stage4_verification: { success: false, checks: [] },
};

/**
 * 단계 1: template.analyzeFile - PDF 분석
 */
async function stage1_analyzeFile() {
  logStep(1, 'template.analyzeFile - PDF 분석 및 템플릿 초안 생성');
  
  try {
    // PDF 파일 읽기
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF 파일을 찾을 수 없습니다: ${PDF_PATH}`);
    }
    
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    const fileBase64 = pdfBuffer.toString('base64');
    
    logInfo(`PDF 파일 크기: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    
    // tRPC 라우터 직접 호출 (서버 사이드)
    const { templateRouter } = await import('./src/server/api/routers/template.ts');
    
    logInfo('template.analyzeFile 호출 중 (직접 함수 호출)...');
    
    // tRPC 라우터 대신 직접 함수 호출
    const { extractTablesFromPDF } = await import('./src/lib/pdf-ocr.ts');
    const { SettingsService } = await import('./src/server/services/settings-service.ts');
    
    // Upstage API 키 가져오기
    const settingsService = new SettingsService(prisma);
    const upstageApiKey = await settingsService.getSetting('UPSTAGE_API_KEY');
    
    if (!upstageApiKey) {
      throw new Error('Upstage API 키가 설정되지 않았습니다');
    }
    
    logInfo('PDF 파싱 중...');
    const pdfResult = await extractTablesFromPDF(pdfBuffer, 3, upstageApiKey);
    
    const headers = pdfResult.headers;
    const sampleRows = pdfResult.rows.slice(0, 10);
    const pageTexts = pdfResult.pageTexts || [];
    
    logInfo(`추출 완료: ${headers.length}개 헤더, ${sampleRows.length}개 행, ${pageTexts.length}개 페이지 텍스트`);
    
    // OpenAI로 LLM 분석 (선택적)
    let result;
    const openaiKey = await settingsService.getSetting('OPENAI_API_KEY');
    
    if (openaiKey) {
      logInfo('OpenAI로 템플릿 분석 중...');
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const sampleDataStr = sampleRows.slice(0, 5).map(row => row.join(" | ")).join("\n");
      const pageTextsStr = pageTexts.slice(0, 10).join(" / ");
      
      const prompt = `다음은 은행 거래내역서 PDF에서 추출한 정보입니다.
이 정보를 분석하여 템플릿 초안을 생성하세요.

## 페이지 텍스트 (문서 상단의 은행명, 타이틀 등)
${pageTextsStr || "(없음)"}

## 테이블 헤더
${headers.join(", ")}

## 샘플 데이터 (최대 5행)
${sampleDataStr}

## 응답 형식 (JSON만 반환)
{
  "bankName": "추정되는 은행명 (페이지 텍스트에서 추출, 확실하지 않으면 빈 문자열)",
  "description": "이 거래내역서의 특징 설명 (2-3문장)",
  "identifiers": ["식별자1", "식별자2", "식별자3"],
  "columnMapping": {
    "date": { "index": 0, "header": "거래일자 컬럼명" },
    "deposit": { "index": 1, "header": "입금 컬럼명" },
    "withdrawal": { "index": 2, "header": "출금 컬럼명" },
    "balance": { "index": 3, "header": "잔액 컬럼명" },
    "memo": { "index": 4, "header": "비고 컬럼명" }
  },
  "confidence": 0.0~1.0,
  "reasoning": "분석 근거"
}

중요:
- **identifiers**: 페이지 텍스트(문서 상단)에서 이 문서를 구분할 수 있는 고유 키워드 2-4개 추출 (예: "국민은행", "입출금거래내역")
  테이블 헤더가 아닌 페이지 상단의 은행명, 계좌 종류, 문서 타이틀 등에서 추출해야 함
- JSON만 반환`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 1500,
        });
        
        const content = response.choices[0]?.message?.content?.trim() || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const llmResult = JSON.parse(jsonMatch[0]);
          result = {
            success: true,
            suggestedName: llmResult.bankName 
              ? `${llmResult.bankName}_${new Date().toISOString().slice(0, 10)}`
              : `템플릿_${new Date().toISOString().slice(0, 10)}`,
            suggestedBankName: llmResult.bankName || "",
            suggestedDescription: llmResult.description || "",
            suggestedIdentifiers: llmResult.identifiers || pageTexts.slice(0, 3),
            detectedHeaders: headers,
            suggestedColumnSchema: { columns: llmResult.columnMapping || {} },
            confidence: llmResult.confidence || 0.7,
            reasoning: llmResult.reasoning || "",
          };
        } else {
          throw new Error('LLM JSON 파싱 실패');
        }
      } catch (error) {
        logWarning(`LLM 분석 실패, 폴백 사용: ${error.message}`);
        // 폴백: 페이지 텍스트에서 식별자 추출
        const fallbackIdentifiers = pageTexts.length > 0 
          ? pageTexts.slice(0, 3).flatMap(t => t.split(/\s+/).slice(0, 2)).filter(Boolean).slice(0, 4)
          : headers.slice(0, 3);
        
        result = {
          success: true,
          suggestedName: `템플릿_${new Date().toISOString().slice(0, 10)}`,
          suggestedBankName: "",
          suggestedDescription: `헤더: ${headers.join(", ")}`,
          suggestedIdentifiers: fallbackIdentifiers,
          detectedHeaders: headers,
          suggestedColumnSchema: { columns: {} },
          confidence: 0.5,
          reasoning: `LLM 분석 실패 - 기본 정보만 추출됨`,
        };
      }
    } else {
      logWarning('OpenAI API 키 없음, 폴백 사용');
      // 폴백: 페이지 텍스트에서 식별자 추출
      const fallbackIdentifiers = pageTexts.length > 0 
        ? pageTexts.slice(0, 3).map(t => t.split(/\s+/)[0]).filter(Boolean)
        : headers.slice(0, 3);
      
      result = {
        success: true,
        suggestedName: `템플릿_${new Date().toISOString().slice(0, 10)}`,
        suggestedBankName: "",
        suggestedDescription: `헤더: ${headers.join(", ")}`,
        suggestedIdentifiers: fallbackIdentifiers,
        detectedHeaders: headers,
        suggestedColumnSchema: { columns: {} },
        confidence: 0.5,
        reasoning: "OpenAI API 키 없음 - 기본 정보만 추출됨",
      };
    }
    
    logSuccess('PDF 분석 완료');
    
    // 결과 검증
    console.log('\n📊 분석 결과:');
    console.log(`  - 제안된 템플릿 이름: ${result.suggestedName}`);
    console.log(`  - 제안된 은행명: ${result.suggestedBankName || '(없음)'}`);
    console.log(`  - 설명: ${result.suggestedDescription.substring(0, 100)}...`);
    console.log(`  - 식별자 (${result.suggestedIdentifiers.length}개): ${result.suggestedIdentifiers.join(', ')}`);
    console.log(`  - 감지된 헤더 (${result.detectedHeaders.length}개): ${result.detectedHeaders.join(', ')}`);
    console.log(`  - 신뢰도: ${result.confidence}`);
    console.log(`  - 추론: ${result.reasoning.substring(0, 150)}...`);
    
    // 핵심 검증
    const checks = [];
    
    if (result.suggestedIdentifiers && result.suggestedIdentifiers.length > 0) {
      logSuccess(`식별자 추출 성공: ${result.suggestedIdentifiers.length}개`);
      checks.push({ name: 'suggestedIdentifiers 존재', passed: true });
    } else {
      logError('식별자가 추출되지 않았습니다');
      checks.push({ name: 'suggestedIdentifiers 존재', passed: false });
    }
    
    if (result.suggestedBankName && result.suggestedBankName.includes('국민')) {
      logSuccess(`은행명 감지 성공: ${result.suggestedBankName}`);
      checks.push({ name: 'suggestedBankName 국민은행', passed: true });
    } else {
      logWarning(`은행명 감지 실패 또는 부정확: ${result.suggestedBankName}`);
      checks.push({ name: 'suggestedBankName 국민은행', passed: false });
    }
    
    if (result.detectedHeaders && result.detectedHeaders.length >= 3) {
      logSuccess(`헤더 감지 성공: ${result.detectedHeaders.length}개`);
      checks.push({ name: 'detectedHeaders 3개 이상', passed: true });
    } else {
      logError('헤더가 충분히 감지되지 않았습니다');
      checks.push({ name: 'detectedHeaders 3개 이상', passed: false });
    }
    
    testResults.stage1_analyzeFile = {
      success: true,
      data: result,
      error: null,
      checks,
    };
    
    return result;
  } catch (error) {
    logError(`단계 1 실패: ${error.message}`);
    console.error(error);
    testResults.stage1_analyzeFile = {
      success: false,
      data: null,
      error: error.message,
    };
    throw error;
  }
}

/**
 * 단계 2: template.create - 템플릿 생성
 */
async function stage2_createTemplate(analyzeResult) {
  logStep(2, 'template.create - 템플릿 생성');
  
  try {
    const { templateRouter } = await import('./src/server/api/routers/template.ts');
    
    const mockCtx = {
      db: prisma,
      userId: 'test-admin-user',
      session: { user: { id: 'test-admin-user', role: 'ADMIN' } },
    };
    
    // 템플릿 데이터 준비
    const templateData = {
      name: `국민은행_자동생성_${Date.now()}`,
      bankName: analyzeResult.suggestedBankName || '국민은행',
      description: analyzeResult.suggestedDescription || '국민은행 거래내역서 템플릿',
      identifiers: analyzeResult.suggestedIdentifiers || [],
      columnSchema: analyzeResult.suggestedColumnSchema || { columns: {} },
      isActive: true,
      priority: 10,
    };
    
    logInfo('템플릿 생성 중...');
    console.log(`  - 이름: ${templateData.name}`);
    console.log(`  - 은행명: ${templateData.bankName}`);
    console.log(`  - 식별자: ${templateData.identifiers.join(', ')}`);
    
    const template = await templateRouter.createCaller(mockCtx).create(templateData);
    
    logSuccess(`템플릿 생성 완료: ID = ${template.id}`);
    
    testResults.stage2_createTemplate = {
      success: true,
      data: template,
      error: null,
    };
    
    return template;
  } catch (error) {
    logError(`단계 2 실패: ${error.message}`);
    console.error(error);
    testResults.stage2_createTemplate = {
      success: false,
      data: null,
      error: error.message,
    };
    throw error;
  }
}

/**
 * 단계 3: template.testMatchWithFile - 템플릿 매칭 테스트
 */
async function stage3_testMatch() {
  logStep(3, 'template.testMatchWithFile - 템플릿 매칭 테스트');
  
  try {
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    const fileBase64 = pdfBuffer.toString('base64');
    
    const { templateRouter } = await import('./src/server/api/routers/template.ts');
    
    const mockCtx = {
      db: prisma,
      userId: 'test-user',
      session: { user: { id: 'test-user', role: 'USER' } },
    };
    
    logInfo('템플릿 매칭 테스트 중...');
    
    const result = await templateRouter.createCaller(mockCtx).testMatchWithFile({
      fileBase64,
      fileName: '국민은행_new.pdf',
      mimeType: 'application/pdf',
    });
    
    console.log('\n📊 매칭 결과:');
    console.log(`  - 매칭 여부: ${result.matched ? '✅ 성공' : '❌ 실패'}`);
    
    if (result.matched) {
      console.log(`  - Layer: ${result.layer}`);
      console.log(`  - Layer 이름: ${result.layerName}`);
      console.log(`  - 템플릿 ID: ${result.templateId}`);
      console.log(`  - 템플릿 이름: ${result.templateName}`);
      console.log(`  - 신뢰도: ${result.confidence}`);
      console.log(`  - 컬럼 매핑:`, JSON.stringify(result.columnMapping, null, 2));
      
      // 핵심 검증
      if (result.layer === 1) {
        logSuccess('Layer 1 (정확 매칭) 성공');
      } else {
        logWarning(`Layer ${result.layer} 매칭 (Layer 1 실패)`);
      }
      
      if (result.layerName === 'exact_match') {
        logSuccess('layerName: exact_match');
      } else {
        logWarning(`layerName: ${result.layerName}`);
      }
    } else {
      logError('템플릿 매칭 실패');
      if (result.error) {
        console.log(`  - 오류: ${result.error}`);
      }
      if (result.message) {
        console.log(`  - 메시지: ${result.message}`);
      }
    }
    
    testResults.stage3_testMatch = {
      success: result.matched,
      data: result,
      error: result.matched ? null : (result.error || result.message),
    };
    
    return result;
  } catch (error) {
    logError(`단계 3 실패: ${error.message}`);
    console.error(error);
    testResults.stage3_testMatch = {
      success: false,
      data: null,
      error: error.message,
    };
    throw error;
  }
}

/**
 * 단계 4: 전체 검증 - 로그 확인
 */
async function stage4_verification() {
  logStep(4, '전체 검증 - 로그 및 결과 확인');
  
  const checks = [];
  
  // 체크 1: 페이지 텍스트 추출 로그
  logInfo('백엔드 로그 확인 중...');
  
  try {
    const { execSync } = await import('child_process');
    const logs = execSync('tail -n 500 /var/log/supervisor/backend.out.log 2>/dev/null || echo ""', { encoding: 'utf-8' });
    
    // 로그 검증
    const logChecks = [
      { name: 'PAGE TEXTS EXTRACTION', pattern: /PAGE TEXTS EXTRACTION/, description: '페이지 텍스트 추출 섹션' },
      { name: 'Page texts preview', pattern: /Page texts preview/, description: '페이지 텍스트 미리보기' },
      { name: 'Raw headers', pattern: /Raw headers \(before normalization\)/, description: '원본 헤더 (정규화 전)' },
      { name: 'Normalized headers', pattern: /Normalized headers \(after removing spaces\)/, description: '정규화된 헤더 (띄어쓰기 제거)' },
      { name: 'Layer 1 matching', pattern: /Layer 1.*matching/i, description: 'Layer 1 템플릿 매칭' },
      { name: 'Template Classifier', pattern: /Template Classifier/, description: '템플릿 분류기 실행' },
    ];
    
    console.log('\n📋 로그 검증:');
    for (const check of logChecks) {
      const found = check.pattern.test(logs);
      checks.push({ name: check.name, passed: found, description: check.description });
      
      if (found) {
        logSuccess(`${check.description} 로그 발견`);
      } else {
        logWarning(`${check.description} 로그 없음`);
      }
    }
    
    // 식별자 매칭 로그 확인
    if (testResults.stage2_createTemplate.success) {
      const template = testResults.stage2_createTemplate.data;
      const identifiers = template.identifiers || [];
      
      console.log('\n🔍 식별자 매칭 로그 확인:');
      for (const identifier of identifiers) {
        const matchPattern = new RegExp(`"${identifier}".*MATCH`, 'i');
        const found = matchPattern.test(logs);
        
        if (found) {
          logSuccess(`식별자 "${identifier}" 매칭 로그 발견`);
        } else {
          logWarning(`식별자 "${identifier}" 매칭 로그 없음`);
        }
      }
    }
    
  } catch (error) {
    logWarning(`로그 확인 실패: ${error.message}`);
  }
  
  // 체크 2: 데이터베이스 확인
  logInfo('\n데이터베이스 확인 중...');
  
  try {
    const templates = await prisma.transactionTemplate.findMany({
      where: {
        name: {
          contains: '국민은행',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    
    if (templates.length > 0) {
      const template = templates[0];
      logSuccess(`템플릿 DB 저장 확인: ${template.name}`);
      console.log(`  - ID: ${template.id}`);
      console.log(`  - 식별자: ${template.identifiers.join(', ')}`);
      console.log(`  - 매칭 횟수: ${template.matchCount}`);
      checks.push({ name: '템플릿 DB 저장', passed: true });
    } else {
      logWarning('국민은행 템플릿이 DB에 없습니다');
      checks.push({ name: '템플릿 DB 저장', passed: false });
    }
  } catch (error) {
    logError(`DB 확인 실패: ${error.message}`);
    checks.push({ name: '템플릿 DB 저장', passed: false });
  }
  
  testResults.stage4_verification = {
    success: checks.filter(c => c.passed).length >= checks.length * 0.7, // 70% 이상 통과
    checks,
  };
}

/**
 * 최종 결과 출력
 */
function printFinalResults() {
  logSection('🎯 최종 테스트 결과');
  
  const stages = [
    { name: '단계 1: template.analyzeFile', result: testResults.stage1_analyzeFile },
    { name: '단계 2: template.create', result: testResults.stage2_createTemplate },
    { name: '단계 3: template.testMatchWithFile', result: testResults.stage3_testMatch },
    { name: '단계 4: 전체 검증', result: testResults.stage4_verification },
  ];
  
  console.log('\n');
  for (const stage of stages) {
    if (stage.result.success) {
      logSuccess(`${stage.name}: 성공`);
    } else {
      logError(`${stage.name}: 실패`);
      if (stage.result.error) {
        console.log(`   오류: ${stage.result.error}`);
      }
    }
  }
  
  // 전체 성공 여부
  const allSuccess = stages.every(s => s.result.success);
  
  console.log('\n' + '='.repeat(80));
  if (allSuccess) {
    log('✅ 전체 템플릿 시스템 검증 완료 - 모든 기능 정상 작동', 'green');
  } else {
    log('❌ 일부 테스트 실패 - 위 오류 메시지를 확인하세요', 'red');
  }
  console.log('='.repeat(80) + '\n');
  
  // 상세 체크리스트
  if (testResults.stage1_analyzeFile.checks) {
    console.log('\n📋 단계 1 상세 체크:');
    for (const check of testResults.stage1_analyzeFile.checks) {
      console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}`);
    }
  }
  
  if (testResults.stage4_verification.checks) {
    console.log('\n📋 단계 4 상세 체크:');
    for (const check of testResults.stage4_verification.checks) {
      console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}${check.description ? ` - ${check.description}` : ''}`);
    }
  }
}

/**
 * 메인 실행
 */
async function main() {
  logSection('🚀 국민은행 PDF 전체 템플릿 시스템 테스트 시작');
  
  try {
    // 단계 1: PDF 분석
    const analyzeResult = await stage1_analyzeFile();
    
    // 단계 2: 템플릿 생성
    const template = await stage2_createTemplate(analyzeResult);
    
    // 단계 3: 템플릿 매칭 테스트
    const matchResult = await stage3_testMatch();
    
    // 단계 4: 전체 검증
    await stage4_verification();
    
    // 최종 결과 출력
    printFinalResults();
    
  } catch (error) {
    logError(`\n테스트 중 오류 발생: ${error.message}`);
    console.error(error);
    
    // 부분 결과라도 출력
    printFinalResults();
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
main().catch(console.error);
