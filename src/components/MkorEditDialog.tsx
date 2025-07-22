import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Edit, Trash2, Calendar, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { MkorUnit, MkorJob } from '../types/mkor';

interface MkorEditDialogProps {
  mkor: MkorUnit;
  onSave: (updatedMkor: MkorUnit) => void;
  onDelete: (mkorId: string) => void;
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

  const handleAddJob = () => {
    if (!canAddJob(newJobDate)) {
      setJobError('Нельзя назначить работу на выбранную дату');
      return;
    }
    const newJobs = [...(editedMkor.jobs || []), { start: newJobDate }];
    setEditedMkor({ ...editedMkor, jobs: newJobs });
    setNewJobDate('');
    setJobError('');
  };

  const handleDeleteJob = (idx: number) => {
    const newJobs = (editedMkor.jobs || []).filter((_, i) => i !== idx);
    setEditedMkor({ ...editedMkor, jobs: newJobs });
  };

  const handleSave = () => {
    onSave(editedMkor);
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete(mkor.id);
    setIsOpen(false);
  };

  const updateSegment = (index: number, value: string) => {
    const newSegments = [...editedMkor.segments];
    newSegments[index] = Math.max(0, parseInt(value) || 0);
    setEditedMkor({ ...editedMkor, segments: newSegments });
  };

  const segmentNames = ['Транзит', 'Погрузка/Разгрузка', 'Работа', 'Ремонт'];
  const segmentColors = ['bg-transit', 'bg-loading', 'bg-working', 'bg-repair'];

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

          {/* Сегменты */}
          <div className="space-y-3">
            <Label className="text-foreground font-medium">Длительность этапов (дни)</Label>
            {segmentNames.map((name, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-4 h-4 ${segmentColors[index]} rounded`}></div>
                <Label className="text-sm text-foreground min-w-0 flex-1">{name}</Label>
                <Input
                  type="number"
                  min="0"
                  value={editedMkor.segments[index]}
                  onChange={(e) => updateSegment(index, e.target.value)}
                  className="w-20 bg-secondary border-border text-foreground"
                />
              </div>
            ))}
          </div>

          {/* Информация */}
          <Card className="bg-secondary/50 border-border p-3">
            <div className="text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Общая длительность:</span>
                <span className="text-foreground font-medium">
                  {editedMkor.segments.reduce((sum, segment) => sum + segment, 0)} дней
                </span>
              </div>
            </div>
          </Card>

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