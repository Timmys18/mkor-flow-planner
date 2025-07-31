import React from 'react';
import { Card } from '@/components/ui/card';
import { format, eachDayOfInterval, parseISO, addDays, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  DndContext, 
  closestCenter, 
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, Clock, Edit, AlertTriangle } from 'lucide-react';
import { MkorEditDialog } from './MkorEditDialog';
import { MkorUnit, STAGE_COLORS, STAGE_NAMES, MKOR_SPECS, isMkorAvailable } from '@/types/mkor';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface MkorTimelineProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
  onMkorUnitsChange: (units: MkorUnit[]) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
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

interface SortableMkorRowProps {
  mkor: MkorUnit;
  days: Date[];
  onSegmentDrag: (mkorId: string, segmentIndex: number, newDuration: number) => void;
  onMkorDrag: (mkorId: string, newStartDate: string) => void;
  onMkorEdit: (updatedMkor: MkorUnit) => void;
  onMkorDelete: (mkorId: string) => void;
}

const SortableMkorRow: React.FC<SortableMkorRowProps> = ({ 
  mkor, 
  days, 
  onSegmentDrag, 
  onMkorDrag,
  onMkorEdit,
  onMkorDelete
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mkor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getMkorSegments = (mkor: MkorUnit, startDate: string) => {
    // Получаем сегменты из работ или стандартные сегменты МКОР
    let segments = [];
    
    // Проверяем, есть ли работы с кастомными этапами
    if (mkor.jobs && mkor.jobs.length > 0) {
      // Берем первую работу (пока поддерживаем только одну работу на МКОР)
      const job = mkor.jobs[0];
      if (job && job.customStages && job.customSegments) {
        try {
          segments = Array.isArray(job.customSegments) 
            ? job.customSegments 
            : JSON.parse(job.customSegments);
        } catch {
          segments = [];
        }
      }
    }
    
    // Если нет кастомных сегментов, используем стандартные сегменты МКОР
    if (segments.length === 0) {
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
    
    // Проверяем, является ли это МКОР для аренды (нет jobs, но есть segments)
    // Для аренды используем только этапы: unloading, working, loading
    const isRentalMkor = !mkor.jobs || mkor.jobs.length === 0;
    if (isRentalMkor && segments.length > 0) {
      console.log('Processing rental MKOR:', mkor.name, {
        segments,
        startDate,
        isRentalMkor
      });
      
      // Для аренды используем только этапы аренды
      const rentalStages = ['unloading', 'working', 'loading'] as const;
      const result = [];
      let currentDate = parseISO(startDate);
      
      segments.forEach((duration, index) => {
        if (duration > 0 && index < rentalStages.length) {
          // Calculate end date: start + duration - 1 day (since we want to end at the end of the last day)
          const endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + duration - 1);
          endDate.setHours(23, 59, 59, 999); // End at the end of the day
          
          result.push({
            stage: rentalStages[index],
            start: new Date(currentDate),
            end: endDate,
            duration,
            index,
          });
          
          // Next segment starts the day after this one ends
          currentDate = new Date(endDate);
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(0, 0, 0, 0);
        }
      });
      
      console.log('Rental segments result:', result);
      return result;
    }
    
    // Проверяем, является ли это МКОР только для ТОИР (нет jobs, но есть segments с одним элементом)
    // Для ТОИР используем только этап: maintenance
    const isMaintenanceMkor = (!mkor.jobs || mkor.jobs.length === 0) && segments.length === 1;
    if (isMaintenanceMkor && segments.length > 0) {
      console.log('Processing maintenance MKOR:', mkor.name, {
        segments,
        startDate,
        isMaintenanceMkor
      });
      
      // Для ТОИР используем только этап maintenance
      const maintenanceStages = ['maintenance'] as const;
      const result = [];
      let currentDate = parseISO(startDate);
      
      segments.forEach((duration, index) => {
        if (duration > 0 && index < maintenanceStages.length) {
          // Calculate end date: start + duration - 1 day (since we want to end at the end of the last day)
          const endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + duration - 1);
          endDate.setHours(23, 59, 59, 999); // End at the end of the day
          
          result.push({
            stage: maintenanceStages[index], // This correctly sets stage to 'maintenance'
            start: new Date(currentDate),
            end: endDate,
            duration,
            index: 5, // This index is for internal segment tracking, not display name lookup
          });
          
          // Next segment starts the day after this one ends
          currentDate = new Date(endDate);
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(0, 0, 0, 0);
        }
      });
      
      console.log('Maintenance segments result:', result);
      return result;
    }
    
    const result = [];
    let currentDate = parseISO(startDate);
    const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
    
    stages.forEach((stage, index) => {
      const duration = segments[index] || 0;
      if (duration > 0) {
        // Calculate end date: start + duration - 1 day (since we want to end at the end of the last day)
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + duration - 1);
        endDate.setHours(23, 59, 59, 999); // End at the end of the day
        
        result.push({
          stage,
          start: new Date(currentDate),
          end: endDate,
          duration,
          index,
        });
        
        // Next segment starts the day after this one ends
        currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    });
    return result;
  };

  const getDayContent = (day: Date) => {
    const startDate = mkor.jobs?.[0]?.start || mkor.start;
    if (!startDate) {
      console.warn('No start date found for MKOR:', mkor.name);
      return null;
    }
    
    const segments = getMkorSegments(mkor, startDate);
    const dayDate = new Date(day);
    dayDate.setHours(0, 0, 0, 0); // Обнуляем время для точного сравнения дат
    
    // Отладка для аренды
    if (!mkor.jobs || mkor.jobs.length === 0) {
      console.log(`Checking day ${dayDate.toDateString()} for rental MKOR ${mkor.name}:`, {
        segmentsCount: segments.length,
        segments: segments.map(s => ({
          stage: s.stage,
          start: s.start.toDateString(),
          end: s.end.toDateString(),
          duration: s.duration
        }))
      });
    }
    
    // Ищем этап, который покрывает этот день
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startDate = new Date(segment.start);
      const endDate = new Date(segment.end);
      startDate.setHours(0, 0, 0, 0); // Обнуляем время
      endDate.setHours(0, 0, 0, 0); // Обнуляем время
      
      // Проверяем, попадает ли день в этот этап (сравниваем только даты)
      // Since endDate is now set to the end of the last day, we use <= for comparison
      if (dayDate >= startDate && dayDate <= endDate) {
        // Отладка: выводим информацию о совпадении
        if (i === 0) { // только для первого этапа
          console.log(`Job start match: ${mkor.name}`, {
            jobStart: mkor.jobs?.[0]?.start,
            dayDate: dayDate.toDateString(),
            startDate: startDate.toDateString(),
            endDate: endDate.toDateString(),
            matches: dayDate >= startDate && dayDate < endDate
          });
        }
        // Вычисляем позицию дня относительно начала этапа
        const dayPosition = differenceInDays(dayDate, startDate);
        const isFirst = dayPosition === 0;
        
        // Определяем, является ли это последним днем этапа
        // Since endDate is now set to the end of the last day, we can simply compare dates
        const isLastDayOfSegment = dayDate.getTime() === endDate.getTime();
        

        
        return {
          stage: segment.stage,
          color: STAGE_DISPLAY_COLORS[segment.stage],
          name: STAGE_DISPLAY_NAMES[segment.stage],
          segmentIndex: segment.index,
          isFirst,
          isLast: isLastDayOfSegment,
          dayPosition,
          totalDuration: segment.duration,
        };
      }
    }
    return null;
  };

  const handleTimelineDrop = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    const newStartDate = format(days[dayIndex], 'yyyy-MM-dd');
    onMkorDrag(mkor.id, newStartDate);
  };

  const totalDays = (() => {
    // Проверяем, есть ли работы с кастомными этапами
    if (mkor.jobs && mkor.jobs.length > 0) {
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
  const isAvailable = isMkorAvailable(mkor, format(new Date(), 'yyyy-MM-dd'));
  const specs = MKOR_SPECS[mkor.diameter];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex border-b border-border last:border-b-0 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center gap-2" style={{minWidth: '10rem', maxWidth: '12rem'}}>
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
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
            onDrop={(e) => handleTimelineDrop(e, dayIndex)}
            onDragOver={(e) => e.preventDefault()}
          >
            {content && (
              <div 
                className="h-full transition-all flex flex-col items-center justify-center group relative cursor-pointer"
                title={`${content.name} - День ${(content.dayPosition || 0) + 1}/${Math.ceil(content.totalDuration || 0)}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('mkorId', mkor.id);
                  e.dataTransfer.setData('segmentIndex', content.segmentIndex.toString());
                }}
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
                  const job = mkor.jobs.find(job => {
                    if (!job.start) return false;
                    const segs = getMkorSegments(mkor, job.start);
                    return segs.some(segment => {
                      if (segment.stage !== 'working') return false;
                      const start = new Date(segment.start);
                      const end = new Date(segment.end);
                      const dayDate = new Date(day);
                      return dayDate >= start && dayDate < end;
                    });
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
                {content.isLast && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-white/30 rounded-full"></div>
                )}
                {/* Resize handle */}
                {content.isLast && (
                  <div 
                    className="absolute right-0 top-0 w-2 h-full bg-white/20 cursor-col-resize hover:bg-white/40 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startDuration = content.totalDuration || 0;
                      const handleMouseMove = (e: MouseEvent) => {
                        const deltaX = e.clientX - startX;
                        const dayWidth = 96; // w-24 = 96px
                        const deltaDays = Math.round(deltaX / dayWidth);
                        const newDuration = Math.max(1, startDuration + deltaDays);
                        if (newDuration !== startDuration) {
                          onSegmentDrag(mkor.id, content.segmentIndex, newDuration);
                        }
                      };
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
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
}) => {
  const [draggedItem, setDraggedItem] = React.useState<MkorUnit | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Формируем массив дней для планировщика
  // Используем стандартный интервал, но исправим логику отображения в getDayContent
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
  
  // Отладка: выводим информацию о датах
  console.log('Timeline dates:', {
    startDate,
    endDate,
    firstDay: days[0]?.toDateString(),
    lastDay: days[days.length - 1]?.toDateString(),
    totalDays: days.length
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedMkor = mkorUnits.find(unit => unit.id === active.id);
    setDraggedItem(draggedMkor || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (active.id !== over?.id) {
      const oldIndex = mkorUnits.findIndex(unit => unit.id === active.id);
      const newIndex = mkorUnits.findIndex(unit => unit.id === over?.id);
      
      const newUnits = arrayMove(mkorUnits, oldIndex, newIndex);
      onMkorUnitsChange(newUnits);
    }
  };

  const handleSegmentDrag = (mkorId: string, segmentIndex: number, newDuration: number) => {
    const newUnits = mkorUnits.map(unit => {
      if (unit.id === mkorId) {
        const newSegments = [...unit.segments];
        newSegments[segmentIndex] = newDuration;
        return { ...unit, segments: newSegments };
      }
      return unit;
    });
    onMkorUnitsChange(newUnits);
  };

  const handleMkorEdit = (updatedMkor: MkorUnit) => {
    const newUnits = mkorUnits.map(unit => 
      unit.id === updatedMkor.id ? updatedMkor : unit
    );
    onMkorUnitsChange(newUnits);
  };

  const handleMkorDelete = (mkorId: string) => {
    const newUnits = mkorUnits.filter(unit => unit.id !== mkorId);
    onMkorUnitsChange(newUnits);
  };

  const handleMkorDrag = (mkorId: string, newStartDate: string) => {
    const newUnits = mkorUnits.map(unit => {
      if (unit.id === mkorId) {
        return { ...unit, start: newStartDate };
      }
      return unit;
    });
    onMkorUnitsChange(newUnits);
  };

  // Для каждого МКОР с работами — одна строка, все работы отображаются на одной шкале
  const sortedUnits = sortMkorUnits(mkorUnits);
  const expandedUnits = sortedUnits;

  // Удаляю условие возврата пустого div. Всегда рендерю основной layout.
  // if (expandedUnits.length === 0) {
  //   return <div />;
  // }

  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Временная шкала МКОР
          </h2>
          <div className="text-sm text-muted-foreground ml-auto">
            Перетащите для изменения порядка и времени
          </div>
        </div>
        
        {/* Применяю scrollRef и onScroll к scrollable div */}
        <div className="overflow-x-auto" ref={scrollRef} onScroll={onScroll}>
          <div className="min-w-max">
            {/* Заголовок с датами */}
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
            
            {/* Строки МКОР с drag and drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={expandedUnits.map(unit => unit.id)} strategy={verticalListSortingStrategy}>
                {expandedUnits.length > 0 && expandedUnits.map((mkor) => (
                  <SortableMkorRow
                    key={mkor.id}
                    mkor={mkor}
                    days={days}
                    onSegmentDrag={handleSegmentDrag}
                    onMkorDrag={handleMkorDrag}
                    onMkorEdit={handleMkorEdit}
                    onMkorDelete={handleMkorDelete}
                  />
                ))}
              </SortableContext>
              
              <DragOverlay>
                {draggedItem ? (
                  <div className="bg-card border border-primary rounded p-2 shadow-elegant">
                    <div className="font-medium text-foreground">{draggedItem.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {draggedItem.segments.reduce((sum, segment) => sum + segment, 0)} дней
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            
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
          
          <div className="ml-auto text-xs text-muted-foreground">
            💡 Перетащите край сегмента для изменения длительности
          </div>
        </div>
      </div>
    </Card>
  );
};