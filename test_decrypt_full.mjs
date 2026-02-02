#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();
const JWT_SECRET = "dev-secret-key-min-32-characters-long-for-local-testing";

async function main() {
  const keys = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['UPSTAGE_API_KEY', 'OPENAI_API_KEY'],
      },
    },
  });
  
  for (const setting of keys) {
    console.log(`\n${setting.key}:`);
    console.log(`  Encrypted value: ${setting.value}`);
    
    try {
      const bytes = CryptoJS.AES.decrypt(setting.value, JWT_SECRET);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      console.log(`  Decrypted value: "${decrypted}"`);
      console.log(`  Length: ${decrypted.length}`);
      console.log(`  Is placeholder: ${decrypted.includes('your-') || decrypted.length === 0}`);
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
