const { PrismaClient } = require('@prisma/client');
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
    console.log(`${i + 1}. ${lpu.name}`);
  });
  
  await prisma.$disconnect();
}

checkDB().catch(console.error); 