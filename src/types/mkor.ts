// Типы данных МКОР на основе технических характеристик

import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

export const STAGE_KEYS = [
  'transitToObject',
  'unloading',
  'working',
  'loading',
  'transitToMaintenance',
  'maintenance',
] as const;

export type StageKey = typeof STAGE_KEYS[number];

export interface JobSegmentWithDates {
  stage: StageKey;
  start: Date;
  end: Date;
  duration: number;
  index: number;
}

/** Локальная календарная дата без смещения из-за UTC в ISO-строках */
export function parseCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }
  const datePart = value.includes('T') ? value.slice(0, 10) : value.split(' ')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const fallback = parseISO(value);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/** Сколько календарных дней занимает этап (1.5 дня → 2 календарных дня) */
export function getCalendarSpanDays(duration: number): number {
  if (duration <= 0) return 0;
  return Math.max(1, Math.ceil(duration));
}

export function stageRequiresTransport(stage: StageKey): boolean {
  return ['transitToObject', 'unloading', 'loading', 'transitToMaintenance'].includes(stage);
}

export interface MkorSpecs {
  diameter: number;
  operationalCycle: number; // общий операционный цикл в днях
  transitToObject: number; // время в пути на объект
  unloadingTime: number; // время разгрузки (может быть дробным, например 1.5)
  workingPeriod: number; // период эксплуатации у заказчика
  loadingTime: number; // время погрузки (может быть дробным, например 1.5)
  transitToMaintenance: number; // время в пути на ТОИР
  maintenanceTime: number; // время ТОИР
  tractors: number; // количество тягачей
  trailers: number; // количество прицепов
  lowLoaders: number; // количество тралов
}

export interface MkorJob {
  id: string;
  start: string; // дата начала работы
  customer?: string; // заказчик
  lpu?: string; // ЛПУ
  customStages?: boolean; // флаг кастомных этапов
  customSegments?: number[]; // кастомные сегменты [транзит, разгрузка, работа, погрузка, транзит на ТОИР, ТОИР]
}

export interface MkorUnit {
  id: string;
  diameter: number;
  name: string;
  start: string;
  availableFrom: string; // дата поступления от завода
  segments: number[]; // [транзит на объект, разгрузка, работа, погрузка, транзит на ТОИР, ТОИР]
  jobs?: MkorJob[]; // список работ
}

export interface MkorInventory {
  id: string;
  diameter: number;
  count: number;
  availableFrom: string; // дата поступления от завода
}

export interface FleetSupply {
  id: string; // уникальный идентификатор
  date: string; // дата поставки (yyyy-MM-dd)
  tractors: number;
  trailers: number;
  lowLoaders: number;
}

export interface TransportSupply {
  id: string;
  date: string;
  tractors: number;
  trailers: number;
  lowLoaders: number;
}

// Справочник технических характеристик МКОР
export const MKOR_SPECS: Record<number, MkorSpecs> = {
  200: {
    diameter: 200,
    operationalCycle: 24,
    transitToObject: 3,
    unloadingTime: 1,
    workingPeriod: 13,
    loadingTime: 1,
    transitToMaintenance: 3,
    maintenanceTime: 3,
    tractors: 2,
    trailers: 2,
    lowLoaders: 0
  },
  300: {
    diameter: 300,
    operationalCycle: 24,
    transitToObject: 3,
    unloadingTime: 1,
    workingPeriod: 13,
    loadingTime: 1,
    transitToMaintenance: 3,
    maintenanceTime: 3,
    tractors: 3,
    trailers: 3,
    lowLoaders: 0
  },
  400: {
    diameter: 400,
    operationalCycle: 24,
    transitToObject: 3,
    unloadingTime: 1,
    workingPeriod: 13,
    loadingTime: 1,
    transitToMaintenance: 3,
    maintenanceTime: 3,
    tractors: 3,
    trailers: 3,
    lowLoaders: 0
  },
  500: {
    diameter: 500,
    operationalCycle: 27,
    transitToObject: 3,
    unloadingTime: 1.5,
    workingPeriod: 14,
    loadingTime: 1.5,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 3,
    trailers: 3,
    lowLoaders: 0
  },
  700: {
    diameter: 700,
    operationalCycle: 27,
    transitToObject: 3,
    unloadingTime: 1.5,
    workingPeriod: 14,
    loadingTime: 1.5,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 4,
    trailers: 4,
    lowLoaders: 0
  },
  800: {
    diameter: 800,
    operationalCycle: 27,
    transitToObject: 3,
    unloadingTime: 1.5,
    workingPeriod: 14,
    loadingTime: 1.5,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 4,
    trailers: 4,
    lowLoaders: 0
  },
  1000: {
    diameter: 1000,
    operationalCycle: 30,
    transitToObject: 3,
    unloadingTime: 2,
    workingPeriod: 16,
    loadingTime: 2,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 7,
    trailers: 7,
    lowLoaders: 0
  },
  1200: {
    diameter: 1200,
    operationalCycle: 31,
    transitToObject: 3,
    unloadingTime: 2,
    workingPeriod: 17,
    loadingTime: 2,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 8,
    trailers: 6,
    lowLoaders: 2
  },
  1400: {
    diameter: 1400,
    operationalCycle: 31,
    transitToObject: 3,
    unloadingTime: 2,
    workingPeriod: 17,
    loadingTime: 2,
    transitToMaintenance: 3,
    maintenanceTime: 4,
    tractors: 8,
    trailers: 4,
    lowLoaders: 4
  }
};

export const STAGE_NAMES = {
  transitToObject: 'В пути на объект',
  unloading: 'Разгрузка',
  working: 'Работа у заказчика',
  loading: 'Погрузка',
  transitToMaintenance: 'В пути на ТОИР',
  maintenance: 'ТОИР'
};

export const STAGE_COLORS = {
  transitToObject: 'bg-transit',
  unloading: 'bg-loading',
  working: 'bg-working',
  loading: 'bg-loading',
  transitToMaintenance: 'bg-transit',
  maintenance: 'bg-repair'
};

// Функция для создания МКОР с правильными сегментами
export function createMkorUnit(diameter: number, startDate: string, availableFrom: string, number: number): MkorUnit {
  const specs = MKOR_SPECS[diameter];
  if (!specs) {
    throw new Error(`Неизвестный диаметр МКОР: ${diameter}`);
  }

  const name = number > 1 ? `DN-${diameter}-${number}` : `DN-${diameter}`;
  
  return {
    id: `mkor-${diameter}-${number}-${Date.now()}`,
    diameter,
    name,
    start: startDate,
    availableFrom,
    segments: [
      specs.transitToObject,
      specs.unloadingTime,
      specs.workingPeriod,
      specs.loadingTime,
      specs.transitToMaintenance,
      specs.maintenanceTime
    ]
  };
}

// Функция для проверки доступности МКОР на дату
export function isMkorAvailable(mkor: MkorUnit, date: string): boolean {
  // Доступен, если поступил на склад (availableFrom <= date)
  return new Date(date) >= new Date(mkor.availableFrom);
}

// Функция для получения сегментов работы (стандартные или кастомные)
export function getJobSegments(mkor: MkorUnit, job: MkorJob): number[] {
  if (job.customStages && job.customSegments) {
    try {
      return Array.isArray(job.customSegments) 
        ? job.customSegments 
        : JSON.parse(job.customSegments);
    } catch {
      // Если не удалось распарсить, возвращаем стандартные
    }
  }
  
  // Возвращаем стандартные сегменты из МКОР
  let segArr = mkor.segments;
  if (!Array.isArray(segArr)) {
    try {
      segArr = JSON.parse(segArr);
    } catch {
      segArr = [];
    }
  }
  return Array.isArray(segArr) ? segArr : [];
}

/** Сегменты работы с календарными датами — единая логика для планировщика и транспорта */
export function buildJobSegmentsWithDates(mkor: MkorUnit, job: MkorJob): JobSegmentWithDates[] {
  if (!job?.start) return [];

  const segmentValues = getJobSegments(mkor, job);
  const result: JobSegmentWithDates[] = [];
  let currentDate = parseCalendarDate(job.start);

  STAGE_KEYS.forEach((stage, index) => {
    const duration = segmentValues[index] || 0;
    if (duration <= 0) return;

    const calendarDays = getCalendarSpanDays(duration);
    const endDate = addDays(currentDate, calendarDays - 1);
    endDate.setHours(23, 59, 59, 999);

    result.push({
      stage,
      start: new Date(currentDate),
      end: endDate,
      duration,
      index,
    });

    currentDate = addDays(endDate, 1);
    currentDate.setHours(0, 0, 0, 0);
  });

  return result;
}

export function getJobStageOnDate(
  mkor: MkorUnit,
  job: MkorJob,
  day: Date,
): {
  stage: StageKey;
  requiresTransport: boolean;
  segmentIndex: number;
  duration: number;
  isFirst: boolean;
  isLast: boolean;
  dayPosition: number;
} | null {
  const dayDate = parseCalendarDate(day);
  const segments = buildJobSegmentsWithDates(mkor, job);

  for (const segment of segments) {
    const start = parseCalendarDate(segment.start);
    const end = parseCalendarDate(segment.end);
    if (dayDate >= start && dayDate <= end) {
      const dayPosition = differenceInCalendarDays(dayDate, start);
      return {
        stage: segment.stage,
        requiresTransport: stageRequiresTransport(segment.stage),
        segmentIndex: segment.index,
        duration: segment.duration,
        isFirst: dayPosition === 0,
        isLast: dayDate.getTime() === end.getTime(),
        dayPosition,
      };
    }
  }

  return null;
}

// Функция для определения этапа МКОР на конкретную дату
export function getMkorStageOnDate(mkor: MkorUnit, date: Date, job?: MkorJob): {
  stage: keyof typeof STAGE_NAMES;
  requiresTransport: boolean;
  progress?: number;
} | null {
  const targetJob: MkorJob = job ?? {
    id: '',
    start: mkor.start,
  };

  const info = getJobStageOnDate(mkor, targetJob, date);
  if (!info) return null;

  return {
    stage: info.stage,
    requiresTransport: info.requiresTransport,
    progress: info.duration % 1 !== 0 && info.dayPosition === 0 ? info.duration % 1 : undefined,
  };
}