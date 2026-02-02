#!/usr/bin/env node
/**
 * Direct PDF Parsing Test (No HTTP/Auth required)
 * Tests the PDF parsing and template matching logic directly
 */

import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

// Import the parsing functions
import { extractTablesFromPDF } from './src/lib/pdf-ocr.ts';
import { classifyTransaction, normalizeText } from './src/lib/template-classifier.ts';

const prisma = new PrismaClient();

async function main() {
  console.log("=" + "=".repeat(59));
  console.log("국민은행 PDF Template-based Parsing System Test (Direct)");
  console.log("=" + "=".repeat(59));
  
  try {
    // Step 1: Create template
    console.log("\n📝 Step 1: Creating template for 국민은행...");
    
    const templateData = {
      name: "국민은행 거래내역",
      bankName: "국민은행",
      description: "국민은행 거래내역서 형식",
      identifiers: ["국민은행", "거래내역"],
      columnSchema: {
        columns: {
          date: { index: 0, header: "거래일자" },
          deposit: { index: 3, header: "입금금액" },
          withdrawal: { index: 2, header: "출금금액" },
          balance: { index: 4, header: "잔액" },
          memo: { index: 5, header: "송금인/수취인" }
        }
      },
      isActive: true,
      priority: 10,
      createdBy: "test-user"
    };
    
    // Check if template already exists
    const existing = await prisma.transactionTemplate.findUnique({
      where: { name: templateData.name }
    });
    
    let template;
    if (existing) {
      console.log(`✅ Template already exists: ${existing.id}`);
      template = existing;
    } else {
      template = await prisma.transactionTemplate.create({
        data: templateData
      });
      console.log(`✅ Template created: ${template.id}`);
    }
    
    console.log(`   Name: ${template.name}`);
    console.log(`   Bank: ${template.bankName}`);
    console.log(`   Identifiers: ${template.identifiers.join(", ")}`);
    
    // Step 2: Load and parse PDF
    console.log("\n📄 Step 2: Loading PDF file...");
    const pdfPath = "/tmp/국민은행.pdf";
    const pdfBuffer = readFileSync(pdfPath);
    console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes`);
    
    // Step 3: Extract tables from PDF
    console.log("\n🔍 Step 3: Extracting tables from PDF (Upstage OCR)...");
    const tableData = await extractTablesFromPDF(pdfBuffer, 3);
    
    console.log(`✅ Extraction complete:`);
    console.log(`   Headers: ${tableData.headers.length} columns`);
    console.log(`   Rows: ${tableData.rows.length} data rows`);
    console.log(`   Page texts: ${tableData.pageTexts?.length || 0} elements`);
    
    // Show headers
    console.log("\n📋 Extracted Headers:");
    tableData.headers.forEach((header, i) => {
      console.log(`   [${i}] ${header}`);
    });
    
    // Show normalized headers
    console.log("\n🔤 Normalized Headers (spaces removed):");
    const normalizedHeaders = tableData.headers.map(h => normalizeText(h));
    normalizedHeaders.forEach((header, i) => {
      console.log(`   [${i}] ${header}`);
    });
    
    // Show page texts
    if (tableData.pageTexts && tableData.pageTexts.length > 0) {
      console.log("\n📄 Page Texts (for template matching):");
      tableData.pageTexts.slice(0, 5).forEach((text, i) => {
        console.log(`   [${i}] ${text.substring(0, 100)}...`);
      });
    }
    
    // Show sample rows
    console.log("\n📊 Sample Data (first 3 rows):");
    tableData.rows.slice(0, 3).forEach((row, i) => {
      console.log(`   Row ${i + 1}: ${row.slice(0, 5).join(" | ")}`);
    });
    
    // Step 4: Template matching
    console.log("\n🎯 Step 4: Template matching...");
    const classificationResult = await classifyTransaction(
      prisma,
      tableData.headers,
      tableData.rows,
      tableData.pageTexts
    );
    
    if (classificationResult) {
      console.log(`✅ Template matched!`);
      console.log(`   Layer: ${classificationResult.layer} (${classificationResult.layerName})`);
      console.log(`   Template: ${classificationResult.templateName}`);
      console.log(`   Confidence: ${classificationResult.confidence}`);
      
      console.log("\n🗺️  Column Mapping:");
      for (const [key, index] of Object.entries(classificationResult.columnMapping)) {
        if (typeof index === 'number') {
          console.log(`   ${key}: column ${index} (${tableData.headers[index]})`);
        }
      }
      
      if (classificationResult.memoInAmountColumn) {
        console.log("   ⚠️  Special case: memo in amount column");
      }
    } else {
      console.log("❌ No template matched");
    }
    
    // Verification checks
    console.log("\n" + "=" + "=".repeat(59));
    console.log("VERIFICATION CHECKS");
    console.log("=" + "=".repeat(59));
    
    // Check 1: Header normalization
    console.log("\n1️⃣  Header Normalization:");
    const hasSpaces = tableData.headers.some(h => h.includes(" "));
    if (hasSpaces) {
      console.log("   ⚠️  Raw headers contain spaces (OCR issue)");
      console.log(`   Example: "${tableData.headers.find(h => h.includes(" "))}"`);
    } else {
      console.log("   ✅ Headers are clean (no spaces)");
    }
    
    const normalizedMatch = normalizedHeaders.some(h => 
      h.includes("거래일자") || h.includes("출금금액") || h.includes("입금금액")
    );
    if (normalizedMatch) {
      console.log("   ✅ Normalization working (found expected columns)");
    }
    
    // Check 2: Template matching
    console.log("\n2️⃣  Template Matching:");
    if (classificationResult) {
      if (classificationResult.layer === 1) {
        console.log("   ✅ Layer 1 (Exact Match) - Identifiers found in page text");
      } else if (classificationResult.layer === 2) {
        console.log("   ✅ Layer 2 (Similarity Match) - LLM matched template");
      } else {
        console.log("   ⚠️  Layer 3 (Fallback) - No template match");
      }
    } else {
      console.log("   ❌ No template matched");
    }
    
    // Check 3: Column mapping
    console.log("\n3️⃣  Column Mapping:");
    if (classificationResult) {
      const requiredColumns = ["date", "deposit", "withdrawal", "balance"];
      const mappedColumns = Object.keys(classificationResult.columnMapping);
      const missingColumns = requiredColumns.filter(col => !mappedColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log("   ✅ All required columns mapped");
      } else {
        console.log(`   ⚠️  Missing columns: ${missingColumns.join(", ")}`);
      }
    } else {
      console.log("   ❌ No column mapping (no template match)");
    }
    
    // Check 4: Data extraction
    console.log("\n4️⃣  Data Extraction:");
    if (tableData.rows.length > 0) {
      console.log(`   ✅ Extracted ${tableData.rows.length} rows`);
      
      // Check if first row has date
      const firstRow = tableData.rows[0];
      if (firstRow && firstRow.length > 0) {
        const firstCell = firstRow[0];
        const datePattern = /\d{4}[-./]\d{2}[-./]\d{2}/;
        if (datePattern.test(firstCell)) {
          console.log(`   ✅ First row contains valid date: ${firstCell}`);
        } else {
          console.log(`   ⚠️  First row date format unclear: ${firstCell}`);
        }
      }
    } else {
      console.log("   ❌ No data rows extracted");
    }
    
    // Summary
    console.log("\n" + "=" + "=".repeat(59));
    console.log("TEST SUMMARY");
    console.log("=" + "=".repeat(59));
    
    const allChecks = [
      template !== null,
      tableData.headers.length > 0,
      tableData.rows.length > 0,
      classificationResult !== null,
      classificationResult?.layer === 1 || classificationResult?.layer === 2
    ];
    
    const passedChecks = allChecks.filter(Boolean).length;
    console.log(`\n✅ Passed: ${passedChecks}/${allChecks.length} checks`);
    
    if (passedChecks === allChecks.length) {
      console.log("\n🎉 All tests passed!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
