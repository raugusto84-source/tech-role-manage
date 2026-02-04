import { useState } from 'react';
import { Calendar, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DeliveryDateEditorProps {
  orderId: string;
  currentDate: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function DeliveryDateEditor({
  orderId,
  currentDate,
  canEdit,
  onUpdate
}: DeliveryDateEditorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const formatDisplayDate = (dateString: string) => {
    try {
      // Parse date string safely without timezone conversion
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;

    try {
      setSaving(true);
      
      // Format date as YYYY-MM-DD using local date components to avoid timezone shift
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          delivery_date: formattedDate,
          estimated_delivery_date: formattedDate
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Fecha actualizada",
        description: `La fecha de entrega ha sido cambiada al ${day}/${month}/${year}`,
      });

      setIsOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating delivery date:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha de entrega",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Parse current date for calendar - avoid timezone issues
  const getSelectedDate = () => {
    if (!currentDate) return undefined;
    try {
      const [year, month, day] = currentDate.split('T')[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return undefined;
    }
  };
  const selectedDate = getSelectedDate();

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          Entrega: <span className="font-medium">{formatDisplayDate(currentDate)}</span>
        </span>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8"
          disabled={saving}
        >
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{formatDisplayDate(currentDate)}</span>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-border">
          <p className="text-sm font-medium">Cambiar fecha de entrega</p>
          <p className="text-xs text-muted-foreground">Selecciona la nueva fecha</p>
        </div>
        <CalendarComponent
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
          locale={es}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
