import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Package } from 'lucide-react';
import { MkorInventory, MKOR_SPECS } from '@/types/mkor';
import { createMkorUnit } from '@/types/mkor';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useEffect } from 'react';

interface MkorInventoryTabProps {
  inventory: MkorInventory[];
  onInventoryChange: (inv: MkorInventory[]) => void;
  mkorUnits: import('@/types/mkor').MkorUnit[];
  onMkorUnitsChange: (units: import('@/types/mkor').MkorUnit[]) => void;
}

export const MkorInventoryTab: React.FC<MkorInventoryTabProps> = ({
  inventory,
  onInventoryChange,
  mkorUnits,
  onMkorUnitsChange
}) => {
  const [newDiameter, setNewDiameter] = useState<number>(200);
  const [newCount, setNewCount] = useState<number>(1);
  const [newDate, setNewDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [planDialogIdx, setPlanDialogIdx] = useState<number | null>(null);
  const [planDate, setPlanDate] = useState('');
  const [planError, setPlanError] = useState('');

  const availableDiameters = Object.keys(MKOR_SPECS).map(Number).sort((a, b) => a - b);

  // Функция для обновления inventory и mkorUnits с сервера
  const refreshData = async () => {
    const inv = await fetch('http://localhost:4000/api/inventory').then(res => res.json());
    onInventoryChange(inv);
    const units = await fetch('http://localhost:4000/api/mkor').then(res => res.json());
    onMkorUnitsChange(units);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Добавление поступления МКОР через API
  const handleAddInventory = async () => {
    await fetch('http://localhost:4000/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diameter: newDiameter,
        count: newCount,
        availableFrom: newDate
      })
    });
    setNewCount(1);
    refreshData();
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
    return inventory
      .filter(item => item.diameter === diameter)
      .reduce((sum, item) => sum + item.count, 0);
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    if (a.diameter !== b.diameter) return a.diameter - b.diameter;
    return new Date(a.availableFrom).getTime() - new Date(b.availableFrom).getTime();
  });

  // Собираем список всех МКОР поштучно (каждая единица — отдельная строка)
  const allUnits: { name: string; diameter: number; availableFrom: string }[] = [];
  inventory.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      const suffix = i === 0 ? '' : `-${i + 1}`;
      allUnits.push({
        name: `DN-${item.diameter}${suffix}`,
        diameter: item.diameter,
        availableFrom: item.availableFrom
      });
    }
  });

  // Проверка: дата не раньше поставки и не пересекается с другими работами (заглушка, если появится jobs)
  const canPlanJob = (unit: typeof allUnits[number], date: string) => {
    if (!date) return false;
    if (date < unit.availableFrom) return false;
    // Здесь можно добавить проверку на jobs, если появятся
    return true;
  };

  // Планирование работы через API
  const handlePlanJob = async () => {
    if (planDialogIdx === null) return;
    const unit = allUnits[planDialogIdx];
    if (!canPlanJob(unit, planDate)) {
      setPlanError('Нельзя назначить работу на выбранную дату');
      return;
    }
    // Найти нужный МКОР по имени и дате поставки
    const mkor = mkorUnits.find(u => u.name === unit.name && u.availableFrom === unit.availableFrom);
    if (mkor) {
      await fetch(`http://localhost:4000/api/mkor/${mkor.id}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: planDate })
      });
    } else {
      // Если такого МКОР нет — создать новый
      const number = mkorUnits.filter(u => u.diameter === unit.diameter).length + 1;
      const res = await fetch('http://localhost:4000/api/mkor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: unit.name,
          diameter: unit.diameter,
          availableFrom: unit.availableFrom,
          segments: [3,1,13,1,3,3] // TODO: брать реальные сегменты
        })
      });
      const newUnit = await res.json();
      await fetch(`http://localhost:4000/api/mkor/${newUnit.id}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: planDate })
      });
    }
    setPlanDialogIdx(null);
    setPlanDate('');
    setPlanError('');
    await refreshData();
  };

  // Удаление конкретной единицы МКОР через API
  const handleRemoveUnit = async (unit: { name: string; diameter: number; availableFrom: string }) => {
    // Удаляем из inventory (находим по diameter и availableFrom)
    const inv = inventory.find(item => item.diameter === unit.diameter && item.availableFrom === unit.availableFrom);
    if (inv) {
      // Если count > 1, уменьшаем, иначе удаляем
      if (inv.count > 1) {
        await fetch(`http://localhost:4000/api/inventory/${inv.id}`, { method: 'DELETE' });
        await fetch('http://localhost:4000/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diameter: inv.diameter,
            count: inv.count - 1,
            availableFrom: inv.availableFrom
          })
        });
      } else {
        await fetch(`http://localhost:4000/api/inventory/${inv.id}`, { method: 'DELETE' });
      }
    }
    // Удаляем из mkorUnits (по id)
    const mkor = mkorUnits.find(u => u.name === unit.name && u.availableFrom === unit.availableFrom);
    if (mkor) {
      await fetch(`http://localhost:4000/api/mkor/${mkor.id}`, { method: 'DELETE' });
    }
    refreshData();
  };

  return (
    <div>
      {/* Форма добавления поступления МКОР */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4 text-foreground">Добавить поступление МКОР</h2>
        <div className="flex gap-4 items-end mb-4">
          <div>
            <span className="text-foreground font-medium">Диаметр</span>
            <select value={newDiameter} onChange={e => setNewDiameter(Number(e.target.value))} className="block w-32 mt-2 bg-secondary border-border text-foreground rounded px-2 py-1">
              {availableDiameters.map(d => <option key={d} value={d}>DN-{d}</option>)}
            </select>
          </div>
          <div>
            <span className="text-foreground font-medium">Количество</span>
            <Input type="number" min={1} value={newCount} onChange={e => setNewCount(Number(e.target.value))} className="w-24 mt-2 bg-secondary border-border text-foreground" />
          </div>
          <div>
            <span className="text-foreground font-medium">Дата поступления</span>
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-40 mt-2 bg-secondary border-border text-foreground" />
          </div>
          <Button className="bg-primary text-white px-4 py-2" onClick={handleAddInventory}>+ Добавить</Button>
        </div>
      </div>
      {/* Основная таблица 'Парк МКОР' */}
      <div className="mb-8">
        <h2 className="text-lg font-bold mb-4 text-foreground">Парк МКОР</h2>
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="bg-secondary/30">
                <th className="px-4 py-2 text-foreground">Диаметр</th>
                <th className="px-4 py-2 text-foreground">Дата поставки</th>
                <th className="px-4 py-2 text-foreground">Дата начала работы</th>
                <th className="px-4 py-2 text-foreground">Действия</th>
              </tr>
            </thead>
            <tbody>
              {allUnits.map((unit, idx) => {
                // Найти работу для этого МКОР
                const mkor = mkorUnits.find(u => u.name === unit.name && u.availableFrom === unit.availableFrom);
                const jobDate = mkor && mkor.jobs && mkor.jobs.length > 0 ? mkor.jobs[0].start : '';
                return (
                  <tr key={unit.name + unit.availableFrom} className="bg-card border-b border-border">
                    <td className="px-4 py-2 font-semibold text-foreground">{unit.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{format(new Date(unit.availableFrom), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-2 text-muted-foreground">{jobDate ? format(new Date(jobDate), 'dd.MM.yyyy') : '-'}</td>
                    <td className="px-4 py-2">
                      <Button className="px-3 py-1 rounded bg-primary text-white hover:bg-primary/80 transition" onClick={() => { setPlanDialogIdx(idx); setPlanDate(''); setPlanError(''); }}>Запланировать работу</Button>
                      <Button className="ml-2 px-3 py-1 rounded bg-destructive text-white hover:bg-destructive/80 transition" onClick={() => handleRemoveUnit(unit)}><Trash2 className="w-4 h-4" /></Button>
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
                <span className="text-foreground font-medium">Дата начала работы</span>
                <Input type="date" min={planDialogIdx !== null ? allUnits[planDialogIdx].availableFrom : undefined} value={planDate} onChange={e => setPlanDate(e.target.value)} className="mt-2 bg-secondary border-border text-foreground" />
              </div>
              {planError && <div className="text-destructive text-xs mt-1">{planError}</div>}
              <Button className="bg-primary text-white px-3 py-1" onClick={handlePlanJob}>Принять в работу</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Сводка по диаметрам */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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

      {/* Техническая информация */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-lg font-medium text-foreground mb-3">
          Технические характеристики
        </h3>
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
    </div>
  );
};