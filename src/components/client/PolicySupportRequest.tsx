import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PolicyInfo {
  policy_client_id: string;
  policy_id: string;
  policy_name: string;
  policy_number: string;
  client_id: string;
}

interface PolicySupportRequestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policies: PolicyInfo[];
  onSuccess?: () => void;
}

const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal - Puedo esperar unos días" },
  { value: "urgente", label: "Urgente - Necesito atención pronto" },
  { value: "critico", label: "Crítico - Sistema completamente detenido" },
];

// Helper component to auto-select single policy
function SinglePolicyDisplay({ 
  policy, 
  selectedPolicy, 
  setSelectedPolicy 
}: { 
  policy: PolicyInfo; 
  selectedPolicy: string; 
  setSelectedPolicy: (id: string) => void;
}) {
  // Auto-select on mount
  if (!selectedPolicy) {
    setTimeout(() => setSelectedPolicy(policy.policy_client_id), 0);
  }
  
  return (
    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
      <p className="text-sm font-medium">{policy.policy_name}</p>
      <p className="text-xs text-muted-foreground">Póliza: {policy.policy_number}</p>
    </div>
  );
}

export function PolicySupportRequest({ 
  open, 
  onOpenChange, 
  policies,
  onSuccess 
}: PolicySupportRequestProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [failureDescription, setFailureDescription] = useState("");
  const [urgency, setUrgency] = useState("normal");

  const handleSubmit = async () => {
    if (!selectedPolicy || !failureDescription.trim()) {
      toast({
        title: "Error",
        description: "Por favor selecciona una póliza y describe la falla",
        variant: "destructive"
      });
      return;
    }

    const policy = policies.find(p => p.policy_client_id === selectedPolicy);
    if (!policy) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-policy-support-order', {
        body: {
          policy_client_id: policy.policy_client_id,
          policy_id: policy.policy_id,
          client_id: policy.client_id,
          policy_name: policy.policy_name,
          policy_number: policy.policy_number,
          failure_description: failureDescription.trim(),
          urgency
        }
      });

      if (error) throw error;

      toast({
        title: "¡Solicitud enviada!",
        description: `Orden ${data.order_number} creada. Nuestro equipo te contactará pronto.`,
      });

      // Reset form
      setSelectedPolicy("");
      setFailureDescription("");
      setUrgency("normal");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating support order:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la solicitud de soporte",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Solicitar Soporte de Póliza</DialogTitle>
              <DialogDescription>
                Tu solicitud será atendida con prioridad
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {policies.length > 1 ? (
            <div className="space-y-2">
              <Label>Selecciona tu póliza</Label>
              <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una póliza" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(policy => (
                    <SelectItem key={policy.policy_client_id} value={policy.policy_client_id}>
                      {policy.policy_name} ({policy.policy_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : policies.length === 1 ? (
            <SinglePolicyDisplay 
              policy={policies[0]} 
              selectedPolicy={selectedPolicy}
              setSelectedPolicy={setSelectedPolicy}
            />
          ) : null}

          <div className="space-y-2">
            <Label>Nivel de urgencia</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Describe la falla o problema</Label>
            <Textarea
              placeholder="Describe detalladamente qué está fallando, cuándo comenzó el problema, y cualquier información relevante..."
              value={failureDescription}
              onChange={(e) => setFailureDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {urgency === "critico" && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                Las solicitudes críticas se atienden con máxima prioridad. 
                Un técnico será asignado de inmediato.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || !failureDescription.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Solicitud"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
