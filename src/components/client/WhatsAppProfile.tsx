import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, CheckCircle } from 'lucide-react';

export function WhatsAppProfile() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [currentWhatsapp, setCurrentWhatsapp] = useState('');

  useEffect(() => {
    loadWhatsAppNumber();
  }, [profile]);

  const loadWhatsAppNumber = async () => {
    if (!profile?.email) return;

    try {
      // First try to get from clients table
      const { data: clientData } = await supabase
        .from('clients')
        .select('whatsapp')
        .eq('email', profile.email)
        .single();

      if (clientData?.whatsapp) {
        setCurrentWhatsapp(clientData.whatsapp);
        setWhatsapp(clientData.whatsapp);
        return;
      }

      // If not found in clients, try profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('whatsapp')
        .eq('email', profile.email)
        .single();

      if (profileData?.whatsapp) {
        setCurrentWhatsapp(profileData.whatsapp);
        setWhatsapp(profileData.whatsapp);
      }
    } catch (error) {
      console.error('Error loading WhatsApp number:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.email) return;

    setLoading(true);

    try {
      // Update in clients table first
      const { error: clientError } = await supabase
        .from('clients')
        .update({ whatsapp })
        .eq('email', profile.email);

      // Also update in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ whatsapp })
        .eq('email', profile.email);

      if (clientError && profileError) {
        throw new Error('No se pudo actualizar el número de WhatsApp');
      }

      setCurrentWhatsapp(whatsapp);
      toast({
        title: "WhatsApp actualizado",
        description: "Su número de WhatsApp ha sido actualizado exitosamente. Recibirá notificaciones automáticas del estado de sus servicios.",
      });
    } catch (error) {
      console.error('Error updating WhatsApp:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el número de WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          Notificaciones WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número de WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+1234567890"
              required
            />
            <p className="text-sm text-muted-foreground">
              Reciba notificaciones automáticas cuando:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Su cotización sea procesada o aceptada</li>
              <li>• Se cree una nueva orden de trabajo</li>
              <li>• El estado de su servicio cambie</li>
              <li>• Su trabajo sea completado</li>
            </ul>
          </div>

          {currentWhatsapp && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">
                Notificaciones activas para: {currentWhatsapp}
              </span>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading || whatsapp === currentWhatsapp} 
            className="w-full"
          >
            {loading ? "Actualizando..." : "Actualizar WhatsApp"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}