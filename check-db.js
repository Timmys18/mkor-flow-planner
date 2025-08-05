require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Установка переменных окружения если они не загружены
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}
if (!process.env.YANDEX_MAPS_API_KEY) {
  process.env.YANDEX_MAPS_API_KEY = '8d239359-e2cf-4935-a8ff-1cf112af5393';
}

const prisma = new PrismaClient();

async function checkDB() {
  console.log('=== Проверка базы данных ЛПУ ===');
  
  // Получить все уникальные заказчики
  const customers = await prisma.lpu.findMany({
    select: { customer: true },
    distinct: ['customer']
  });
  
  console.log('Всего заказчиков:', customers.length);
  console.log('Список заказчиков:');
  customers.forEach((c, i) => {
    console.log(`${i + 1}. "${c.customer}"`);
  });
  
  // Проверить конкретного заказчика
  const testCustomer = 'ООО «Газпром трансгаз Югорск»';
  const lpus = await prisma.lpu.findMany({
    where: { customer: testCustomer }
  });
  
  console.log(`\nЛПУ для "${testCustomer}":`, lpus.length);
  lpus.forEach((lpu, i) => {
    console.log(`${i + 1}. ${lpu.name} - Координаты: ${lpu.latitude}, ${lpu.longitude}`);
  });
  
  // Проверим общее количество ЛПУ с координатами
  const allLpus = await prisma.lpu.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } }
      ]
    }
  });
  
  console.log(`\nВсего ЛПУ с координатами: ${allLpus.length}`);
  
  await prisma.$disconnect();
}

checkDB().catch(console.error); 