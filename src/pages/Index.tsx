import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MkorHeader } from '@/components/MkorHeader';
import { MkorTimeline } from '@/components/MkorTimeline';
import { TransportChart } from '@/components/TransportChart';
import { MkorInventoryTab } from '@/components/MkorInventoryTab';
import { Reports } from '@/pages/Reports';
import { format, addDays } from 'date-fns';
import { MkorUnit, MkorInventory, createMkorUnit } from '@/types/mkor';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

const Index = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 730), 'yyyy-MM-dd'));
  const [inventory, setInventory] = useState<MkorInventory[]>([]);
  const [mkorUnits, setMkorUnits] = useState<MkorUnit[]>([]);
  const [fleetSupplies, setFleetSupplies] = useState([]);
  useEffect(() => {
    fetch('/api/transport-supply')
      .then(res => res.json())
      .then(setFleetSupplies)
      .catch(() => setFleetSupplies([]));
  }, []);
  const [ownFleet, setOwnFleet] = useState({ tractors: 0, trailers: 0, lowLoaders: 0 });
  const mkorTimelineScrollRef = useRef<HTMLDivElement>(null);
  const transportChartScrollRef = useRef<HTMLDivElement>(null);

  // Синхронизация скролла: при прокрутке планировщика МКОР прокручивается и транспорт
  const handleMkorScroll = () => {
    if (mkorTimelineScrollRef.current && transportChartScrollRef.current) {
      transportChartScrollRef.current.scrollLeft = mkorTimelineScrollRef.current.scrollLeft;
    }
  };

  // Функция для загрузки МКОР с сервера
  const fetchMkorUnits = async () => {
    const res = await fetch('/api/mkor');
    const data = await res.json();
    setMkorUnits(data);
  };

  // Функция для загрузки инвентаря
  const fetchInventory = async () => {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    setInventory(data);
  };

  // Загрузка данных с API при монтировании
  useEffect(() => {
    fetchInventory();
    fetchMkorUnits();
  }, []);

  // --- LocalStorage для границ проекта ---
  useEffect(() => {
    const savedStart = localStorage.getItem('projectStart');
    const savedEnd = localStorage.getItem('projectEnd');
    if (savedStart && savedEnd) {
      setStartDate(savedStart);
      setEndDate(savedEnd);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('projectStart', startDate);
    localStorage.setItem('projectEnd', endDate);
  }, [startDate, endDate]);
  // --- END LocalStorage ---

  // Автоматическое обновление границ планировщика на основе реальных дат работ
  useEffect(() => {
    if (mkorUnits.length > 0) {
      let earliestStart = new Date();
      let latestEnd = new Date();
      
      mkorUnits.forEach(mkor => {
        if (mkor.jobs && mkor.jobs.length > 0) {
          const jobStart = new Date(mkor.jobs[0].start);
          if (jobStart < earliestStart) {
            earliestStart = jobStart;
          }
          
          // Вычисляем дату окончания работы с учётом дробных этапов
          let segments = [];
          if (mkor.jobs[0].customStages && mkor.jobs[0].customSegments) {
            try {
              segments = Array.isArray(mkor.jobs[0].customSegments) 
                ? mkor.jobs[0].customSegments 
                : JSON.parse(mkor.jobs[0].customSegments);
            } catch {
              segments = mkor.segments;
            }
          } else {
            segments = mkor.segments;
          }
          
          // Точный расчёт даты окончания по миллисекундам
          let currentDate = new Date(jobStart);
          segments.forEach(duration => {
            if (duration > 0) {
              const durationMs = duration * 24 * 60 * 60 * 1000;
              currentDate = new Date(currentDate.getTime() + durationMs);
            }
          });
          
          const jobEnd = currentDate;
          
          if (jobEnd > latestEnd) {
            latestEnd = jobEnd;
          }
        }
      });
      
      // Обновляем границы только если они существенно отличаются
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);
      
      if (earliestStart < currentStart || latestEnd > currentEnd) {
        setStartDate(format(earliestStart, 'yyyy-MM-dd'));
        setEndDate(format(latestEnd, 'yyyy-MM-dd'));
      }
    }
  }, [mkorUnits]);

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // Добавление МКОР через API
  const handleAddMkor = async () => {
    const availableDiameters = inventory.filter(item => item.count > 0);
    if (availableDiameters.length === 0) {
      alert('Нет доступных МКОР в инвентаре');
      return;
    }
    const selectedInventory = availableDiameters[0];
    const diameter = selectedInventory.diameter;
    const existingCount = mkorUnits.filter(unit => unit.diameter === diameter).length;
    const newNumber = existingCount + 1;
    const newMkor = createMkorUnit(
      diameter,
      format(addDays(today, 2), 'yyyy-MM-dd'),
      selectedInventory.availableFrom,
      newNumber
    );
    await fetch('/api/mkor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMkor)
    });
    fetchMkorUnits();
  };

  // Обновление МКОР (например, после редактирования или удаления работы)
  const handleMkorUnitsChange = (units?: MkorUnit[]) => {
    fetchMkorUnits();
  };

  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Красивый header */}
        <header className="flex flex-col items-center justify-center mb-8">
          <h1 className="text-5xl font-extrabold text-center text-foreground drop-shadow-lg tracking-wide" style={{fontFamily: 'Inter, sans-serif', letterSpacing:'0.04em'}}>МКОР | Планировщик</h1>
        </header>
        {/* Границы проекта и даты */}
        <div className="flex flex-col items-center mb-6">
          <div className="text-lg font-semibold text-foreground mb-2">Границы проекта</div>
          <div className="flex gap-4">
            {/* Начало */}
            <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  'w-[160px] justify-start text-left font-normal bg-secondary border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow',
                  !startDate && 'text-muted-foreground'
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {startDate ? format(new Date(startDate), 'dd.MM.yyyy') : 'Дата начала'}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={new Date(startDate)}
                  onSelect={d => d && setStartDate(format(d, 'yyyy-MM-dd'))}
                  onSelectClose={() => setStartPopoverOpen(false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {/* Окончание */}
            <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  'w-[160px] justify-start text-left font-normal bg-secondary border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow',
                  !endDate && 'text-muted-foreground'
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {endDate ? format(new Date(endDate), 'dd.MM.yyyy') : 'Дата окончания'}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={new Date(endDate)}
                  onSelect={d => d && setEndDate(format(d, 'yyyy-MM-dd'))}
                  onSelectClose={() => setEndPopoverOpen(false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Вкладки с металлическим стилем */}
        <Tabs defaultValue="planner" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 rounded-xl overflow-hidden shadow-lg border border-slate-400 bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700">
            <TabsTrigger value="planner" className="text-xl h-14 font-bold tracking-wide flex items-center justify-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-xl">Визуальный планировщик</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xl h-14 font-bold tracking-wide flex items-center justify-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-xl">Имеющиеся МКОР</TabsTrigger>
            <TabsTrigger value="reports" className="text-xl h-14 font-bold tracking-wide flex items-center justify-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-xl">Отчёты</TabsTrigger>
          </TabsList>
          <TabsContent value="planner" className="space-y-6">
            <MkorTimeline
              startDate={startDate}
              endDate={endDate}
              mkorUnits={mkorUnits}
              onMkorUnitsChange={handleMkorUnitsChange}
              scrollRef={mkorTimelineScrollRef}
              onScroll={handleMkorScroll}
              mode="full"
            />
            <TransportChart
              startDate={startDate}
              endDate={endDate}
              mkorUnits={mkorUnits}
              fleetSupplies={fleetSupplies}
              scrollRef={transportChartScrollRef}
            />
          </TabsContent>
          <TabsContent value="inventory">
            <MkorInventoryTab
              inventory={inventory}
              onInventoryChange={setInventory}
              mkorUnits={mkorUnits}
              onMkorUnitsChange={handleMkorUnitsChange}
              fleetSupplies={fleetSupplies}
              setFleetSupplies={setFleetSupplies}
            />
          </TabsContent>
          <TabsContent value="reports">
            <Reports
              startDate={startDate}
              endDate={endDate}
              mkorUnits={mkorUnits}
              onDateChange={handleDateChange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
