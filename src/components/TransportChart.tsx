import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

interface TransportChartProps {
  startDate: string;
  endDate: string;
}

export const TransportChart: React.FC<TransportChartProps> = ({
  startDate,
  endDate,
}) => {
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  // Примерные данные для графика
  const generateData = () => {
    return days.map((day, index) => ({
      date: format(day, 'dd.MM', { locale: ru }),
      fullDate: format(day, 'dd MMMM', { locale: ru }),
      tractors: Math.floor(Math.random() * 4) + 2, // 2-5
      trucks: Math.floor(Math.random() * 3) + 1,   // 1-3  
      trailers: Math.floor(Math.random() * 3) + 1, // 1-3
    }));
  };

  const data = generateData();

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
                dataKey="trucks"
                stroke="hsl(var(--loading))"
                strokeWidth={3}
                name="Фуры"
                dot={{ fill: 'hsl(var(--loading))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--loading))', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="trailers"
                stroke="hsl(var(--working))"
                strokeWidth={3}
                name="Траллы"
                dot={{ fill: 'hsl(var(--working))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--working))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};