require('dotenv').config();

// Установка переменных окружения если они не загружены
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}
if (!process.env.YANDEX_MAPS_API_KEY) {
  process.env.YANDEX_MAPS_API_KEY = '8d239359-e2cf-4935-a8ff-1cf112af5393';
}

async function testRouting() {
  console.log('=== Тестирование API маршрутизации ===');
  
  // Тестируем API напрямую
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  const fromLat = 63.245226;
  const fromLng = 66.941013;
  const toLat = 63.813136;
  const toLng = 67.833161;
  
  const url = `https://api-maps.yandex.ru/services/route/2.0/?apikey=${apiKey}&lang=ru_RU&routingMode=driving&rll=${fromLng},${fromLat}~${toLng},${toLat}`;
  
  console.log('URL запроса:', url);
  
  try {
    const response = await fetch(url);
    console.log('Статус ответа:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Ответ API:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Ошибка:', errorText);
    }
  } catch (error) {
    console.error('Ошибка запроса:', error.message);
  }
}

testRouting().catch(console.error); 