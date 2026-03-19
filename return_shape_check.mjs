#!/usr/bin/env node
/**
 * Quick verification of return shapes in transaction router
 */

import { readFile } from 'fs/promises';

async function testReturnShapes() {
  const content = await readFile('./src/server/api/routers/transaction.ts', 'utf-8');
  
  console.log('🔍 Checking filterByCounterparty return shape...');
  
  // Find filterByCounterparty return statement
  const counterpartyMatch = content.match(/filterByCounterparty:[\s\S]*?return\s*\{[\s\S]*?\}[\s\S]*?\}/);
  if (counterpartyMatch) {
    const returnBlock = counterpartyMatch[0];
    console.log('Found filterByCounterparty return:');
    
    // Check for required fields
    const requiredFields = ['transactions', 'summary', 'total', 'depositCount', 'withdrawalCount', 'depositTotal', 'withdrawalTotal', 'query'];
    const hasAllFields = requiredFields.every(field => returnBlock.includes(field));
    
    console.log(`✅ filterByCounterparty has correct return shape: ${hasAllFields}`);
    if (hasAllFields) {
      console.log('   Fields: transactions, summary{total, depositCount, withdrawalCount, depositTotal, withdrawalTotal, query}');
    }
  }
  
  console.log('\n🔍 Checking detectInternalTransfers return shape...');
  
  // Find detectInternalTransfers return statement
  const internalMatch = content.match(/detectInternalTransfers:[\s\S]*?return\s*\{[\s\S]*?matches,[\s\S]*?summary:[\s\S]*?\}/);
  if (internalMatch) {
    const returnBlock = internalMatch[0];
    console.log('Found detectInternalTransfers return:');
    
    // Check for required fields
    const requiredFields = ['matches', 'summary', 'total', 'totalAmount', 'sameDayCount', 'nextDayCount', 'documentPairCount'];
    const hasAllFields = requiredFields.every(field => returnBlock.includes(field));
    
    console.log(`✅ detectInternalTransfers has correct return shape: ${hasAllFields}`);
    if (hasAllFields) {
      console.log('   Fields: matches, summary{total, totalAmount, sameDayCount, nextDayCount, documentPairCount}');
    }
  }
  
  console.log('\n🔍 Checking filterByAmount return shape...');
  
  // Find filterByAmount return statement  
  const amountMatch = content.match(/filterByAmount:[\s\S]*?return\s*\{[\s\S]*?transactions:[\s\S]*?summary:[\s\S]*?\}/);
  if (amountMatch) {
    const returnBlock = amountMatch[0];
    console.log('Found filterByAmount return:');
    
    // Check for required fields
    const requiredFields = ['transactions', 'summary', 'total', 'depositCount', 'withdrawalCount', 'depositTotal', 'withdrawalTotal', 'minAmount'];
    const hasAllFields = requiredFields.every(field => returnBlock.includes(field));
    
    console.log(`✅ filterByAmount has correct return shape: ${hasAllFields}`);
    if (hasAllFields) {
      console.log('   Fields: transactions, summary{total, depositCount, withdrawalCount, depositTotal, withdrawalTotal, minAmount}');
    }
  }
}

testReturnShapes().catch(console.error);