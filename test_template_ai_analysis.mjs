#!/usr/bin/env node
/**
 * Template AI Analysis Test Script
 * 
 * Tests the template.analyzeFile endpoint with 국민은행_new.pdf
 * Verifies identifier extraction from page texts (not just table headers)
 */

import { readFileSync } from 'fs';
import { db } from './src/server/db.ts';

const prisma = db;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bold');
  console.log('='.repeat(80));
}

async function checkApiKeys() {
  section('Step 1: API Key Configuration Check');
  
  // Check database
  log('Checking database for API keys...', 'cyan');
  const upstageKey = await prisma.systemSettings.findUnique({
    where: { key: 'UPSTAGE_API_KEY' }
  });
  const openaiKey = await prisma.systemSettings.findUnique({
    where: { key: 'OPENAI_API_KEY' }
  });
  
  log(`  Database - UPSTAGE_API_KEY: ${upstageKey ? '✅ Found' : '❌ Not found'}`, upstageKey ? 'green' : 'red');
  log(`  Database - OPENAI_API_KEY: ${openaiKey ? '✅ Found' : '❌ Not found'}`, openaiKey ? 'green' : 'red');
  
  // Check .env file
  log('\nChecking .env file...', 'cyan');
  const envContent = readFileSync('/app/.env', 'utf-8');
  const upstageEnv = envContent.match(/UPSTAGE_API_KEY="([^"]+)"/)?.[1];
  const openaiEnv = envContent.match(/OPENAI_API_KEY="([^"]+)"/)?.[1];
  
  const isUpstageValid = upstageEnv && upstageEnv !== 'your-upstage-api-key';
  const isOpenaiValid = openaiEnv && openaiEnv !== 'your-openai-api-key';
  
  log(`  .env - UPSTAGE_API_KEY: ${isUpstageValid ? '✅ Valid' : '❌ Placeholder'}`, isUpstageValid ? 'green' : 'red');
  log(`  .env - OPENAI_API_KEY: ${isOpenaiValid ? '✅ Valid' : '❌ Placeholder'}`, isOpenaiValid ? 'green' : 'red');
  
  return {
    upstageInDb: !!upstageKey,
    openaiInDb: !!openaiKey,
    upstageInEnv: isUpstageValid,
    openaiInEnv: isOpenaiValid,
    upstageEnvValue: upstageEnv,
    openaiEnvValue: openaiEnv,
  };
}

async function insertApiKeysIfNeeded(keyStatus) {
  section('Step 2: API Key Database Insertion');
  
  if (keyStatus.upstageInEnv && !keyStatus.upstageInDb) {
    log('Inserting UPSTAGE_API_KEY into database...', 'cyan');
    try {
      await prisma.systemSettings.create({
        data: {
          key: 'UPSTAGE_API_KEY',
          value: keyStatus.upstageEnvValue,
          category: 'AI',
          isEncrypted: true,
          updatedAt: new Date(),
        }
      });
      log('  ✅ UPSTAGE_API_KEY inserted successfully', 'green');
    } catch (error) {
      log(`  ❌ Failed to insert: ${error.message}`, 'red');
    }
  } else if (keyStatus.upstageInDb) {
    log('  ℹ️  UPSTAGE_API_KEY already in database', 'blue');
  } else {
    log('  ⚠️  UPSTAGE_API_KEY not valid in .env - skipping insertion', 'yellow');
  }
  
  if (keyStatus.openaiInEnv && !keyStatus.openaiInDb) {
    log('\nInserting OPENAI_API_KEY into database...', 'cyan');
    try {
      await prisma.systemSettings.create({
        data: {
          key: 'OPENAI_API_KEY',
          value: keyStatus.openaiEnvValue,
          category: 'AI',
          isEncrypted: true,
          updatedAt: new Date(),
        }
      });
      log('  ✅ OPENAI_API_KEY inserted successfully', 'green');
    } catch (error) {
      log(`  ❌ Failed to insert: ${error.message}`, 'red');
    }
  } else if (keyStatus.openaiInDb) {
    log('  ℹ️  OPENAI_API_KEY already in database', 'blue');
  } else {
    log('  ⚠️  OPENAI_API_KEY not valid in .env - skipping insertion', 'yellow');
  }
}

async function testAnalyzeFile() {
  section('Step 3: Testing template.analyzeFile API');
  
  // Check if PDF exists
  const pdfPath = '/tmp/국민은행_new.pdf';
  log(`Checking PDF file: ${pdfPath}`, 'cyan');
  
  let pdfBuffer;
  try {
    pdfBuffer = readFileSync(pdfPath);
    log(`  ✅ PDF file found (${pdfBuffer.length} bytes)`, 'green');
  } catch (error) {
    log(`  ❌ PDF file not found: ${error.message}`, 'red');
    return null;
  }
  
  // Get admin user for authentication
  log('\nFinding admin user...', 'cyan');
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });
  
  if (!adminUser) {
    log('  ❌ No admin user found in database', 'red');
    return null;
  }
  log(`  ✅ Admin user found: ${adminUser.email}`, 'green');
  
  // Import the template router and create context
  log('\nCalling template.analyzeFile...', 'cyan');
  
  try {
    // Import the necessary modules
    const { templateRouter } = await import('./src/server/api/routers/template.ts');
    
    // Create a mock context
    const ctx = {
      db: prisma,
      userId: adminUser.id,
      session: {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
        }
      }
    };
    
    // Convert PDF to base64
    const fileBase64 = pdfBuffer.toString('base64');
    
    // Call the analyzeFile mutation
    const input = {
      fileBase64,
      fileName: '국민은행_new.pdf',
      mimeType: 'application/pdf',
    };
    
    log('  Calling analyzeFile mutation...', 'cyan');
    const result = await templateRouter.createCaller(ctx).analyzeFile(input);
    
    return result;
  } catch (error) {
    log(`  ❌ API call failed: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    return null;
  }
}

function validateResult(result) {
  section('Step 4: Validation Results');
  
  if (!result) {
    log('❌ No result to validate', 'red');
    return false;
  }
  
  log('Response structure:', 'cyan');
  console.log(JSON.stringify(result, null, 2));
  
  let allPassed = true;
  
  // Check success flag
  log('\n1. Success Flag:', 'cyan');
  if (result.success) {
    log('  ✅ success: true', 'green');
  } else {
    log('  ❌ success: false', 'red');
    allPassed = false;
  }
  
  // Check suggestedIdentifiers
  log('\n2. Identifier Extraction:', 'cyan');
  if (result.suggestedIdentifiers && Array.isArray(result.suggestedIdentifiers)) {
    if (result.suggestedIdentifiers.length > 0) {
      log(`  ✅ suggestedIdentifiers: ${result.suggestedIdentifiers.length} items`, 'green');
      result.suggestedIdentifiers.forEach((id, idx) => {
        log(`     [${idx + 1}] "${id}"`, 'blue');
      });
      
      // Check if identifiers are from page text (not table headers)
      const detectedHeaders = result.detectedHeaders || [];
      const identifiersFromHeaders = result.suggestedIdentifiers.filter(id => 
        detectedHeaders.some(h => h.includes(id) || id.includes(h))
      );
      
      if (identifiersFromHeaders.length < result.suggestedIdentifiers.length) {
        log(`  ✅ Identifiers extracted from page text (not just headers)`, 'green');
      } else {
        log(`  ⚠️  Warning: Most identifiers seem to be from table headers`, 'yellow');
      }
    } else {
      log('  ❌ suggestedIdentifiers is empty', 'red');
      allPassed = false;
    }
  } else {
    log('  ❌ suggestedIdentifiers missing or invalid', 'red');
    allPassed = false;
  }
  
  // Check suggestedBankName
  log('\n3. Bank Name Detection:', 'cyan');
  if (result.suggestedBankName) {
    log(`  ✅ suggestedBankName: "${result.suggestedBankName}"`, 'green');
  } else {
    log('  ⚠️  suggestedBankName is empty (may be expected if LLM couldn\'t detect)', 'yellow');
  }
  
  // Check suggestedDescription
  log('\n4. Description Generation:', 'cyan');
  if (result.suggestedDescription) {
    log(`  ✅ suggestedDescription: "${result.suggestedDescription.substring(0, 100)}..."`, 'green');
  } else {
    log('  ⚠️  suggestedDescription is empty', 'yellow');
  }
  
  // Check detectedHeaders
  log('\n5. Header Detection:', 'cyan');
  if (result.detectedHeaders && result.detectedHeaders.length > 0) {
    log(`  ✅ detectedHeaders: ${result.detectedHeaders.length} headers`, 'green');
    log(`     Headers: ${result.detectedHeaders.join(', ')}`, 'blue');
  } else {
    log('  ❌ detectedHeaders missing or empty', 'red');
    allPassed = false;
  }
  
  // Check suggestedColumnSchema
  log('\n6. Column Schema:', 'cyan');
  if (result.suggestedColumnSchema && result.suggestedColumnSchema.columns) {
    const columnCount = Object.keys(result.suggestedColumnSchema.columns).length;
    log(`  ✅ suggestedColumnSchema: ${columnCount} columns mapped`, 'green');
    Object.entries(result.suggestedColumnSchema.columns).forEach(([key, value]) => {
      log(`     ${key}: ${JSON.stringify(value)}`, 'blue');
    });
  } else {
    log('  ⚠️  suggestedColumnSchema is empty or invalid', 'yellow');
  }
  
  // Check confidence
  log('\n7. Confidence Score:', 'cyan');
  if (typeof result.confidence === 'number') {
    log(`  ✅ confidence: ${result.confidence}`, 'green');
  } else {
    log('  ⚠️  confidence missing', 'yellow');
  }
  
  // Check reasoning
  log('\n8. Reasoning:', 'cyan');
  if (result.reasoning) {
    log(`  ✅ reasoning: "${result.reasoning}"`, 'green');
  } else {
    log('  ⚠️  reasoning missing', 'yellow');
  }
  
  return allPassed;
}

async function checkBackendLogs() {
  section('Step 5: Backend Log Analysis');
  
  log('Checking backend logs for key indicators...', 'cyan');
  
  try {
    const { execSync } = await import('child_process');
    const logs = execSync('tail -n 200 /var/log/supervisor/backend.out.log', { encoding: 'utf-8' });
    
    // Check for key log messages
    const indicators = [
      { pattern: /\[Template Analyze\] Extracted \d+ headers, \d+ rows, \d+ page texts/, label: 'Extraction summary' },
      { pattern: /\[Upstage API\] ========== PAGE TEXTS EXTRACTION ==========/, label: 'Page texts section' },
      { pattern: /\[Template Analyze\] Page texts preview:/, label: 'Page texts preview' },
      { pattern: /\[Upstage API\] Extracted \d+ page text elements/, label: 'Page text count' },
    ];
    
    log('\nLog indicators found:', 'cyan');
    indicators.forEach(({ pattern, label }) => {
      const found = pattern.test(logs);
      log(`  ${found ? '✅' : '❌'} ${label}`, found ? 'green' : 'red');
      
      if (found) {
        const match = logs.match(pattern);
        if (match) {
          log(`     "${match[0]}"`, 'blue');
        }
      }
    });
    
    // Show recent Template Analyze logs
    log('\nRecent Template Analyze logs:', 'cyan');
    const templateLogs = logs.split('\n').filter(line => line.includes('[Template Analyze]'));
    templateLogs.slice(-10).forEach(line => {
      console.log(`  ${line}`);
    });
    
    // Show recent Upstage API logs
    log('\nRecent Upstage API logs:', 'cyan');
    const upstageLogs = logs.split('\n').filter(line => line.includes('[Upstage API]'));
    upstageLogs.slice(-10).forEach(line => {
      console.log(`  ${line}`);
    });
    
  } catch (error) {
    log(`  ⚠️  Could not read backend logs: ${error.message}`, 'yellow');
  }
}

async function main() {
  try {
    log('\n🚀 Template AI Analysis Test - 국민은행_new.pdf', 'bold');
    log('Testing identifier extraction from page texts\n', 'cyan');
    
    // Step 1: Check API keys
    const keyStatus = await checkApiKeys();
    
    // Step 2: Insert API keys if needed
    await insertApiKeysIfNeeded(keyStatus);
    
    // Check if we can proceed
    const canProceed = keyStatus.upstageInEnv || keyStatus.upstageInDb;
    
    if (!canProceed) {
      section('❌ CRITICAL BLOCKER');
      log('Cannot proceed with testing - UPSTAGE_API_KEY is required', 'red');
      log('\nTo fix this:', 'yellow');
      log('1. Obtain API key from: https://console.upstage.ai/api-keys', 'yellow');
      log('2. Update /app/.env file: UPSTAGE_API_KEY="your-actual-key"', 'yellow');
      log('3. Run this test again', 'yellow');
      log('\nOr insert directly into database:', 'yellow');
      log('PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d paros -c "', 'yellow');
      log('INSERT INTO system_settings (key, value, category, \\"isEncrypted\\", \\"updatedAt\\")', 'yellow');
      log('VALUES (\'UPSTAGE_API_KEY\', \'your-actual-key\', \'AI\', true, NOW())', 'yellow');
      log('ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \\"updatedAt\\" = NOW();"', 'yellow');
      process.exit(1);
    }
    
    if (!keyStatus.openaiInEnv && !keyStatus.openaiInDb) {
      log('\n⚠️  WARNING: OPENAI_API_KEY not configured', 'yellow');
      log('The test will use fallback logic (basic identifier extraction)', 'yellow');
      log('For full LLM analysis, configure OPENAI_API_KEY', 'yellow');
    }
    
    // Step 3: Test the API
    const result = await testAnalyzeFile();
    
    if (!result) {
      section('❌ TEST FAILED');
      log('API call did not return a result', 'red');
      await checkBackendLogs();
      process.exit(1);
    }
    
    // Step 4: Validate results
    const isValid = validateResult(result);
    
    // Step 5: Check backend logs
    await checkBackendLogs();
    
    // Final summary
    section('📊 Test Summary');
    if (isValid && result.suggestedIdentifiers && result.suggestedIdentifiers.length > 0) {
      log('✅ 템플릿 AI 분석 검증 완료 - 식별자 추출 성공', 'green');
      log('\nKey achievements:', 'cyan');
      log(`  ✅ PDF parsed successfully`, 'green');
      log(`  ✅ ${result.suggestedIdentifiers.length} identifiers extracted`, 'green');
      log(`  ✅ ${result.detectedHeaders?.length || 0} headers detected`, 'green');
      log(`  ✅ Template schema generated`, 'green');
    } else {
      log('❌ 템플릿 AI 분석 검증 실패', 'red');
      log('\nIssues found:', 'yellow');
      if (!result.suggestedIdentifiers || result.suggestedIdentifiers.length === 0) {
        log('  ❌ No identifiers extracted', 'red');
      }
      if (!result.detectedHeaders || result.detectedHeaders.length === 0) {
        log('  ❌ No headers detected', 'red');
      }
    }
    
  } catch (error) {
    log(`\n❌ Test execution failed: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Prisma client is managed by the app, no need to disconnect
  }
}

main();
