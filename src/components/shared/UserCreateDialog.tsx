import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff } from 'lucide-react';

type UserRole = 'administrador' | 'vendedor' | 'tecnico' | 'cliente' | 'supervisor' | 'visor_tecnico' | 'jcf';

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (user: any) => void;
  defaultRole?: UserRole;
  showRoleSelector?: boolean;
  title?: string;
}

/**
 * Diálogo reutilizable para crear usuarios con autenticación
 * Mismo formulario usado en UserManagement
 */
export function UserCreateDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultRole = 'cliente',
  showRoleSelector = true,
  title = 'Crear Nuevo Usuario'
}: UserCreateDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    phone: '',
    role: defaultRole,
    password: ''
  });

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      full_name: '',
      phone: '',
      role: defaultRole,
      password: ''
    });
    setShowPassword(false);
  };

  const handleCreate = async () => {
    if (!formData.username || !formData.email || !formData.full_name || !formData.password) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: formData.role
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      toast({
        title: 'Usuario creado',
        description: `Usuario ${formData.full_name} creado exitosamente`
      });

      resetForm();
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess(result.user);
      }

    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Usuario *</Label>
            <Input 
              id="username" 
              value={formData.username} 
              onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))} 
              placeholder="nombre_usuario" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este será el nombre de usuario para iniciar sesión
            </p>
          </div>
          
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input 
              id="email" 
              type="email" 
              value={formData.email} 
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} 
              placeholder="usuario@ejemplo.com" 
            />
          </div>
          
          <div>
            <Label htmlFor="full_name">Nombre Completo *</Label>
            <Input 
              id="full_name" 
              value={formData.full_name} 
              onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))} 
              placeholder="Juan Pérez" 
            />
          </div>
          
          <div>
            <Label htmlFor="phone">Teléfono (Opcional)</Label>
            <Input 
              id="phone" 
              value={formData.phone} 
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
              placeholder="+1234567890" 
            />
          </div>
          
          {showRoleSelector && (
            <div>
              <Label htmlFor="role">Rol *</Label>
              <Select 
                value={formData.role} 
                onValueChange={value => setFormData(prev => ({ ...prev, role: value as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="visor_tecnico">Visor Técnico</SelectItem>
                  <SelectItem value="jcf">JCF (Jóvenes Construyendo el Futuro)</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label htmlFor="password">Contraseña *</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? 'text' : 'password'} 
                value={formData.password} 
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} 
                placeholder="Mínimo 6 caracteres" 
                className="pr-10" 
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
          
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={loading || !formData.username || !formData.email || !formData.full_name || !formData.password}
            >
              {loading ? 'Creando...' : 'Crear'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
