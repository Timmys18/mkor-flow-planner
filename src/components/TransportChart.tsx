import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { format, eachDayOfInterval, parseISO, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MkorUnit, getMkorStageOnDate, MKOR_SPECS, isMkorAvailable } from '@/types/mkor';

interface TransportChartProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
}

export const TransportChart: React.FC<TransportChartProps> = ({
  startDate,
  endDate,
  mkorUnits,
}) => {
  // Формируем массив дней с обнулением времени (локальная дата)
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map(d => {
    const local = new Date(d);
    local.setHours(0,0,0,0);
    return local;
  });

  // Считаем загрузку транспорта по дням (на всем диапазоне days)
  const data = useMemo(() => days.map((day) => {
    let tractors = 0;
    let trailers = 0;
    let lowLoaders = 0;
    const dayISO = day.toISOString();
    mkorUnits.forEach((mkor) => {
      if (mkor.jobs && mkor.jobs.length > 0) {
        mkor.jobs.forEach(job => {
          const jobStart = new Date(job.start);
          jobStart.setHours(0,0,0,0);
          // Для расчета этапов временно подменяем start на job.start
          const mkorForJob = { ...mkor, start: job.start };
          const stageInfo = getMkorStageOnDate(mkorForJob, day);
          if (stageInfo && stageInfo.requiresTransport) {
            const specs = MKOR_SPECS[mkor.diameter];
            if (specs) {
              tractors += specs.tractors;
              trailers += specs.trailers;
              lowLoaders += specs.lowLoaders;
            }
          }
        });
      }
      // else: полностью игнорируем МКОР без jobs
    });
    return {
      date: day,
      label: format(day, 'dd.MM', { locale: ru }),
      tractors,
      trailers,
      lowLoaders,
    };
  }), [days, mkorUnits]);

  // Определяем максимальное значение для визуализации цвета
  const maxTractors = Math.max(...data.map(d => d.tractors), 1);
  const maxTrailers = Math.max(...data.map(d => d.trailers), 1);
  const maxLowLoaders = Math.max(...data.map(d => d.lowLoaders), 1);

  // Цветовая шкала (можно доработать под дизайн)
  const getCellColor = (value: number, max: number, type: 'tractors' | 'trailers' | 'lowLoaders') => {
    if (value === 0) return 'bg-background border-border';
    if (type === 'tractors') return 'bg-transit/70 border-transit';
    if (type === 'trailers') return 'bg-loading/70 border-loading';
    if (type === 'lowLoaders') return 'bg-working/70 border-working';
    return 'bg-secondary border-border';
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Суточная загрузка транспорта
        </h2>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Заголовок с датами и вертикальными линиями */}
            <div className="flex relative border-b border-border">
              <div className="w-40 p-3 bg-secondary/50 font-medium text-foreground sticky left-0 z-10">&nbsp;</div>
              {days.map((day, idx) => (
                <div key={day.toISOString()} className="w-24 p-2 text-center border-l border-border first:border-l-0 relative">
                  <div className="text-xs text-muted-foreground">{format(day, 'dd.MM', { locale: ru })}</div>
                  <div className="text-xs text-muted-foreground mt-1">{format(day, 'EEE', { locale: ru })}</div>
                  {/* Вертикальная линия */}
                  <div className="absolute top-0 right-0 w-px h-[120px] bg-border/60" style={{left: '100%'}} />
                </div>
              ))}
            </div>
            {/* Строка: Тягачи */}
            <div className="flex border-b border-border">
              <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center">Тягачи</div>
              {data.map((d, idx) => (
                <div key={d.date.toISOString()} className={`w-24 h-12 flex items-center justify-center border-l border-border first:border-l-0 text-lg font-bold ${getCellColor(d.tractors, maxTractors, 'tractors')}`}>{d.tractors > 0 ? d.tractors : ''}</div>
              ))}
            </div>
            {/* Строка: Прицепы */}
            <div className="flex border-b border-border">
              <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center">Прицепы</div>
              {data.map((d, idx) => (
                <div key={d.date.toISOString()} className={`w-24 h-12 flex items-center justify-center border-l border-border first:border-l-0 text-lg font-bold ${getCellColor(d.trailers, maxTrailers, 'trailers')}`}>{d.trailers > 0 ? d.trailers : ''}</div>
              ))}
            </div>
            {/* Строка: Траллы */}
            <div className="flex">
              <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center">Траллы</div>
              {data.map((d, idx) => (
                <div key={d.date.toISOString()} className={`w-24 h-12 flex items-center justify-center border-l border-border first:border-l-0 text-lg font-bold ${getCellColor(d.lowLoaders, maxLowLoaders, 'lowLoaders')}`}>{d.lowLoaders > 0 ? d.lowLoaders : ''}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};