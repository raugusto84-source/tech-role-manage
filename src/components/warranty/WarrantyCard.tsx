import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WarrantyCardProps {
  orderItem: {
    id: string;
    service_name: string;
    warranty_start_date: string | null;
    warranty_end_date: string | null;
    warranty_conditions: string | null;
    order_id: string;
    orders: {
      order_number: string;
      client_id: string;
    };
  };
  clientId?: string;
  showClaimButton?: boolean;
}

export function WarrantyCard({ orderItem, clientId, showClaimButton = false }: WarrantyCardProps) {
  const { toast } = useToast();
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimType, setClaimType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getWarrantyStatus = () => {
    if (!orderItem.warranty_end_date) {
      return { status: 'sin_garantia', daysRemaining: 0, color: 'gray' };
    }

    const endDate = new Date(orderItem.warranty_end_date);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return { status: 'vencida', daysRemaining: 0, color: 'red' };
    } else if (daysRemaining <= 7) {
      return { status: 'por_vencer', daysRemaining, color: 'yellow' };
    } else {
      return { status: 'vigente', daysRemaining, color: 'green' };
    }
  };

  const getStatusBadge = () => {
    const { status, daysRemaining } = getWarrantyStatus();
    
    switch (status) {
      case 'sin_garantia':
        return <Badge variant="secondary">Sin Garantía</Badge>;
      case 'vencida':
        return <Badge variant="destructive">Vencida</Badge>;
      case 'por_vencer':
        return <Badge variant="secondary">Por Vencer ({daysRemaining} días)</Badge>;
      case 'vigente':
        return <Badge variant="default">Vigente ({daysRemaining} días)</Badge>;
      default:
        return <Badge variant="secondary">Sin Estado</Badge>;
    }
  };

  const submitClaim = async () => {
    if (!claimDescription.trim() || !claimType || !clientId) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('warranty_claims')
        .insert({
          order_item_id: orderItem.id,
          client_id: clientId,
          claim_description: claimDescription,
          claim_type: claimType,
          status: 'pendiente'
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Reclamo de garantía enviado exitosamente"
      });

      setClaimDialogOpen(false);
      setClaimDescription('');
      setClaimType('');
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: "Error",
        description: "Error al enviar el reclamo",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const { status } = getWarrantyStatus();
  const hasWarranty = status !== 'sin_garantia';

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Garantía
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-medium text-sm">{orderItem.service_name}</h4>
          <p className="text-xs text-muted-foreground">Orden: {orderItem.orders.order_number}</p>
        </div>

        {hasWarranty ? (
          <>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Inicio: {orderItem.warranty_start_date ? new Date(orderItem.warranty_start_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Vence: {orderItem.warranty_end_date ? new Date(orderItem.warranty_end_date).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            {orderItem.warranty_conditions && (
              <div>
                <p className="text-xs font-medium">Condiciones:</p>
                <p className="text-xs text-muted-foreground">{orderItem.warranty_conditions}</p>
              </div>
            )}

            {showClaimButton && status === 'vigente' && (
              <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <AlertTriangle className="h-3 w-3 mr-2" />
                    Hacer Reclamo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reclamo de Garantía</DialogTitle>
                    <DialogDescription>
                      Complete la información del reclamo para {orderItem.service_name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="claim-type">Tipo de Reclamo</Label>
                      <Select value={claimType} onValueChange={setClaimType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione el tipo de reclamo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="defecto">Defecto del Producto/Servicio</SelectItem>
                          <SelectItem value="mal_funcionamiento">Mal Funcionamiento</SelectItem>
                          <SelectItem value="incumplimiento">Incumplimiento de Garantía</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="claim-description">Descripción del Problema</Label>
                      <Textarea
                        id="claim-description"
                        placeholder="Describa detalladamente el problema..."
                        value={claimDescription}
                        onChange={(e) => setClaimDescription(e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={submitClaim} disabled={submitting}>
                      {submitting ? 'Enviando...' : 'Enviar Reclamo'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Este item no incluye garantía</p>
        )}
      </CardContent>
    </Card>
  );
}