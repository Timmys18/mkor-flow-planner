// Типы данных МКОР на основе технических характеристик

import { differenceInCalendarDays } from 'date-fns';

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

// Функция для определения этапа МКОР на конкретную дату
export function getMkorStageOnDate(mkor: MkorUnit, date: Date, job?: MkorJob): {
  stage: keyof typeof STAGE_NAMES;
  requiresTransport: boolean;
  progress?: number; // прогресс в рамках дня (0-1) для дробных этапов
} | null {
  const startDate = new Date(mkor.start);
  const daysDiff = differenceInCalendarDays(date, startDate);
  
  if (daysDiff < 0) return null;
  
  // Используем сегменты работы или стандартные сегменты МКОР
  const segments = job ? getJobSegments(mkor, job) : mkor.segments;
  
  let currentDay = 0;
  const stages: (keyof typeof STAGE_NAMES)[] = [
    'transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'
  ];
  
  for (let i = 0; i < stages.length; i++) {
    const segmentDuration = segments[i] || 0;
    if (daysDiff >= currentDay && daysDiff < currentDay + segmentDuration) {
      const stage = stages[i];
      const requiresTransport = ['transitToObject', 'unloading', 'loading', 'transitToMaintenance'].includes(stage);
      
      // Вычисляем прогресс в рамках дня для дробных этапов
      const dayProgress = daysDiff - currentDay;
      const progress = dayProgress < 1 ? dayProgress : undefined;
      
      return { stage, requiresTransport, progress };
    }
    currentDay += segmentDuration;
  }
  
  return null;
}