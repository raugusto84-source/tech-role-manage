import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, UserCircle, Search, Eye, EyeOff, Key } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Tipos para TypeScript
interface User {
  id: string;
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  role: 'administrador' | 'vendedor' | 'tecnico' | 'cliente' | 'supervisor' | 'visor_tecnico';
  created_at: string;
  updated_at: string;
}
interface UserManagementProps {
  onUserSelect: (userId: string, role: string) => void;
}

/**
 * Componente de gestión completa de usuarios
 * 
 * Funcionalidades:
 * - Listar usuarios por categorías (roles)
 * - Crear nuevos usuarios con autenticación
 * - Editar información de usuarios existentes
 * - Eliminar usuarios (solo perfil, no auth.users)
 * - Búsqueda y filtrado
 * 
 * Reutilizable para:
 * - Panel de administración
 * - Selección de usuarios en otros módulos
 * - Asignación de roles y permisos
 */
export function UserManagement({
  onUserSelect
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const {
    toast
  } = useToast();

  // Estado del formulario
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    phone: '',
    role: 'cliente' as User['role'],
    password: ''
  });
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * Carga todos los usuarios desde la base de datos
   * Incluye información de perfil completa
   */
  const loadUsers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filtra usuarios por término de búsqueda y rol
   * Búsqueda en nombre, username, email y rol
   */
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  /**
   * Agrupa usuarios por rol para mejor visualización
   */
  const usersByRole = filteredUsers.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = [];
    acc[user.role].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  /**
   * Maneja la creación de un nuevo usuario
   * Usa Edge Function para crear usuarios de forma segura
   */
  const handleCreateUser = async () => {
    try {
      setLoading(true);

      // Crear usuario usando Edge Function
      const {
        data: session
      } = await supabase.auth.getSession();
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
          phone: formData.phone,
          role: formData.role
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      // Recargar usuarios y mostrar éxito
      loadUsers();
      resetForm();
      setIsDialogOpen(false);
      toast({
        title: 'Usuario creado',
        description: `Usuario ${formData.full_name} creado exitosamente`
      });
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

  /**
   * Maneja la edición de un usuario existente
   * Solo actualiza el perfil, no los datos de autenticación
   */
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      setLoading(true);
      const {
        error
      } = await supabase.from('profiles').update({
        username: formData.username,
        full_name: formData.full_name,
        phone: formData.phone || null,
        role: formData.role,
        updated_at: new Date().toISOString()
      }).eq('id', editingUser.id);
      if (error) throw error;
      loadUsers();
      resetForm();
      setIsDialogOpen(false);
      toast({
        title: 'Usuario actualizado',
        description: `Usuario ${formData.full_name} actualizado exitosamente`
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el usuario',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja la eliminación de un usuario
   * Solo elimina el perfil, mantiene el auth.users para integridad
   */
  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      const {
        error
      } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      loadUsers();
      toast({
        title: 'Usuario eliminado',
        description: 'Usuario eliminado exitosamente'
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el usuario',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Elimina completamente al usuario (perfil + auth)
   */
  const handleDeleteUserFully = async (user: User) => {
    try {
      setLoading(true);
      const {
        data: session
      } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No hay sesión activa');
      }
      const response = await fetch('https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          userId: user.user_id
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'No se pudo eliminar el usuario');
      }
      await loadUsers();
      toast({
        title: 'Usuario eliminado',
        description: `Se eliminó ${user.full_name} (perfil y acceso)`
      });
    } catch (error: any) {
      console.error('Error deleting user fully:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el usuario',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja el cambio de contraseña de un usuario
   */
  const handleChangePassword = async () => {
    if (!passwordChangeUser || !newPassword) return;
    try {
      setLoading(true);
      const {
        data: session
      } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No hay sesión activa');
      }
      console.log('Changing password for user:', passwordChangeUser);
      console.log('User ID being sent:', passwordChangeUser.user_id);
      const response = await fetch('https://exunjybsermnxvrvyxnj.supabase.co/functions/v1/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          userId: passwordChangeUser.user_id,
          newPassword: newPassword
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Error al cambiar contraseña');
      }
      setIsPasswordDialogOpen(false);
      setPasswordChangeUser(null);
      setNewPassword('');

      // Clear password visibility state
      setShowPasswords(prev => ({
        ...prev,
        change_password: false
      }));
      toast({
        title: 'Contraseña actualizada',
        description: `Contraseña de ${passwordChangeUser.full_name} actualizada exitosamente`
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar la contraseña',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Alterna la visibilidad de la contraseña para un usuario
   */
  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  /**
   * Genera una contraseña temporal para mostrar
   */
  const getDisplayPassword = (userId: string) => {
    return showPasswords[userId] ? '••••••••' : '••••••••';
  };

  /**
   * Resetea el formulario a valores iniciales
   */
  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      full_name: '',
      phone: '',
      role: 'cliente',
      password: ''
    });
    setEditingUser(null);
  };

  /**
   * Prepara el formulario para editar un usuario
   */
  const startEdit = (user: User) => {
    setFormData({
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      password: ''
    });
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  /**
   * Obtiene el color del badge según el rol
   */
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'administrador':
        return 'default';
      case 'supervisor':
        return 'default';
      case 'vendedor':
        return 'secondary';
      case 'tecnico':
        return 'outline';
      case 'cliente':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  /**
   * Traduce roles al español
   */
  const translateRole = (role: string) => {
    const translations = {
      'administrador': 'Administrador',
      'supervisor': 'Supervisor',
      'vendedor': 'Vendedor',
      'tecnico': 'Técnico',
      'cliente': 'Cliente',
      'visor_tecnico': 'Visor Técnico'
    };
    return translations[role as keyof typeof translations] || role;
  };
  if (loading && users.length === 0) {
    return <div className="text-center py-6">Cargando usuarios...</div>;
  }
  return <div className="space-y-6">
      {/* Controles de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Buscar por nombre o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </div>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="administrador">Administradores</SelectItem>
            <SelectItem value="supervisor">Supervisores</SelectItem>
            <SelectItem value="vendedor">Vendedores</SelectItem>
            <SelectItem value="tecnico">Técnicos</SelectItem>
            <SelectItem value="visor_tecnico">Visores Técnicos</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Usuario</Label>
                <Input 
                  id="username" 
                  value={formData.username} 
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    username: e.target.value
                  }))} 
                  disabled={!!editingUser} 
                  placeholder="nombre_usuario" 
                />
                {!editingUser && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Este será el nombre de usuario para iniciar sesión
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({
                ...prev,
                email: e.target.value
              }))} disabled={!!editingUser} placeholder="usuario@ejemplo.com" />
              </div>
              <div>
                <Label htmlFor="full_name">Nombre Completo</Label>
                <Input id="full_name" value={formData.full_name} onChange={e => setFormData(prev => ({
                ...prev,
                full_name: e.target.value
              }))} placeholder="Juan Pérez" />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono (Opcional)</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData(prev => ({
                ...prev,
                phone: e.target.value
              }))} placeholder="+1234567890" />
              </div>
                <div>
                <Label htmlFor="role">Rol</Label>
                <Select value={formData.role} onValueChange={value => setFormData(prev => ({
                ...prev,
                role: value as User['role']
              }))} disabled={editingUser?.role === 'cliente'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="visor_tecnico">Visor Técnico</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                {editingUser?.role === 'cliente' && <p className="text-xs text-muted-foreground mt-1">
                    Los clientes no pueden cambiar su tipo de rol
                  </p>}
              </div>
              {!editingUser && <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input id="password" type={showPasswords['create_user'] ? 'text' : 'password'} value={formData.password} onChange={e => setFormData(prev => ({
                  ...prev,
                  password: e.target.value
                }))} placeholder="Mínimo 6 caracteres" className="pr-10" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => {
                  console.log('Create user password toggle clicked, current state:', showPasswords['create_user']);
                  setShowPasswords(prev => ({
                    ...prev,
                    create_user: !prev.create_user
                  }));
                }}>
                      {showPasswords['create_user'] ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={editingUser ? handleUpdateUser : handleCreateUser} disabled={!formData.username || !formData.email || !formData.full_name || !editingUser && !formData.password}>
                  {editingUser ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de usuarios agrupados por rol */}
      <div className="space-y-6">
        {Object.entries(usersByRole).map(([role, roleUsers]) => <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {translateRole(role)} ({roleUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {roleUsers.map(user => <Card key={user.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                       <div className="flex justify-between items-start mb-2">
                         <div className="flex-1">
                            <h4 className="font-medium text-foreground">{user.full_name}</h4>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                           
                           {/* Sección de contraseña */}
                           <div className="flex items-center gap-2 mt-2">
                             
                             
                           </div>
                         </div>
                         <Badge variant={getRoleBadgeVariant(user.role)}>
                           {translateRole(user.role)}
                         </Badge>
                       </div>
                       
                       <Separator className="my-3" />
                       
                       <div className="flex justify-between items-center">
                         <div className="text-xs text-muted-foreground">
                           Creado: {new Date(user.created_at).toLocaleDateString()}
                         </div>
                         <div className="flex gap-1">
                           <Button size="sm" variant="outline" onClick={() => startEdit(user)} title="Editar usuario">
                             <Edit className="h-3 w-3" />
                           </Button>
                           <Button size="sm" variant="outline" onClick={() => {
                      setPasswordChangeUser(user);
                      setIsPasswordDialogOpen(true);
                    }} title="Cambiar contraseña">
                             <Key className="h-3 w-3" />
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button size="sm" variant="outline" title="Eliminar usuario">
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   Esta acción eliminará el perfil de {user.full_name}. 
                                   Los datos de autenticación se conservarán por seguridad.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUserFully(user)}>
                                    Eliminar
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                       </div>
                    </CardContent>
                  </Card>)}
              </div>
            </CardContent>
          </Card>)}
      </div>

      {filteredUsers.length === 0 && <Card>
          <CardContent className="text-center py-8">
            <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No se encontraron usuarios con esos criterios' : 'No hay usuarios registrados'}
            </p>
          </CardContent>
        </Card>}

      {/* Diálogo para cambiar contraseña */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Actualizar la contraseña del usuario seleccionado. La nueva contraseña debe tener al menos 6 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuario</Label>
              <p className="text-sm text-muted-foreground">
                {passwordChangeUser?.full_name} ({passwordChangeUser?.email})
              </p>
            </div>
            <div>
              <Label htmlFor="new_password">Nueva Contraseña</Label>
              <div className="relative">
                <Input id="new_password" type={showPasswords['change_password'] ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" className="pr-10" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => {
                console.log('Toggle clicked, current state:', showPasswords['change_password']);
                setShowPasswords(prev => ({
                  ...prev,
                  change_password: !prev.change_password
                }));
              }}>
                  {showPasswords['change_password'] ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
              setIsPasswordDialogOpen(false);
              setPasswordChangeUser(null);
              setNewPassword('');
            }}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={!newPassword || newPassword.length < 6 || loading}>
                {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}