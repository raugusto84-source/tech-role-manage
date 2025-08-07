import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthDebug() {
  const { user, session, profile, loading } = useAuth();

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Debug de Autenticación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>Estado de carga:</strong> {loading ? 'Cargando...' : 'Completado'}
        </div>
        
        <div>
          <strong>Usuario autenticado:</strong> 
          {user ? (
            <div className="ml-4">
              <div>ID: {user.id}</div>
              <div>Email: {user.email}</div>
              <div>Rol del metadata: {user.user_metadata?.role}</div>
              <div>Nombre del metadata: {user.user_metadata?.full_name}</div>
            </div>
          ) : 'No hay usuario'}
        </div>

        <div>
          <strong>Sesión:</strong> 
          {session ? (
            <div className="ml-4">
              <div>Token presente: {session.access_token ? 'Sí' : 'No'}</div>
              <div>Expira: {new Date(session.expires_at! * 1000).toLocaleString()}</div>
            </div>
          ) : 'No hay sesión'}
        </div>

        <div>
          <strong>Perfil cargado:</strong> 
          {profile ? (
            <div className="ml-4">
              <div>ID: {profile.id}</div>
              <div>Email: {profile.email}</div>
              <div>Nombre: {profile.full_name}</div>
              <div>Rol: {profile.role}</div>
              <div>User ID: {profile.user_id}</div>
            </div>
          ) : 'No hay perfil cargado'}
        </div>

        {user && !profile && !loading && (
          <div className="text-red-600 font-semibold">
            ⚠️ PROBLEMA: Usuario autenticado pero sin perfil
          </div>
        )}
      </CardContent>
    </Card>
  );
}