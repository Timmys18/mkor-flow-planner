require('dotenv').config();

async function testOSRM() {
  console.log('=== Тестирование OSRM API ===');
  
  // Тестируем API с реальными координатами ЛПУ
  const fromLat = 63.245226;
  const fromLng = 66.941013;
  const toLat = 63.813136;
  const toLng = 67.833161;
  
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&steps=false&annotations=distance,duration`;
  
  console.log('URL запроса:', url);
  console.log('Координаты:', `${fromLat},${fromLng} -> ${toLat},${toLng}`);
  
  try {
    const response = await fetch(url);
    
    console.log('Статус ответа:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Ответ API получен!');
      
      const route = data.routes?.[0];
      if (route) {
        const distance = route.distance || 0;
        const duration = route.duration || 0;
        
        console.log('Результат:');
        console.log('- Расстояние:', Math.round(distance), 'м');
        console.log('- Время в пути:', Math.round(duration), 'сек');
        console.log('- Время в пути:', Math.round(duration / 60), 'мин');
        console.log('- Расстояние:', (distance / 1000).toFixed(1), 'км');
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

testOSRM().catch(console.error); 