import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { format, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  MkorUnit,
  getJobStageOnDate,
  MKOR_SPECS,
  parseCalendarDate,
} from '@/types/mkor';

interface TransportChartProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
  fleetSupplies: { id: string; date: string; tractors: number; trailers: number; lowLoaders: number }[];
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const TransportChart: React.FC<TransportChartProps> = ({
  startDate,
  endDate,
  mkorUnits,
  fleetSupplies,
  scrollRef,
}) => {
  const days = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end) || start > end) return [];
    try {
      return eachDayOfInterval({ start, end }).map((day) => parseCalendarDate(day));
    } catch {
      return [];
    }
  }, [startDate, endDate]);

  const data = useMemo(() => days.map((day) => {
    let tractors = 0;
    let trailers = 0;
    let lowLoaders = 0;

    mkorUnits.forEach((mkor) => {
      if (!mkor.jobs?.length) return;

      mkor.jobs.forEach((job) => {
        const stageInfo = getJobStageOnDate(mkor, job, day);
        if (stageInfo?.requiresTransport) {
          const specs = MKOR_SPECS[mkor.diameter];
          if (specs) {
            tractors += specs.tractors;
            trailers += specs.trailers;
            lowLoaders += specs.lowLoaders;
          }
        }
      });
    });

    return {
      date: day,
      label: format(day, 'dd.MM', { locale: ru }),
      tractors,
      trailers,
      lowLoaders,
    };
  }), [days, mkorUnits]);

  const ownFleetData = data.map((d) => {
    const sum = fleetSupplies.reduce((acc, s) => {
      const supplyDate = parseCalendarDate(s.date);
      const dayDate = parseCalendarDate(d.date);
      if (supplyDate <= dayDate) {
        acc.tractors += s.tractors;
        acc.trailers += s.trailers;
        acc.lowLoaders += s.lowLoaders;
      }
      return acc;
    }, { tractors: 0, trailers: 0, lowLoaders: 0 });
    return {
      date: d.date,
      label: d.label,
      tractors: Math.min(d.tractors, sum.tractors),
      trailers: Math.min(d.trailers, sum.trailers),
      lowLoaders: Math.min(d.lowLoaders, sum.lowLoaders),
    };
  });

  const externalData = data.map((d, i) => ({
    date: d.date,
    label: d.label,
    tractors: Math.max(0, d.tractors - ownFleetData[i].tractors),
    trailers: Math.max(0, d.trailers - ownFleetData[i].trailers),
    lowLoaders: Math.max(0, d.lowLoaders - ownFleetData[i].lowLoaders),
  }));

  const getCellClass = (value: number) => {
    return value > 0
      ? 'bg-black/80 backdrop-blur border border-white/10 shadow-inner text-white'
      : 'bg-background border-border';
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-x-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Суточная загрузка транспорта
        </h2>
        <div className="overflow-x-auto w-full max-w-full" style={{ overflowY: 'hidden', marginBottom: '8px' }} ref={scrollRef}>
          <table className="min-w-max w-full text-sm border-separate border-spacing-0 table-fixed">
            <thead>
              <tr>
                <th className="w-40 bg-secondary/50 text-foreground font-medium sticky left-0 z-10">&nbsp;</th>
                {days.map((day) => (
                  <th key={day.toISOString()} className="w-24 p-2 text-center text-xs text-muted-foreground font-normal border-l border-border first:border-l-0">
                    <div>{format(day, 'dd.MM', { locale: ru })}</div>
                    <div className="mt-1">{format(day, 'EEE', { locale: ru })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['Суточная загрузка транспорта', 'Собственный парк транспорта', 'Потребность в привлеченном транспорте'].map((section, sectionIdx) => {
                const sectionData = sectionIdx === 0 ? data : sectionIdx === 1 ? ownFleetData : externalData;
                return [
                  <tr key={`${section}_header`}>
                    <td className="w-40 bg-background text-lg font-semibold text-foreground pt-4 pb-1 sticky left-0 top-0 z-30" style={{ background: '#111827' }}>{section}</td>
                    {days.map((_, idx) => <td key={idx}></td>)}
                  </tr>,
                  ['Тягачи', 'Прицепы', 'Тралы'].map((label, idx) => (
                    <tr key={section + label}>
                      <td className="w-40 bg-secondary/30 text-foreground font-medium sticky left-0 z-10 text-center align-middle" style={{ verticalAlign: 'middle', minHeight: '56px', padding: 0 }}>
                        <div className="flex flex-col justify-center items-center h-full min-h-[56px]">
                          <div className="font-medium text-center w-full">{label}</div>
                        </div>
                      </td>
                      {sectionData.map((d) => {
                        const key = idx === 0 ? 'tractors' : idx === 1 ? 'trailers' : 'lowLoaders';
                        return (
                          <td key={d.date.toISOString()} className={`w-24 h-12 text-center align-middle border-l border-border first:border-l-0 text-lg font-bold ${getCellClass(d[key])}`}>{d[key] > 0 ? d[key] : ''}</td>
                        );
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
