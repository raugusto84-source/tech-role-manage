import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  order_id: string;
  tracking_id: string;
  notification_type: 'sla_warning' | 'sla_exceeded' | 'status_change';
  recipient_type: 'client' | 'fleet' | 'billing';
  recipient_identifier: string;
  message_content: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting SLA notifications check...');

    // Get all tracking entries that need attention
    const { data: trackingEntries, error: trackingError } = await supabase
      .from('order_process_tracking')
      .select(`
        *,
        orders!inner(
          id,
          order_number,
          client_id,
          assigned_technician,
          service_type,
          clients(id, name, email, whatsapp)
        ),
        order_process_slas!inner(
          max_hours,
          warning_hours,
          notification_channels
        )
      `)
      .is('completed_at', null)
      .in('sla_status', ['warning', 'exceeded']);

    if (trackingError) {
      console.error('Error fetching tracking entries:', trackingError);
      throw trackingError;
    }

    console.log(`Found ${trackingEntries?.length || 0} entries needing notifications`);

    const notifications: NotificationPayload[] = [];

    for (const entry of trackingEntries || []) {
      const order = entry.orders;
      const client = order.clients;
      const slaConfig = entry.order_process_slas;

      // Check if notification already sent
      const sentNotifications = JSON.parse(entry.notifications_sent || '[]');
      const notificationKey = `${entry.sla_status}_${Math.floor(entry.hours_elapsed)}h`;
      
      if (sentNotifications.includes(notificationKey)) {
        continue; // Skip if already notified
      }

      const statusText = entry.sla_status === 'warning' ? 'próxima a vencer' : 'vencida';
      const timeText = `${Math.floor(entry.hours_elapsed)} horas`;

      // Client notification
      if (client && client.whatsapp && slaConfig.notification_channels.includes('whatsapp')) {
        const clientMessage = `🔔 *Estado de su orden ${order.order_number}*\n\n` +
          `La etapa "${entry.status_stage}" está ${statusText} (${timeText})\n\n` +
          `Nuestro equipo está trabajando para resolver esto lo antes posible.\n\n` +
          `_Mensaje automático del sistema de seguimiento_`;

        notifications.push({
          order_id: order.id,
          tracking_id: entry.id,
          notification_type: entry.sla_status === 'warning' ? 'sla_warning' : 'sla_exceeded',
          recipient_type: 'client',
          recipient_identifier: client.whatsapp,
          message_content: clientMessage
        });
      }

      // Fleet notification (assigned technician)
      if (order.assigned_technician) {
        const { data: techProfile } = await supabase
          .from('profiles')
          .select('whatsapp, full_name')
          .eq('user_id', order.assigned_technician)
          .single();

        if (techProfile?.whatsapp && slaConfig.notification_channels.includes('whatsapp')) {
          const fleetMessage = `⚠️ *SLA Alert - Orden ${order.order_number}*\n\n` +
            `Etapa: ${entry.status_stage}\n` +
            `Estado: ${statusText} (${timeText})\n` +
            `Cliente: ${client?.name || 'N/A'}\n\n` +
            `Se requiere atención inmediata.\n\n` +
            `_Sistema de seguimiento automático_`;

          notifications.push({
            order_id: order.id,
            tracking_id: entry.id,
            notification_type: entry.sla_status === 'warning' ? 'sla_warning' : 'sla_exceeded',
            recipient_type: 'fleet',
            recipient_identifier: techProfile.whatsapp,
            message_content: fleetMessage
          });
        }
      }

      // Billing team notification (for finalized orders)
      if (entry.status_stage === 'finalizada' && slaConfig.notification_channels.includes('whatsapp')) {
        // Get billing team contacts (users with admin/supervisor role)
        const { data: billingTeam } = await supabase
          .from('profiles')
          .select('whatsapp, full_name')
          .in('role', ['administrador', 'supervisor'])
          .not('whatsapp', 'is', null);

        for (const member of billingTeam || []) {
          const billingMessage = `💰 *Orden lista para cobro - ${order.order_number}*\n\n` +
            `Cliente: ${client?.name || 'N/A'}\n` +
            `Estado: Finalizada hace ${timeText}\n` +
            `SLA: ${statusText}\n\n` +
            `Proceder con la facturación y cobro.\n\n` +
            `_Sistema de seguimiento automático_`;

          notifications.push({
            order_id: order.id,
            tracking_id: entry.id,
            notification_type: entry.sla_status === 'warning' ? 'sla_warning' : 'sla_exceeded',
            recipient_type: 'billing',
            recipient_identifier: member.whatsapp,
            message_content: billingMessage
          });
        }
      }

      // Update notifications_sent array
      const updatedNotifications = [...sentNotifications, notificationKey];
      await supabase
        .from('order_process_tracking')
        .update({ 
          notifications_sent: JSON.stringify(updatedNotifications),
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);
    }

    // Log all notifications to database
    if (notifications.length > 0) {
      const { error: logError } = await supabase
        .from('automated_notifications_log')
        .insert(notifications.map(notif => ({
          order_id: notif.order_id,
          tracking_id: notif.tracking_id,
          notification_type: notif.notification_type,
          recipient_type: notif.recipient_type,
          recipient_identifier: notif.recipient_identifier,
          message_content: notif.message_content,
          channel: 'whatsapp',
          status: 'pending'
        })));

      if (logError) {
        console.error('Error logging notifications:', logError);
      }

      // Send WhatsApp notifications via existing function
      for (const notification of notifications) {
        try {
          await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phone: notification.recipient_identifier,
              message: notification.message_content,
              type: notification.notification_type
            }
          });

          // Update status to sent
          await supabase
            .from('automated_notifications_log')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('tracking_id', notification.tracking_id)
            .eq('recipient_identifier', notification.recipient_identifier);

          console.log(`Notification sent to ${notification.recipient_type}: ${notification.recipient_identifier}`);
        } catch (error) {
          console.error(`Failed to send notification to ${notification.recipient_identifier}:`, error);
          
          // Update status to failed
          await supabase
            .from('automated_notifications_log')
            .update({ status: 'failed' })
            .eq('tracking_id', notification.tracking_id)
            .eq('recipient_identifier', notification.recipient_identifier);
        }
      }
    }

    console.log(`Processed ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${notifications.length} SLA notifications`,
        notifications_sent: notifications.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in SLA notifications function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});