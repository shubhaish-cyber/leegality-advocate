import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MARKETING_USERS = [
  { email: 'marketers@leegality.com', name: 'Marketers', googleId: 'seed-marketers' },
  { email: 'shubhaish@leegality.com', name: 'Shubhaish', googleId: 'seed-shubhaish' },
  { email: 'rishit@leegality.com', name: 'Rishit', googleId: 'seed-rishit' },
];

async function main() {
  console.log('Seeding marketing users...\n');

  for (const u of MARKETING_USERS) {
    // Upsert into MarketingUser
    const user = await prisma.marketingUser.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        email: u.email,
        name: u.name,
        googleId: u.googleId,
        role: 'admin',
      },
    });
    console.log(`  MarketingUser: ${user.email} (id: ${user.id})`);

    // Upsert into AllowedEmail (needs an addedById — use this user's own id)
    const allowed = await prisma.allowedEmail.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        role: 'marketing',
        addedById: user.id,
      },
    });
    console.log(`  AllowedEmail: ${allowed.email}`);
  }

  console.log('\nDone! Seeded 3 marketing users + allowed emails.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
