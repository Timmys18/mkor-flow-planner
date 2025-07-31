import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Package } from 'lucide-react';
import { MkorInventory, MKOR_SPECS, STAGE_NAMES } from '@/types/mkor';
import { createMkorUnit } from '@/types/mkor';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { TransportSupply } from '@/types/mkor';


// --- Добавляем массивы для выпадающих списков ---
const CUSTOMERS = [
  'ООО «Газпром трансгаз Волгоград»',
  'ООО «Газпром трансгаз Екатеринбург»',
  'ООО «Газпром трансгаз Казань»',
  'ООО «Газпром трансгаз Москва»',
  'ООО «Газпром трансгаз Нижний Новгород»',
  'ООО «Газпром трансгаз Самара»',
  'ООО «Газпром трансгаз Санкт-Петербург»',
  'ООО «Газпром трансгаз Саратов»',
  'ООО «Газпром трансгаз Ставрополь»',
  'ООО «Газпром трансгаз Сургут»',
  'ООО «Газпром трансгаз Томск»',
  'ООО «Газпром трансгаз Уфа»',
  'ООО «Газпром трансгаз Ухта»',
  'ООО «Газпром трансгаз Чайковский»',
  'ООО «Газпром трансгаз Югорск»',
];
// const LPU_LIST = [
//   'ЛПУ-1',
//   'ЛПУ-2',
//   'ЛПУ-3',
// ];

interface MkorInventoryTabProps {
  inventory: MkorInventory[];
  onInventoryChange: (inv: MkorInventory[]) => void;
  mkorUnits: import('@/types/mkor').MkorUnit[];
  onMkorUnitsChange?: (units?: import('@/types/mkor').MkorUnit[]) => void;
  fleetSupplies: import('@/types/mkor').FleetSupply[];
  setFleetSupplies: (supplies: import('@/types/mkor').FleetSupply[]) => void;
}

export const MkorInventoryTab: React.FC<MkorInventoryTabProps> = ({
  inventory,
  onInventoryChange,
  mkorUnits,
  onMkorUnitsChange,
  fleetSupplies,
  setFleetSupplies
}) => {
  const [newDiameter, setNewDiameter] = useState<number>(200);
  const [newCount, setNewCount] = useState<number>(1);
  const [newDate, setNewDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [planDialogIdx, setPlanDialogIdx] = useState<number | null>(null);
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [supplyCalendarOpen, setSupplyCalendarOpen] = useState(false);
  const [planCalendarOpen, setPlanCalendarOpen] = useState(false); // Добавляем отдельное состояние для планирования
  const [planError, setPlanError] = useState('');
  const [planCustomer, setPlanCustomer] = useState('');
  const [planLpu, setPlanLpu] = useState('');
  const [editJob, setEditJob] = useState<{unitIdx: number, jobIdx: number} | null>(null);
  const [editJobDate, setEditJobDate] = useState<Date | undefined>(undefined);
  const [editJobCustomer, setEditJobCustomer] = useState('');
  const [editJobLpu, setEditJobLpu] = useState('');
  const [editJobError, setEditJobError] = useState('');
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [customSegments, setCustomSegments] = useState<number[]>([]);
  const [stagesError, setStagesError] = useState('');

  // --- Состояния для формы поставки транспорта ---
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [editSupplyIdx, setEditSupplyIdx] = useState<number | null>(null);
  const [supplyDate, setSupplyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [supplyTractors, setSupplyTractors] = useState(0);
  const [supplyTrailers, setSupplyTrailers] = useState(0);
  const [supplyLowLoaders, setSupplyLowLoaders] = useState(0);
  // ---

  const [lpuList, setLpuList] = useState<string[]>([]);

  const availableDiameters = Object.keys(MKOR_SPECS).map(Number).sort((a, b) => a - b);

  // 1. Сортировка mkorUnits по убыванию диаметра, без суффикса — раньше, с суффиксом — позже
  function sortMkorUnits(units) {
    return [...units].sort((a, b) => {
      if (b.diameter !== a.diameter) return b.diameter - a.diameter;
      // Без суффикса раньше, с суффиксом позже
      const aHasSuffix = /-\d+$/.test(a.name);
      const bHasSuffix = /-\d+$/.test(b.name);
      if (aHasSuffix !== bHasSuffix) return aHasSuffix ? 1 : -1;
      return a.name.localeCompare(b.name, undefined, {numeric: true});
    });
  }

  // Функция для обновления inventory и mkorUnits с сервера
  const refreshData = async () => {
    try {
      const inv = await fetch('/api/inventory').then(res => res.json());
      onInventoryChange(inv);
      await fetch('/api/mkor');
      onMkorUnitsChange?.();
    } catch (error) {
      console.error('Ошибка при обновлении данных:', error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Загрузка поставок транспорта с сервера при монтировании
  useEffect(() => {
    fetch('/api/transport-supply')
      .then(res => res.json())
      .then(setFleetSupplies)
      .catch(() => setFleetSupplies([]));
  }, []);

  // Добавление поступления МКОР через API
  const handleAddInventory = async () => {
    try {
      // 1. Добавить в inventory
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diameter: newDiameter,
          count: newCount,
          availableFrom: newDate
        })
      });
      // 2. Добавить в mkorUnit (по количеству newCount)
      const segments = [
        MKOR_SPECS[newDiameter].transitToObject,
        MKOR_SPECS[newDiameter].unloadingTime,
        MKOR_SPECS[newDiameter].workingPeriod,
        MKOR_SPECS[newDiameter].loadingTime,
        MKOR_SPECS[newDiameter].transitToMaintenance,
        MKOR_SPECS[newDiameter].maintenanceTime
      ];
      for (let i = 0; i < newCount; i++) {
        // Определяем правильное имя с учетом существующих МКОР
        const existingUnits = mkorUnits.filter(u => u.diameter === newDiameter);
        let number = 1;
        let name = `DN-${newDiameter}`;
        while (existingUnits.some(u => u.name === name)) {
          number++;
          name = `DN-${newDiameter}-${number}`;
        }
        await fetch('/api/mkor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            diameter: newDiameter,
            availableFrom: newDate,
            segments
          })
        });
      }
      setNewCount(1);
      await refreshData();
    } catch (error) {
      console.error('Ошибка при добавлении инвентаря:', error);
    }
  };

  const handleRemoveInventory = (index: number) => {
    const newInventory = inventory.filter((_, i) => i !== index);
    onInventoryChange(newInventory);
  };

  const handleUpdateCount = (index: number, newCount: number) => {
    if (newCount <= 0) {
      handleRemoveInventory(index);
      return;
    }
    const newInventory = [...inventory];
    newInventory[index] = { ...newInventory[index], count: newCount };
    onInventoryChange(newInventory);
  };

  const getTotalByDiameter = (diameter: number) => {
    return mkorUnits.filter(unit => unit.diameter === diameter).length;
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    if (a.diameter !== b.diameter) return a.diameter - b.diameter;
    return new Date(a.availableFrom).getTime() - new Date(b.availableFrom).getTime();
  });

  // Используем только реальные МКОР из базы
  const allUnits = sortMkorUnits(mkorUnits);

  // Проверка: дата не раньше поставки и не пересекается с другими работами
  const canPlanJob = (unit: typeof allUnits[number], date: string) => {
    if (!date) return false;
    if (date < unit.availableFrom) return false;
    // Здесь можно добавить проверку на jobs, если появятся
    return true;
  };

  // Функция проверки занятости МКОР на выбранные даты
  const isMkorAvailableForJob = (mkor, startDate, segments) => {
    // startDate - строка yyyy-mm-dd
    const jobStart = new Date(startDate);
    jobStart.setHours(0,0,0,0);
    const totalDays = segments.reduce((a, b) => a + b, 0);
    const jobEnd = new Date(jobStart);
    jobEnd.setDate(jobEnd.getDate() + Math.ceil(totalDays) - 1);
    if (!mkor.jobs) return true;
    for (const job of mkor.jobs) {
      const existingStart = new Date(job.start);
      existingStart.setHours(0,0,0,0);
      
      // Получаем сегменты существующей работы
      let existingSegments = segments;
      if (job.customStages && job.customSegments) {
        try {
          existingSegments = Array.isArray(job.customSegments) 
            ? job.customSegments 
            : JSON.parse(job.customSegments);
        } catch {
          existingSegments = segments;
        }
      }
      
      const existingTotalDays = existingSegments.reduce((a, b) => a + b, 0);
      const existingEnd = new Date(existingStart);
      existingEnd.setDate(existingEnd.getDate() + Math.ceil(existingTotalDays) - 1);
      // Пересечение интервалов
      if (jobStart <= existingEnd && jobEnd >= existingStart) {
        return false;
      }
    }
    return true;
  };

  // Планирование работы через API (ИСПРАВЛЕННАЯ ВЕРСИЯ)
  const handlePlanJob = async () => {
    if (planDialogIdx === null) return;
    const unit = allUnits[planDialogIdx];
    if (!canPlanJob(unit, planDate ? format(planDate, 'yyyy-MM-dd') : '')) {
      setPlanError('Нельзя назначить работу на выбранную дату');
      return;
    }
    try {
      // Формируем сегменты для расчёта занятости (без округления)
      const segments = [
        MKOR_SPECS[unit.diameter].transitToObject,
        MKOR_SPECS[unit.diameter].unloadingTime,
        MKOR_SPECS[unit.diameter].workingPeriod,
        MKOR_SPECS[unit.diameter].loadingTime,
        MKOR_SPECS[unit.diameter].transitToMaintenance,
        MKOR_SPECS[unit.diameter].maintenanceTime
      ];
      // Найти все МКОР с этим именем и датой поставки
      let mkor = mkorUnits.find(u => u.name === unit.name && u.availableFrom === unit.availableFrom);
      if (mkor) {
        // Проверить, свободен ли МКОР на выбранные даты
        if (!isMkorAvailableForJob(mkor, planDate ? format(planDate, 'yyyy-MM-dd') : '', segments)) {
          setPlanError('МКОР занят на выбранные даты');
          return;
        }
        // Добавить работу к существующему МКОР
        await fetch(`/api/mkor/${mkor.id}/job`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: planDate ? format(planDate, 'yyyy-MM-dd') : '',
            customer: planCustomer,
            lpu: planLpu
          })
        });
      } else {
        // Если такого МКОР нет — создать новый с правильным именем
        // Определить номер (суффикс)
        const sameDiameterUnits = mkorUnits.filter(u => u.diameter === unit.diameter);
        let number = 1;
        let name = `DN-${unit.diameter}`;
        while (sameDiameterUnits.some(u => u.name === name)) {
          number++;
          name = `DN-${unit.diameter}-${number}`;
        }
        const createResponse = await fetch('/api/mkor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            diameter: unit.diameter,
            availableFrom: unit.availableFrom,
            segments
          })
        });
        if (!createResponse.ok) {
          throw new Error(`Ошибка создания МКОР: ${createResponse.status}`);
        }
        const newUnit = await createResponse.json();
        // Добавить работу к новому МКОР
        const jobResponse = await fetch(`/api/mkor/${newUnit.id}/job`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: planDate ? format(planDate, 'yyyy-MM-dd') : '',
            customer: planCustomer,
            lpu: planLpu
          })
        });
        if (!jobResponse.ok) {
          throw new Error(`Ошибка добавления работы: ${jobResponse.status}`);
        }
      }
      setPlanDialogIdx(null);
      setPlanDate(undefined);
      setCalendarOpen(false);
      setPlanError('');
      await refreshData();
    } catch (error) {
      console.error('Ошибка при планировании работы:', error);
      setPlanError('Ошибка при планировании работы. Попробуйте еще раз.');
    }
  };

  // Удаление конкретной единицы МКОР через API
  const handleRemoveUnit = async (unit: { name: string; diameter: number; availableFrom: string }) => {
    try {
      // Удаляем из inventory (находим по diameter и availableFrom)
      const inv = inventory.find(item => item.diameter === unit.diameter && item.availableFrom === unit.availableFrom);
      
      if (inv && inv.id) {
        // Если count > 1, уменьшаем, иначе удаляем
        if (inv.count > 1) {
          await fetch(`/api/inventory/${inv.id}`, { method: 'DELETE' });
          await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              diameter: inv.diameter,
              count: inv.count - 1,
              availableFrom: inv.availableFrom
            })
          });
        } else {
          await fetch(`/api/inventory/${inv.id}`, { method: 'DELETE' });
        }
      }

      // Удаляем из mkorUnits (по id) - каскадное удаление настроено в БД
      const mkor = mkorUnits.find(u => u.name === unit.name && u.availableFrom === unit.availableFrom);
      if (mkor && mkor.id) {
        await fetch(`/api/mkor/${mkor.id}`, { method: 'DELETE' });
      }

      refreshData();
    } catch (error) {
      console.error('Ошибка при удалении единицы:', error);
    }
  };

  // Удаление работы по id
  const handleDeleteJob = async (jobId: string) => {
    try {
      await fetch(`/api/job/${jobId}`, { method: 'DELETE' });
      await refreshData();
    } catch (error) {
      // Можно добавить обработку ошибки
    }
  };

  // Открыть форму для новой поставки
  const openAddSupply = () => {
    setEditSupplyIdx(null);
    setSupplyDate(format(new Date(), 'yyyy-MM-dd'));
    setSupplyTractors(0);
    setSupplyTrailers(0);
    setSupplyLowLoaders(0);
    setSupplyDialogOpen(true);
  };
  // Открыть форму для редактирования
  const openEditSupply = (idx: number) => {
    const s = fleetSupplies[idx];
    setEditSupplyIdx(idx);
    setSupplyDate(s.date);
    setSupplyTractors(s.tractors);
    setSupplyTrailers(s.trailers);
    setSupplyLowLoaders(s.lowLoaders);
    setSupplyDialogOpen(true);
  };
  const handleSaveSupply = async () => {
    if (!supplyDate) return;
    if (editSupplyIdx !== null) {
      // Редактирование
      const s = fleetSupplies[editSupplyIdx];
      await fetch(`/api/transport-supply/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: supplyDate,
          tractors: supplyTractors,
          trailers: supplyTrailers,
          lowLoaders: supplyLowLoaders
        })
      });
    } else {
      // Новая поставка
      await fetch('/api/transport-supply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: supplyDate,
          tractors: supplyTractors,
          trailers: supplyTrailers,
          lowLoaders: supplyLowLoaders
        })
      });
    }
    // После любого действия обновляем список
    fetch('/api/transport-supply')
      .then(res => res.json())
      .then(setFleetSupplies)
      .catch(() => setFleetSupplies([]));
    setSupplyDialogOpen(false);
  };
  // --- Удалить поставку ---
  const handleDeleteSupply = async (idx: number) => {
    const s = fleetSupplies[idx];
    await fetch(`/api/transport-supply/${s.id}`, { method: 'DELETE' });
    fetch('/api/transport-supply')
      .then(res => res.json())
      .then(setFleetSupplies)
      .catch(() => setFleetSupplies([]));
  };

  useEffect(() => {
    if (planCustomer) {
      console.log('Fetching LPUs for customer:', planCustomer);
      console.log('Encoded customer:', encodeURIComponent(planCustomer));
      fetch(`/api/lpu?customer=${encodeURIComponent(planCustomer)}`)
        .then(res => res.json())
        .then(data => {
          console.log('LPU API response:', data);
          setLpuList(data.map((lpu: any) => lpu.name));
          console.log('LPU names:', data.map((lpu: any) => lpu.name));
        })
        .catch((error) => {
          console.error('LPU API error:', error);
          setLpuList([]);
        });
    } else {
      setLpuList([]);
    }
  }, [planCustomer]);

  // Открытие диалога планирования работы
  const openPlanDialog = (idx: number) => {
    setPlanDialogIdx(idx);
    setPlanCustomer('');
    setPlanLpu('');
    setPlanCalendarOpen(false); // Сбрасываем состояние календаря
  };

  // В обработчике выбора заказчика
  const handlePlanCustomerChange = (customer: string) => {
    setPlanCustomer(customer);
    setPlanLpu(''); // сбрасываем ЛПУ при смене заказчика
  };

  const handleEditJobCustomerChange = (customer: string) => {
    setEditJobCustomer(customer);
    setEditJobLpu('');
    // Загружаем ЛПУ для выбранного заказчика
    if (customer) {
      fetch(`/api/lpu?customer=${encodeURIComponent(customer)}`)
        .then(res => res.json())
        .then(data => {
          setLpuList(data.map((lpu: any) => lpu.name));
        })
        .catch((error) => {
          console.error('LPU API error:', error);
          setLpuList([]);
        });
    } else {
      setLpuList([]);
    }
  };

  // Функции для работы с этапами
  const handleSegmentChange = (index: number, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setStagesError('Значение должно быть положительным числом');
      return;
    }
    const newSegments = [...customSegments];
    newSegments[index] = numValue;
    setCustomSegments(newSegments);
    setStagesError('');
  };

  const handleResetToDefault = () => {
    if (!editJob) return;
    const unit = allUnits[editJob.unitIdx];
    const specs = MKOR_SPECS[unit.diameter];
    setCustomSegments([
      specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
      specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
    ]);
    setStagesError('');
  };

  const handleSaveCustomStages = async () => {
    if (!editJob) return;
    
    const totalDays = customSegments.reduce((sum, segment) => sum + segment, 0);
    if (totalDays <= 0) {
      setStagesError('Общая продолжительность должна быть больше 0');
      return;
    }

    try {
      const unit = allUnits[editJob.unitIdx];
      const job = unit.jobs[editJob.jobIdx];
      const response = await fetch(`/api/job/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: format(editJobDate!, 'yyyy-MM-dd'),
          customer: editJobCustomer,
          lpu: editJobLpu,
          customStages: true,
          customSegments: customSegments
        })
      });

      if (response.ok) {
        await refreshData();
      } else {
        setStagesError('Ошибка при сохранении этапов');
      }
    } catch (error) {
      setStagesError('Ошибка при сохранении этапов');
    }
  };



  return (
    <div className="space-y-8 flex flex-col items-center">
      {/* Добавить поступление МКОР */}
      <div className="bg-gradient-to-br from-slate-300/30 via-slate-400/30 to-white/10 bg-black/60 backdrop-blur border border-white/10 shadow-lg rounded-2xl p-6 w-full">
        <h2 className="text-2xl font-bold mb-6 text-foreground text-center">Добавить поступление МКОР</h2>
        <div className="flex gap-4 items-end mb-4 justify-center">
          <div>
            <span className="text-foreground font-medium">Диаметр</span>
            <select 
              value={newDiameter} 
              onChange={e => setNewDiameter(Number(e.target.value))} 
              className="block w-32 mt-2 bg-secondary border-border text-foreground rounded px-2 py-1"
            >
              {availableDiameters.map(d => <option key={d} value={d}>DN-{d}</option>)}
            </select>
          </div>
          <div>
            <span className="text-foreground font-medium">Количество</span>
            <Input 
              type="number" 
              min={1} 
              value={newCount} 
              onChange={e => setNewCount(Number(e.target.value))}
              className="w-24 mt-2 bg-secondary border-border text-foreground" 
            />
          </div>
          <div>
            <span className="text-foreground font-medium">Дата поступления</span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-40 mt-2 bg-secondary border border-border text-foreground rounded px-3 py-2 flex items-center gap-2 shadow"
                  onClick={() => setCalendarOpen(true)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {newDate ? format(new Date(newDate), 'dd.MM.yyyy') : 'Дата поступления'}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={new Date(newDate)}
                  onSelect={d => d && setNewDate(format(d, 'yyyy-MM-dd'))}
                  onSelectClose={() => setCalendarOpen(false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button className="bg-primary text-white px-4 py-2" onClick={handleAddInventory}>+ Добавить</Button>
        </div>
      </div>

      {/* Парк МКОР */}
      <div className="bg-gradient-to-br from-slate-300/30 via-slate-400/30 to-white/10 bg-black/60 backdrop-blur border border-white/10 shadow-lg rounded-2xl p-6 w-full">
        <h2 className="text-2xl font-bold mb-6 text-foreground text-center">Парк МКОР</h2>
        <div className="overflow-x-auto">
          <table className="min-w-max w-full border-separate border-spacing-0 text-sm table-fixed">
            <thead>
              <tr className="bg-secondary/30">
                <th className="w-48 px-4 py-2 text-left text-foreground">Диаметр</th>
                <th className="w-32 py-2 text-center text-foreground">Дата поставки</th>
                <th className="w-32 py-2 text-center text-foreground">Дата начала работы</th>
                <th className="w-32 py-2 text-center text-foreground">Действия</th>
              </tr>
            </thead>
            <tbody>
              {allUnits.map((unit, idx) => {
                const jobs = unit.jobs && unit.jobs.length > 0 ? unit.jobs : [];
                return (
                  <tr key={unit.name + unit.availableFrom} className="bg-transparent border-b border-white/20 last:border-b-0">
                    <td className="w-48 px-4 py-2 font-semibold text-foreground text-left align-middle truncate">{unit.name}</td>
                    <td className="w-32 py-2 text-muted-foreground text-center align-middle">{format(new Date(unit.availableFrom), 'dd.MM.yyyy')}</td>
                    <td className="w-32 py-2 text-muted-foreground text-center align-middle">
                      {jobs.length > 0 ? jobs.map((job, i) => {
                        const jobId = job.id || job['id'];
                        return (
                          <span key={jobId} style={{display: 'inline-flex', alignItems: 'center', marginRight: 8}}>
                            {format(new Date(job.start), 'dd.MM.yyyy')}
                            <Button size="icon" onClick={() => { 
                              setEditJob({unitIdx: idx, jobIdx: i}); 
                              setEditJobDate(new Date(job.start)); 
                              setEditJobCustomer(job.customer || ''); 
                              setEditJobLpu(job.lpu || ''); 
                              setEditJobError(''); 
                              setEditCalendarOpen(false);
                              setStagesError('');
                              
                              // Загружаем этапы
                              if (job.customStages && job.customSegments) {
                                try {
                                  const segments = Array.isArray(job.customSegments) 
                                    ? job.customSegments 
                                    : JSON.parse(job.customSegments);
                                  setCustomSegments(segments);
                                } catch {
                                  const specs = MKOR_SPECS[unit.diameter];
                                  setCustomSegments([
                                    specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
                                    specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
                                  ]);
                                }
                              } else {
                                const specs = MKOR_SPECS[unit.diameter];
                                setCustomSegments([
                                  specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
                                  specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
                                ]);
                              }
                              
                              // Загружаем ЛПУ для текущего заказчика
                              if (job.customer) {
                                fetch(`/api/lpu?customer=${encodeURIComponent(job.customer)}`)
                                  .then(res => res.json())
                                  .then(data => {
                                    setLpuList(data.map((lpu: any) => lpu.name));
                                  })
                                  .catch((error) => {
                                    console.error('LPU API error:', error);
                                    setLpuList([]);
                                  });
                              }
                            }} className="ml-2 bg-gradient-to-r from-blue-500 to-cyan-400 border border-blue-400 shadow-lg ring-2 ring-blue-400/30 text-white transition-all"><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 0 0 .707-.293l9.414-9.414a2 2 0 0 0 0-2.828l-3.172-3.172a2 2 0 0 0-2.828 0l-9.414 9.414A1 1 0 0 0 4 20Z"/></svg></Button>
                            <Button size="icon" onClick={() => handleDeleteJob(jobId)} className="bg-gradient-to-r from-red-500 to-pink-500 border border-red-400 shadow-lg hover:from-pink-500 hover:to-red-500 ring-2 ring-red-400/30 text-white transition-all ml-2"><Trash2 className="w-4 h-4" /></Button>

                          </span>
                        );
                      }) : '-'}
                    </td>
                    <td className="w-32 py-2 text-center align-middle whitespace-nowrap">
                      <div className="flex flex-nowrap items-center justify-center gap-2">
                        <Button 
                          className="px-3 py-1 rounded bg-primary text-white hover:bg-primary/80 transition" 
                          onClick={() => openPlanDialog(idx)}
                        >
                          Запланировать работу
                        </Button>
                        <Button 
                          className="px-3 py-1 rounded bg-destructive text-white hover:bg-destructive/80 transition"
                          onClick={() => handleRemoveUnit(unit)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Модальное окно планирования работы */}
        <Dialog open={planDialogIdx !== null} onOpenChange={open => { if (!open) setPlanDialogIdx(null); }}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Планирование работы</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer" className="text-foreground">Заказчик</Label>
                <Select value={planCustomer} onValueChange={handlePlanCustomerChange}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Выберите заказчика" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMERS.map(customer => (
                      <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lpu" className="text-foreground">ЛПУ</Label>
                <Select
                  value={planLpu}
                  onValueChange={setPlanLpu}
                  disabled={!planCustomer || lpuList.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !planCustomer
                        ? 'Сначала выберите заказчика'
                        : lpuList.length === 0
                          ? 'Нет ЛПУ для выбранного заказчика'
                          : 'Выберите ЛПУ'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {lpuList.length > 0 ? (
                      lpuList.map(lpu => (
                        <SelectItem key={lpu} value={lpu}>{lpu}</SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
                {planCustomer && lpuList.length === 0 && (
                  <div className="text-xs text-destructive mt-1">Нет ЛПУ для выбранного заказчика</div>
                )}
              </div>
              <div>
                <Label htmlFor="start-date" className="text-foreground">Дата начала работы</Label>
                <Popover open={planCalendarOpen} onOpenChange={setPlanCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={() => setPlanCalendarOpen(true)}
                    >
                      {planDate ? format(planDate, 'dd.MM.yyyy') : 'ДД.ММ.ГГГГ'}
                      <CalendarIcon className="w-5 h-5 text-blue-500 ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="p-0 w-auto bg-card border-border">
                    <Calendar
                      mode="single"
                      selected={planDate}
                      onSelect={date => { setPlanDate(date); setPlanCalendarOpen(false); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {planError && <div className="text-destructive text-xs mt-1">{planError}</div>}
              <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-400 border border-blue-400 shadow-lg ring-2 ring-blue-400/30 text-white hover:from-cyan-400 hover:to-blue-600 transition-all" onClick={handlePlanJob}>Принять в работу</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Собственный парк транспорта */}
      <div className="bg-gradient-to-br from-slate-300/30 via-slate-400/30 to-white/10 bg-black/60 backdrop-blur border border-white/10 shadow-lg rounded-2xl p-6 w-full">
        <h2 className="text-2xl font-bold mb-6 text-foreground text-center">Собственный парк транспорта</h2>
        <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch">
          {/* Левая колонка: на сегодня */}
          <div className="flex-1 flex flex-col items-center">
            <div className="text-lg font-semibold text-foreground mb-2">Собственный парк на текущую дату</div>
            <div className="flex flex-wrap gap-6 justify-center mb-4">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const sumToday = fleetSupplies.reduce((acc, s) => {
                  const supplyDate = new Date(s.date);
                  supplyDate.setHours(0, 0, 0, 0);
                  if (supplyDate <= today) {
                    acc.tractors += s.tractors;
                    acc.trailers += s.trailers;
                    acc.lowLoaders += s.lowLoaders;
                  }
                  return acc;
                }, {tractors:0, trailers:0, lowLoaders:0});
                return (
                  <>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Тягачи</span>
                      <span className="text-2xl font-bold text-white">{sumToday.tractors}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Прицепы</span>
                      <span className="text-2xl font-bold text-white">{sumToday.trailers}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Тралы</span>
                      <span className="text-2xl font-bold text-white">{sumToday.lowLoaders}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          {/* Правая колонка: запланированный парк */}
          <div className="flex-1 flex flex-col items-center">
            <div className="text-lg font-semibold text-foreground mb-2">Запланированный собственный парк</div>
            <div className="flex flex-wrap gap-6 justify-center mb-4">
              {(() => {
                // Границы проекта берём из localStorage (как в Index.tsx)
                const start = localStorage.getItem('projectStart');
                const end = localStorage.getItem('projectEnd');
                const startDate = start ? new Date(start) : null;
                const endDate = end ? new Date(end) : null;
                const sumPlanned = fleetSupplies.reduce((acc, s) => {
                  const d = new Date(s.date);
                  d.setHours(0, 0, 0, 0);
                  const start = startDate ? new Date(startDate) : null;
                  const end = endDate ? new Date(endDate) : null;
                  if (start) start.setHours(0, 0, 0, 0);
                  if (end) end.setHours(0, 0, 0, 0);
                  if ((!start || d >= start) && (!end || d <= end)) {
                    acc.tractors += s.tractors;
                    acc.trailers += s.trailers;
                    acc.lowLoaders += s.lowLoaders;
                  }
                  return acc;
                }, {tractors:0, trailers:0, lowLoaders:0});
                return (
                  <>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Тягачи</span>
                      <span className="text-2xl font-bold text-white">{sumPlanned.tractors}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Прицепы</span>
                      <span className="text-2xl font-bold text-white">{sumPlanned.trailers}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                      <span className="text-lg font-semibold text-foreground mb-2">Тралы</span>
                      <span className="text-2xl font-bold text-white">{sumPlanned.lowLoaders}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="flex justify-center mt-2">
          <Button className="bg-gradient-to-r from-blue-700 to-cyan-500 text-white font-bold shadow-lg" onClick={openAddSupply}>
            Запланировать поставку транспорта
          </Button>
        </div>
        {/* Список всех поставок */}
        {fleetSupplies.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">Поставки транспорта</h3>
            <div className="flex flex-col gap-2">
              {fleetSupplies
                .slice()
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between bg-white/10 backdrop-blur rounded-lg px-4 py-2 border border-white/10 shadow">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-center">
                      <span className="text-base font-medium text-foreground">{format(new Date(s.date), 'dd.MM.yyyy')}</span>
                      <span className="text-sm text-white/80">Тягачи: <b>{s.tractors}</b></span>
                      <span className="text-sm text-white/80">Прицепы: <b>{s.trailers}</b></span>
                      <span className="text-sm text-white/80">Тралы: <b>{s.lowLoaders}</b></span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-blue-400 text-blue-400 hover:bg-blue-400/10" onClick={() => openEditSupply(idx)}>Редактировать</Button>
                      <Button size="sm" variant="outline" className="border-red-400 text-red-400 hover:bg-red-400/10" onClick={() => handleDeleteSupply(idx)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* Модалка добавления/редактирования поставки */}
        <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editSupplyIdx !== null ? 'Редактировать поставку' : 'Запланировать поставку транспорта'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="supply-date" className="text-foreground">Дата поставки</Label>
                <Popover open={supplyCalendarOpen} onOpenChange={setSupplyCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      'w-full justify-start text-left font-normal bg-secondary border border-border rounded-lg px-3 py-2 flex items-center gap-2 shadow',
                      !supplyDate && 'text-muted-foreground'
                    )} onClick={() => setSupplyCalendarOpen(true)}>
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {supplyDate ? format(new Date(supplyDate), 'dd.MM.yyyy') : 'Дата поставки'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0">
                    <Calendar
                      mode="single"
                      selected={new Date(supplyDate)}
                      onSelect={d => d && setSupplyDate(format(d, 'yyyy-MM-dd'))}
                      onSelectClose={() => setSupplyCalendarOpen(false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="supply-tractors" className="text-foreground">Тягачи</Label>
                  <Input id="supply-tractors" type="number" min={0} value={supplyTractors} onChange={e => setSupplyTractors(Math.max(0, Number(e.target.value)))} className="w-full text-center bg-black/40 border border-white/20 text-white font-bold" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="supply-trailers" className="text-foreground">Прицепы</Label>
                  <Input id="supply-trailers" type="number" min={0} value={supplyTrailers} onChange={e => setSupplyTrailers(Math.max(0, Number(e.target.value)))} className="w-full text-center bg-black/40 border border-white/20 text-white font-bold" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="supply-lowloaders" className="text-foreground">Тралы</Label>
                  <Input id="supply-lowloaders" type="number" min={0} value={supplyLowLoaders} onChange={e => setSupplyLowLoaders(Math.max(0, Number(e.target.value)))} className="w-full text-center bg-black/40 border border-white/20 text-white font-bold" />
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-400 border border-blue-400 shadow-lg ring-2 ring-blue-400/30 text-white hover:from-cyan-400 hover:to-blue-600 transition-all" onClick={handleSaveSupply}>{editSupplyIdx !== null ? 'Сохранить' : 'Принять в работу'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Счетчик МКОР */}
      <div className="bg-gradient-to-br from-slate-300/30 via-slate-400/30 to-white/10 bg-black/60 backdrop-blur border border-white/10 shadow-lg rounded-2xl p-6 w-full">
        <h2 className="text-2xl font-bold mb-6 text-foreground text-center">Счетчик МКОР</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 justify-center text-center">
          {availableDiameters.map(diameter => {
            const total = getTotalByDiameter(diameter);
            return (
              <div key={diameter} className="bg-secondary/10 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-foreground">
                  DN-{diameter}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {total}
                </div>
                <div className="text-xs text-muted-foreground">единиц</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Технические характеристики */}
      <div className="bg-gradient-to-br from-slate-300/30 via-slate-400/30 to-white/10 bg-black/60 backdrop-blur border border-white/10 shadow-lg rounded-2xl p-6 w-full">
        <h2 className="text-2xl font-bold mb-6 text-foreground text-center">Технические характеристики</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-foreground">Диаметр</th>
                <th className="text-center py-2 text-foreground">Цикл (дн)</th>
                <th className="text-center py-2 text-foreground">Работа (дн)</th>
                <th className="text-center py-2 text-foreground">ТОИР (дн)</th>
                <th className="text-center py-2 text-foreground">Тягачи</th>
                <th className="text-center py-2 text-foreground">Прицепы</th>
                <th className="text-center py-2 text-foreground">Траллы</th>
              </tr>
            </thead>
            <tbody>
              {availableDiameters.map(diameter => {
                const specs = MKOR_SPECS[diameter];
                return (
                  <tr key={diameter} className="border-b border-border last:border-b-0">
                    <td className="py-2 font-medium text-foreground">DN-{diameter}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.operationalCycle}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.workingPeriod}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.maintenanceTime}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.tractors}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.trailers}</td>
                    <td className="text-center py-2 text-muted-foreground">{specs.lowLoaders}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка редактирования работы */}
      <Dialog open={!!editJob} onOpenChange={open => { if (!open) setEditJob(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать работу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-customer" className="text-foreground">Заказчик</Label>
              <Select value={editJobCustomer} onValueChange={handleEditJobCustomerChange}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Выберите заказчика" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMERS.map(customer => (
                    <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-lpu" className="text-foreground">ЛПУ</Label>
              <Select value={editJobLpu} onValueChange={setEditJobLpu}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите ЛПУ" />
                </SelectTrigger>
                <SelectContent>
                  {lpuList.map(lpu => (
                    <SelectItem key={lpu} value={lpu}>{lpu}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-date" className="text-foreground">Дата начала работы</Label>
              <Popover open={editCalendarOpen} onOpenChange={setEditCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => setEditCalendarOpen(true)}
                  >
                    {editJobDate ? format(editJobDate, 'dd.MM.yyyy') : 'ДД.ММ.ГГГГ'}
                    <CalendarIcon className="w-5 h-5 text-blue-500 ml-2" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="p-0 w-auto bg-card border-border">
                  <Calendar
                    mode="single"
                    selected={editJobDate}
                    onSelect={date => { setEditJobDate(date); setEditCalendarOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {editJobError && <div className="text-destructive text-xs mt-1">{editJobError}</div>}
            
            {/* Редактирование этапов работы */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-medium">Этапы работы</Label>
                <Button variant="outline" size="sm" onClick={handleResetToDefault} className="text-xs">
                  Сбросить до стандартного
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(STAGE_NAMES).map(([stageKey, stageName], index) => (
                  <div key={stageKey} className="space-y-2">
                    <Label htmlFor={`segment-${index}`} className="text-foreground">
                      {stageName}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`segment-${index}`}
                        type="number"
                        step="0.5"
                        min="0"
                        value={customSegments[index] || 0}
                        onChange={(e) => handleSegmentChange(index, e.target.value)}
                        className="flex-1"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground">дней</span>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="bg-secondary/50 border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">Общая продолжительность:</span>
                  <span className="text-foreground font-bold">
                    {customSegments.reduce((sum, segment) => sum + segment, 0) % 1 === 0 
                      ? `${customSegments.reduce((sum, segment) => sum + segment, 0)} дней` 
                      : `${customSegments.reduce((sum, segment) => sum + segment, 0).toFixed(1)} дней`}
                  </span>
                </div>
              </Card>
              {stagesError && (
                <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                  {stagesError}
                </div>
              )}
            </div>
            
            <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-400 border border-blue-400 shadow-lg ring-2 ring-blue-400/30 text-white hover:from-cyan-400 hover:to-blue-600 transition-all" onClick={async () => {
              if (!editJob || !editJobDate || !editJobCustomer || !editJobLpu) { setEditJobError('Заполните все поля'); return; }
              
              // Сохраняем все данные одним запросом
              const unit = allUnits[editJob.unitIdx];
              const job = unit.jobs[editJob.jobIdx];
              
              const totalDays = customSegments.reduce((sum, segment) => sum + segment, 0);
              if (totalDays <= 0) {
                setEditJobError('Общая продолжительность должна быть больше 0');
                return;
              }
              
              try {
                const response = await fetch(`/api/job/${job.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    start: format(editJobDate, 'yyyy-MM-dd'),
                    customer: editJobCustomer,
                    lpu: editJobLpu,
                    customStages: true,
                    customSegments: customSegments
                  })
                });

                if (response.ok) {
                  setEditJob(null); 
                  setEditJobDate(undefined); 
                  setEditJobCustomer(''); 
                  setEditJobLpu(''); 
                  setEditJobError(''); 
                  setEditCalendarOpen(false); 
                  await refreshData();
                } else {
                  setEditJobError('Ошибка при сохранении');
                }
              } catch (error) {
                setEditJobError('Ошибка при сохранении');
              }
            }}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
};