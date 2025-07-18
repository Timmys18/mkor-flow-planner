import React, { useState } from 'react';
import { MkorHeader } from '@/components/MkorHeader';
import { MkorTimeline, MkorUnit } from '@/components/MkorTimeline';
import { TransportChart } from '@/components/TransportChart';
import { format, addDays } from 'date-fns';

const Index = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  
  const [mkorUnits, setMkorUnits] = useState<MkorUnit[]>([
    {
      id: 'mkor-1',
      name: 'DN-700-1',
      start: format(addDays(today, 2), 'yyyy-MM-dd'),
      segments: [3, 1, 7, 2], // [транзит, погрузка, работа, ремонт]
    },
    {
      id: 'mkor-2',
      name: 'DN-800-2', 
      start: format(addDays(today, 5), 'yyyy-MM-dd'),
      segments: [2, 1, 6, 1],
    },
  ]);

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleAddMkor = () => {
    const newMkorNumber = mkorUnits.length + 1;
    const newMkor: MkorUnit = {
      id: `mkor-${Date.now()}`, // Уникальный ID
      name: `DN-900-${newMkorNumber}`,
      start: format(addDays(today, 2), 'yyyy-MM-dd'),
      segments: [2, 1, 5, 1], // Стандартные сегменты
    };
    
    setMkorUnits([...mkorUnits, newMkor]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <MkorHeader
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onAddMkor={handleAddMkor}
        />
        
        <MkorTimeline
          startDate={startDate}
          endDate={endDate}
          mkorUnits={mkorUnits}
          onMkorUnitsChange={setMkorUnits}
        />
        
        <TransportChart
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
};

export default Index;
