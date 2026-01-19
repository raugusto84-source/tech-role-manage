import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface ClientUserFormProps {
  onSuccess: (client: any) => void;
  onCancel: () => void;
}

/**
 * Formulario para crear un nuevo cliente con usuario y contraseña
 * Usa la Edge Function create-user para crear el usuario completo con autenticación
 */
export function ClientUserForm({ onSuccess, onCancel }: ClientUserFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    username: '',
    phone: '',
    address: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.full_name.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive"
      });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Error",
        description: "El email es requerido",
        variant: "destructive"
      });
      return;
    }

    if (!formData.username.trim()) {
      toast({
        title: "Error",
        description: "El nombre de usuario es requerido",
        variant: "destructive"
      });
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (!formData.address.trim()) {
      toast({
        title: "Error",
        description: "La dirección es requerida",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Obtener sesión actual
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No hay sesión activa');
      }

      // Crear usuario usando Edge Function
      const response = await fetch('https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          username: formData.username.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: 'cliente'
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      // Crear registro en tabla clients
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          address: formData.address.trim(),
          user_id: result.user?.id || null,
          created_by: session.session.user.id
        })
        .select()
        .single();

      if (clientError) {
        console.error('Error creating client record:', clientError);
        // No lanzar error ya que el usuario se creó correctamente
        toast({
          title: "Advertencia",
          description: "Usuario creado pero hubo un error al crear el registro de cliente",
          variant: "destructive"
        });
      }

      toast({
        title: "Cliente creado",
        description: `Cliente ${formData.full_name} creado exitosamente con su cuenta de acceso`,
      });

      // Retornar el cliente creado
      onSuccess(clientData || {
        id: result.user?.id,
        name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address
      });

    } catch (error: any) {
      console.error('Error creating client user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el cliente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre Completo *</Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
          placeholder="Juan Pérez"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="correo@ejemplo.com"
          required
        />
        <p className="text-xs text-muted-foreground">
          El cliente usará este email para iniciar sesión
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Nombre de Usuario *</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
          placeholder="juanperez"
          required
        />
        <p className="text-xs text-muted-foreground">
          Sin espacios ni caracteres especiales
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña *</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Mínimo 6 caracteres"
            className="pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="+52 123 456 7890"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección *</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Dirección completa del cliente..."
          rows={3}
          required
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Creando..." : "Crear Cliente"}
        </Button>
      </div>
    </form>
  );
}
