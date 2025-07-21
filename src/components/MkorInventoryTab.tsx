import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Package } from 'lucide-react';
import { MkorInventory, MKOR_SPECS } from '@/types/mkor';
import { format } from 'date-fns';

interface MkorInventoryTabProps {
  inventory: MkorInventory[];
  onInventoryChange: (inventory: MkorInventory[]) => void;
}

export const MkorInventoryTab: React.FC<MkorInventoryTabProps> = ({
  inventory,
  onInventoryChange
}) => {
  const [newDiameter, setNewDiameter] = useState<number>(200);
  const [newCount, setNewCount] = useState<number>(1);
  const [newDate, setNewDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const availableDiameters = Object.keys(MKOR_SPECS).map(Number).sort((a, b) => a - b);

  const handleAddInventory = () => {
    const existingIndex = inventory.findIndex(item => 
      item.diameter === newDiameter && item.availableFrom === newDate
    );

    if (existingIndex >= 0) {
      // Обновляем существующую запись
      const newInventory = [...inventory];
      newInventory[existingIndex] = {
        ...newInventory[existingIndex],
        count: newInventory[existingIndex].count + newCount
      };
      onInventoryChange(newInventory);
    } else {
      // Добавляем новую запись
      const newItem: MkorInventory = {
        diameter: newDiameter,
        count: newCount,
        availableFrom: newDate
      };
      onInventoryChange([...inventory, newItem]);
    }

    // Сброс формы
    setNewCount(1);
  };

  const handleRemoveInventory = (index: number) => {
    const newInventory = inventory.filter((_, i) => i !== index);
    onInventoryChange(newInventory);
  };

  const handleUpdateCount = (index: number, newCount: number) => {
    if (newCount <= 0) {
      handleRemoveInventory(index);
      return;
    }

    const newInventory = [...inventory];
    newInventory[index] = { ...newInventory[index], count: newCount };
    onInventoryChange(newInventory);
  };

  const getTotalByDiameter = (diameter: number) => {
    return inventory
      .filter(item => item.diameter === diameter)
      .reduce((sum, item) => sum + item.count, 0);
  };

  const sortedInventory = [...inventory].sort((a, b) => {
    if (a.diameter !== b.diameter) return a.diameter - b.diameter;
    return new Date(a.availableFrom).getTime() - new Date(b.availableFrom).getTime();
  });

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Имеющиеся МКОР
          </h2>
          <div className="text-sm text-muted-foreground ml-auto">
            Управление парком установок
          </div>
        </div>

        {/* Форма добавления */}
        <div className="bg-secondary/20 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-foreground mb-4">
            Добавить поступление МКОР
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="diameter" className="text-foreground">Диаметр</Label>
              <select
                id="diameter"
                value={newDiameter}
                onChange={(e) => setNewDiameter(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-foreground"
              >
                {availableDiameters.map(diameter => (
                  <option key={diameter} value={diameter}>
                    DN-{diameter}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="count" className="text-foreground">Количество</Label>
              <Input
                id="count"
                type="number"
                min="1"
                value={newCount}
                onChange={(e) => setNewCount(Number(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="date" className="text-foreground">Дата поступления</Label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleAddInventory} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>
          </div>
        </div>

        {/* Сводка по диаметрам */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {availableDiameters.map(diameter => {
            const total = getTotalByDiameter(diameter);
            return (
              <div key={diameter} className="bg-secondary/10 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-foreground">
                  DN-{diameter}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {total}
                </div>
                <div className="text-xs text-muted-foreground">единиц</div>
              </div>
            );
          })}
        </div>

        {/* Список инвентаря */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-foreground mb-3">
            Поступления по датам
          </h3>
          
          {sortedInventory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <div className="text-lg mb-2">Нет данных об инвентаре</div>
              <div className="text-sm">Добавьте первое поступление МКОР</div>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedInventory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="font-medium text-foreground">
                      DN-{item.diameter}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Поступление: {format(new Date(item.availableFrom), 'dd.MM.yyyy')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateCount(index, item.count - 1)}
                      >
                        -
                      </Button>
                      <span className="text-foreground font-medium min-w-[2ch] text-center">
                        {item.count}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateCount(index, item.count + 1)}
                      >
                        +
                      </Button>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveInventory(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Техническая информация */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-3">
            Технические характеристики
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-foreground">Диаметр</th>
                  <th className="text-center py-2 text-foreground">Цикл (дн)</th>
                  <th className="text-center py-2 text-foreground">Работа (дн)</th>
                  <th className="text-center py-2 text-foreground">ТОИР (дн)</th>
                  <th className="text-center py-2 text-foreground">Тягачи</th>
                  <th className="text-center py-2 text-foreground">Прицепы</th>
                  <th className="text-center py-2 text-foreground">Траллы</th>
                </tr>
              </thead>
              <tbody>
                {availableDiameters.map(diameter => {
                  const specs = MKOR_SPECS[diameter];
                  return (
                    <tr key={diameter} className="border-b border-border last:border-b-0">
                      <td className="py-2 font-medium text-foreground">DN-{diameter}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.operationalCycle}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.workingPeriod}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.maintenanceTime}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.tractors}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.trailers}</td>
                      <td className="text-center py-2 text-muted-foreground">{specs.lowLoaders}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
};