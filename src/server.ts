import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { YandexMapsService, CoordinateUtils } from './services/yandexMaps';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Устанавливаем переменные окружения напрямую, если они не загрузились
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}
    if (!process.env.GRAPHHOPPER_API_KEY) {
      process.env.GRAPHHOPPER_API_KEY = 'demo';
    }

// Отладочная информация
console.log('Переменные окружения:');
console.log('OSRM API: УСТАНОВЛЕН (не требует ключа)');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН');

const prisma = new PrismaClient();
const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());

// Инициализация сервиса Яндекс Карт
let yandexMapsService: YandexMapsService;
try {
  const apiKey = YandexMapsService.getApiKey();
  yandexMapsService = new YandexMapsService(apiKey);
} catch (error) {
  console.warn('Yandex Maps API не настроен:', error.message);
  yandexMapsService = null;
}

// --- MKOR UNITS ---
app.get('/api/mkor', async (req: Request, res: Response) => {
  const units = await prisma.mkorUnit.findMany({ include: { jobs: true } });
  const normalized = units.map(unit => ({
    ...unit,
    segments: Array.isArray(unit.segments)
      ? unit.segments
      : JSON.parse(unit.segments)
  }));
  res.json(normalized);
});

app.post('/api/mkor', async (req: Request, res: Response) => {
  const { name, diameter, availableFrom, segments } = req.body;
  const unit = await prisma.mkorUnit.create({
    data: {
      name,
      diameter,
      availableFrom: new Date(availableFrom),
      segments: JSON.stringify(segments),
    },
  });
  res.json(unit);
});

app.delete('/api/mkor/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.mkorUnit.delete({ where: { id } });
  res.json({ ok: true });
});

// --- MKOR JOBS ---
app.post('/api/mkor/:id/job', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { start, customer, lpu } = req.body; // добавил customer, lpu
  const job = await prisma.mkorJob.create({
    data: {
      start: new Date(start),
      customer, // сохраняем заказчика
      lpu,      // сохраняем ЛПУ
      mkorUnitId: id,
    },
  });
  res.json(job);
});

app.delete('/api/job/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.mkorJob.delete({ where: { id } });
  res.json({ ok: true });
});

// @ts-ignore
app.put('/api/job/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { start, customer, lpu, customStages, customSegments } = req.body;
  
  console.log('Обновление работы:', { id, start, customer, lpu, customStages, customSegments });
  
  try {
    const job = await prisma.mkorJob.update({
      where: { id },
      data: {
        start: new Date(start),
        customer,
        lpu,
        // @ts-ignore
        customStages: customStages || false,
        // @ts-ignore
        customSegments: customSegments ? JSON.stringify(customSegments) : null
      }
    });
    
    console.log('Работа обновлена в БД:', job);
    res.json(job);
  } catch (error) {
    console.error('Ошибка обновления работы:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- MKOR INVENTORY ---
app.get('/api/inventory', async (req: Request, res: Response) => {
  const inv = await prisma.mkorInventory.findMany();
  res.json(inv);
});

app.post('/api/inventory', async (req: Request, res: Response) => {
  const { diameter, count, availableFrom } = req.body;
  const item = await prisma.mkorInventory.create({
    data: {
      diameter,
      count,
      availableFrom: new Date(availableFrom),
    },
  });
  res.json(item);
});

app.delete('/api/inventory/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.mkorInventory.delete({ where: { id } });
  res.json({ ok: true });
});

// --- TRANSPORT SUPPLY ---
app.get('/api/transport-supply', async (req: Request, res: Response) => {
  const supplies = await prisma.transportSupply.findMany();
  res.json(supplies);
});

app.post('/api/transport-supply', async (req: Request, res: Response) => {
  const { date, tractors, trailers, lowLoaders } = req.body;
  const supply = await prisma.transportSupply.create({
    data: {
      date: new Date(date),
      tractors,
      trailers,
      lowLoaders
    }
  });
  res.json(supply);
});

app.put('/api/transport-supply/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date, tractors, trailers, lowLoaders } = req.body;
  const supply = await prisma.transportSupply.update({
    where: { id },
    data: {
      date: new Date(date),
      tractors,
      trailers,
      lowLoaders
    }
  });
  res.json(supply);
});

app.delete('/api/transport-supply/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.transportSupply.delete({ where: { id } });
  res.json({ ok: true });
});

// --- LPU ---
app.get('/api/lpu', async (req: Request, res: Response) => {
  const { customer } = req.query;
  console.log('LPU API called with customer:', customer);
  console.log('Customer type:', typeof customer);
  console.log('Customer length:', customer ? customer.length : 'undefined');
  
  let lpus;
  if (customer) {
    lpus = await prisma.lpu.findMany({ where: { customer: String(customer) } });
    console.log('Found LPUs:', lpus.length);
    console.log('First LPU:', lpus[0]);
  } else {
    lpus = await prisma.lpu.findMany();
    console.log('No customer filter, found all LPUs:', lpus.length);
  }
  res.json(lpus);
});

// API эндпоинты для работы с расстояниями

/**
 * GET /api/distances/calculate
 * Расчет расстояния между двумя ЛПУ
 */
app.get('/api/distances/calculate', async (req, res) => {
  try {
    const { fromLpuId, toLpuId } = req.query;

    if (!fromLpuId || !toLpuId) {
      return res.status(400).json({ error: 'Необходимо указать fromLpuId и toLpuId' });
    }

    // Получаем данные ЛПУ из базы
    const fromLpu = await prisma.lpu.findUnique({
      where: { id: fromLpuId as string }
    });

    const toLpu = await prisma.lpu.findUnique({
      where: { id: toLpuId as string }
    });

    if (!fromLpu || !toLpu) {
      return res.status(404).json({ error: 'ЛПУ не найдены' });
    }

    if (!fromLpu.latitude || !fromLpu.longitude || !toLpu.latitude || !toLpu.longitude) {
      return res.status(400).json({ error: 'Координаты ЛПУ не указаны' });
    }

    // Проверяем валидность координат
    if (!CoordinateUtils.isValidCoordinate(fromLpu.latitude, fromLpu.longitude) ||
        !CoordinateUtils.isValidCoordinate(toLpu.latitude, toLpu.longitude)) {
      return res.status(400).json({ error: 'Некорректные координаты' });
    }

    // Рассчитываем расстояние
    const routeInfo = await yandexMapsService.calculateDistance(
      {
        latitude: fromLpu.latitude,
        longitude: fromLpu.longitude,
        name: fromLpu.name
      },
      {
        latitude: toLpu.latitude,
        longitude: toLpu.longitude,
        name: toLpu.name
      }
    );

    res.json({
      from: {
        id: fromLpu.id,
        name: fromLpu.name,
        customer: fromLpu.customer,
        coordinates: { lat: fromLpu.latitude, lng: fromLpu.longitude }
      },
      to: {
        id: toLpu.id,
        name: toLpu.name,
        customer: toLpu.customer,
        coordinates: { lat: toLpu.latitude, lng: toLpu.longitude }
      },
      distance: {
        meters: routeInfo.distance,
        formatted: YandexMapsService.formatDistance(routeInfo.distance)
      },
      duration: {
        seconds: routeInfo.duration,
        formatted: YandexMapsService.formatDuration(routeInfo.duration)
      }
    });

  } catch (error) {
    console.error('Ошибка при расчете расстояния:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * POST /api/distances/matrix
 * Расчет матрицы расстояний между множеством ЛПУ
 */
app.post('/api/distances/matrix', async (req, res) => {
  try {
    const { lpuIds } = req.body;

    if (!Array.isArray(lpuIds) || lpuIds.length < 2) {
      return res.status(400).json({ error: 'Необходимо указать массив из минимум 2 ID ЛПУ' });
    }

    // Получаем данные всех ЛПУ
    const lpus = await prisma.lpu.findMany({
      where: { id: { in: lpuIds } }
    });

    if (lpus.length !== lpuIds.length) {
      return res.status(404).json({ error: 'Некоторые ЛПУ не найдены' });
    }

    // Проверяем наличие координат
    const lpusWithoutCoords = lpus.filter(lpu => !lpu.latitude || !lpu.longitude);
    if (lpusWithoutCoords.length > 0) {
      return res.status(400).json({ 
        error: 'У некоторых ЛПУ не указаны координаты',
        missingCoords: lpusWithoutCoords.map(lpu => ({ id: lpu.id, name: lpu.name }))
      });
    }

    // Формируем точки для расчета
    const points = lpus.map(lpu => ({
      latitude: lpu.latitude!,
      longitude: lpu.longitude!,
      name: lpu.name
    }));

    // Рассчитываем матрицу расстояний
    const matrix = await yandexMapsService.calculateDistanceMatrix(points);

    // Формируем результат
    const result = {
      lpus: lpus.map(lpu => ({
        id: lpu.id,
        name: lpu.name,
        customer: lpu.customer,
        coordinates: { lat: lpu.latitude, lng: lpu.longitude }
      })),
      distances: matrix.distances.map(row => 
        row.map(distance => ({
          meters: distance,
          formatted: YandexMapsService.formatDistance(distance)
        }))
      ),
      durations: matrix.durations.map(row => 
        row.map(duration => ({
          seconds: duration,
          formatted: YandexMapsService.formatDuration(duration)
        }))
      )
    };

    res.json(result);

  } catch (error) {
    console.error('Ошибка при расчете матрицы расстояний:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/distances/optimal-route
 * Получение оптимального маршрута между ЛПУ
 */
app.get('/api/distances/optimal-route', async (req, res) => {
  try {
    const { lpuIds } = req.query;
    const ids = Array.isArray(lpuIds) 
      ? lpuIds.filter(id => typeof id === 'string') as string[]
      : [lpuIds].filter(id => typeof id === 'string') as string[];

    if (ids.length < 2) {
      return res.status(400).json({ error: 'Необходимо указать минимум 2 ID ЛПУ' });
    }

    // Получаем данные ЛПУ
    const lpus = await prisma.lpu.findMany({
      where: { id: { in: ids } }
    });

    if (lpus.length !== ids.length) {
      return res.status(404).json({ error: 'Некоторые ЛПУ не найдены' });
    }

    // Проверяем координаты
    const lpusWithoutCoords = lpus.filter(lpu => !lpu.latitude || !lpu.longitude);
    if (lpusWithoutCoords.length > 0) {
      return res.status(400).json({ 
        error: 'У некоторых ЛПУ не указаны координаты',
        missingCoords: lpusWithoutCoords.map(lpu => ({ id: lpu.id, name: lpu.name }))
      });
    }

    // Формируем точки
    const points = lpus.map(lpu => ({
      latitude: lpu.latitude!,
      longitude: lpu.longitude!,
      name: lpu.name
    }));

    // Получаем оптимальный маршрут
    const routeInfo = await yandexMapsService.getOptimalRoute(points);

    res.json({
      route: routeInfo.route.map((point, index) => ({
        order: index + 1,
        name: point.name,
        coordinates: { lat: point.latitude, lng: point.longitude }
      })),
      totalDistance: {
        meters: routeInfo.distance,
        formatted: YandexMapsService.formatDistance(routeInfo.distance)
      },
      totalDuration: {
        seconds: routeInfo.duration,
        formatted: YandexMapsService.formatDuration(routeInfo.duration)
      }
    });

  } catch (error) {
    console.error('Ошибка при расчете оптимального маршрута:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * GET /api/lpus/with-coordinates
 * Получение всех ЛПУ с координатами
 */
app.get('/api/lpus/with-coordinates', async (req, res) => {
  try {
    const lpus = await prisma.lpu.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } }
        ]
      },
      orderBy: [
        { customer: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(lpus.map(lpu => ({
      id: lpu.id,
      name: lpu.name,
      customer: lpu.customer,
      coordinates: {
        lat: lpu.latitude,
        lng: lpu.longitude
      }
    })));

  } catch (error) {
    console.error('Ошибка при получении ЛПУ:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(port, () => {
  console.log(`Prisma API server running on http://localhost:${port}`);
}); 