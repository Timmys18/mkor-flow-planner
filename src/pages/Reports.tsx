import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, Truck, Wrench, Route, FileText } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { MkorUnit, MKOR_SPECS, getJobSegments } from '@/types/mkor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer } from 'recharts';
import { MkorTimeline } from '@/components/MkorTimeline';
import { UtilizationAndRentalCharts } from '@/components/UtilizationChart';
import DistanceCalculator from '@/components/DistanceCalculator';

interface ReportsProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
  onDateChange: (startDate: string, endDate: string) => void;
}

type ReportTab = 'production' | 'maintenance' | 'logistics' | 'placeholder';

const ReportSidebar: React.FC<{
  selectedTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
}> = ({ selectedTab, onTabChange }) => {
  const tabs = [
    { id: 'production' as ReportTab, label: 'Производственная программа', icon: BarChart3 },
    { id: 'maintenance' as ReportTab, label: 'ТОиР и загрузка подрядчика', icon: Wrench },
    { id: 'logistics' as ReportTab, label: 'Логистика', icon: Route },
    { id: 'placeholder' as ReportTab, label: 'Заглушка 2', icon: FileText },
  ];

  return (
    <div className="w-72 bg-secondary/30 rounded-lg p-4 space-y-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            variant={selectedTab === tab.id ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start gap-3 h-14 rounded-xl transition-all duration-200 text-left',
              selectedTab === tab.id 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'hover:bg-secondary/50'
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium leading-tight">{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );
};

const DateRangePicker: React.FC<{
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  projectStart: string;
  projectEnd: string;
}> = ({ startDate, endDate, onDateChange, projectStart, projectEnd }) => {
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="text-lg font-semibold text-foreground mb-2">Отчётный период</div>
      <div className="flex gap-4">
        {/* Начало периода */}
        <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              'w-[160px] justify-start text-left font-normal bg-secondary border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow',
              !startDate && 'text-muted-foreground'
            )}>
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              {startDate ? format(parseISO(startDate), 'dd.MM.yyyy') : 'Дата начала'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0">
            <CalendarComponent
              mode="single"
              selected={startDate ? parseISO(startDate) : undefined}
              onSelect={(date) => {
                if (date) {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  onDateChange(dateStr, endDate);
                  setStartPopoverOpen(false);
                }
              }}
              disabled={(date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return dateStr < projectStart || dateStr > projectEnd || (endDate && dateStr > endDate);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        {/* Окончание периода */}
        <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              'w-[160px] justify-start text-left font-normal bg-secondary border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow',
              !endDate && 'text-muted-foreground'
            )}>
              <Calendar className="mr-2 h-4 w-4 text-primary" />
              {endDate ? format(parseISO(endDate), 'dd.MM.yyyy') : 'Дата окончания'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0">
            <CalendarComponent
              mode="single"
              selected={endDate ? parseISO(endDate) : undefined}
              onSelect={(date) => {
                if (date) {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  onDateChange(startDate, dateStr);
                  setEndPopoverOpen(false);
                }
              }}
              disabled={(date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return dateStr < projectStart || dateStr > projectEnd || (startDate && dateStr < startDate);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

// Функция для получения сегментов с датами (как в MkorTimeline)
const getMkorSegmentsWithDates = (mkor: MkorUnit, startDate: string) => {
  if (!mkor.jobs || mkor.jobs.length === 0) return [];
  
  // Берем первую работу для расчета сегментов
  const job = mkor.jobs[0];
  const segments = getJobSegments(mkor, job);
  
  const result = [];
  let currentDate = parseISO(startDate);
  const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
  
  stages.forEach((stage, index) => {
    const duration = segments[index] || 0;
    if (duration > 0) {
      const endDate = addDays(currentDate, duration - 1);
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
    }
  });
  return result;
};

// Специальный компонент для календаря аренды
const RentalMkorTimeline: React.FC<{
  mkorUnits: MkorUnit[];
  startDate: string;
  endDate: string;
}> = ({ mkorUnits, startDate, endDate }) => {
  // Создаём МКОР с правильными данными для отображения
  const processedMkors = mkorUnits.map(mkor => {
    // Создаём МКОР с правильной структурой для аренды
    // У нас уже есть правильные segments и start, но нужно сохранить jobs для совместимости
    return {
      ...mkor,
      // Убеждаемся, что segments - это массив
      segments: Array.isArray(mkor.segments) ? mkor.segments : mkor.segments
    };
  });

  console.log('RentalMkorTimeline - processed MKORs:', processedMkors.map(mkor => ({
    name: mkor.name,
    start: mkor.start,
    segments: mkor.segments,
    hasJobs: !!mkor.jobs,
    jobsCount: mkor.jobs?.length || 0,
    debug: (mkor as any)._debug
  })));

  return (
    <MkorTimeline 
      mkorUnits={processedMkors}
      startDate={startDate}
      endDate={endDate}
      onMkorUnitsChange={() => {}}
    />
  );
};

// Компонент для отображения графика работ (полный цикл)
const WorkTimeline: React.FC<{
  mkorUnits: MkorUnit[];
  startDate: string;
  endDate: string;
}> = ({ mkorUnits, startDate, endDate }) => {
  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto h-96">
        <MkorTimeline 
          mkorUnits={mkorUnits}
          startDate={startDate}
          endDate={endDate}
          onMkorUnitsChange={() => {}}
          mode="full"
        />
      </div>
    </div>
  );
};

// Компонент для отображения календаря аренды (только этапы аренды)
const RentalTimeline: React.FC<{
  mkorUnits: MkorUnit[];
  startDate: string;
  endDate: string;
}> = ({ mkorUnits, startDate, endDate }) => {
  // Фильтруем МКОР, у которых есть этап "работа у заказчика"
  const mkorsWithWork = mkorUnits.filter(mkor => {
    if (!mkor.jobs || mkor.jobs.length === 0) return false;
    
    // Проверяем все работы МКОР
    for (const job of mkor.jobs) {
      const segments = getJobSegments(mkor, job);
      
      // Проверяем, есть ли этап "работа у заказчика" (индекс 2)
      if (segments[2] && segments[2] > 0) {
        return true;
      }
    }
    
    return false;
  });

  // Создаём МКОР с правильными сегментами для аренды
  // Один МКОР = одна строка, все аренды на одной временной шкале
  const rentalMkors = mkorsWithWork.map(mkor => {
    console.log(`=== Processing MKOR ${mkor.name} for rental ===`);
    console.log('Jobs count:', mkor.jobs?.length || 0);
    mkor.jobs?.forEach((job, index) => {
      console.log(`Job ${index + 1}:`, {
        customer: job.customer,
        start: job.start,
        lpu: job.lpu
      });
    });
    
    // Собираем все сегменты аренды со всех работ этого МКОР
    const allRentalSegments = [];
    
    for (const job of mkor.jobs!) {
      const allSegments = getMkorSegmentsWithDates(mkor, job.start);
      const rentalSegments = allSegments.filter(segment => 
        ['unloading', 'working', 'loading'].includes(segment.stage)
      );
      
      console.log(`Rental segments for job ${job.start}:`, rentalSegments.length);
      allRentalSegments.push(...rentalSegments);
    }
    
    console.log('Total rental segments found:', allRentalSegments.length);
    
    if (allRentalSegments.length === 0) {
      console.log('No rental segments found for MKOR:', mkor.name);
      return { ...mkor, segments: [] };
    }
    
    // Сортируем все сегменты аренды по дате начала
    allRentalSegments.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // Находим общую дату начала (самая ранняя дата аренды)
    const rentalStartDate = allRentalSegments[0].start;
    
    // Создаём массив длительностей для всех этапов аренды в хронологическом порядке
    const rentalDurations = allRentalSegments.map(seg => seg.duration);
    
    console.log('=== RENTAL MKOR CREATED ===');
    console.log('Name:', mkor.name);
    console.log('Total rental segments:', allRentalSegments.length);
    console.log('Rental start:', format(rentalStartDate, 'dd.MM.yyyy'));
    console.log('All rental segments with dates:');
    allRentalSegments.forEach(s => {
      console.log(`  ${s.stage}: ${format(s.start, 'dd.MM.yyyy')} - ${format(s.end, 'dd.MM.yyyy')} (${s.duration} days)`);
    });
    console.log('Rental durations:', rentalDurations);
    console.log('========================');
    
    const rentalMkor = {
      ...mkor,
      start: format(rentalStartDate, 'yyyy-MM-dd'), // Начинаем с даты первого этапа аренды
      segments: rentalDurations,
      // Убираем jobs, чтобы MkorTimeline использовал mkor.start и mkor.segments
      jobs: [],
      // Добавляем отладочную информацию
      _debug: {
        originalMkorName: mkor.name,
        rentalStart: format(rentalStartDate, 'yyyy-MM-dd'),
        rentalDurations,
        rentalSegments: allRentalSegments.map(s => ({
          stage: s.stage,
          start: format(s.start, 'dd.MM.yyyy'),
          end: format(s.end, 'dd.MM.yyyy'),
          duration: s.duration
        }))
      }
    } as any;
    
    console.log('Final rental MKOR for timeline:', {
      name: rentalMkor.name,
      start: rentalMkor.start,
      segments: rentalMkor.segments,
      rentalStartDate: format(rentalStartDate, 'yyyy-MM-dd'),
      hasJobs: !!rentalMkor.jobs,
      jobsCount: rentalMkor.jobs?.length || 0,
      debug: rentalMkor._debug
    });
    
    return rentalMkor;
  });

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto h-96">
        <MkorTimeline 
          mkorUnits={rentalMkors}
          startDate={startDate}
          endDate={endDate}
          onMkorUnitsChange={() => {}}
          mode="rental"
        />
      </div>
    </div>
  );
};

const ProductionProgram: React.FC<{
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}> = ({ startDate, endDate, mkorUnits }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');

  // Проверяем, что даты выбраны
  if (!startDate || !endDate) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4" />
          <p>Выберите отчётный период для просмотра данных</p>
        </div>
      </div>
    );
  }

  // Получаем список всех заказчиков
  const customers = Array.from(new Set(
    mkorUnits
      .filter(mkor => mkor.jobs && mkor.jobs.length > 0)
      .flatMap(mkor => mkor.jobs!.map(job => job.customer))
      .filter(customer => customer && customer.trim() !== '')
  )).sort();

  // Отладочная информация
  console.log('Всего МКОР:', mkorUnits.length);
  console.log('МКОР с работами:', mkorUnits.filter(mkor => mkor.jobs && mkor.jobs.length > 0).length);
  console.log('Заказчики:', customers);
  console.log('Выбранный заказчик:', selectedCustomer);
  
  // Отладочная информация для выбранного заказчика
  if (selectedCustomer && selectedCustomer !== 'all') {
    const filteredMkors = mkorUnits
      .filter(mkor => 
        mkor.jobs && mkor.jobs.length > 0 && 
        mkor.jobs.some(job => job.customer === selectedCustomer)
      )
      .map(mkor => ({
        ...mkor,
        jobs: mkor.jobs!.filter(job => job.customer === selectedCustomer)
      }));
    
    console.log(`Отфильтрованные МКОР для заказчика "${selectedCustomer}":`, 
      filteredMkors.map(m => ({
        name: m.name,
        jobsCount: m.jobs.length,
        jobs: m.jobs.map(j => ({ customer: j.customer, start: j.start, lpu: j.lpu }))
      }))
    );
  }

  // Подсчёт МКОР в работе (уникальные единицы с любым этапом в периоде)
  const mkorInWork = mkorUnits.filter(mkor => {
    if (!mkor.jobs || mkor.jobs.length === 0) return false;
    
    // Проверяем все работы МКОР
    for (const job of mkor.jobs) {
      const segments = getMkorSegmentsWithDates(mkor, job.start);
      
      const reportStart = parseISO(startDate);
      const reportEnd = parseISO(endDate);
      
      // Проверяем, есть ли хотя бы один день любого этапа в отчётном периоде
      if (segments.some(segment => 
        segment.start <= reportEnd && segment.end >= reportStart
      )) {
        return true;
      }
    }
    
    return false;
  }).length;

  // Подсчёт общего количества транспорта на конец выбранного периода
  const transportDays = 0; // Пока заглушка, нужно добавить данные о поставках транспорта
  
  // TODO: Добавить логику подсчёта общего транспорта на конец периода
  // const transportDays = fleetSupply
  //   .filter(supply => parseISO(supply.date) <= parseISO(endDate))
  //   .reduce((total, supply) => ({
  //     tractors: total.tractors + supply.tractors,
  //     trailers: total.trailers + supply.trailers,
  //     lowLoaders: total.lowLoaders + supply.lowLoaders
  //   }), { tractors: 0, trailers: 0, lowLoaders: 0 });

  // Подсчёт максимального количества транспорта на отчетную дату
  const transportBreakdown = mkorUnits.reduce((acc, mkor) => {
    if (!mkor.jobs || mkor.jobs.length === 0) return acc;
    
    // Проверяем все работы МКОР
    for (const job of mkor.jobs) {
      const segments = getMkorSegmentsWithDates(mkor, job.start);
      const transportSegments = segments.filter(seg => 
        ['transitToObject', 'unloading', 'loading', 'transitToMaintenance'].includes(seg.stage)
      );
      
      // Проверяем, есть ли транспортные этапы в отчетном периоде
      const hasTransportInPeriod = transportSegments.some(segment => {
        const reportStart = parseISO(startDate);
        const reportEnd = parseISO(endDate);
        
        return segment.start <= reportEnd && segment.end >= reportStart;
      });
      
      // Если есть транспортные этапы в периоде, добавляем транспорт для этого МКОР
      if (hasTransportInPeriod) {
        const specs = MKOR_SPECS[mkor.diameter];
        if (specs) {
          acc.tractors += specs.tractors;
          acc.trailers += specs.trailers;
          acc.lowLoaders += specs.lowLoaders;
        }
        // Прерываем цикл, так как нам нужен только один вклад транспорта на МКОР
        break;
      }
    }
    
    return acc;
  }, { tractors: 0, trailers: 0, lowLoaders: 0 });



  return (
    <div className="space-y-6">
             {/* Карточки KPI */}
       <div className="grid grid-cols-1 gap-6">
         <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-200/20">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-green-500/20 rounded-lg">
               <BarChart3 className="w-6 h-6 text-green-600" />
             </div>
             <div className="flex-1">
               <p className="text-sm text-muted-foreground">МКОР в работе</p>
               <p className="text-2xl font-bold text-green-600 transition-all duration-500 ease-in-out">
                 {mkorInWork}
               </p>
             </div>
             <div className="flex items-center gap-6">
               <div className="text-center">
                 <Truck className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                 <p className="text-xs text-muted-foreground">Тягачи</p>
                 <p className="text-lg font-semibold text-blue-600">{transportBreakdown.tractors}</p>
               </div>
               <div className="text-center">
                 <div className="w-5 h-5 bg-blue-600 rounded-sm mx-auto mb-1 flex items-center justify-center">
                   <div className="w-3 h-2 bg-white rounded-sm"></div>
                 </div>
                 <p className="text-xs text-muted-foreground">Прицепы</p>
                 <p className="text-lg font-semibold text-blue-600">{transportBreakdown.trailers}</p>
               </div>
               <div className="text-center">
                 <div className="w-5 h-5 bg-blue-600 rounded-sm mx-auto mb-1 flex items-center justify-center">
                   <div className="w-4 h-1 bg-white rounded-sm"></div>
                 </div>
                 <p className="text-xs text-muted-foreground">Тралы</p>
                 <p className="text-lg font-semibold text-blue-600">{transportBreakdown.lowLoaders}</p>
               </div>
             </div>
           </div>
         </Card>
       </div>

             {/* Новые чарты утилизации и аренды */}
             <UtilizationAndRentalCharts 
               mkorUnits={mkorUnits}
               startDate={startDate}
               endDate={endDate}
             />

             {/* Раздел заказчиков - перемещён в центр */}
       <div className="text-center mb-6 max-w-full">
         <h2 className="text-2xl font-bold text-foreground mb-4">Работы по заказчику</h2>
         <div className="flex items-center justify-center gap-4 flex-wrap">
           <span className="text-sm font-medium">Выберите заказчика:</span>
           <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
             <SelectTrigger className="w-[300px] max-w-full">
               <SelectValue placeholder="Все заказчики" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Все заказчики</SelectItem>
               {customers.map(customer => (
                 <SelectItem key={customer} value={customer}>
                   {customer}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       </div>
      
             {/* Графики заказчика - только если выбран конкретный заказчик */}
       {selectedCustomer && selectedCustomer !== 'all' && (
         <div className="space-y-6 max-w-full">
           {/* График работ - на всю ширину с правильным скроллом */}
           <Card className="p-6 max-w-full">
             <h4 className="text-lg font-semibold mb-4">График работ</h4>
             <div className="max-w-full overflow-hidden">
               <WorkTimeline 
                 mkorUnits={mkorUnits
                   .filter(mkor => 
                     mkor.jobs && mkor.jobs.length > 0 && 
                     mkor.jobs.some(job => job.customer === selectedCustomer)
                   )
                   .map(mkor => ({
                     ...mkor,
                     jobs: mkor.jobs!.filter(job => job.customer === selectedCustomer)
                   }))
                 }
                 startDate={startDate}
                 endDate={endDate}
               />
             </div>
           </Card>
           
           {/* Календарь аренды - на всю ширину с правильным скроллом */}
           <Card className="p-6 max-w-full">
             <h4 className="text-lg font-semibold mb-4">Календарь аренды</h4>
             <div className="max-w-full overflow-hidden">
               <RentalTimeline 
                 mkorUnits={mkorUnits
                   .filter(mkor => 
                     mkor.jobs && mkor.jobs.length > 0 && 
                     mkor.jobs.some(job => job.customer === selectedCustomer)
                   )
                   .map(mkor => ({
                     ...mkor,
                     jobs: mkor.jobs!.filter(job => job.customer === selectedCustomer)
                   }))
                 }
                 startDate={startDate}
                 endDate={endDate}
               />
             </div>
                         {/* Статистика аренды по МКОР */}
             <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
               <h5 className="text-sm font-medium mb-4">Статистика аренды по МКОР:</h5>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm">
                   <thead>
                     <tr className="border-b">
                                               <th className="text-left p-2 font-medium w-1/5">МКОР</th>
                        <th className="text-left p-2 font-medium w-1/5">Период аренды</th>
                        <th className="text-left p-2 font-medium w-1/4">Дата выполнения</th>
                        <th className="text-left p-2 font-medium w-1/3">ЛПУ</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(() => {
                       // Создаем массив всех строк таблицы
                       const tableRows = [];
                       
                       for (const mkor of mkorUnits) {
                         if (!mkor.jobs || mkor.jobs.length === 0) continue;
                         
                         // Находим все работы для выбранного заказчика
                         const customerJobs = mkor.jobs.filter(job => job.customer === selectedCustomer);
                         
                         // Для каждой работы создаем отдельную строку
                         for (const job of customerJobs) {
                           // Используем getJobSegments для получения сегментов конкретной работы
                           const jobSegments = getJobSegments(mkor, job);
                           let currentDate = parseISO(job.start);
                           const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
                           
                           // Создаем сегменты с датами для этой конкретной работы
                           const segments = jobSegments.map((duration, index) => {
                             if (duration > 0) {
                               const stage = stages[index];
                               const endDate = addDays(currentDate, duration - 1);
                               endDate.setHours(23, 59, 59, 999);
                               
                               const segment = {
                                 stage,
                                 start: new Date(currentDate),
                                 end: endDate,
                                 duration,
                                 index
                               };
                               
                               currentDate = addDays(endDate, 1);
                               currentDate.setHours(0, 0, 0, 0);
                               
                               return segment;
                             }
                             return null;
                           }).filter(Boolean);
                           
                           const rentalSegments = segments.filter(seg => ['unloading', 'working', 'loading'].includes(seg.stage));
                           
                           if (rentalSegments.length === 0) continue;
                           
                           const rentalDays = rentalSegments.reduce((sum, seg) => sum + seg.duration, 0);
                           const startDate = format(rentalSegments[0].start, 'dd.MM.yyyy');
                           const endDate = format(rentalSegments[rentalSegments.length - 1].end, 'dd.MM.yyyy');
                           const lpu = job.lpu || 'Не указано';
                           
                           tableRows.push({
                             mkorName: mkor.name,
                             rentalDays,
                             startDate,
                             endDate,
                             lpu,
                             key: `${mkor.name}-${job.start}-${job.customer}`,
                             startTime: rentalSegments[0].start.getTime()
                           });
                         }
                       }
                       
                       // Сортируем по дате начала
                       tableRows.sort((a, b) => a.startTime - b.startTime);
                       
                       // Рендерим отсортированные строки
                       return tableRows.map(row => (
                         <tr key={row.key} className="border-b border-border/50">
                           <td className="p-2 font-medium w-1/5">{row.mkorName}</td>
                           <td className="p-2 w-1/5">{row.rentalDays} дней</td>
                           <td className="p-2 w-1/4">{row.startDate}-{row.endDate}</td>
                           <td className="p-2 w-1/3">{row.lpu}</td>
                         </tr>
                       ));
                     })()}
                   </tbody>
                 </table>
               </div>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const MaintenanceReport: React.FC<{
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}> = ({ startDate, endDate, mkorUnits }) => {
  // Отладочная информация
  console.log('MaintenanceReport - входные данные:', {
    startDate,
    endDate,
    reportPeriod: `${startDate} - ${endDate}`,
    mkorUnitsCount: mkorUnits.length,
    mkorUnits: mkorUnits.map(m => ({
      name: m.name,
      jobsCount: m.jobs?.length || 0,
      jobs: m.jobs?.map(j => ({ customer: j.customer, start: j.start }))
    }))
  });
  
  // Проверяем, включает ли период дату 20.09.2025
  const targetDate = parseISO('2025-09-20');
  const reportStart = parseISO(startDate);
  const reportEnd = parseISO(endDate);
  console.log('Проверка периода для 20.09.2025:', {
    targetDate: targetDate.toISOString(),
    reportStart: reportStart.toISOString(),
    reportEnd: reportEnd.toISOString(),
    isInPeriod: targetDate >= reportStart && targetDate <= reportEnd
  });
  
  // Проверяем, что даты выбраны
  if (!startDate || !endDate) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4" />
          <p>Выберите отчётный период для просмотра данных</p>
        </div>
      </div>
    );
  }

  // Фильтруем МКОР, у которых есть этап ТОИР в выбранном периоде
  const mkorsWithMaintenance = mkorUnits.filter(mkor => {
    if (!mkor.jobs || mkor.jobs.length === 0) return false;
    
    // Проверяем все работы МКОР
    for (const job of mkor.jobs) {
      const segments = getJobSegments(mkor, job);
      
      // Проверяем, есть ли этап ТОИР (индекс 5) и он больше 0 дней
      if (!segments[5] || segments[5] <= 0) continue;
      
      // Вычисляем дату начала ТОИР
      const allSegments = getMkorSegmentsWithDates(mkor, job.start);
      const maintenanceSegment = allSegments.find(seg => seg.stage === 'maintenance');
      
      if (!maintenanceSegment) continue;
      
      // Проверяем, попадает ли ТОИР в выбранный период
      const reportStart = parseISO(startDate);
      const reportEnd = parseISO(endDate);
      
      // Отладочная информация для DN-1400
      if (mkor.name === 'DN-1400') {
        console.log('DN-1400 ТОИР проверка:', {
          jobCustomer: job.customer,
          jobStart: job.start,
          maintenanceStart: maintenanceSegment.start,
          maintenanceEnd: maintenanceSegment.end,
          reportStart,
          reportEnd,
          isInPeriod: maintenanceSegment.start <= reportEnd && maintenanceSegment.end >= reportStart
        });
      }
      
      if (maintenanceSegment.start <= reportEnd && maintenanceSegment.end >= reportStart) {
        return true;
      }
    }
    
    return false;
  });

  // Если нет ТОИР в выбранном периоде
  if (mkorsWithMaintenance.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Wrench className="w-12 h-12 mx-auto mb-4" />
          <p>Нет ТОИР в заданный период</p>
        </div>
      </div>
    );
  }

  // Создаём МКОР с правильными сегментами для ТОИР
  const maintenanceMkors = mkorsWithMaintenance.map(mkor => {
    // Находим все работы с ТОИР в выбранном периоде
    const maintenanceSegments = [];
    
    for (const job of mkor.jobs!) {
      const allSegments = getMkorSegmentsWithDates(mkor, job.start);
      const maintenanceSegment = allSegments.find(seg => seg.stage === 'maintenance');
      
      if (maintenanceSegment) {
        const reportStart = parseISO(startDate);
        const reportEnd = parseISO(endDate);
        
        if (maintenanceSegment.start <= reportEnd && maintenanceSegment.end >= reportStart) {
          maintenanceSegments.push({
            job,
            segment: maintenanceSegment
          });
        }
      }
    }
    
    if (maintenanceSegments.length === 0) {
      return { ...mkor, segments: [] };
    }
    
    // Создаём МКОР с сегментами ТОИР
    const maintenanceMkor = {
      ...mkor,
      start: format(maintenanceSegments[0].segment.start, 'yyyy-MM-dd'),
      segments: maintenanceSegments.map(ms => ms.segment.duration), // Все длительности ТОИР
      jobs: [], // Убираем jobs, чтобы MkorTimeline использовал mkor.start и mkor.segments
      _debug: {
        maintenanceSegments: maintenanceSegments.map(ms => ({
          job: ms.job,
          maintenanceStart: format(ms.segment.start, 'yyyy-MM-dd'),
          maintenanceEnd: format(ms.segment.end, 'yyyy-MM-dd'),
          maintenanceDuration: ms.segment.duration
        }))
      }
    } as any;
    
    console.log('Maintenance MKOR created:', {
      name: maintenanceMkor.name,
      start: maintenanceMkor.start,
      segments: maintenanceMkor.segments,
      debug: maintenanceMkor._debug
    });
    
    return maintenanceMkor;
  });

  console.log('MaintenanceReport - Final data:', {
    selectedPeriod: { startDate, endDate },
    mkorsWithMaintenanceCount: mkorsWithMaintenance.length,
    maintenanceMkorsCount: maintenanceMkors.length,
    maintenanceMkors: maintenanceMkors.map(m => ({
      name: m.name,
      start: m.start,
      segments: m.segments,
      hasJobs: !!m.jobs?.length
    }))
  });

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">ТОиР и загрузка подрядчика</h2>
      </div>

       {/* Статистика */}
       <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-200/20 max-w-full">
         <div className="flex items-center gap-4">
           <div className="p-3 bg-orange-500/20 rounded-lg">
             <Wrench className="w-6 h-6 text-orange-600" />
           </div>
           <div>
             <p className="text-sm text-muted-foreground">ТОИР в отчетном периоде</p>
             <p className="text-2xl font-bold text-orange-600">
               {maintenanceMkors.reduce((total, mkor) => total + mkor._debug.maintenanceSegments.length, 0)}
             </p>
           </div>
         </div>
       </Card>

      {/* Временная шкала ТОИР */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Временная шкала ТОИР</h3>
        <div className="w-full border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <MkorTimeline 
              mkorUnits={maintenanceMkors}
              startDate={startDate}
              endDate={endDate}
              onMkorUnitsChange={() => {}}
            />
          </div>
        </div>
      </Card>

             {/* Детальная статистика ТОИР - перепроектированная таблица */}
       <Card className="p-6">
         <h3 className="text-lg font-semibold mb-4">Детальная статистика ТОИР</h3>
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="border-b">
                                   <th className="text-left p-2 font-medium w-1/8">МКОР</th>
                  <th className="text-left p-2 font-medium w-1/8">Длительность ТОИР</th>
                  <th className="text-left p-2 font-medium w-1/6">Период ТОИР</th>
                  <th className="text-left p-2 font-medium w-1/2">Локация</th>
               </tr>
             </thead>
             <tbody>
               {(() => {
                 // Создаем массив всех строк таблицы
                 const tableRows = maintenanceMkors.flatMap(maintenanceMkor => 
                   maintenanceMkor._debug.maintenanceSegments.map((ms, index) => ({
                     mkorName: maintenanceMkor.name,
                     maintenanceDuration: ms.maintenanceDuration,
                     maintenanceStartDate: ms.maintenanceStart,
                     maintenanceEndDate: ms.maintenanceEnd,
                     location: ms.job.customer + (ms.job.lpu ? `\n(${ms.job.lpu})` : ''),
                     key: `${maintenanceMkor.id}-${index}`,
                     startTime: parseISO(ms.maintenanceStart).getTime()
                   }))
                 );
                 
                 // Сортируем по дате начала
                 tableRows.sort((a, b) => a.startTime - b.startTime);
                 
                 // Рендерим отсортированные строки
                 return tableRows.map(row => (
                   <tr key={row.key} className="border-b border-border/50">
                     <td className="p-2 font-medium w-1/8">{row.mkorName}</td>
                     <td className="p-2 w-1/8">{row.maintenanceDuration} дн.</td>
                     <td className="p-2 w-1/6">{row.maintenanceStartDate}-{row.maintenanceEndDate}</td>
                     <td className="p-2 w-1/2 whitespace-pre-line">{row.location}</td>
                   </tr>
                 ));
               })()}
             </tbody>
           </table>
         </div>
       </Card>
    </div>
  );
};

const LogisticsReport: React.FC<{
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}> = ({ startDate, endDate, mkorUnits }) => {
  return <DistanceCalculator />;
};



const PlaceholderReport: React.FC<{
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}> = ({ startDate, endDate, mkorUnits }) => {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <p>Заглушка 2</p>
        <p className="text-sm mt-2">В разработке</p>
      </div>
    </div>
  );
};

export const Reports: React.FC<ReportsProps> = ({
  startDate: projectStart,
  endDate: projectEnd,
  mkorUnits,
  onDateChange,
}) => {
  const [selectedTab, setSelectedTab] = useState<ReportTab>('production');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // Загрузка сохранённого периода из localStorage
  useEffect(() => {
    const savedStart = localStorage.getItem('reportStartDate');
    const savedEnd = localStorage.getItem('reportEndDate');
    if (savedStart && savedEnd) {
      setReportStartDate(savedStart);
      setReportEndDate(savedEnd);
    }
  }, []);

  // Сохранение периода в localStorage
  useEffect(() => {
    if (reportStartDate && reportEndDate) {
      localStorage.setItem('reportStartDate', reportStartDate);
      localStorage.setItem('reportEndDate', reportEndDate);
    }
  }, [reportStartDate, reportEndDate]);

  const handleDateChange = (start: string, end: string) => {
    setReportStartDate(start);
    setReportEndDate(end);
  };

  const renderContent = () => {
    switch (selectedTab) {
      case 'production':
        return (
          <ProductionProgram
            startDate={reportStartDate}
            endDate={reportEndDate}
            mkorUnits={mkorUnits}
          />
        );
      case 'maintenance':
        return (
          <MaintenanceReport
            startDate={reportStartDate}
            endDate={reportEndDate}
            mkorUnits={mkorUnits}
          />
        );
      case 'logistics':
        return (
          <LogisticsReport
            startDate={reportStartDate}
            endDate={reportEndDate}
            mkorUnits={mkorUnits}
          />
        );

      case 'placeholder':
        return (
          <PlaceholderReport
            startDate={reportStartDate}
            endDate={reportEndDate}
            mkorUnits={mkorUnits}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-full overflow-x-hidden">
      <div className="flex flex-col max-w-full">
        <div className="flex-shrink-0 p-6">
          <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Отчёты</h1>
          
          {selectedTab !== 'logistics' && (
            <DateRangePicker
              startDate={reportStartDate}
              endDate={reportEndDate}
              onDateChange={handleDateChange}
              projectStart={projectStart}
              projectEnd={projectEnd}
            />
          )}
        </div>
        
        <div className="flex-1 flex gap-6 px-6 pb-6 max-w-full">
          <ReportSidebar selectedTab={selectedTab} onTabChange={setSelectedTab} />
          <div className="flex-1 max-w-full">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}; 