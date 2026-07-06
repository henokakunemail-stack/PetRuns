/**
 * Seed data species & breeds untuk Tahap 1.
 * Jalankan dengan: pnpm seed (di folder backend)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding species & breeds...');

  const speciesData = [
    {
      name: 'Anjing',
      breeds: [
        'Golden Retriever',
        'Husky',
        'Pomeranian',
        'Shih Tzu',
        'Poodle',
        'Beagle',
        'Labrador',
        'Bulldog',
        'Chihuahua',
        'Local/Kampung',
      ],
    },
    {
      name: 'Kucing',
      breeds: ['Persia', 'Anggora', 'Maine Coon', 'British Shorthair', 'Domestik/Lokal'],
    },
    {
      name: 'Kelinci',
      breeds: ['Anggora', 'Holland Lop', 'Rex', 'Lokal'],
    },
    {
      name: 'Lainnya',
      breeds: [],
    },
  ];

  for (const s of speciesData) {
    const species = await prisma.species.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name },
    });

    for (const breedName of s.breeds) {
      await prisma.breed.upsert({
        where: { speciesId_name: { speciesId: species.id, name: breedName } },
        update: {},
        create: { speciesId: species.id, name: breedName },
      });
    }

    console.log(`  ✓ ${s.name}: ${s.breeds.length} breeds`);
  }

  console.log('Seeding done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });