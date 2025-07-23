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

interface MkorTimelineProps {
  startDate: string;
  endDate: string;
  mkorUnits: MkorUnit[];
  onMkorUnitsChange: (units: MkorUnit[]) => void;
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

  const getMkorSegments = (mkor: MkorUnit) => {
    const segments = [];
    let currentDate = parseISO(mkor.start);
    const stages = ['transitToObject', 'unloading', 'working', 'loading', 'transitToMaintenance', 'maintenance'] as const;
    
    stages.forEach((stage, index) => {
      const duration = mkor.segments[index];
      if (duration > 0) {
        segments.push({
          stage,
          start: new Date(currentDate),
          end: addDays(currentDate, duration - 1),
          duration,
          index,
        });
        currentDate = addDays(currentDate, duration);
      }
    });
    
    return segments;
  };

  const getDayContent = (day: Date) => {
    const segments = getMkorSegments(mkor);
    const dayTime = day.getTime();
    
    for (const segment of segments) {
      const startTime = segment.start.getTime();
      const endTime = segment.end.getTime();
      
      if (dayTime >= startTime && dayTime <= endTime) {
        const dayPosition = differenceInDays(day, segment.start);
        const isFirst = dayPosition === 0;
        const isLast = dayPosition === segment.duration - 1;
        
        return {
          stage: segment.stage,
          color: STAGE_DISPLAY_COLORS[segment.stage],
          name: STAGE_DISPLAY_NAMES[segment.stage],
          segmentIndex: segment.index,
          isFirst,
          isLast,
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

  const totalDays = Array.isArray(mkor.segments) ? mkor.segments.reduce((sum, segment) => sum + segment, 0) : 0;
  const isAvailable = isMkorAvailable(mkor, format(new Date(), 'yyyy-MM-dd'));
  const specs = MKOR_SPECS[mkor.diameter];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex border-b border-border last:border-b-0 ${isDragging ? 'opacity-50' : ''} ${!isAvailable ? 'opacity-60' : ''}`}
    >
      <div className="w-40 p-3 bg-secondary/30 font-medium text-foreground sticky left-0 z-10 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-sm flex items-center gap-1">
            {mkor.name}
            {!isAvailable && (
              <AlertTriangle className="w-3 h-3 text-warning" />
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {totalDays}д
          </div>
          <div className="text-xs text-muted-foreground">
            DN-{mkor.diameter} • {specs?.tractors || 0}т/{specs?.trailers || 0}п/{specs?.lowLoaders || 0}тр
          </div>
        </div>
        <MkorEditDialog
          mkor={mkor}
          onSave={onMkorEdit}
          onDelete={onMkorDelete}
          trigger={
            <button className="text-muted-foreground hover:text-primary transition-colors p-1">
              <Edit className="w-3 h-3" />
            </button>
          }
        />
        <button
          className="ml-2 px-2 py-1 rounded bg-destructive text-white hover:bg-destructive/80 transition text-xs"
          onClick={() => onMkorDelete(mkor.id)}
        >Удалить</button>
      </div>
      
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
                className={`h-full ${content.color} opacity-80 hover:opacity-100 transition-all flex flex-col items-center justify-center group relative cursor-pointer`}
                title={`${content.name} - День ${content.dayPosition + 1}/${content.totalDuration}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('mkorId', mkor.id);
                  e.dataTransfer.setData('segmentIndex', content.segmentIndex.toString());
                }}
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                {content.isFirst && (
                  <div className="text-xs text-white font-medium z-10 text-center leading-tight">
                    {content.name}
                  </div>
                )}
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
                      const startDuration = content.totalDuration;
                      
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

export const MkorTimeline: React.FC<MkorTimelineProps> = ({
  startDate,
  endDate,
  mkorUnits,
  onMkorUnitsChange,
}) => {
  const [draggedItem, setDraggedItem] = React.useState<MkorUnit | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
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

  // Фильтруем только МКОР с работами
  const mkorWithJobs = mkorUnits.filter(unit => Array.isArray(unit.jobs) && unit.jobs.length > 0);

  // Для каждого МКОР и каждой работы строим отдельный блок
  const expandedUnits = mkorWithJobs.flatMap(unit =>
    (unit.jobs || []).map((job, idx) => ({
      ...unit,
      start: job.start,
      jobIndex: idx,
      name: unit.jobs && unit.jobs.length > 1 ? `${unit.name} (${idx + 1})` : unit.name
    }))
  );

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
        
        <div className="overflow-x-auto">
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
              <SortableContext items={expandedUnits.map(unit => unit.id + '-' + unit.start)} strategy={verticalListSortingStrategy}>
                {expandedUnits.length > 0 && expandedUnits.map((mkor) => (
                  <SortableMkorRow
                    key={mkor.id + '-' + mkor.start}
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