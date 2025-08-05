import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Route, Clock, Car, ChevronDown, ChevronUp } from 'lucide-react';

interface LpuWithCoordinates {
  id: string;
  name: string;
  customer: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface DistanceResult {
  from: {
    id: string;
    name: string;
    customer: string;
    coordinates: { lat: number; lng: number };
  };
  to: {
    id: string;
    name: string;
    customer: string;
    coordinates: { lat: number; lng: number };
  };
  distance: {
    meters: number;
    formatted: string;
  };
  duration: {
    seconds: number;
    formatted: string;
  };
}

interface MatrixResult {
  lpus: LpuWithCoordinates[];
  distances: Array<Array<{ meters: number; formatted: string }>>;
  durations: Array<Array<{ seconds: number; formatted: string }>>;
}

const DistanceCalculator: React.FC = () => {
  const [lpus, setLpus] = useState<LpuWithCoordinates[]>([]);
  const [selectedFromLpu, setSelectedFromLpu] = useState<string>('');
  const [selectedToLpu, setSelectedToLpu] = useState<string>('');
  const [selectedLpusForMatrix, setSelectedLpusForMatrix] = useState<string[]>([]);
  const [distanceResult, setDistanceResult] = useState<DistanceResult | null>(null);
  const [matrixResult, setMatrixResult] = useState<MatrixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  // Загрузка ЛПУ с координатами
  useEffect(() => {
    fetchLpusWithCoordinates();
  }, []);

  const fetchLpusWithCoordinates = async () => {
    try {
      console.log('Загружаем ЛПУ с координатами...');
      const response = await fetch('/api/lpus/with-coordinates');
      console.log('Ответ сервера:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error('Ошибка при загрузке ЛПУ');
      }
      const data = await response.json();
      console.log('Получены ЛПУ:', data.length, 'записей');
      setLpus(data);
    } catch (error) {
      setError('Не удалось загрузить ЛПУ с координатами');
      console.error('Ошибка загрузки ЛПУ:', error);
    }
  };

  // Расчет расстояния между двумя ЛПУ
  const calculateDistance = async () => {
    if (!selectedFromLpu || !selectedToLpu) {
      setError('Выберите ЛПУ отправления и назначения');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/distances/calculate?fromLpuId=${selectedFromLpu}&toLpuId=${selectedToLpu}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при расчете расстояния');
      }

      const result = await response.json();
      setDistanceResult(result);
    } catch (error) {
      setError(error.message);
      console.error('Ошибка расчета расстояния:', error);
    } finally {
      setLoading(false);
    }
  };

  // Расчет матрицы расстояний
  const calculateMatrix = async () => {
    if (selectedLpusForMatrix.length < 2) {
      setError('Выберите минимум 2 ЛПУ для расчета матрицы');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/distances/matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lpuIds: selectedLpusForMatrix }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при расчете матрицы');
      }

      const result = await response.json();
      setMatrixResult(result);
    } catch (error) {
      setError(error.message);
      console.error('Ошибка расчета матрицы:', error);
    } finally {
      setLoading(false);
    }
  };

  // Добавление/удаление ЛПУ из матрицы
  const toggleLpuInMatrix = (lpuId: string) => {
    setSelectedLpusForMatrix(prev => 
      prev.includes(lpuId) 
        ? prev.filter(id => id !== lpuId)
        : [...prev, lpuId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Расчет расстояний</h2>
        <p className="text-muted-foreground">
          Расчет расстояний и времени в пути между ЛПУ
        </p>
      </div>

      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* Расчет расстояния между двумя ЛПУ */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Route className="w-5 h-5" />
          Расчет расстояния
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Точка отправления</label>
            <Select value={selectedFromLpu} onValueChange={setSelectedFromLpu}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите точку отправления" />
              </SelectTrigger>
              <SelectContent>
                {lpus.map(lpu => (
                  <SelectItem key={lpu.id} value={lpu.id}>
                    {lpu.customer} - {lpu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Точка прибытия</label>
            <Select value={selectedToLpu} onValueChange={setSelectedToLpu}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите точку прибытия" />
              </SelectTrigger>
              <SelectContent>
                {lpus.map(lpu => (
                  <SelectItem key={lpu.id} value={lpu.id}>
                    {lpu.customer} - {lpu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={calculateDistance} 
          disabled={loading || !selectedFromLpu || !selectedToLpu}
          className="w-full"
        >
          {loading ? 'Расчет...' : 'Рассчитать расстояние'}
        </Button>

        {distanceResult && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
            <h4 className="font-semibold mb-3">Результат расчета</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Откуда</p>
                <p className="font-medium">{distanceResult.from.customer} - {distanceResult.from.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Куда</p>
                <p className="font-medium">{distanceResult.to.customer} - {distanceResult.to.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Расстояние</p>
                  <p className="font-semibold text-blue-600">{distanceResult.distance.formatted}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Время в пути</p>
                  <p className="font-semibold text-green-600">{distanceResult.duration.formatted}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Кнопка для показа/скрытия матрицы расстояний */}
      <div className="text-center">
        <Button 
          variant="outline"
          onClick={() => setShowMatrix(!showMatrix)}
          className="flex items-center gap-2"
        >
          <Car className="w-4 h-4" />
          Матрица расстояний
          {showMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Матрица расстояний (скрываемая) */}
      {showMatrix && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Car className="w-5 h-5" />
            Матрица расстояний
          </h3>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-3">
              Выберите ЛПУ для расчета матрицы расстояний:
            </p>
            <div className="flex flex-wrap gap-2">
              {lpus.map(lpu => (
                <Badge
                  key={lpu.id}
                  variant={selectedLpusForMatrix.includes(lpu.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleLpuInMatrix(lpu.id)}
                >
                  {lpu.customer} - {lpu.name}
                </Badge>
              ))}
            </div>
          </div>

          <Button 
            onClick={calculateMatrix} 
            disabled={loading || selectedLpusForMatrix.length < 2}
            className="w-full"
          >
            {loading ? 'Расчет...' : `Рассчитать матрицу (${selectedLpusForMatrix.length} ЛПУ)`}
          </Button>

          {matrixResult && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Матрица расстояний</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ЛПУ</TableHead>
                      {matrixResult.lpus.map(lpu => (
                        <TableHead key={lpu.id} className="text-center">
                          {lpu.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixResult.lpus.map((lpu, index) => (
                      <TableRow key={lpu.id}>
                        <TableCell className="font-medium">
                          {lpu.customer} - {lpu.name}
                        </TableCell>
                        {matrixResult.distances[index].map((distance, colIndex) => (
                          <TableCell key={colIndex} className="text-center">
                            {index === colIndex ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div>
                                <div className="font-medium">{distance.formatted}</div>
                                <div className="text-xs text-muted-foreground">
                                  {matrixResult.durations[index][colIndex].formatted}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default DistanceCalculator; 