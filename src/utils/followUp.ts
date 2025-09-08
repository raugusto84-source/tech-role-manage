import { supabase } from "@/integrations/supabase/client";

interface OrderLike {
  id: string;
  order_number?: string;
  clients?: { name?: string; email?: string | null } | null;
}

export async function triggerOrderFollowUp(order: OrderLike, event: string) {
  try {
    const body = {
      trigger_event: event,
      related_id: order.id,
      related_type: 'order',
      target_email: order.clients?.email || null,
      additional_data: {
        client_name: order.clients?.name || 'Cliente',
        order_number: order.order_number || ''
      }
    };

    await supabase.functions.invoke('process-follow-ups', { body });
  } catch (e) {
    console.error('Failed to trigger follow-up', e);
  }
}
