import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationResult {
  process: string;
  success: boolean;
  processed: number;
  errors: any[];
  execution_time: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action = 'daily', force = false } = await req.json().catch(() => ({}));
    
    console.log(`🚀 Policy Automation Engine - Action: ${action}, Force: ${force}`);
    
    const results: AutomationResult[] = [];
    const startTime = Date.now();

    // 1. Generate Policy Payments (Monthly)
    if (action === 'daily' || action === 'monthly' || action === 'payments' || force) {
      const paymentStart = Date.now();
      try {
        const { data: paymentResult } = await supabaseClient.functions.invoke('generate-policy-payments', {
          body: { generate_immediate: force }
        });
        
        results.push({
          process: 'generate-policy-payments',
          success: true,
          processed: paymentResult?.created || 0,
          errors: paymentResult?.errors || [],
          execution_time: Date.now() - paymentStart
        });
      } catch (error) {
        results.push({
          process: 'generate-policy-payments',
          success: false,
          processed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          execution_time: Date.now() - paymentStart
        });
      }
    }

    // 2. Process Scheduled Services (Daily)
    if (action === 'daily' || action === 'services' || force) {
      const servicesStart = Date.now();
      try {
        const { data: servicesResult } = await supabaseClient.functions.invoke('process-scheduled-services', {
          body: {}
        });
        
        results.push({
          process: 'process-scheduled-services',
          success: true,
          processed: servicesResult?.orders_created || 0,
          errors: servicesResult?.errors || [],
          execution_time: Date.now() - servicesStart
        });
      } catch (error) {
        results.push({
          process: 'process-scheduled-services',
          success: false,
          processed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          execution_time: Date.now() - servicesStart
        });
      }
    }

    // 3. Process Follow-Up Reminders (Daily)
    if (action === 'daily' || action === 'followups' || force) {
      const followUpStart = Date.now();
      try {
        // Get pending follow-up reminders
        const { data: pendingReminders, error: remindersError } = await supabaseClient
          .rpc('process_pending_follow_ups');
        
        if (remindersError) throw remindersError;
        
        let processedReminders = 0;
        const reminderErrors: any[] = [];
        
        for (const reminder of pendingReminders || []) {
          try {
            // Send follow-up notification
            await supabaseClient.functions.invoke('send-follow-up-notifications', {
              body: { reminder_id: reminder.id }
            });
            
            // Mark as sent
            await supabaseClient.rpc('complete_follow_up_reminder', {
              p_reminder_id: reminder.id,
              p_status: 'sent'
            });
            
            processedReminders++;
          } catch (error) {
            reminderErrors.push({
              reminder_id: reminder.id,
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Mark as failed
            await supabaseClient.rpc('complete_follow_up_reminder', {
              p_reminder_id: reminder.id,
              p_status: 'failed'
            });
          }
        }
        
        results.push({
          process: 'process-follow-ups',
          success: true,
          processed: processedReminders,
          errors: reminderErrors,
          execution_time: Date.now() - followUpStart
        });
      } catch (error) {
        results.push({
          process: 'process-follow-ups',
          success: false,
          processed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          execution_time: Date.now() - followUpStart
        });
      }
    }

    // 4. Update Overdue Payments (Daily)
    if (action === 'daily' || action === 'overdue' || force) {
      const overdueStart = Date.now();
      try {
        const { data: overdueResult, error: overdueError } = await supabaseClient
          .from('policy_payments')
          .update({ payment_status: 'vencido' })
          .eq('payment_status', 'pendiente')
          .lt('due_date', new Date().toISOString().split('T')[0])
          .select('id');
        
        if (overdueError) throw overdueError;
        
        results.push({
          process: 'update-overdue-payments',
          success: true,
          processed: overdueResult?.length || 0,
          errors: [],
          execution_time: Date.now() - overdueStart
        });
      } catch (error) {
        results.push({
          process: 'update-overdue-payments',
          success: false,
          processed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          execution_time: Date.now() - overdueStart
        });
      }
    }

    // 5. Generate Financial Projections (Weekly)
    if (action === 'weekly' || action === 'projections' || force) {
      const projectionsStart = Date.now();
      try {
        // Calculate next 12 months projections
        const projections = [];
        const today = new Date();
        
        for (let i = 1; i <= 12; i++) {
          const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
          const year = targetDate.getFullYear();
          const month = targetDate.getMonth() + 1;
          
          // Get active policy clients for this projection period
          const { data: activePolicies, error: policiesError } = await supabaseClient
            .from('policy_clients')
            .select(`
              id,
              insurance_policies(monthly_fee)
            `)
            .eq('is_active', true);
          
          if (policiesError) throw policiesError;
          
          const monthlyRevenue = activePolicies?.reduce((sum, pc) => 
            sum + ((pc.insurance_policies as any)?.[0]?.monthly_fee || (pc.insurance_policies as any)?.monthly_fee || 0), 0) || 0;
          
          projections.push({
            year,
            month,
            projected_revenue: monthlyRevenue,
            active_contracts: activePolicies?.length || 0,
            projection_date: new Date().toISOString()
          });
        }
        
        // Insert projections (upsert)
        const { error: insertError } = await supabaseClient
          .from('financial_projections')
          .upsert(projections, { 
            onConflict: 'year,month',
            ignoreDuplicates: false 
          });
        
        if (insertError) throw insertError;
        
        results.push({
          process: 'generate-financial-projections',
          success: true,
          processed: projections.length,
          errors: [],
          execution_time: Date.now() - projectionsStart
        });
      } catch (error) {
        results.push({
          process: 'generate-financial-projections',
          success: false,
          processed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          execution_time: Date.now() - projectionsStart
        });
      }
    }

    // Summary
    const totalExecutionTime = Date.now() - startTime;
    const totalSuccess = results.filter(r => r.success).length;
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    const response = {
      success: true,
      action,
      timestamp: new Date().toISOString(),
      execution_time_ms: totalExecutionTime,
      summary: {
        processes_run: results.length,
        processes_successful: totalSuccess,
        total_items_processed: totalProcessed,
        total_errors: totalErrors
      },
      results,
      health_check: {
        database: true,
        edge_functions: totalSuccess > 0,
        automation_status: totalErrors === 0 ? 'healthy' : 'issues_detected'
      }
    };

    console.log('🎯 Policy Automation Engine completed:', response.summary);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Policy Automation Engine failed:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      execution_time_ms: 0,
      summary: {
        processes_run: 0,
        processes_successful: 0,
        total_items_processed: 0,
        total_errors: 1
      },
      results: [],
      health_check: {
        database: false,
        edge_functions: false,
        automation_status: 'critical_error'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});