import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, Truck, Wrench, Route, FileText, Users } from 'lucide-react';
import { format, eachMonthOfInterval, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { MkorUnit, MKOR_SPECS, getJobSegments } from '@/types/mkor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { MkorTimeline } from '@/components/MkorTimeline';

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
  
  const job = mkor.jobs[0];
  const segments = getJobSegments(mkor, job);
  
  const result = [];
  let currentDate = parseISO(startDate);
  const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
  
  stages.forEach((stage, index) => {
    const duration = segments[index] || 0;
    if (duration > 0) {
      const durationMs = duration * 24 * 60 * 60 * 1000;
      const endDate = new Date(currentDate.getTime() + durationMs);
      result.push({
        stage,
        start: new Date(currentDate),
        end: endDate,
        duration,
        index,
      });
      currentDate = endDate;
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
      <div className="overflow-x-auto">
        <MkorTimeline 
          mkorUnits={mkorUnits}
          startDate={startDate}
          endDate={endDate}
          onMkorUnitsChange={() => {}}
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
    
    const job = mkor.jobs[0];
    const segments = getJobSegments(mkor, job);
    
    // Проверяем, есть ли этап "работа у заказчика" (индекс 2)
    return segments[2] && segments[2] > 0;
  });

  // Создаём МКОР с правильными сегментами для аренды
  const rentalMkors = mkorsWithWork.map(mkor => {
    const job = mkor.jobs![0];
    const originalSegments = getJobSegments(mkor, job);
    const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'];
    
    // Находим даты начала этапов аренды
    const allSegments = getMkorSegmentsWithDates(mkor, job.start);
    const rentalSegments = allSegments.filter(segment => 
      ['unloading', 'working', 'loading'].includes(segment.stage)
    );
    
    if (rentalSegments.length === 0) {
      return { ...mkor, segments: [] };
    }
    
    // Вычисляем новую дату начала (дата начала первого этапа аренды)
    const rentalStartDate = rentalSegments[0].start;
    
    // Создаём массив длительностей для этапов аренды в правильном порядке
    const rentalDurations = rentalSegments.map(seg => seg.duration);
    
    console.log('=== RENTAL MKOR CREATED ===');
    console.log('Name:', mkor.name);
    console.log('Original start:', job.start);
    console.log('Rental start:', format(rentalStartDate, 'dd.MM.yyyy'));
    console.log('All segments with dates:');
    allSegments.forEach(s => {
      console.log(`  ${s.stage}: ${format(s.start, 'dd.MM.yyyy')} - ${format(s.end, 'dd.MM.yyyy')} (${s.duration} days)`);
    });
    console.log('Rental segments with dates:');
    rentalSegments.forEach(s => {
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
        originalStart: job.start,
        rentalStart: format(rentalStartDate, 'yyyy-MM-dd'),
        rentalDurations,
        rentalSegments: rentalSegments.map(s => ({
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
      <div className="overflow-x-auto h-full">
        <RentalMkorTimeline 
          mkorUnits={rentalMkors}
          startDate={startDate}
          endDate={endDate}
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
      .map(mkor => mkor.jobs![0].customer)
      .filter(customer => customer && customer.trim() !== '')
  )).sort();

  // Отладочная информация
  console.log('Всего МКОР:', mkorUnits.length);
  console.log('МКОР с работами:', mkorUnits.filter(mkor => mkor.jobs && mkor.jobs.length > 0).length);
  console.log('Заказчики:', customers);
  console.log('Выбранный заказчик:', selectedCustomer);

  // Подсчёт МКОР в работе (уникальные единицы с любым этапом в периоде)
  const mkorInWork = mkorUnits.filter(mkor => {
    if (!mkor.jobs || mkor.jobs.length === 0) return false;
    
    const job = mkor.jobs[0];
    const segments = getMkorSegmentsWithDates(mkor, job.start);
    
    const reportStart = parseISO(startDate);
    const reportEnd = parseISO(endDate);
    
    // Проверяем, есть ли хотя бы один день любого этапа в отчётном периоде
    return segments.some(segment => 
      segment.start <= reportEnd && segment.end >= reportStart
    );
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

  // Подсчёт по типам транспорта
  const transportBreakdown = mkorUnits.reduce((acc, mkor) => {
    if (!mkor.jobs || mkor.jobs.length === 0) return acc;
    
    const job = mkor.jobs[0];
    const segments = getMkorSegmentsWithDates(mkor, job.start);
    const transportSegments = segments.filter(seg => 
      ['transitToObject', 'unloading', 'loading', 'transitToMaintenance'].includes(seg.stage)
    );
    
    let days = 0;
    transportSegments.forEach(segment => {
      const reportStart = parseISO(startDate);
      const reportEnd = parseISO(endDate);
      
      const overlapStart = new Date(Math.max(segment.start.getTime(), reportStart.getTime()));
      const overlapEnd = new Date(Math.min(segment.end.getTime(), reportEnd.getTime()));
      
      if (overlapStart <= overlapEnd) {
        days += Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000));
      }
    });
    
    // Используем данные из MKOR_SPECS для определения количества транспорта
    const specs = MKOR_SPECS[mkor.diameter];
    if (specs && days > 0) {
      acc.tractors += specs.tractors * days;
      acc.trailers += specs.trailers * days;
      acc.lowLoaders += specs.lowLoaders * days;
    }
    
    return acc;
  }, { tractors: 0, trailers: 0, lowLoaders: 0 });

  // Данные для графиков
  const months = eachMonthOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  // График "Количество работ" (уникальные МКОР)
  const worksData = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const worksByDiameter: { [key: string]: number } = {};
    
    mkorUnits.forEach(mkor => {
      if (!mkor.jobs || mkor.jobs.length === 0) return;
      
      const job = mkor.jobs[0];
      
      // Фильтруем по заказчику, если выбран
      if (selectedCustomer && selectedCustomer !== 'all' && job.customer !== selectedCustomer) {
        return;
      }
      
      const segments = getMkorSegmentsWithDates(mkor, job.start);
      
      // Проверяем, есть ли работа в этом месяце
      const hasWorkInMonth = segments.some(segment => 
        segment.start <= monthEnd && segment.end >= monthStart
      );
      
      if (hasWorkInMonth) {
        // Используем уникальное имя МКОР вместо диаметра
        worksByDiameter[mkor.name] = (worksByDiameter[mkor.name] || 0) + 1;
      }
    });
    
    return {
      month: format(month, 'MMM yyyy', { locale: ru }),
      ...worksByDiameter,
    };
  });

  // График "МКОР в ожидании работы" (уникальные единицы без работы в периоде)
  const waitingData = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    const waitingByDiameter: { [key: string]: number } = {};
    
    mkorUnits.forEach(mkor => {
      const hasWorkInMonth = mkor.jobs && mkor.jobs.some(job => {
        const segments = getMkorSegmentsWithDates(mkor, job.start);
        return segments.some(segment => 
          segment.start <= monthEnd && segment.end >= monthStart
        );
      });
      
      if (!hasWorkInMonth) {
        // Используем уникальное имя МКОР вместо диаметра
        waitingByDiameter[mkor.name] = (waitingByDiameter[mkor.name] || 0) + 1;
      }
    });
    
    return {
      month: format(month, 'MMM yyyy', { locale: ru }),
      ...waitingByDiameter,
    };
  });

  return (
    <div className="space-y-6">
      {/* Карточки KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-200/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">МКОР в работе</p>
              <p className="text-2xl font-bold text-green-600 transition-all duration-500 ease-in-out">
                {mkorInWork}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Транспортные средства в работе</p>
              <p className="text-2xl font-bold text-blue-600 transition-all duration-500 ease-in-out">
                {transportDays} дн.
              </p>
              <div className="text-xs text-muted-foreground mt-1 transition-all duration-500 ease-in-out">
                Тягачи: {transportBreakdown.tractors} | Прицепы: {transportBreakdown.trailers} | Тралы: {transportBreakdown.lowLoaders}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Количество работ</h3>
          <div className="h-64">
            {worksData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={worksData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(worksData[0] || {}).filter(key => key !== 'month').map((mkorName, index) => (
                    <Bar 
                      key={mkorName} 
                      dataKey={mkorName} 
                      fill={`hsl(${index * 60}, 70%, 50%)`}
                      name={mkorName}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Нет данных для отображения</p>
              </div>
            )}
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">МКОР в ожидании работы</h3>
          <div className="h-64">
            {waitingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waitingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.keys(waitingData[0] || {}).filter(key => key !== 'month').map((mkorName, index) => (
                    <Bar 
                      key={mkorName} 
                      dataKey={mkorName} 
                      fill={`hsl(${index * 60 + 180}, 70%, 50%)`}
                      name={mkorName}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Нет данных для отображения</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Раздел заказчиков - перемещён в центр */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Работы по заказчику</h2>
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm font-medium">Выберите заказчика:</span>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="w-[300px]">
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
        <div className="space-y-6">
          {/* График работ - на всю ширину с правильным скроллом */}
          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4">График работ</h4>
            <WorkTimeline 
              mkorUnits={mkorUnits.filter(mkor => 
                mkor.jobs && mkor.jobs.length > 0 && 
                mkor.jobs[0].customer === selectedCustomer
              )}
              startDate={startDate}
              endDate={endDate}
            />
          </Card>
          
          {/* Календарь аренды - на всю ширину с правильным скроллом */}
          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4">Календарь аренды</h4>
            <RentalTimeline 
              mkorUnits={mkorUnits.filter(mkor => 
                mkor.jobs && mkor.jobs.length > 0 && 
                mkor.jobs[0].customer === selectedCustomer
              )}
              startDate={startDate}
              endDate={endDate}
            />
            {/* Статистика по диаметрам */}
            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
              <h5 className="text-sm font-medium mb-2">Статистика аренды по диаметрам:</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(
                  mkorUnits
                    .filter(mkor => 
                      mkor.jobs && mkor.jobs.length > 0 && 
                      mkor.jobs[0].customer === selectedCustomer
                    )
                    .reduce((acc, mkor) => {
                      const diameter = mkor.diameter;
                      if (!acc[diameter]) {
                        acc[diameter] = { count: 0, totalDays: 0 };
                      }
                      acc[diameter].count += 1;
                      // Считаем дни аренды (разгрузка + работа + погрузка)
                      const segments = getMkorSegmentsWithDates(mkor, mkor.jobs![0].start);
                      const rentalDays = segments
                        .filter(seg => ['unloading', 'working', 'loading'].includes(seg.stage))
                        .reduce((sum, seg) => sum + seg.duration, 0);
                      acc[diameter].totalDays += rentalDays;
                      return acc;
                    }, {} as { [key: number]: { count: number; totalDays: number } })
                ).map(([diameter, stats]) => (
                  <div key={diameter} className="flex justify-between">
                    <span>DN-{diameter}:</span>
                    <span>{stats.count} ед. ({stats.totalDays} дн.)</span>
                  </div>
                ))}
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
    
    const job = mkor.jobs[0];
    const segments = getJobSegments(mkor, job);
    
    // Проверяем, есть ли этап ТОИР (индекс 5) и он больше 0 дней
    if (!segments[5] || segments[5] <= 0) return false;
    
    // Вычисляем дату начала ТОИР
    const allSegments = getMkorSegmentsWithDates(mkor, job.start);
    const maintenanceSegment = allSegments.find(seg => seg.stage === 'maintenance');
    
    if (!maintenanceSegment) return false;
    
    // Проверяем, попадает ли ТОИР в выбранный период
    const reportStart = parseISO(startDate);
    const reportEnd = parseISO(endDate);
    
    return maintenanceSegment.start <= reportEnd && maintenanceSegment.end >= reportStart;
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
    const job = mkor.jobs![0];
    const allSegments = getMkorSegmentsWithDates(mkor, job.start);
    const maintenanceSegment = allSegments.find(seg => seg.stage === 'maintenance');
    
    if (!maintenanceSegment) {
      return { ...mkor, segments: [] };
    }
    
    // Создаём МКОР только с этапом ТОИР
    const maintenanceMkor = {
      ...mkor,
      start: format(maintenanceSegment.start, 'yyyy-MM-dd'),
      segments: [maintenanceSegment.duration], // Только длительность ТОИР
      jobs: [], // Убираем jobs, чтобы MkorTimeline использовал mkor.start и mkor.segments
      _debug: {
        originalStart: job.start,
        maintenanceStart: format(maintenanceSegment.start, 'yyyy-MM-dd'),
        maintenanceEnd: format(maintenanceSegment.end, 'yyyy-MM-dd'),
        maintenanceDuration: maintenanceSegment.duration
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
        <p className="text-muted-foreground">
          Период: {format(parseISO(startDate), 'dd.MM.yyyy')} - {format(parseISO(endDate), 'dd.MM.yyyy')}
        </p>
      </div>

      {/* Статистика */}
      <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-200/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <Wrench className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">МКОР в ТОИР</p>
            <p className="text-2xl font-bold text-orange-600">
              {mkorsWithMaintenance.length}
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

      {/* Детальная статистика - вынесена из контейнера графика */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Детальная статистика ТОИР</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* По диаметрам */}
          <div>
            <h4 className="text-sm font-medium mb-3">По диаметрам труб:</h4>
            <div className="space-y-2">
              {Object.entries(
                mkorsWithMaintenance.reduce((acc, mkor) => {
                  const diameter = mkor.diameter;
                  if (!acc[diameter]) {
                    acc[diameter] = { count: 0, totalDays: 0 };
                  }
                  acc[diameter].count += 1;
                  
                  // Считаем дни ТОИР
                  const job = mkor.jobs![0];
                  const segments = getJobSegments(mkor, job);
                  const maintenanceDays = segments[5] || 0;
                  acc[diameter].totalDays += maintenanceDays;
                  
                  return acc;
                }, {} as { [key: number]: { count: number; totalDays: number } })
              ).map(([diameter, stats]) => (
                <div key={diameter} className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                  <span className="font-medium">DN-{diameter}</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.count} ед. ({stats.totalDays} дн.)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* По заказчикам */}
          <div>
            <h4 className="text-sm font-medium mb-3">По заказчикам:</h4>
            <div className="space-y-2">
              {Object.entries(
                mkorsWithMaintenance.reduce((acc, mkor) => {
                  const customer = mkor.jobs![0].customer;
                  if (!acc[customer]) {
                    acc[customer] = { count: 0, totalDays: 0 };
                  }
                  acc[customer].count += 1;
                  
                  // Считаем дни ТОИР
                  const job = mkor.jobs![0];
                  const segments = getJobSegments(mkor, job);
                  const maintenanceDays = segments[5] || 0;
                  acc[customer].totalDays += maintenanceDays;
                  
                  return acc;
                }, {} as { [key: string]: { count: number; totalDays: number } })
              ).map(([customer, stats]) => (
                <div key={customer} className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                  <span className="font-medium">{customer}</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.count} ед. ({stats.totalDays} дн.)
                  </span>
                </div>
              ))}
            </div>
          </div>
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
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <Route className="w-12 h-12 mx-auto mb-4" />
        <p>Логистический отчёт</p>
        <p className="text-sm mt-2">В разработке</p>
      </div>
    </div>
  );
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
          
          <DateRangePicker
            startDate={reportStartDate}
            endDate={reportEndDate}
            onDateChange={handleDateChange}
            projectStart={projectStart}
            projectEnd={projectEnd}
          />
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