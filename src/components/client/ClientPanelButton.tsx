import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, MessageCircle, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ClientPanelButton() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleAccessClientPanel = () => {
    if (profile?.role === 'cliente') {
      navigate('/client');
    } else {
      // If not a client, redirect to create client account or contact support
      navigate('/auth');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Panel del Cliente
        </CardTitle>
        <CardDescription>
          Accede a tu panel personalizado para gestionar tus servicios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span>Ver tus órdenes y cotizaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <span>Configurar notificaciones WhatsApp</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            <span>Gestionar perfil y datos</span>
          </div>
        </div>
        
        <Button 
          onClick={handleAccessClientPanel}
          className="w-full"
          size="lg"
        >
          {profile?.role === 'cliente' ? 'Ir a Mi Panel' : 'Acceder como Cliente'}
        </Button>
        
        {profile?.role !== 'cliente' && (
          <p className="text-sm text-muted-foreground text-center">
            Si eres cliente, inicia sesión con tu cuenta de cliente
          </p>
        )}
      </CardContent>
    </Card>
  );
}