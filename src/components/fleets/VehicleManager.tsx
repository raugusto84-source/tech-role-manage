import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Truck, Calendar } from 'lucide-react';

interface Vehicle {
  id: string;
  model: string;
  license_plate: string;
  year: number | null;
  status: string;
  current_mileage: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
}

export function VehicleManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    model: '',
    license_plate: '',
    year: '',
    status: 'activo',
    current_mileage: '',
    purchase_date: '',
    notes: ''
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los vehículos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      model: '',
      license_plate: '',
      year: '',
      status: 'activo',
      current_mileage: '',
      purchase_date: '',
      notes: ''
    });
    setEditingVehicle(null);
  };

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        model: vehicle.model,
        license_plate: vehicle.license_plate,
        year: vehicle.year?.toString() || '',
        status: vehicle.status,
        current_mileage: vehicle.current_mileage?.toString() || '',
        purchase_date: vehicle.purchase_date || '',
        notes: vehicle.notes || ''
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.model.trim() || !formData.license_plate.trim()) {
      toast({
        title: "Error",
        description: "Modelo y placa son campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const vehicleData = {
        model: formData.model.trim(),
        license_plate: formData.license_plate.trim(),
        year: formData.year ? parseInt(formData.year) : null,
        status: formData.status,
        current_mileage: formData.current_mileage ? parseInt(formData.current_mileage) : null,
        purchase_date: formData.purchase_date || null,
        notes: formData.notes.trim() || null
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Vehículo actualizado correctamente"
        });
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert(vehicleData);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Vehículo creado correctamente"
        });
      }

      handleCloseDialog();
      loadVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      
      let errorMessage = "No se pudo guardar el vehículo";
      if (error.code === '23505' && error.message.includes('license_plate')) {
        errorMessage = "Ya existe un vehículo con esa placa";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activo':
        return 'bg-green-100 text-green-800';
      case 'mantenimiento':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactivo':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Gestión de Vehículos
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Vehículo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingVehicle ? 'Editar Vehículo' : 'Agregar Vehículo'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="model">Modelo *</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Ej: Toyota Corolla"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="license_plate">Placa *</Label>
                    <Input
                      id="license_plate"
                      value={formData.license_plate}
                      onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                      placeholder="ABC-123"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="year">Año</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      placeholder="2020"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Estado</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="current_mileage">Kilometraje Actual</Label>
                    <Input
                      id="current_mileage"
                      type="number"
                      value={formData.current_mileage}
                      onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_date">Fecha de Compra</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observaciones adicionales..."
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingVehicle ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay vehículos registrados</p>
            <p className="text-sm text-muted-foreground mt-2">
              Agrega el primer vehículo para comenzar
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Fecha Compra</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.model}</TableCell>
                    <TableCell>{vehicle.license_plate}</TableCell>
                    <TableCell>{vehicle.year || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusColor(vehicle.status)}>
                        {vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{vehicle.current_mileage ? `${vehicle.current_mileage} km` : 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {vehicle.purchase_date 
                          ? new Date(vehicle.purchase_date).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(vehicle)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}