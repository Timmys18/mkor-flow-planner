// Сервис для работы с OpenRouteService API
// Документация: https://openrouteservice.org/dev/#/api-docs

interface RoutePoint {
  latitude: number;
  longitude: number;
  name?: string;
}

interface RouteInfo {
  distance: number; // в метрах
  duration: number; // в секундах
  route: RoutePoint[];
}

interface DistanceMatrixResult {
  distances: number[][]; // матрица расстояний в метрах
  durations: number[][]; // матрица времени в секундах
}

export class YandexMapsService {
  private apiKey: string;
  private baseUrl = 'https://router.project-osrm.org/route/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Получение API ключа из переменных окружения
   */
  static getApiKey(): string {
    return 'demo'; // OSRM не требует ключа
  }

  /**
   * Расчет расстояния между двумя точками по автомобильным дорогам
   */
  async calculateDistance(from: RoutePoint, to: RoutePoint): Promise<RouteInfo> {
    try {
      const url = `${this.baseUrl}/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false&steps=false&annotations=distance,duration`;
      
      console.log('Запрос к OSRM API:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OSRM API вернул ошибку: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.message) {
        throw new Error(`Ошибка API: ${data.message}`);
      }
      
      // Извлекаем информацию о маршруте
      const route = data.routes?.[0];
      if (!route) {
        throw new Error('Маршрут не найден в ответе API');
      }
      
      const distance = route.distance || 0;
      const duration = route.duration || 0;
      
      console.log('Получен маршрут:', { distance, duration });
      
      return {
        distance: Math.round(distance),
        duration: Math.round(duration),
        route: [from, to]
      };
      
    } catch (error) {
      console.error('Ошибка при получении маршрута из API:', error);
      
      // Fallback на улучшенную формулу Хаверсайна с коэффициентом для дорог
      console.log('Используем fallback расчет с учетом дорог');
      const straightDistance = this.calculateHaversineDistance(from, to);
      
      // Коэффициент для учета извилистости дорог (обычно 1.2-1.4)
      const roadCoefficient = 1.3;
      const distance = Math.round(straightDistance * roadCoefficient);
      
      const estimatedDuration = this.estimateTravelTime(distance);
      
      return {
        distance,
        duration: estimatedDuration,
        route: [from, to]
      };
    }
  }

  /**
   * Расчет матрицы расстояний между множеством точек по автомобильным дорогам
   */
  async calculateDistanceMatrix(points: RoutePoint[]): Promise<DistanceMatrixResult> {
    const n = points.length;
    const distances: number[][] = [];
    const durations: number[][] = [];

    console.log(`Начинаем расчет матрицы расстояний для ${n} точек`);

    for (let i = 0; i < n; i++) {
      distances[i] = [];
      durations[i] = [];
      
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i][j] = 0;
          durations[i][j] = 0;
        } else {
          try {
            // Используем реальный API для каждой пары точек
            const routeInfo = await this.calculateDistance(points[i], points[j]);
            distances[i][j] = routeInfo.distance;
            durations[i][j] = routeInfo.duration;
            
            console.log(`${i+1}->${j+1}: ${routeInfo.distance}m, ${routeInfo.duration}s`);
          } catch (error) {
            console.error(`Ошибка при расчете маршрута ${i+1}->${j+1}:`, error);
            // Fallback на формулу Хаверсайна
            const distance = this.calculateHaversineDistance(points[i], points[j]);
            const duration = this.estimateTravelTime(distance);
            distances[i][j] = distance;
            durations[i][j] = duration;
          }
        }
      }
    }

    console.log('Матрица расстояний рассчитана');
    return { distances, durations };
  }

  /**
   * Расчет расстояния по формуле гаверсинуса (приблизительно)
   */
  private calculateHaversineDistance(from: RoutePoint, to: RoutePoint): number {
    const R = 6371000; // радиус Земли в метрах
    const lat1 = this.toRadians(from.latitude);
    const lat2 = this.toRadians(to.latitude);
    const deltaLat = this.toRadians(to.latitude - from.latitude);
    const deltaLon = this.toRadians(to.longitude - from.longitude);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Оценка времени в пути (учитывая среднюю скорость грузового транспорта)
   */
  private estimateTravelTime(distance: number): number {
    const averageSpeed = 60; // км/ч для грузового транспорта
    const speedInMps = averageSpeed * 1000 / 3600; // м/с
    return Math.round(distance / speedInMps);
  }

  /**
   * Конвертация градусов в радианы
   */
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  /**
   * Получение оптимального маршрута между точками по автомобильным дорогам
   */
  async getOptimalRoute(points: RoutePoint[]): Promise<RouteInfo> {
    if (points.length < 2) {
      throw new Error('Необходимо минимум 2 точки для построения маршрута');
    }

    try {
      // Строим маршрут через все точки
      let totalDistance = 0;
      let totalDuration = 0;
      const route: RoutePoint[] = [points[0]];

      for (let i = 0; i < points.length - 1; i++) {
        const routeInfo = await this.calculateDistance(points[i], points[i + 1]);
        totalDistance += routeInfo.distance;
        totalDuration += routeInfo.duration;
        route.push(points[i + 1]);
      }

      return {
        distance: totalDistance,
        duration: totalDuration,
        route: route
      };
    } catch (error) {
      console.error('Ошибка при построении оптимального маршрута:', error);
      
      // Fallback на простой расчет
      let totalDistance = 0;
      let totalDuration = 0;
      
      for (let i = 0; i < points.length - 1; i++) {
        const distance = this.calculateHaversineDistance(points[i], points[i + 1]);
        const duration = this.estimateTravelTime(distance);
        
        totalDistance += distance;
        totalDuration += duration;
      }

      return {
        distance: totalDistance,
        duration: totalDuration,
        route: points
      };
    }
  }

  /**
   * Форматирование расстояния для отображения
   */
  static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} м`;
    } else {
      return `${(meters / 1000).toFixed(1)} км`;
    }
  }

  /**
   * Форматирование времени для отображения
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}ч ${minutes}мин`;
    } else {
      return `${minutes}мин`;
    }
  }
}

// Экспорт утилит для работы с координатами
export const CoordinateUtils = {
  /**
   * Проверка валидности координат
   */
  isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  /**
   * Получение центральной точки между двумя координатами
   */
  getCenterPoint(lat1: number, lng1: number, lat2: number, lng2: number) {
    return {
      latitude: (lat1 + lat2) / 2,
      longitude: (lng1 + lng2) / 2
    };
  },

  /**
   * Расчет зоны покрытия (радиус в метрах)
   */
  calculateCoverageRadius(points: RoutePoint[]): number {
    if (points.length < 2) return 0;
    
    let maxDistance = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = new YandexMapsService('').calculateHaversineDistance(points[i], points[j]);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    return maxDistance / 2; // радиус = половина максимального расстояния
  }
}; 