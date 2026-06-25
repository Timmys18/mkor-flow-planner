import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const DEMO_INVENTORY = [
  { diameter: 200, count: 2, availableFrom: '2025-07-30' },
  { diameter: 500, count: 2, availableFrom: '2025-08-11' },
  { diameter: 700, count: 1, availableFrom: '2025-09-05' },
  { diameter: 800, count: 2, availableFrom: '2025-07-30' },
  { diameter: 1000, count: 1, availableFrom: '2025-09-10' },
  { diameter: 1400, count: 1, availableFrom: '2025-07-30' },
];

const DEMO_TRANSPORT = [
  { date: '2025-07-01', tractors: 12, trailers: 10, lowLoaders: 4 },
  { date: '2025-09-01', tractors: 18, trailers: 16, lowLoaders: 6 },
];

const DEMO_MKOR = [
  {
    name: 'DN-200',
    diameter: 200,
    availableFrom: '2025-07-30',
    segments: [3, 1, 13, 1, 3, 3],
    jobs: [
      {
        start: '2025-08-04',
        customer: 'ООО «Газпром трансгаз Волгоград»',
        lpu: 'Волгоградское',
      },
    ],
  },
  {
    name: 'DN-1400',
    diameter: 1400,
    availableFrom: '2025-07-30',
    segments: [3, 2, 17, 2, 3, 4],
    jobs: [
      {
        start: '2025-08-18',
        customer: 'ООО «Газпром трансгаз Казань»',
        lpu: 'Альметьевское',
        customStages: true,
        customSegments: [3, 2, 5, 2, 3, 4],
      },
      {
        start: '2025-09-07',
        customer: 'ООО «Газпром трансгаз Нижний Новгород»',
        lpu: 'Приокское',
      },
    ],
  },
  {
    name: 'DN-800',
    diameter: 800,
    availableFrom: '2025-07-30',
    segments: [3, 1.5, 14, 1.5, 3, 4],
    jobs: [
      {
        start: '2025-08-31',
        customer: 'ООО «Газпром трансгаз Нижний Новгород»',
        lpu: 'Волжское',
      },
    ],
  },
  {
    name: 'DN-500',
    diameter: 500,
    availableFrom: '2025-08-11',
    segments: [3, 1.5, 14, 1.5, 3, 4],
    jobs: [
      {
        start: '2025-08-12',
        customer: 'ООО «Газпром трансгаз Саратов»',
        lpu: 'Аткарское',
      },
    ],
  },
  {
    name: 'DN-1000',
    diameter: 1000,
    availableFrom: '2025-09-10',
    segments: [3, 2, 16, 2, 3, 4],
    jobs: [
      {
        start: '2025-09-12',
        customer: 'ООО «Газпром трансгаз Уфа»',
        lpu: 'Благовещенское',
      },
    ],
  },
  {
    name: 'DN-700',
    diameter: 700,
    availableFrom: '2025-09-05',
    segments: [3, 1.5, 14, 1.5, 3, 4],
    jobs: [
      {
        start: '2025-09-24',
        customer: 'ООО «Газпром трансгаз Самара»',
        lpu: 'Кинельское',
      },
    ],
  },
];

async function bootstrapDemoIfEmpty(client: PrismaClient) {
  const mkorCount = await client.mkorUnit.count();
  if (mkorCount > 0) {
    console.log('Demo bootstrap skipped: database already has MKOR data.');
    return;
  }

  console.log('Bootstrapping demo database...');

  try {
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  } catch (error) {
    console.warn('LPU seed failed or partially applied:', error);
  }

  for (const item of DEMO_INVENTORY) {
    await client.mkorInventory.create({
      data: {
        diameter: item.diameter,
        count: item.count,
        availableFrom: new Date(item.availableFrom),
      },
    });
  }

  for (const supply of DEMO_TRANSPORT) {
    await client.transportSupply.create({
      data: {
        date: new Date(supply.date),
        tractors: supply.tractors,
        trailers: supply.trailers,
        lowLoaders: supply.lowLoaders,
      },
    });
  }

  for (const mkor of DEMO_MKOR) {
    const unit = await client.mkorUnit.create({
      data: {
        name: mkor.name,
        diameter: mkor.diameter,
        availableFrom: new Date(mkor.availableFrom),
        segments: JSON.stringify(mkor.segments),
      },
    });

    for (const job of mkor.jobs) {
      await client.mkorJob.create({
        data: {
          start: new Date(job.start),
          customer: job.customer,
          lpu: job.lpu,
          customStages: Boolean(job.customStages),
          customSegments: job.customSegments ? JSON.stringify(job.customSegments) : null,
          mkorUnitId: unit.id,
        },
      });
    }
  }

  console.log('Demo bootstrap complete.');
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await bootstrapDemoIfEmpty(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').includes('bootstrap-demo')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { bootstrapDemoIfEmpty };
