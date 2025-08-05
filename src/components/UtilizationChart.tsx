import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MkorUnit, getJobSegments, MKOR_SPECS } from '@/types/mkor';
import { format, parseISO, differenceInDays, isAfter, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';

interface UtilizationChartProps {
  mkorUnits: MkorUnit[];
  startDate: string;
  endDate: string;
}

interface UtilizationData {
  mkor: MkorUnit;
  utilization: number;
  workingDays: number;
  totalDays: number;
  rentalDays: number;
  deliveryDate: string | null;
  startDate: string;
  endDate: string;
}

const UtilizationChart: React.FC<UtilizationChartProps> = ({
  mkorUnits,
  startDate,
  endDate,
}) => {
  const [hoveredMkor, setHoveredMkor] = useState<string | null>(null);
  const [animatedValues, setAnimatedValues] = useState<Record<string, number>>({});

  const utilizationData = useMemo(() => {
    if (!startDate || !endDate || !mkorUnits || mkorUnits.length === 0) return [];

    try {
      const projectStart = parseISO(startDate);
      const projectEnd = parseISO(endDate);
      const totalProjectDays = differenceInDays(projectEnd, projectStart) + 1;

    return mkorUnits
      .map(mkor => {
        // Определяем дату начала для расчета (дата поступления или начало проекта)
        const deliveryDate = mkor.availableFrom ? parseISO(mkor.availableFrom) : null;
        const effectiveStartDate = deliveryDate && isAfter(deliveryDate, projectStart) 
          ? deliveryDate 
          : projectStart;

        // Получаем все сегменты работ для МКОР
        const segments = getJobSegments(mkor, mkor.jobs?.[0] || { id: '', start: '' });
        
        // Подсчитываем дни в работе (все этапы техцикла)
        let totalWorkingDays = 0;
        let totalRentalDays = 0;
        
        // Если есть работы, считаем по ним
        if (mkor.jobs && mkor.jobs.length > 0) {
          mkor.jobs.forEach(job => {
            if (!job.start) return; // Пропускаем работы без даты начала
            
            const jobStart = parseISO(job.start);
            const jobSegments = getJobSegments(mkor, job);
            
            let currentDate = jobStart;
            let segmentIndex = 0;
            
            jobSegments.forEach(segmentDuration => {
              if (!segmentDuration || segmentDuration <= 0) return;
              
              // Определяем этап по индексу (погрузка, разгрузка, работа у заказчика)
              const stage = segmentIndex === 0 ? 'loading' : 
                           segmentIndex === 1 ? 'unloading' : 
                           segmentIndex === 2 ? 'working' : 'other';
              
              const segmentEnd = new Date(currentDate);
              segmentEnd.setDate(segmentEnd.getDate() + segmentDuration - 1);
              
              // Учитываем только дни в пределах проекта
              const actualStart = isAfter(currentDate, effectiveStartDate) ? currentDate : effectiveStartDate;
              const actualEnd = isBefore(segmentEnd, projectEnd) ? segmentEnd : projectEnd;
              
              if (isBefore(actualStart, actualEnd) || actualStart.getTime() === actualEnd.getTime()) {
                const daysInSegment = differenceInDays(actualEnd, actualStart) + 1;
                totalWorkingDays += daysInSegment;
                
                // Учитываем дни аренды (погрузка, разгрузка, работа)
                if (['loading', 'unloading', 'working'].includes(stage)) {
                  totalRentalDays += daysInSegment;
                }
              }
              
              currentDate = new Date(segmentEnd);
              currentDate.setDate(currentDate.getDate() + 1);
              segmentIndex++;
            });
          });
        } else {
          // Если нет работ, считаем по стандартному циклу
          const specs = MKOR_SPECS[mkor.diameter];
          if (specs && mkor.start) {
            const cycleStart = parseISO(mkor.start);
            let currentDate = cycleStart;
            
            const standardSegments = [
              specs.transitToObject,
              specs.unloadingTime,
              specs.workingPeriod,
              specs.loadingTime,
              specs.transitToMaintenance,
              specs.maintenanceTime
            ];
            
            standardSegments.forEach((segmentDuration, index) => {
              if (!segmentDuration || segmentDuration <= 0) return;
              
              const segmentEnd = new Date(currentDate);
              segmentEnd.setDate(segmentEnd.getDate() + segmentDuration - 1);
              
              // Учитываем только дни в пределах проекта
              const actualStart = isAfter(currentDate, effectiveStartDate) ? currentDate : effectiveStartDate;
              const actualEnd = isBefore(segmentEnd, projectEnd) ? segmentEnd : projectEnd;
              
              if (isBefore(actualStart, actualEnd) || actualStart.getTime() === actualEnd.getTime()) {
                const daysInSegment = differenceInDays(actualEnd, actualStart) + 1;
                totalWorkingDays += daysInSegment;
                
                // Учитываем дни аренды (разгрузка, работа, погрузка)
                if ([1, 2, 3].includes(index)) { // unloading, working, loading
                  totalRentalDays += daysInSegment;
                }
              }
              
              currentDate = new Date(segmentEnd);
              currentDate.setDate(currentDate.getDate() + 1);
            });
          }
        }

        // Общее количество дней для этого МКОР
        const totalDays = differenceInDays(projectEnd, effectiveStartDate) + 1;
        
        // Утилизация в процентах
        const utilization = totalDays > 0 ? (totalWorkingDays / totalDays) * 100 : 0;

        return {
          mkor,
          utilization: Math.round(utilization * 100) / 100,
          workingDays: totalWorkingDays,
          rentalDays: totalRentalDays,
          totalDays,
          deliveryDate: mkor.availableFrom || null,
          startDate: format(effectiveStartDate, 'yyyy-MM-dd'),
          endDate: format(projectEnd, 'yyyy-MM-dd'),
        };
      })
      .filter(data => data.totalDays > 0)
      .sort((a, b) => b.utilization - a.utilization);
    } catch (error) {
      console.error('Ошибка при расчете утилизации:', error);
      return [];
    }
  }, [mkorUnits, startDate, endDate]);

  // Анимация значений при изменении данных
  useEffect(() => {
    const newValues: Record<string, number> = {};
    utilizationData.forEach(data => {
      newValues[data.mkor.id] = 0;
    });
    setAnimatedValues(newValues);

    const animationDuration = 1500;
    const steps = 60;
    const stepDuration = animationDuration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      const updatedValues: Record<string, number> = {};
      utilizationData.forEach(data => {
        updatedValues[data.mkor.id] = data.utilization * progress;
      });
      setAnimatedValues(updatedValues);

      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [utilizationData]);

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'from-emerald-400 via-green-500 to-emerald-600';
    if (utilization >= 60) return 'from-blue-400 via-cyan-500 to-blue-600';
    if (utilization >= 40) return 'from-yellow-400 via-orange-500 to-yellow-600';
    if (utilization >= 20) return 'from-orange-400 via-red-500 to-orange-600';
    return 'from-red-400 via-pink-500 to-red-600';
  };

  const getUtilizationStatus = (utilization: number) => {
    if (utilization >= 80) return { text: 'Отличная', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (utilization >= 60) return { text: 'Хорошая', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (utilization >= 40) return { text: 'Средняя', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (utilization >= 20) return { text: 'Низкая', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { text: 'Критическая', color: 'text-red-600', bg: 'bg-red-50' };
  };

  if (!startDate || !endDate) {
    return (
      <Card className="p-6 bg-gradient-to-br from-background to-secondary/20 backdrop-blur-sm">
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-lg font-medium">Выберите отчетный период</p>
          <p className="text-sm mt-2">для отображения утилизации МКОР</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Утилизация МКОР
        </h2>
        <p className="text-muted-foreground text-lg">
          Эффективность использования оборудования в период{' '}
          <span className="font-medium text-foreground">
            {format(parseISO(startDate), 'dd.MM.yyyy', { locale: ru })} - {format(parseISO(endDate), 'dd.MM.yyyy', { locale: ru })}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {utilizationData.map((data, index) => {
          const status = getUtilizationStatus(data.utilization);
          const isHovered = hoveredMkor === data.mkor.id;
          const animatedValue = animatedValues[data.mkor.id] || 0;
          
          return (
            <Card 
              key={data.mkor.id}
              className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-105 cursor-pointer ${
                isHovered ? 'ring-2 ring-primary/30 shadow-xl' : 'hover:shadow-lg'
              } bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-900/90 backdrop-blur-sm border border-slate-600/30 shadow-md`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
              onMouseEnter={() => setHoveredMkor(data.mkor.id)}
              onMouseLeave={() => setHoveredMkor(null)}
            >
              {/* Liquid glass эффект */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Металлический эффект */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-400/5 via-transparent to-slate-600/10" />
              
              <div className="relative p-6 space-y-6">
                {/* Заголовок МКОР */}
                <div className="text-center">
                  <h3 className="font-bold text-xl text-foreground mb-1">
                    {data.mkor.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    {data.mkor.diameter} мм
                  </p>
                </div>

                {/* Круговая диаграмма */}
                <div className="relative flex justify-center">
                  <div className="relative w-36 h-36">
                    {/* Фоновый круг с градиентом */}
                    <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id={`gradient-${data.mkor.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" className="text-slate-600" />
                          <stop offset="100%" className="text-slate-500" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="url(#gradient-${data.mkor.id})"
                        strokeWidth="6"
                        fill="none"
                        className="drop-shadow-sm"
                      />
                      {/* Прогресс с анимацией */}
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        className={`transition-all duration-1000 ease-out ${getUtilizationColor(data.utilization)} drop-shadow-lg`}
                        style={{
                          strokeDasharray: `${2 * Math.PI * 42}`,
                          strokeDashoffset: `${2 * Math.PI * 42 * (1 - animatedValue / 100)}`,
                        }}
                      />
                    </svg>
                    
                    {/* Центральный текст с анимацией */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground transition-all duration-500">
                          {Math.round(animatedValue)}%
                        </div>
                        <div className={`text-xs font-semibold ${status.color} transition-all duration-300`}>
                          {status.text}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Детальная информация */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground font-medium">Дни в работе:</span>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {data.workingDays} из {data.totalDays}
                    </Badge>
                  </div>
                  
                  <Progress 
                    value={animatedValue} 
                    className="h-3 transition-all duration-500 bg-slate-700"
                  />
                  
                  {/* Дни в аренде */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground font-medium">Дни в аренде:</span>
                    <Badge variant="outline" className="font-bold text-xs border-purple-500/30 text-purple-400">
                      {data.rentalDays} из {data.totalDays}
                    </Badge>
                  </div>
                  
                  <Progress 
                    value={data.totalDays > 0 ? (data.rentalDays / data.totalDays) * 100 : 0} 
                    className="h-2 transition-all duration-500 bg-slate-700"
                    style={{
                      '--progress-background': 'linear-gradient(90deg, rgb(147 51 234), rgb(168 85 247))'
                    } as React.CSSProperties}
                  />
                  
                  {data.deliveryDate && data.deliveryDate !== data.mkor.start && (
                    <div className="text-xs text-muted-foreground text-center font-medium">
                      Поставка: {format(parseISO(data.deliveryDate), 'dd.MM.yyyy', { locale: ru })}
                    </div>
                  )}
                </div>

                {/* Статус индикатор */}
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${status.bg} ${status.color} border-2 border-current`} />
              </div>
            </Card>
          );
        })}
      </div>

      {utilizationData.length === 0 && (
        <Card className="p-16 bg-gradient-to-br from-background to-secondary/20 backdrop-blur-sm">
          <div className="text-center text-muted-foreground">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xl font-semibold mb-3">Нет данных для отображения</p>
            <p className="text-base">В выбранном периоде нет МКОР в работе</p>
          </div>
        </Card>
      )}
    </div>
  );
};

// Компонент, объединяющий оба чарта (теперь не нужен, но оставляем для совместимости)
export const UtilizationAndRentalCharts: React.FC<UtilizationChartProps> = (props) => {
  return <UtilizationChart {...props} />;
};

export default UtilizationChart; 