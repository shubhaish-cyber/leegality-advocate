import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Enable WAL mode
  await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');

  console.log('Database seeded successfully.');
  console.log('Marketing users will be created on first Google SSO login.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
