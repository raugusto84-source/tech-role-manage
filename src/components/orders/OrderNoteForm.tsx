/**
 * FORMULARIO DE NOTAS/COMENTARIOS - COMPONENTE REUTILIZABLE
 * 
 * Características:
 * - Interfaz móvil-first con textarea expansible
 * - Registro automático de usuario y timestamp
 * - Validación de contenido
 * - Upload de fotos (preparado para futuras mejoras)
 * 
 * Funcionalidades:
 * - Comentarios con timestamp automático
 * - Usuario que creó el comentario
 * - Validación de contenido mínimo
 * 
 * Reutilización:
 * - Funciona con cualquier orden
 * - Fácil de extender con upload de archivos
 * - Consistente con design system
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { X, MessageSquare, Send } from 'lucide-react';

interface OrderNoteFormProps {
  order: {
    id: string;
    order_number: string;
    clients?: {
      name: string;
    } | null;
  };
  onClose: () => void;
  onUpdate: () => void;
}

export function OrderNoteForm({ order, onClose, onUpdate }: OrderNoteFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Maneja el envío del comentario
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!note.trim()) {
      toast({
        title: "Error",
        description: "Debes escribir un comentario",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Insertar el comentario en la base de datos
      const { error } = await supabase
        .from('order_notes')
        .insert({
          order_id: order.id,
          user_id: user.id,
          note: note.trim()
        });

      if (error) throw error;

      toast({
        title: "Comentario Agregado",
        description: "Tu comentario se ha registrado exitosamente",
      });

      // Limpiar formulario y cerrar
      setNote('');
      onUpdate();
      onClose();
      
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el comentario",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja cambios en el textarea con límite de caracteres
   */
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) { // Límite de 500 caracteres
      setNote(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Agregar Comentario</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Información de la orden */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {order.order_number}
            </p>
            <p className="text-sm text-muted-foreground">
              Cliente: {order.clients?.name || 'No especificado'}
            </p>
            <p className="text-xs text-muted-foreground">
              Técnico: {profile?.full_name || 'Usuario'}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Textarea para el comentario */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comentario o Observación
              </label>
              <Textarea
                value={note}
                onChange={handleNoteChange}
                placeholder="Describe el trabajo realizado, observaciones, problemas encontrados, etc."
                rows={4}
                className="resize-none"
                disabled={loading}
                autoFocus
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mínimo 10 caracteres</span>
                <span>{note.length}/500</span>
              </div>
            </div>

            {/* Preparado para upload de fotos - futuras mejoras */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground text-center">
                💡 Próximamente: Adjuntar fotos del trabajo realizado
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline" 
                className="flex-1" 
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              
              <Button 
                type="submit"
                className="flex-1"
                disabled={loading || note.trim().length < 10}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}