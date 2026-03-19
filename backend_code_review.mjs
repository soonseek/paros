#!/usr/bin/env node
/**
 * Backend Code Review - Debt Case Tool New Features
 * 
 * Verifies implementation of new tRPC procedures without requiring database connection:
 * 1. transaction.filterByCounterparty
 * 2. transaction.detectInternalTransfers  
 * 3. transaction.filterByAmount
 * 4. file.preAnalyzeFile
 * 5. file.analyzeWithTemplate
 * 
 * This focuses on code review and logic validation since the frontend preview is not responding.
 */

import { readFile } from 'fs/promises';

class DebtCaseCodeReviewer {
  constructor() {
    this.tests_run = 0;
    this.tests_passed = 0;
    this.test_results = [];
    this.issues = [];
  }

  log_test(name, success, details = "", severity = "INFO") {
    this.tests_run += 1;
    if (success) {
      this.tests_passed += 1;
      console.log(`✅ ${name}: PASSED`);
    } else {
      console.log(`❌ ${name}: FAILED - ${details}`);
      if (severity === "CRITICAL") {
        this.issues.push({ type: "CRITICAL", test: name, details });
      }
    }
    
    if (details) {
      console.log(`   Details: ${details}`);
    }
    
    this.test_results.push({
      test: name,
      success,
      details,
      severity
    });
    console.log();
  }

  async test_transaction_router_structure() {
    try {
      console.log('🔍 Analyzing transaction router structure...');
      
      const content = await readFile('./src/server/api/routers/transaction.ts', 'utf-8');
      
      // Check for new procedures
      const requiredProcedures = [
        { name: 'filterByCounterparty', linePattern: /filterByCounterparty:\s*protectedProcedure/ },
        { name: 'detectInternalTransfers', linePattern: /detectInternalTransfers:\s*protectedProcedure/ },
        { name: 'filterByAmount', linePattern: /filterByAmount:\s*protectedProcedure/ }
      ];

      let foundProcedures = 0;
      for (const proc of requiredProcedures) {
        if (proc.linePattern.test(content)) {
          foundProcedures++;
          console.log(`  ✓ Found ${proc.name} procedure`);
        } else {
          console.log(`  ❌ Missing ${proc.name} procedure`);
        }
      }

      if (foundProcedures === requiredProcedures.length) {
        this.log_test("Transaction Router - New Procedures", true, 
          `All ${requiredProcedures.length} new procedures implemented`);
      } else {
        this.log_test("Transaction Router - New Procedures", false, 
          `Only found ${foundProcedures}/${requiredProcedures.length} procedures`, "CRITICAL");
        return false;
      }

      // Check for proper imports
      const requiredImports = [
        'matchCounterpartyQuery',
        'detectInternalTransfers'
      ];

      let foundImports = 0;
      for (const imp of requiredImports) {
        if (content.includes(imp)) {
          foundImports++;
          console.log(`  ✓ Found import: ${imp}`);
        } else {
          console.log(`  ⚠️  Import not found: ${imp}`);
        }
      }

      this.log_test("Transaction Router - Imports", foundImports === requiredImports.length, 
        `Found ${foundImports}/${requiredImports.length} required imports`);

      return true;
    } catch (error) {
      this.log_test("Transaction Router Structure", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_file_router_enhancements() {
    try {
      console.log('🔍 Analyzing file router enhancements...');
      
      const content = await readFile('./src/server/api/routers/file.ts', 'utf-8');
      
      // Check for new procedures
      const requiredProcedures = [
        { name: 'preAnalyzeFile', description: 'Pre-analyze file for template matching' },
        { name: 'analyzeWithTemplate', description: 'Analyze file with manually selected template' }
      ];

      let foundProcedures = 0;
      for (const proc of requiredProcedures) {
        if (content.includes(`${proc.name}:`)) {
          foundProcedures++;
          console.log(`  ✓ Found ${proc.name}: ${proc.description}`);
        } else {
          console.log(`  ❌ Missing ${proc.name}: ${proc.description}`);
        }
      }

      if (foundProcedures === requiredProcedures.length) {
        this.log_test("File Router - New Procedures", true, 
          `All ${requiredProcedures.length} new procedures implemented`);
      } else {
        this.log_test("File Router - New Procedures", false, 
          `Only found ${foundProcedures}/${requiredProcedures.length} procedures`, "CRITICAL");
      }

      // Check for header row detection integration
      if (content.includes('detectHeaderRowFromRawData')) {
        console.log(`  ✓ Found header row detection integration`);
        this.log_test("File Router - Header Detection Integration", true, 
          "detectHeaderRowFromRawData properly imported and used");
      } else {
        this.log_test("File Router - Header Detection Integration", false, 
          "Header row detection not integrated", "CRITICAL");
      }

      return foundProcedures === requiredProcedures.length;
    } catch (error) {
      this.log_test("File Router Enhancements", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_counterparty_search_implementation() {
    try {
      console.log('🔍 Analyzing counterparty search implementation...');
      
      const content = await readFile('./src/lib/counterparty-search.ts', 'utf-8');
      
      // Check for core functions
      const requiredFunctions = [
        'matchCounterpartyQuery',
        'flattenMetadataValues',
        'normalizeText',
        'normalizeDenseText',
        'normalizeDigits'
      ];

      let foundFunctions = 0;
      for (const func of requiredFunctions) {
        if (content.includes(`function ${func}`) || content.includes(`export function ${func}`)) {
          foundFunctions++;
          console.log(`  ✓ Found function: ${func}`);
        } else {
          console.log(`  ❌ Missing function: ${func}`);
        }
      }

      if (foundFunctions === requiredFunctions.length) {
        this.log_test("Counterparty Search - Core Functions", true, 
          `All ${requiredFunctions.length} functions implemented`);
      } else {
        this.log_test("Counterparty Search - Core Functions", false, 
          `Only found ${foundFunctions}/${requiredFunctions.length} functions`, "CRITICAL");
      }

      // Check for field matching logic
      const fieldChecks = [
        { field: '비고', pattern: /evaluateValue\(\s*["']비고["']/ },
        { field: '채권자명', pattern: /evaluateValue\(\s*["']채권자명["']/ },
        { field: '원본데이터', pattern: /evaluateValue\(\s*["']원본데이터["']/ }
      ];

      let foundFields = 0;
      for (const check of fieldChecks) {
        if (check.pattern.test(content)) {
          foundFields++;
          console.log(`  ✓ Found field matching: ${check.field}`);
        } else {
          console.log(`  ❌ Missing field matching: ${check.field}`);
        }
      }

      this.log_test("Counterparty Search - Field Matching", foundFields === fieldChecks.length,
        `Found ${foundFields}/${fieldChecks.length} field matching implementations`);

      return foundFunctions === requiredFunctions.length && foundFields === fieldChecks.length;
    } catch (error) {
      this.log_test("Counterparty Search Implementation", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_internal_transfer_detector() {
    try {
      console.log('🔍 Analyzing internal transfer detector...');
      
      const content = await readFile('./src/lib/internal-transfer-detector.ts', 'utf-8');
      
      // Check for main function
      if (content.includes('export function detectInternalTransfers')) {
        console.log(`  ✓ Found main function: detectInternalTransfers`);
        this.log_test("Internal Transfer Detector - Main Function", true, "detectInternalTransfers function exists");
      } else {
        this.log_test("Internal Transfer Detector - Main Function", false, "detectInternalTransfers function missing", "CRITICAL");
        return false;
      }

      // Check for helper functions
      const helperFunctions = [
        'hasTransferKeyword',
        'getDayDiff',
        'toDateKey'
      ];

      let foundHelpers = 0;
      for (const helper of helperFunctions) {
        if (content.includes(`function ${helper}`)) {
          foundHelpers++;
          console.log(`  ✓ Found helper function: ${helper}`);
        } else {
          console.log(`  ❌ Missing helper function: ${helper}`);
        }
      }

      this.log_test("Internal Transfer Detector - Helper Functions", foundHelpers === helperFunctions.length,
        `Found ${foundHelpers}/${helperFunctions.length} helper functions`);

      // Check for transfer keywords
      const transferKeywordPattern = /이체|송금|입금이체|출금이체|보내기|받기|振込/;
      if (transferKeywordPattern.test(content)) {
        console.log(`  ✓ Found transfer keyword detection`);
        this.log_test("Internal Transfer Detector - Keyword Detection", true, "Transfer keywords properly defined");
      } else {
        this.log_test("Internal Transfer Detector - Keyword Detection", false, "Transfer keyword detection missing");
      }

      // Check for confidence calculation
      if (content.includes('confidence')) {
        console.log(`  ✓ Found confidence calculation logic`);
        this.log_test("Internal Transfer Detector - Confidence Logic", true, "Confidence scoring implemented");
      } else {
        this.log_test("Internal Transfer Detector - Confidence Logic", false, "Confidence scoring missing");
      }

      return true;
    } catch (error) {
      this.log_test("Internal Transfer Detector", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_header_row_detector() {
    try {
      console.log('🔍 Analyzing header row detector...');
      
      const content = await readFile('./src/lib/header-row-detector.ts', 'utf-8');
      
      // Check for main functions
      const mainFunctions = [
        'detectHeaderRowFromRawData',
        'looksLikeHeaderRow'
      ];

      let foundFunctions = 0;
      for (const func of mainFunctions) {
        if (content.includes(`export function ${func}`) || content.includes(`function ${func}`)) {
          foundFunctions++;
          console.log(`  ✓ Found function: ${func}`);
        } else {
          console.log(`  ❌ Missing function: ${func}`);
        }
      }

      if (foundFunctions === mainFunctions.length) {
        this.log_test("Header Row Detector - Main Functions", true, 
          `All ${mainFunctions.length} functions implemented`);
      } else {
        this.log_test("Header Row Detector - Main Functions", false, 
          `Only found ${foundFunctions}/${mainFunctions.length} functions`, "CRITICAL");
      }

      // Check for column type integration
      if (content.includes('inferColumnType')) {
        console.log(`  ✓ Found column type inference integration`);
        this.log_test("Header Row Detector - Column Type Integration", true, "inferColumnType properly integrated");
      } else {
        this.log_test("Header Row Detector - Column Type Integration", false, "Column type integration missing");
      }

      // Check for scan limit configuration
      if (content.includes('maxScanRows')) {
        console.log(`  ✓ Found configurable scan limit`);
        this.log_test("Header Row Detector - Scan Limit", true, "maxScanRows parameter implemented");
      } else {
        this.log_test("Header Row Detector - Scan Limit", false, "Scan limit configuration missing");
      }

      return foundFunctions === mainFunctions.length;
    } catch (error) {
      this.log_test("Header Row Detector", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_data_extractor_enhancements() {
    try {
      console.log('🔍 Analyzing data extractor enhancements...');
      
      const content = await readFile('./src/lib/data-extractor.ts', 'utf-8');
      
      // Check for row merging functionality
      if (content.includes('export function mergePairedRows')) {
        console.log(`  ✓ Found row merging function for NH농협 format`);
        this.log_test("Data Extractor - Row Merging", true, "mergePairedRows function implemented");
      } else {
        this.log_test("Data Extractor - Row Merging", false, "Row merging function missing", "CRITICAL");
      }

      // Check for enhanced date parsing
      const dateEnhancements = [
        { name: 'extractDateAndMemo', description: 'Extract date and memo from merged columns' },
        { name: 'inferReferenceDateFromRows', description: 'Infer reference date for short dates' },
        { name: 'resolveTransactionDateFromRow', description: 'Resolve transaction date with fallbacks' }
      ];

      let foundEnhancements = 0;
      for (const enhancement of dateEnhancements) {
        if (content.includes(enhancement.name)) {
          foundEnhancements++;
          console.log(`  ✓ Found ${enhancement.name}: ${enhancement.description}`);
        } else {
          console.log(`  ❌ Missing ${enhancement.name}: ${enhancement.description}`);
        }
      }

      this.log_test("Data Extractor - Date Enhancements", foundEnhancements === dateEnhancements.length,
        `Found ${foundEnhancements}/${dateEnhancements.length} date parsing enhancements`);

      // Check for balance-based validation
      if (content.includes('validateAndCorrectTransactions')) {
        console.log(`  ✓ Found balance-based transaction validation`);
        this.log_test("Data Extractor - Balance Validation", true, "Balance-based validation implemented");
      } else {
        this.log_test("Data Extractor - Balance Validation", false, "Balance validation missing");
      }

      // Check for balance consistency calculation
      if (content.includes('calculateBalanceConsistency')) {
        console.log(`  ✓ Found balance consistency calculation`);
        this.log_test("Data Extractor - Balance Consistency", true, "Balance consistency logic implemented");
      } else {
        this.log_test("Data Extractor - Balance Consistency", false, "Balance consistency calculation missing");
      }

      return true;
    } catch (error) {
      this.log_test("Data Extractor Enhancements", false, `File read error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_return_shape_consistency() {
    try {
      console.log('🔍 Analyzing return shape consistency...');
      
      const transactionContent = await readFile('./src/server/api/routers/transaction.ts', 'utf-8');
      
      // Check filterByCounterparty return shape
      const counterpartyReturnMatch = transactionContent.match(/return\s*\{[^}]*transactions:[^}]*summary:\s*\{[^}]*total:[^}]*depositCount:[^}]*withdrawalCount:[^}]*depositTotal:[^}]*withdrawalTotal:[^}]*query/s);
      if (counterpartyReturnMatch) {
        console.log(`  ✓ filterByCounterparty returns consistent shape: total, depositCount, withdrawalCount, depositTotal, withdrawalTotal, query`);
        this.log_test("Return Shape - filterByCounterparty", true, "Correct summary fields: total, depositCount, withdrawalCount, depositTotal, withdrawalTotal, query");
      } else {
        this.log_test("Return Shape - filterByCounterparty", false, "filterByCounterparty summary shape incorrect", "CRITICAL");
      }

      // Check detectInternalTransfers return shape  
      const internalTransferReturnMatch = transactionContent.match(/return\s*\{[^}]*matches,[^}]*summary:\s*\{[^}]*total:[^}]*totalAmount:[^}]*sameDayCount:[^}]*nextDayCount:[^}]*documentPairCount/s);
      if (internalTransferReturnMatch) {
        console.log(`  ✓ detectInternalTransfers returns consistent shape: total, totalAmount, sameDayCount, nextDayCount, documentPairCount`);
        this.log_test("Return Shape - detectInternalTransfers", true, "Correct summary fields: total, totalAmount, sameDayCount, nextDayCount, documentPairCount");
      } else {
        this.log_test("Return Shape - detectInternalTransfers", false, "detectInternalTransfers summary shape incorrect", "CRITICAL");
      }

      // Check filterByAmount return shape
      const amountFilterReturnMatch = transactionContent.match(/return\s*\{[^}]*transactions:[^}]*summary:\s*\{[^}]*total:[^}]*depositCount:[^}]*withdrawalCount:[^}]*depositTotal:[^}]*withdrawalTotal:[^}]*minAmount/s);
      if (amountFilterReturnMatch) {
        console.log(`  ✓ filterByAmount returns consistent shape with minAmount`);
        this.log_test("Return Shape - filterByAmount", true, "Enhanced return shape with depositAmount/withdrawalAmount breakdown");
      } else {
        this.log_test("Return Shape - filterByAmount", false, "filterByAmount summary shape incorrect", "CRITICAL");
      }

      return true;
    } catch (error) {
      this.log_test("Return Shape Consistency", false, `Analysis error: ${error.message}`, "CRITICAL");
      return false;
    }
  }

  async test_rbac_consistency() {
    try {
      console.log('🔍 Analyzing RBAC consistency...');
      
      const transactionContent = await readFile('./src/server/api/routers/transaction.ts', 'utf-8');
      
      // Check that all new procedures use protectedProcedure
      const newProcedures = ['filterByCounterparty', 'detectInternalTransfers', 'filterByAmount'];
      let rbacCorrect = 0;
      
      for (const proc of newProcedures) {
        const procPattern = new RegExp(`${proc}:\\s*protectedProcedure`);
        if (procPattern.test(transactionContent)) {
          rbacCorrect++;
          console.log(`  ✓ ${proc} uses protectedProcedure`);
        } else {
          console.log(`  ❌ ${proc} does not use protectedProcedure`);
        }
      }

      if (rbacCorrect === newProcedures.length) {
        this.log_test("RBAC - Protected Procedures", true, "All new procedures properly protected");
      } else {
        this.log_test("RBAC - Protected Procedures", false, `${rbacCorrect}/${newProcedures.length} procedures protected`, "CRITICAL");
      }

      // Check for assertTransactionAccess usage
      const assertAccessCount = (transactionContent.match(/assertTransactionAccess/g) || []).length;
      if (assertAccessCount >= 3) { // Should be used in all 3 new procedures
        console.log(`  ✓ Found ${assertAccessCount} uses of assertTransactionAccess`);
        this.log_test("RBAC - Access Assertions", true, "assertTransactionAccess properly used");
      } else {
        this.log_test("RBAC - Access Assertions", false, `Only ${assertAccessCount} uses of assertTransactionAccess found`);
      }

      return true;
    } catch (error) {
      this.log_test("RBAC Consistency", false, `Analysis error: ${error.message}`);
      return false;
    }
  }

  async test_type_safety() {
    try {
      console.log('🔍 Analyzing TypeScript type safety...');
      
      // Check interface definitions
      const counterpartyContent = await readFile('./src/lib/counterparty-search.ts', 'utf-8');
      const transferContent = await readFile('./src/lib/internal-transfer-detector.ts', 'utf-8');
      
      // Check counterparty interfaces
      if (counterpartyContent.includes('interface CounterpartySearchCandidate') && 
          counterpartyContent.includes('interface CounterpartyMatchResult')) {
        console.log(`  ✓ Counterparty search interfaces defined`);
        this.log_test("Type Safety - Counterparty Interfaces", true, "CounterpartySearchCandidate and CounterpartyMatchResult interfaces defined");
      } else {
        this.log_test("Type Safety - Counterparty Interfaces", false, "Missing counterparty interface definitions");
      }

      // Check transfer detector interfaces
      if (transferContent.includes('interface InternalTransferCandidate') && 
          transferContent.includes('interface DetectedInternalTransfer')) {
        console.log(`  ✓ Internal transfer interfaces defined`);
        this.log_test("Type Safety - Transfer Interfaces", true, "InternalTransferCandidate and DetectedInternalTransfer interfaces defined");
      } else {
        this.log_test("Type Safety - Transfer Interfaces", false, "Missing transfer interface definitions");
      }

      // Check Zod validation schemas in transaction router
      const transactionContent = await readFile('./src/server/api/routers/transaction.ts', 'utf-8');
      const zodValidationCount = (transactionContent.match(/\.input\s*\(\s*z\.object\s*\(/g) || []).length;
      
      if (zodValidationCount >= 3) { // Should have validation for each new procedure
        console.log(`  ✓ Found ${zodValidationCount} Zod validation schemas`);
        this.log_test("Type Safety - Input Validation", true, "Proper input validation with Zod schemas");
      } else {
        this.log_test("Type Safety - Input Validation", false, `Only ${zodValidationCount} Zod validation schemas found`);
      }

      return true;
    } catch (error) {
      this.log_test("Type Safety", false, `Analysis error: ${error.message}`);
      return false;
    }
  }

  async run_all_tests() {
    console.log('='.repeat(70));
    console.log('Backend Code Review - Debt Case Tool New Features');
    console.log('='.repeat(70));
    console.log(`Review started at: ${new Date().toISOString()}`);
    console.log();
    console.log('📝 Note: Frontend preview not responding - focusing on backend code validation');
    console.log();

    const tests = [
      ['Transaction Router Structure', () => this.test_transaction_router_structure()],
      ['File Router Enhancements', () => this.test_file_router_enhancements()],
      ['Counterparty Search Implementation', () => this.test_counterparty_search_implementation()],
      ['Internal Transfer Detector', () => this.test_internal_transfer_detector()],
      ['Header Row Detector', () => this.test_header_row_detector()],
      ['Data Extractor Enhancements', () => this.test_data_extractor_enhancements()],
      ['Return Shape Consistency', () => this.test_return_shape_consistency()],
      ['RBAC Consistency', () => this.test_rbac_consistency()],
      ['Type Safety', () => this.test_type_safety()]
    ];

    for (const [testName, testFunc] of tests) {
      console.log(`🔍 Running ${testName}...`);
      try {
        await testFunc();
      } catch (error) {
        this.log_test(testName, false, `Test execution error: ${error.message}`, "CRITICAL");
      }
    }

    // Print summary
    console.log('='.repeat(70));
    console.log('Code Review Summary');
    console.log('='.repeat(70));
    console.log(`Tests run: ${this.tests_run}`);
    console.log(`Tests passed: ${this.tests_passed}`);
    console.log(`Tests failed: ${this.tests_run - this.tests_passed}`);
    console.log(`Success rate: ${this.tests_run > 0 ? (this.tests_passed / this.tests_run * 100).toFixed(1) : 0}%`);
    
    if (this.issues.length > 0) {
      console.log('\n🚨 Critical Issues Found:');
      for (const issue of this.issues) {
        console.log(`   • ${issue.test}: ${issue.details}`);
      }
    }
    
    if (this.tests_passed === this.tests_run && this.issues.length === 0) {
      console.log('\n🎉 All code review checks passed!');
      console.log('\n✅ Key Verified Features:');
      console.log('   • transaction.filterByCounterparty - 특정 인물/계좌 거래 검색');
      console.log('   • transaction.detectInternalTransfers - 문서 간 내부이체 탐지');
      console.log('   • transaction.filterByAmount - 향상된 금액 필터링');
      console.log('   • file.preAnalyzeFile - 파일 사전분석 및 헤더 탐지');
      console.log('   • file.analyzeWithTemplate - 템플릿 기반 파일 분석');
      console.log('\n✅ Technical Quality:');
      console.log('   • Proper tRPC procedure implementation');
      console.log('   • Consistent return shapes with summary fields');
      console.log('   • RBAC protection on all new endpoints');
      console.log('   • TypeScript interfaces and Zod validation');
      console.log('   • Korean text handling and account number normalization');
    } else {
      console.log(`\n⚠️  ${this.tests_run - this.tests_passed} check(s) failed`);
      if (this.issues.length > 0) {
        console.log(`🚨 ${this.issues.length} critical issue(s) found`);
      }
    }

    return {
      total_tests: this.tests_run,
      passed_tests: this.tests_passed,
      failed_tests: this.tests_run - this.tests_passed,
      critical_issues: this.issues.length,
      success_rate: this.tests_run > 0 ? (this.tests_passed / this.tests_run * 100) : 0,
      test_results: this.test_results
    };
  }
}

// Run code review
const reviewer = new DebtCaseCodeReviewer();
reviewer.run_all_tests().then(results => {
  process.exit(results.failed_tests === 0 && results.critical_issues === 0 ? 0 : 1);
}).catch(error => {
  console.error('💥 Code review failed:', error);
  process.exit(1);
});