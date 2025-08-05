require('dotenv').config();

async function testGraphHopper() {
  console.log('=== Тестирование GraphHopper API ===');
  
  const apiKey = process.env.GRAPHHOPPER_API_KEY || 'demo';
  console.log('API ключ:', apiKey);
  
  // Тестируем API с реальными координатами ЛПУ
  const fromLat = 63.245226;
  const fromLng = 66.941013;
  const toLat = 63.813136;
  const toLng = 67.833161;
  
  const url = `https://graphhopper.com/api/1/route?point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=truck&key=${apiKey}&instructions=false&calc_points=false`;
  
  console.log('URL запроса:', url);
  console.log('Координаты:', `${fromLat},${fromLng} -> ${toLat},${toLng}`);
  
  try {
    const response = await fetch(url);
    
    console.log('Статус ответа:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Ответ API получен!');
      
      const route = data.paths?.[0];
      if (route) {
        const distance = route.distance || 0;
        const duration = route.time || 0;
        
        console.log('Результат:');
        console.log('- Расстояние:', Math.round(distance), 'м');
        console.log('- Время в пути:', Math.round(duration / 1000), 'сек');
        console.log('- Время в пути:', Math.round(duration / 60000), 'мин');
      } else {
        console.log('Маршрут не найден в ответе');
      }
    } else {
      const errorText = await response.text();
      console.log('Ошибка:', errorText);
    }
  } catch (error) {
    console.error('Ошибка запроса:', error.message);
  }
}

testGraphHopper().catch(console.error); 