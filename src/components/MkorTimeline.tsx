import React from 'react';
import { Card } from '@/components/ui/card';
import { format, eachDayOfInterval, parseISO, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface MkorUnit {
  name: string;
  start: string;
  segments: number[]; // [транзит, погрузка, работа, ремонт] в днях
}

interface MkorTimelineProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}

const STAGE_COLORS = {
  transit: 'bg-transit',
  loading: 'bg-loading', 
  working: 'bg-working',
  repair: 'bg-repair'
};

const STAGE_NAMES = {
  transit: 'Транзит',
  loading: 'Погрузка/Разгрузка',
  working: 'Работа', 
  repair: 'Ремонт'
};

export const MkorTimeline: React.FC<MkorTimelineProps> = ({
  startDate,
  endDate,
  mkorUnits,
}) => {
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  const getMkorSegments = (mkor: MkorUnit) => {
    const segments = [];
    let currentDate = parseISO(mkor.start);
    const stages = ['transit', 'loading', 'working', 'repair'] as const;
    
    stages.forEach((stage, index) => {
      const duration = mkor.segments[index];
      if (duration > 0) {
        segments.push({
          stage,
          start: new Date(currentDate),
          end: addDays(currentDate, duration - 1),
          duration,
        });
        currentDate = addDays(currentDate, duration);
      }
    });
    
    return segments;
  };

  const getDayContent = (day: Date, mkor: MkorUnit) => {
    const segments = getMkorSegments(mkor);
    const dayTime = day.getTime();
    
    for (const segment of segments) {
      const startTime = segment.start.getTime();
      const endTime = segment.end.getTime();
      
      if (dayTime >= startTime && dayTime <= endTime) {
        return {
          stage: segment.stage,
          color: STAGE_COLORS[segment.stage],
          name: STAGE_NAMES[segment.stage],
        };
      }
    }
    
    return null;
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Временная шкала МКОР
        </h2>
        
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Заголовок с датами */}
            <div className="flex border-b border-border">
              <div className="w-32 p-3 bg-secondary/50 font-medium text-foreground sticky left-0 z-10">
                Установка
              </div>
              {days.map((day) => (
                <div key={day.toISOString()} className="w-24 p-2 text-center border-l border-border first:border-l-0">
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'dd.MM', { locale: ru })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(day, 'EEE', { locale: ru })}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Строки МКОР */}
            {mkorUnits.map((mkor, index) => (
              <div key={index} className="flex border-b border-border last:border-b-0">
                <div className="w-32 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center">
                  {mkor.name}
                </div>
                {days.map((day) => {
                  const content = getDayContent(day, mkor);
                  return (
                    <div key={day.toISOString()} className="w-24 h-12 border-l border-border first:border-l-0 relative">
                      {content && (
                        <div 
                          className={`h-full ${content.color} opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center group relative`}
                          title={content.name}
                        >
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            
            {mkorUnits.length === 0 && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg mb-2">Нет данных</div>
                  <div className="text-sm">Добавьте первую установку МКОР</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Легенда */}
        <div className="mt-6 flex items-center gap-6">
          <span className="text-sm font-medium text-foreground">Этапы:</span>
          {Object.entries(STAGE_COLORS).map(([stage, color]) => (
            <div key={stage} className="flex items-center gap-2">
              <div className={`w-4 h-4 ${color} rounded`}></div>
              <span className="text-sm text-foreground">
                {STAGE_NAMES[stage as keyof typeof STAGE_NAMES]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};