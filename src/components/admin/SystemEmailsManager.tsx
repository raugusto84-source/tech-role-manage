import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Save, RefreshCw } from 'lucide-react';

interface SystemEmail {
  id: string;
  email_type: string;
  email_address: string;
  description: string | null;
}

export function SystemEmailsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emails, setEmails] = useState<SystemEmail[]>([]);
  const [editedEmails, setEditedEmails] = useState<Record<string, string>>({});

  const loadEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_emails')
        .select('*')
        .order('email_type');

      if (error) throw error;
      setEmails(data || []);
      
      // Initialize edited emails with current values
      const initial: Record<string, string> = {};
      (data || []).forEach(e => {
        initial[e.email_type] = e.email_address;
      });
      setEditedEmails(initial);
    } catch (error) {
      console.error('Error loading system emails:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los correos del sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each email that has changed
      for (const email of emails) {
        const newAddress = editedEmails[email.email_type];
        if (newAddress && newAddress !== email.email_address) {
          const { error } = await supabase
            .from('system_emails')
            .update({ email_address: newAddress })
            .eq('id', email.id);

          if (error) throw error;
        }
      }

      toast({
        title: "Guardado",
        description: "Los correos del sistema se han actualizado correctamente",
      });

      loadEmails();
    } catch (error: any) {
      console.error('Error saving system emails:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getEmailLabel = (type: string) => {
    switch (type) {
      case 'ventas':
        return 'Correo de Ventas';
      case 'facturacion':
        return 'Correo de Facturación';
      default:
        return type;
    }
  };

  const getEmailIcon = (type: string) => {
    return <Mail className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Correos del Sistema
        </CardTitle>
        <CardDescription>
          Configura los correos electrónicos que reciben notificaciones del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {emails.map((email) => (
          <div key={email.id} className="space-y-2">
            <Label className="flex items-center gap-2">
              {getEmailIcon(email.email_type)}
              {getEmailLabel(email.email_type)}
            </Label>
            <Input
              type="email"
              value={editedEmails[email.email_type] || ''}
              onChange={(e) => setEditedEmails(prev => ({
                ...prev,
                [email.email_type]: e.target.value
              }))}
              placeholder={`Correo de ${email.email_type}`}
            />
            {email.description && (
              <p className="text-xs text-muted-foreground">{email.description}</p>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
          <Button variant="outline" onClick={loadEmails} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
