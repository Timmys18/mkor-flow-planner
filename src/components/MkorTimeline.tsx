import React from 'react';
import { Card } from '@/components/ui/card';
import { format, eachDayOfInterval, parseISO, addDays, differenceInCalendarDays, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import {
  MkorUnit,
  MKOR_SPECS,
  getJobSegments,
  getJobStageOnDate,
  buildJobSegmentsWithDates,
  getCalendarSpanDays,
  parseCalendarDate,
} from '@/types/mkor';

interface MkorTimelineProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
  onMkorUnitsChange: (units: MkorUnit[]) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  mode?: 'full' | 'rental';
  /** Разрешить изменение длительности этапов (только главный планировщик) */
  interactive?: boolean;
}

// Названия этапов для отображения в интерфейсе
const STAGE_DISPLAY_NAMES = {
  transitToObject: 'В пути на объект',
  unloading: 'Разгрузка',
  working: 'Работа у заказчика',
  loading: 'Погрузка',
  transitToMaintenance: 'В пути на ТОИР',
  maintenance: 'ТОИР'
};

const STAGE_DISPLAY_COLORS = {
  transitToObject: 'bg-transit',
  unloading: 'bg-loading',
  working: 'bg-working',
  loading: 'bg-loading',
  transitToMaintenance: 'bg-transit',
  maintenance: 'bg-repair'
};

interface MkorRowProps {
  mkor: MkorUnit;
  days: Date[];
  onSegmentResize: (mkorId: string, jobId: string, segmentIndex: number, newDuration: number) => void;
  mode?: 'full' | 'rental';
  interactive?: boolean;
}

const MkorRow: React.FC<MkorRowProps> = ({
  mkor,
  days,
  onSegmentResize,
  mode = 'full',
  interactive = false,
}) => {
  const getMkorSegments = (mkor: MkorUnit, startDate: string) => {
    let segments: any[] = [];
    
    // Для режима аренды - только этапы аренды
    if (mode === 'rental') {
      // Если у МКОР есть работы, собираем сегменты аренды со всех работ
      if (mkor.jobs && mkor.jobs.length > 0) {
        for (const job of mkor.jobs) {
          buildJobSegmentsWithDates(mkor, job).forEach((segment) => {
            if (['unloading', 'working', 'loading'].includes(segment.stage)) {
              allRentalSegments.push({
                stage: segment.stage,
                start: segment.start,
                end: segment.end,
                duration: segment.duration,
                index: segment.index,
              });
            }
          });
        }
        allRentalSegments.sort((a, b) => a.start.getTime() - b.start.getTime());
        return allRentalSegments;
      }
      
      // Если у МКОР нет работ, но есть segments (для rentalMkors из RentalTimeline)
      if (mkor.segments && mkor.segments.length > 0) {
        // Если есть отладочная информация с реальными датами, используем её
        if ((mkor as any)._debug && (mkor as any)._debug.rentalSegments) {
          const rentalSegments = (mkor as any)._debug.rentalSegments;
          return rentalSegments.map((seg: any, index: number) => {
            // Используем реальные даты из отладочной информации
            const startDate = new Date(seg.start.split('.').reverse().join('-'));
            const endDate = new Date(seg.end.split('.').reverse().join('-'));
            
            return {
              stage: seg.stage,
              start: startDate,
              end: endDate,
              duration: seg.duration,
              index
            };
          });
        }
        
        // Fallback: циклический перебор этапов (как было)
        const rentalStages = ['unloading', 'working', 'loading'] as const;
        const result = [];
        let currentDate = parseISO(startDate);
        
        mkor.segments.forEach((duration, index) => {
          if (duration > 0) {
            const stageIndex = index % 3;
            const stage = rentalStages[stageIndex];
            const calendarDays = getCalendarSpanDays(duration);
            const endDate = addDays(currentDate, calendarDays - 1);
            endDate.setHours(23, 59, 59, 999);
            
            result.push({
              stage,
              start: new Date(currentDate),
              end: endDate,
              duration,
              index
            });
            
            currentDate = new Date(endDate);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
          }
        });
        
        return result;
      }
      
      return [];
    }
    
    // Для полного техцикла (визуальный планировщик и график работ)
    if (mode === 'full') {
      // Получаем сегменты из работ или стандартные сегменты МКОР
      if (mkor.jobs && mkor.jobs.length > 0) {
        // Для полного техцикла показываем только первую работу (как в визуальном планировщике)
        const job = mkor.jobs[0];
        segments = getJobSegments(mkor, job);
      } else {
        // Если нет работ, используем сегменты из mkor.segments (для ТОИР-МКОР)
        let segArr = mkor.segments;
        if (!Array.isArray(segArr)) {
          try {
            segArr = JSON.parse(segArr);
          } catch {
            segArr = [];
          }
        }
        segments = Array.isArray(segArr) ? segArr : [];
      }
      
      // Проверяем, является ли это МКОР только для ТОИР
      const isMaintenanceMkor = (!mkor.jobs || mkor.jobs.length === 0) && segments.length > 0;
      const hasMaintenanceDebug = (mkor as any)._debug && (mkor as any)._debug.maintenanceSegments;
      const isMaintenanceMkorByDebug = hasMaintenanceDebug;
      
      if ((isMaintenanceMkor || isMaintenanceMkorByDebug)) {
        // Если есть отладочные реальные даты ТОИР — используем их, чтобы не «склеивать» блоки
        const debug = (mkor as any)._debug;
        if (debug && Array.isArray(debug.maintenanceSegments) && debug.maintenanceSegments.length > 0) {
          return debug.maintenanceSegments.map((ms: any) => {
            // Поддерживаем как 'yyyy-MM-dd', так и 'dd.MM.yyyy'
            const parseDate = (v: string) => {
              if (!v) return null;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v);
              if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
                const [d, m, y] = v.split('.');
                return new Date(`${y}-${m}-${d}`);
              }
              const d = new Date(v);
              return isNaN(d.getTime()) ? null : d;
            };
            const start = parseDate(ms.maintenanceStart) || parseISO(startDate);
            const end = parseDate(ms.maintenanceEnd) || new Date(start);
            end.setHours(23, 59, 59, 999);
            const duration = ms.maintenanceDuration ?? Math.max(1, Math.round((end.getTime() - start.getTime()) / (24*60*60*1000)) + 1);
            return {
              stage: 'maintenance',
              start,
              end,
              duration,
              index: 5,
            };
          });
        }

        // Fallback: если нет реальных дат, строим последовательно от mkor.start
        if (segments.length > 0) {
          const result = [] as any[];
          let currentDate = parseCalendarDate(startDate);
          segments.forEach((duration) => {
            if (duration > 0) {
              const calendarDays = getCalendarSpanDays(duration);
              const endDate = addDays(currentDate, calendarDays - 1);
              endDate.setHours(23, 59, 59, 999);
              result.push({
                stage: 'maintenance',
                start: new Date(currentDate),
                end: endDate,
                duration,
                index: 5,
              });
              currentDate = new Date(endDate);
              currentDate.setDate(currentDate.getDate() + 1);
              currentDate.setHours(0, 0, 0, 0);
            }
          });
          return result;
        }
        
        // Если нет ни реальных дат, ни segments - возвращаем пустой массив
        return [];
      }
      
      // Для обычных МКОР - полный техцикл
      const result = [];
      let currentDate = parseISO(startDate);
      const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
      
      stages.forEach((stage, index) => {
        const duration = segments[index] || 0;
        if (duration > 0) {
          const endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + duration - 1);
          endDate.setHours(23, 59, 59, 999);
          
          result.push({
            stage,
            start: new Date(currentDate),
            end: endDate,
            duration,
            index,
          });
          
          currentDate = new Date(endDate);
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(0, 0, 0, 0);
        }
      });
      
      return result;
    }
    
    // Fallback - возвращаем пустой массив
    return [];
  };

  const getDayContent = (day: Date) => {
    const allJobs = mkor.jobs || [];
    const dayDate = parseCalendarDate(day);

    if (mode === 'full' && allJobs.length > 0) {
      for (const job of allJobs) {
        if (!job.start) continue;
        const stageInfo = getJobStageOnDate(mkor, job, dayDate);
        if (stageInfo) {
          return {
            stage: stageInfo.stage,
            color: STAGE_DISPLAY_COLORS[stageInfo.stage],
            name: STAGE_DISPLAY_NAMES[stageInfo.stage],
            segmentIndex: stageInfo.segmentIndex,
            jobId: job.id,
            isFirst: stageInfo.isFirst,
            isLast: stageInfo.isLast,
            dayPosition: stageInfo.dayPosition,
            totalDuration: stageInfo.duration,
          };
        }
      }
      return null;
    }

    // rental / maintenance / mkor без jobs
    const rowStartDate = mkor.start;
    if (rowStartDate) {
      const segments = getMkorSegments(mkor, rowStartDate);
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentStart = parseCalendarDate(segment.start);
        const segmentEnd = parseCalendarDate(segment.end);
        
        if (dayDate >= segmentStart && dayDate <= segmentEnd) {
          const dayPosition = differenceInCalendarDays(dayDate, segmentStart);
          
          return {
            stage: segment.stage,
            color: STAGE_DISPLAY_COLORS[segment.stage],
            name: STAGE_DISPLAY_NAMES[segment.stage],
            segmentIndex: segment.index,
            isFirst: dayPosition === 0,
            isLast: dayDate.getTime() === segmentEnd.getTime(),
            dayPosition,
            totalDuration: segment.duration,
          };
        }
      }
    }
    
    return null;
  };

  const totalDays = (() => {
    // Проверяем, есть ли работы с кастомными этапами
    if (mkor.jobs && mkor.jobs.length > 0) {
      // Берем первую работу для расчета общей продолжительности
      const job = mkor.jobs[0];
      if (job.customStages && job.customSegments) {
        try {
          const segments = Array.isArray(job.customSegments) 
            ? job.customSegments 
            : JSON.parse(job.customSegments);
          return segments.reduce((sum, segment) => sum + segment, 0);
        } catch {
          // Если не удалось распарсить, используем стандартные
        }
      }
    }
    
    // Используем стандартные сегменты
    let segArr = mkor.segments;
    if (!Array.isArray(segArr)) {
      try {
        segArr = JSON.parse(segArr);
      } catch {
        segArr = [];
      }
    }
    return Array.isArray(segArr) ? segArr.reduce((sum, segment) => sum + segment, 0) : 0;
  })();

  return (
    <div className="flex border-b border-border last:border-b-0">
      <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center gap-2" style={{ minWidth: '10rem', maxWidth: '12rem' }}>
        <div className="flex-1">
          <div className="text-sm flex items-center gap-1 text-foreground font-medium">
            {mkor.name}
            {/* Удаляю восклицательный знак и tooltip, больше не показываем недоступность */}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {totalDays % 1 === 0 ? `${totalDays}д` : `${totalDays.toFixed(1)}д`}
          </div>
        </div>
      </div>
      {/* Для каждой работы mkor.jobs строим отдельные сегменты на одной строке */}
      {days.map((day, dayIndex) => {
        const content = getDayContent(day);
        return (
          <div 
            key={day.toISOString()} 
            className="w-24 h-16 border-l border-border first:border-l-0 relative"
          >
            {content && (
              <div 
                className="h-full transition-all flex flex-col items-center justify-center group relative"
                title={`${content.name} - День ${(content.dayPosition || 0) + 1}/${Math.ceil(content.totalDuration || 0)}`}
              >
                {/* Основной фон ячейки */}
                <div className={`absolute inset-0 ${content.color} opacity-80 hover:opacity-100 transition-colors`}></div>
                
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                
                {/* Показываем название этапа только в первый день сегмента */}
                {content.isFirst && (
                  <div className="text-xs text-white font-medium z-10 text-center leading-tight">
                    {content.name}
                  </div>
                )}
                {/* Показываем заказчика во всех зеленых блоках 'working' */}
                {content.stage === 'working' && mkor.jobs && mkor.jobs.length > 0 && (() => {
                  const job = content.jobId
                    ? mkor.jobs.find((item) => item.id === content.jobId)
                    : mkor.jobs.find((item) => {
                        if (!item.start) return false;
                        return getJobStageOnDate(mkor, item, day)?.stage === 'working';
                      });
                  if (job && job.customer) {
                    const lastWord = job.customer.trim().split(' ').pop()?.replace(/[«»]/g, '');
                    return (<div className="text-[10px] text-white/80 mt-1">{lastWord}</div>);
                  }
                  if (job && !job.customer) {
                    return (<div className="text-[10px] text-white/80 mt-1">нет заказчика</div>);
                  }
                  return null;
                })()}
                {interactive && content.isLast && content.jobId && (
                  <div 
                    className="absolute right-0 top-0 w-2 h-full bg-white/20 cursor-col-resize hover:bg-white/40 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startDuration = content.totalDuration || 0;
                      let pendingDuration = startDuration;
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const dayWidth = 96;
                        const deltaDays = Math.round(deltaX / dayWidth);
                        pendingDuration = Math.max(0.5, startDuration + deltaDays);
                      };
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        if (pendingDuration !== startDuration) {
                          onSegmentResize(mkor.id, content.jobId, content.segmentIndex, pendingDuration);
                        }
                      };
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 1. Сортировка mkorUnits по убыванию диаметра, без суффикса — раньше, с суффиксом — позже
function sortMkorUnits(units: MkorUnit[]) {
  return [...units].sort((a, b) => {
    if (b.diameter !== a.diameter) return b.diameter - a.diameter;
    // Без суффикса раньше, с суффиксом позже
    const aHasSuffix = /-\d+$/.test(a.name);
    const bHasSuffix = /-\d+$/.test(b.name);
    if (aHasSuffix !== bHasSuffix) return aHasSuffix ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, {numeric: true});
  });
}

export const MkorTimeline: React.FC<MkorTimelineProps> = ({
  startDate,
  endDate,
  mkorUnits,
  onMkorUnitsChange,
  scrollRef,
  onScroll,
  mode = 'full',
  interactive = false,
}) => {
  const days = React.useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end) || start > end) {
      return [];
    }
    try {
      return eachDayOfInterval({ start, end }).map((day) => parseCalendarDate(day));
    } catch {
      return [];
    }
  }, [startDate, endDate]);

  const handleSegmentResize = async (
    mkorId: string,
    jobId: string,
    segmentIndex: number,
    newDuration: number,
  ) => {
    if (!interactive) return;

    const mkor = mkorUnits.find((unit) => unit.id === mkorId);
    const job = mkor?.jobs?.find((item) => item.id === jobId);
    if (!mkor || !job) return;

    const segments = [...getJobSegments(mkor, job)];
    segments[segmentIndex] = newDuration;

    try {
      const response = await fetch(`/api/job/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: job.start,
          customer: job.customer,
          lpu: job.lpu,
          customStages: true,
          customSegments: segments,
        }),
      });
      if (!response.ok) throw new Error('Не удалось сохранить этап');
      onMkorUnitsChange(mkorUnits);
    } catch (error) {
      console.error('Ошибка сохранения длительности этапа:', error);
    }
  };

  const sortedUnits = sortMkorUnits(mkorUnits);

  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-visible">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Временная шкала МКОР
          </h2>
        </div>
        
        <div
          className="overflow-x-auto pb-4"
          ref={scrollRef}
          onScroll={onScroll}
          style={{ scrollbarGutter: 'stable', overflowY: 'hidden' }}
        >
          <div className="min-w-max">
            <div className="flex border-b border-border">
              <div className="w-40 p-3 bg-secondary/50 font-medium text-foreground sticky left-0 z-10">
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
            
            {sortedUnits.length > 0 ? sortedUnits.map((mkor) => (
              <MkorRow
                key={mkor.id}
                mkor={mkor}
                days={days}
                onSegmentResize={handleSegmentResize}
                mode={mode}
                interactive={interactive}
              />
            )) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg mb-2">Нет данных</div>
                  <div className="text-sm">Добавьте первую установку МКОР</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex items-center gap-6 flex-wrap">
          <span className="text-sm font-medium text-foreground">Этапы:</span>
          {Object.entries(STAGE_DISPLAY_COLORS).map(([stage, color]) => (
            <div key={stage} className="flex items-center gap-2">
              <div className={`w-4 h-4 ${color} rounded`}></div>
              <span className="text-sm text-foreground">
                {STAGE_DISPLAY_NAMES[stage as keyof typeof STAGE_DISPLAY_NAMES]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};