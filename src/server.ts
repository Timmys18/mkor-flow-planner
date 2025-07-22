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
  // Приводим jobs к массиву, если вдруг это объект
  const normalized = units
    .map(unit => ({
      ...unit,
      segments: (() => {
        try {
          const seg = Array.isArray(unit.segments)
            ? unit.segments
            : JSON.parse(unit.segments);
          return Array.isArray(seg) ? seg : [];
        } catch {
          return [];
        }
      })(),
      jobs: Array.isArray(unit.jobs) ? unit.jobs : Object.values(unit.jobs || {})
    }))
    .filter(unit => Array.isArray(unit.segments) && unit.segments.length > 0);
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
  const { start } = req.body;
  console.log('POST /api/mkor/:id/job', { id, start });
  try {
    const job = await prisma.mkorJob.create({
      data: {
        start: new Date(start),
        mkorUnitId: id,
      },
    });
    console.log('Created job:', job);
    res.json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job', details: error });
  }
});

app.delete('/api/job/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.mkorJob.delete({ where: { id } });
  res.json({ ok: true });
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

app.listen(port, () => {
  console.log(`Prisma API server running on http://localhost:${port}`);
}); 