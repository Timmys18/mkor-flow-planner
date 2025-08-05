require('dotenv').config();

async function testOpenRoute() {
  console.log('=== Тестирование OpenRouteService API ===');
  
  const apiKey = process.env.OPENROUTE_API_KEY;
  console.log('API ключ:', apiKey ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН');
  
  // Тестируем API с реальными координатами ЛПУ
  const fromLat = 63.245226;
  const fromLng = 66.941013;
  const toLat = 63.813136;
  const toLng = 67.833161;
  
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
  
  const requestBody = {
    coordinates: [
      [fromLng, fromLat],
      [toLng, toLat]
    ],
    format: 'json',
    units: 'meters',
    instructions: false,
    preference: 'fastest',
    avoid_features: [],
    avoid_borders: 'controlled',
    vehicle_type: 'hgv'
  };

  console.log('URL запроса:', url);
  console.log('Координаты:', `${fromLat},${fromLng} -> ${toLat},${toLng}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Статус ответа:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Ответ API получен!');
      
      const route = data.features?.[0];
      if (route) {
        const properties = route.properties;
        const distance = properties.segments?.[0]?.distance || properties.distance || 0;
        const duration = properties.segments?.[0]?.duration || properties.duration || 0;
        
        console.log('Результат:');
        console.log('- Расстояние:', Math.round(distance), 'м');
        console.log('- Время в пути:', Math.round(duration), 'сек');
        console.log('- Время в пути:', Math.round(duration/60), 'мин');
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

testOpenRoute().catch(console.error); 