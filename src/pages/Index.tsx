import React, { useState } from 'react';
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
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  
  // Инвентарь МКОР - откуда берем установки для планирования
  const [inventory, setInventory] = useState<MkorInventory[]>([
    {
      diameter: 700,
      count: 2,
      availableFrom: format(today, 'yyyy-MM-dd')
    },
    {
      diameter: 800,
      count: 1,
      availableFrom: format(addDays(today, -10), 'yyyy-MM-dd')
    }
  ]);
  
  // Планируемые МКОР - что отображается на временной шкале
  const [mkorUnits, setMkorUnits] = useState<MkorUnit[]>([
    createMkorUnit(700, format(addDays(today, 2), 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd'), 1),
    createMkorUnit(800, format(addDays(today, 5), 'yyyy-MM-dd'), format(addDays(today, -10), 'yyyy-MM-dd'), 1),
  ]);

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleAddMkor = () => {
    // Найдем доступные диаметры из инвентаря
    const availableDiameters = inventory.filter(item => item.count > 0);
    if (availableDiameters.length === 0) {
      alert('Нет доступных МКОР в инвентаре');
      return;
    }

    // Возьмем первый доступный диаметр
    const selectedInventory = availableDiameters[0];
    const diameter = selectedInventory.diameter;
    
    // Определим номер для нового МКОР этого диаметра
    const existingCount = mkorUnits.filter(unit => unit.diameter === diameter).length;
    const newNumber = existingCount + 1;
    
    const newMkor = createMkorUnit(
      diameter,
      format(addDays(today, 2), 'yyyy-MM-dd'),
      selectedInventory.availableFrom,
      newNumber
    );
    
    setMkorUnits([...mkorUnits, newMkor]);
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
              onMkorUnitsChange={setMkorUnits}
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
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
