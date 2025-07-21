// Типы данных МКОР на основе технических характеристик

export interface MkorSpecs {
  diameter: number;
  operationalCycle: number; // общий операционный цикл в днях
  transitToObject: number; // время в пути на объект
  unloadingTime: number; // время разгрузки
  workingPeriod: number; // период эксплуатации у заказчика
  loadingTime: number; // время погрузки
  transitToMaintenance: number; // время в пути на ТОИР
  maintenanceTime: number; // время ТОИР
  tractors: number; // количество тягачей
  trailers: number; // количество прицепов
  lowLoaders: number; // количество тралов
}

export interface MkorUnit {
  id: string;
  diameter: number;
  name: string;
  start: string;
  availableFrom: string; // дата поступления от завода
  segments: number[]; // [транзит на объект, разгрузка, работа, погрузка, транзит на ТОИР, ТОИР]
}

export interface MkorInventory {
  diameter: number;
  count: number;
  availableFrom: string; // дата поступления от завода
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
      Math.ceil(specs.unloadingTime),
      specs.workingPeriod,
      Math.ceil(specs.loadingTime),
      specs.transitToMaintenance,
      specs.maintenanceTime
    ]
  };
}

// Функция для проверки доступности МКОР на дату
export function isMkorAvailable(mkor: MkorUnit, date: string): boolean {
  return new Date(date) >= new Date(mkor.availableFrom);
}

// Функция для определения этапа МКОР на конкретную дату
export function getMkorStageOnDate(mkor: MkorUnit, date: Date): {
  stage: keyof typeof STAGE_NAMES;
  requiresTransport: boolean;
} | null {
  const startDate = new Date(mkor.start);
  const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 0) return null;
  
  let currentDay = 0;
  const stages: (keyof typeof STAGE_NAMES)[] = [
    'transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'
  ];
  
  for (let i = 0; i < stages.length; i++) {
    const segmentDuration = mkor.segments[i];
    if (daysDiff >= currentDay && daysDiff < currentDay + segmentDuration) {
      const stage = stages[i];
      const requiresTransport = ['transitToObject', 'unloading', 'loading', 'transitToMaintenance'].includes(stage);
      return { stage, requiresTransport };
    }
    currentDay += segmentDuration;
  }
  
  return null;
}