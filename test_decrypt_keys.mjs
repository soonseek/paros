#!/usr/bin/env node
/**
 * Test API key decryption
 */

import { PrismaClient } from '@prisma/client';
import { decrypt } from './src/server/lib/encryption.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing API key decryption...\n');
  
  const keys = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['UPSTAGE_API_KEY', 'OPENAI_API_KEY'],
      },
    },
  });
  
  for (const setting of keys) {
    console.log(`Key: ${setting.key}`);
    console.log(`  Encrypted: ${setting.value.substring(0, 30)}...`);
    console.log(`  Is Encrypted: ${setting.isEncrypted}`);
    
    if (setting.isEncrypted) {
      try {
        const decrypted = decrypt(setting.value);
        console.log(`  Decrypted: ${decrypted.substring(0, 20)}... (length: ${decrypted.length})`);
        console.log(`  ✅ Decryption successful`);
      } catch (error) {
        console.log(`  ❌ Decryption failed: ${error.message}`);
      }
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
