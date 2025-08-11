import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Technician {
  user_id: string;
  full_name: string;
}

interface SupportTechnicianEntry {
  id: string;
  technicianId: string;
  reductionPercentage: number;
}

interface MultipleSupportTechnicianSelectorProps {
  technicians: Technician[];
  primaryTechnicianId: string;
  selectedSupportTechnicians: SupportTechnicianEntry[];
  onSupportTechniciansChange: (supportTechnicians: SupportTechnicianEntry[]) => void;
  className?: string;
}

export function MultipleSupportTechnicianSelector({
  technicians,
  primaryTechnicianId,
  selectedSupportTechnicians,
  onSupportTechniciansChange,
  className
}: MultipleSupportTechnicianSelectorProps) {
  const { toast } = useToast();
  const [newTechnicianId, setNewTechnicianId] = useState<string>('');
  const [newReductionPercentage, setNewReductionPercentage] = useState<number>(30);

  // Filter available technicians (exclude primary and already selected)
  const availableTechnicians = technicians.filter(tech => 
    tech.user_id !== primaryTechnicianId && 
    !selectedSupportTechnicians.some(selected => selected.technicianId === tech.user_id)
  );

  const addSupportTechnician = () => {
    if (!newTechnicianId) {
      toast({
        title: "Error",
        description: "Selecciona un técnico de apoyo",
        variant: "destructive"
      });
      return;
    }

    if (newReductionPercentage <= 0 || newReductionPercentage > 50) {
      toast({
        title: "Error", 
        description: "El porcentaje de reducción debe estar entre 1% y 50%",
        variant: "destructive"
      });
      return;
    }

    const newSupportTechnician: SupportTechnicianEntry = {
      id: `temp_${Date.now()}`,
      technicianId: newTechnicianId,
      reductionPercentage: newReductionPercentage
    };

    onSupportTechniciansChange([...selectedSupportTechnicians, newSupportTechnician]);
    setNewTechnicianId('');
    setNewReductionPercentage(30);
  };

  const removeSupportTechnician = (id: string) => {
    onSupportTechniciansChange(
      selectedSupportTechnicians.filter(tech => tech.id !== id)
    );
  };

  const updateReductionPercentage = (id: string, percentage: number) => {
    onSupportTechniciansChange(
      selectedSupportTechnicians.map(tech => 
        tech.id === id ? { ...tech, reductionPercentage: percentage } : tech
      )
    );
  };

  const getTechnicianName = (technicianId: string) => {
    return technicians.find(t => t.user_id === technicianId)?.full_name || 'Técnico no encontrado';
  };

  const getTotalReduction = () => {
    return selectedSupportTechnicians.reduce((sum, tech) => sum + tech.reductionPercentage, 0);
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Técnicos de Apoyo</Label>
          <p className="text-sm text-muted-foreground">
            Agregar técnicos de apoyo reduce el tiempo estimado de entrega
          </p>
        </div>

        {/* Selected Support Technicians */}
        {selectedSupportTechnicians.length > 0 && (
          <div className="space-y-2">
            {selectedSupportTechnicians.map((supportTech) => (
              <Card key={supportTech.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{getTechnicianName(supportTech.technicianId)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Label className="text-xs">Reducción:</Label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={supportTech.reductionPercentage}
                          onChange={(e) => updateReductionPercentage(supportTech.id, parseInt(e.target.value) || 0)}
                          className="w-20 h-6 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      -{supportTech.reductionPercentage}%
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSupportTechnician(supportTech.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            
            <div className="text-center">
              <Badge variant="outline" className="text-green-600 border-green-200">
                Reducción total: {getTotalReduction()}%
              </Badge>
            </div>
          </div>
        )}

        {/* Add New Support Technician */}
        {availableTechnicians.length > 0 && (
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm">Agregar Técnico de Apoyo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Técnico</Label>
                  <Select value={newTechnicianId} onValueChange={setNewTechnicianId}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Seleccionar técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTechnicians.map((technician) => (
                        <SelectItem key={technician.user_id} value={technician.user_id}>
                          {technician.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs">% Reducción</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={newReductionPercentage}
                    onChange={(e) => setNewReductionPercentage(parseInt(e.target.value) || 30)}
                    className="h-8"
                    placeholder="30"
                  />
                </div>
                
                <div className="flex items-end">
                  <Button
                    size="sm"
                    onClick={addSupportTechnician}
                    className="h-8"
                    disabled={!newTechnicianId}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {availableTechnicians.length === 0 && selectedSupportTechnicians.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay técnicos disponibles para apoyo
          </p>
        )}
      </div>
    </div>
  );
}