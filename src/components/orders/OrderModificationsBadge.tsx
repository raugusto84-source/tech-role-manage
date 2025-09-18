import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
interface OrderModificationsBadgeProps {
  orderId: string;
  onChanged?: () => void; // Notify parent to refresh items/payments
}
interface OrderModificationRow {
  id: string;
  client_approved: boolean | null;
  created_at: string;
}
export function OrderModificationsBadge({
  orderId,
  onChanged
}: OrderModificationsBadgeProps) {
  const [mods, setMods] = useState<OrderModificationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rejecting, setRejecting] = useState<boolean>(false);
  const fetchMods = async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from("order_modifications").select("id, client_approved, created_at").eq("order_id", orderId).order("created_at", {
      ascending: false
    });
    if (error) {
      console.error("Error loading modifications", error);
      setMods([]);
    } else {
      setMods(data as any[] as OrderModificationRow[]);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchMods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
  const pending = mods.filter(m => m.client_approved === null).length;
  const accepted = mods.filter(m => m.client_approved === true).length;
  const total = mods.length;
  const handleRejectLatest = async () => {
    if (pending === 0) return;
    setRejecting(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("reject-order-modification", {
        body: {
          orderId
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Actualización rechazada",
          description: "Se eliminaron los items agregados."
        });
        await fetchMods();
        onChanged?.();
      } else {
        toast({
          title: "No se pudo rechazar",
          description: data?.error || "Intente nuevamente",
          variant: "destructive"
        });
      }
    } catch (e: any) {
      console.error("Reject error", e);
      toast({
        title: "Error al rechazar",
        description: e?.message || "Intente nuevamente",
        variant: "destructive"
      });
    } finally {
      setRejecting(false);
    }
  };
  if (loading || total === 0) return null;
  return <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">Mods: {total}</Badge>
      {accepted > 0 && <Check className="h-4 w-4 text-green-600" aria-label="Modificaciones aceptadas" />}
      {pending > 0}
    </div>;
}