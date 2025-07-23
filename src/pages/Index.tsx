import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MkorHeader } from '@/components/MkorHeader';
import { MkorTimeline } from '@/components/MkorTimeline';
import { TransportChart } from '@/components/TransportChart';
import { MkorInventoryTab } from '@/components/MkorInventoryTab';
import { format, addDays } from 'date-fns';
import { MkorUnit, MkorInventory, createMkorUnit } from '@/types/mkor';

const Index = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 730), 'yyyy-MM-dd'));
  const [inventory, setInventory] = useState<MkorInventory[]>([]);
  const [mkorUnits, setMkorUnits] = useState<MkorUnit[]>([]);

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
  const handleMkorUnitsChange = () => {
    fetchMkorUnits();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <MkorHeader
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onAddMkor={handleAddMkor}
        />
        
        <Tabs defaultValue="planner" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planner">Визуальный планировщик</TabsTrigger>
            <TabsTrigger value="inventory">Имеющиеся МКОР</TabsTrigger>
          </TabsList>
          
          <TabsContent value="planner" className="space-y-6">
            <MkorTimeline
              startDate={startDate}
              endDate={endDate}
              mkorUnits={mkorUnits}
              onMkorUnitsChange={handleMkorUnitsChange}
            />
            
            <TransportChart
              startDate={startDate}
              endDate={endDate}
              mkorUnits={mkorUnits}
            />
          </TabsContent>
          
          <TabsContent value="inventory">
            <MkorInventoryTab
              inventory={inventory}
              onInventoryChange={setInventory}
              mkorUnits={mkorUnits}
              onMkorUnitsChange={handleMkorUnitsChange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
