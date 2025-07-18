import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface MkorHeaderProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  onAddMkor: () => void;
}

export const MkorHeader: React.FC<MkorHeaderProps> = ({
  startDate,
  endDate,
  onDateChange,
  onAddMkor,
}) => {
  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            МКОР | Планировщик
          </h1>
          <Button
            onClick={onAddMkor}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-elegant"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить МКОР
          </Button>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="start-date" className="text-sm font-medium text-foreground">
              Начало
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <Label htmlFor="end-date" className="text-sm font-medium text-foreground">
              Окончание
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="bg-secondary border-border text-foreground"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};