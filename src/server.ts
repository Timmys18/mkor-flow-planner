import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = 4000;

app.use(cors());
app.use(bodyParser.json());

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

app.listen(port, () => {
  console.log(`Prisma API server running on http://localhost:${port}`);
}); 