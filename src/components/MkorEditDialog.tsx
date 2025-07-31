import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Edit, Trash2, Calendar, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { MkorUnit, MkorJob, MKOR_SPECS, STAGE_NAMES } from '../types/mkor';

interface MkorEditDialogProps {
  mkor: MkorUnit;
  onSave?: (updatedMkor?: MkorUnit) => void;
  onDelete: (id: string) => void;
  trigger: React.ReactNode;
}

export const MkorEditDialog: React.FC<MkorEditDialogProps> = ({
  mkor,
  onSave,
  onDelete,
  trigger,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editedMkor, setEditedMkor] = useState<MkorUnit>(mkor);
  const [newJobDate, setNewJobDate] = useState('');
  const [jobError, setJobError] = useState('');
  const [customSegments, setCustomSegments] = useState<number[]>([]);
  const [stagesError, setStagesError] = useState('');

  // Проверка: дата не раньше поставки и не пересекается с существующими работами
  const canAddJob = (date: string) => {
    if (!date) return false;
    if (date < editedMkor.availableFrom) return false;
    if (editedMkor.jobs) {
      for (const job of editedMkor.jobs) {
        // Работа не может начинаться до окончания предыдущей
        const prevStart = new Date(job.start);
        const prevEnd = new Date(prevStart);
        prevEnd.setDate(prevEnd.getDate() + editedMkor.segments.reduce((a, b) => a + b, 0));
        const newStart = new Date(date);
        if (newStart >= prevStart && newStart < prevEnd) return false;
      }
    }
    return true;
  };

  const handleAddJob = async () => {
    if (!canAddJob(newJobDate)) {
      setJobError('Нельзя назначить работу на выбранную дату');
      return;
    }
    try {
      await fetch(`/api/mkor/${mkor.id}/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: newJobDate })
      });
      setNewJobDate('');
      setJobError('');
      if (onSave) onSave();
    } catch (error) {
      setJobError('Ошибка при добавлении работы');
    }
  };

  const handleDeleteJob = async (idx: number) => {
    try {
      const job = (mkor.jobs || [])[idx];
      const jobId = job && (job.id || job['id']);
      if (jobId) {
        await fetch(`/api/job/${jobId}`, { method: 'DELETE' });
        if (onSave) onSave();
      }
    } catch (error) {
      // Можно добавить обработку ошибки
    }
  };

  // Загружаем кастомные этапы при открытии диалога
  useEffect(() => {
    if (isOpen && mkor.jobs && mkor.jobs.length > 0) {
      const job = mkor.jobs[0];
      if (job.customStages && job.customSegments) {
        try {
          const segments = Array.isArray(job.customSegments) 
            ? job.customSegments 
            : JSON.parse(job.customSegments);
          setCustomSegments(segments);
        } catch {
          // Если не удалось распарсить, используем стандартные
          const specs = MKOR_SPECS[mkor.diameter];
          setCustomSegments([
            specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
            specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
          ]);
        }
      } else {
        // Используем стандартные этапы
        const specs = MKOR_SPECS[mkor.diameter];
        setCustomSegments([
          specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
          specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
        ]);
      }
    }
  }, [isOpen, mkor]);

  const handleSegmentChange = (index: number, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setStagesError('Значение должно быть положительным числом');
      return;
    }
    const newSegments = [...customSegments];
    newSegments[index] = numValue;
    setCustomSegments(newSegments);
    setStagesError('');
  };

  const handleResetToDefault = () => {
    const specs = MKOR_SPECS[mkor.diameter];
    setCustomSegments([
      specs.transitToObject, specs.unloadingTime, specs.workingPeriod,
      specs.loadingTime, specs.transitToMaintenance, specs.maintenanceTime
    ]);
    setStagesError('');
  };

  const handleSaveCustomStages = async () => {
    if (!mkor.jobs || mkor.jobs.length === 0) return;
    
    const totalDays = customSegments.reduce((sum, segment) => sum + segment, 0);
    if (totalDays <= 0) {
      setStagesError('Общая продолжительность должна быть больше 0');
      return;
    }

    try {
      const job = mkor.jobs[0];
      const response = await fetch(`/api/job/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: job.start,
          customer: job.customer,
          lpu: job.lpu,
          customStages: true,
          customSegments: customSegments
        })
      });

      if (response.ok) {
        if (onSave) onSave();
      } else {
        setStagesError('Ошибка при сохранении этапов');
      }
    } catch (error) {
      setStagesError('Ошибка при сохранении этапов');
    }
  };

  const handleSave = async () => {
    // Сначала сохраняем кастомные этапы, если есть работы
    if (editedMkor.jobs && editedMkor.jobs.length > 0) {
      await handleSaveCustomStages();
    }
    
    onSave(editedMkor);
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete(mkor.id);
    setIsOpen(false);
  };



  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="w-5 h-5" />
            Редактирование МКОР
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Основная информация */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-foreground">Название установки</Label>
              <Input
                id="name"
                value={editedMkor.name}
                onChange={(e) => setEditedMkor({ ...editedMkor, name: e.target.value })}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            
            <div>
              <Label htmlFor="start" className="text-foreground">Дата начала</Label>
              <Input
                id="start"
                type="date"
                value={editedMkor.start}
                onChange={(e) => setEditedMkor({ ...editedMkor, start: e.target.value })}
                className="bg-secondary border-border text-foreground"
              />
            </div>
          </div>



          {/* Работы */}
          <div className="space-y-3">
            <Label className="text-foreground font-medium">Работы</Label>
            <ul className="mb-2">
              {(editedMkor.jobs || []).map((job, idx) => (
                <li key={job.start} className="flex items-center gap-2 text-sm text-foreground">
                  <span>{format(new Date(job.start), 'dd.MM.yyyy')}</span>
                  <Button size="icon" variant="destructive" onClick={() => handleDeleteJob(idx)}><Trash2 className="w-4 h-4" /></Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                min={editedMkor.availableFrom}
                value={newJobDate}
                onChange={e => setNewJobDate(e.target.value)}
                className="w-40 bg-secondary border-border text-foreground"
              />
              <Button onClick={handleAddJob} className="bg-primary text-white px-3 py-1 flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" /> Добавить работу
              </Button>
            </div>
            {jobError && <div className="text-destructive text-xs mt-1">{jobError}</div>}
          </div>

          {/* Редактирование этапов работы */}
          {editedMkor.jobs && editedMkor.jobs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-medium">Этапы работы</Label>
                <Button variant="outline" size="sm" onClick={handleResetToDefault} className="text-xs">
                  Сбросить до стандартного
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(STAGE_NAMES).map(([stageKey, stageName], index) => (
                  <div key={stageKey} className="space-y-2">
                    <Label htmlFor={`segment-${index}`} className="text-foreground">
                      {stageName}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`segment-${index}`}
                        type="number"
                        step="0.5"
                        min="0"
                        value={customSegments[index] || 0}
                        onChange={(e) => handleSegmentChange(index, e.target.value)}
                        className="flex-1"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground">дней</span>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="bg-secondary/50 border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-medium">Общая продолжительность:</span>
                  <span className="text-foreground font-bold">
                    {customSegments.reduce((sum, segment) => sum + segment, 0) % 1 === 0 
                      ? `${customSegments.reduce((sum, segment) => sum + segment, 0)} дней` 
                      : `${customSegments.reduce((sum, segment) => sum + segment, 0).toFixed(1)} дней`}
                  </span>
                </div>
              </Card>
              {stagesError && (
                <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                  {stagesError}
                </div>
              )}
              <Button onClick={handleSaveCustomStages} disabled={!!stagesError} className="w-full">
                Сохранить этапы
              </Button>
            </div>
          )}

          {/* Действия */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Сохранить
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              size="icon"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};