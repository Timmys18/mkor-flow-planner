import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MkorUnit, getMkorStageOnDate, MKOR_SPECS } from '@/types/mkor';

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

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
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  // Расчет реальной загрузки транспорта на основе МКОР
  const calculateTransportLoad = () => {
    return days.map((day) => {
      let tractors = 0;
      let trailers = 0;
      let lowLoaders = 0;

      // Проходим по всем МКОР и проверяем их статус на этот день
      mkorUnits.forEach((mkor) => {
        const stageInfo = getMkorStageOnDate(mkor, day);
        
        if (stageInfo && stageInfo.requiresTransport) {
          const specs = MKOR_SPECS[mkor.diameter];
          if (specs) {
            tractors += specs.tractors;
            trailers += specs.trailers;
            lowLoaders += specs.lowLoaders;
          }
        }
      });

      return {
        date: format(day, 'dd.MM', { locale: ru }),
        fullDate: format(day, 'dd MMMM', { locale: ru }),
        tractors,
        trailers,
        lowLoaders,
      };
    });
  };

  const data = calculateTransportLoad();

  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dayData = data.find(d => d.date === label);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-foreground font-medium mb-2">{dayData?.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value} ед.
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Суточная загрузка транспорта
        </h2>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line
                type="monotone"
                dataKey="tractors"
                stroke="hsl(var(--transit))"
                strokeWidth={3}
                name="Тягачи"
                dot={{ fill: 'hsl(var(--transit))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--transit))', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="trailers"
                stroke="hsl(var(--loading))"
                strokeWidth={2}
                name="Прицепы"
                dot={{ fill: 'hsl(var(--loading))', strokeWidth: 1, r: 3 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--loading))', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="lowLoaders"
                stroke="hsl(var(--working))"
                strokeWidth={2}
                name="Траллы"
                dot={{ fill: 'hsl(var(--working))', strokeWidth: 1, r: 3 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--working))', strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};