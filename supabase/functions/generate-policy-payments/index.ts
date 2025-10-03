// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const next = new Date(Date.UTC(year, month + 1, day));
  return next.toISOString().substring(0, 10);
}

function getNextFirstOfMonth(): string {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Parse request body for specific policy client or immediate generation
    let requestBody: { policy_client_id?: string; generate_immediate?: boolean } = {};
    try {
      if (req.method === 'POST') {
        requestBody = await req.json();
      }
    } catch (e) {
      console.log('No request body provided, processing all active policy clients');
    }

    console.log('Starting policy payments generation...', requestBody);

    const today = new Date();
    // Use local timezone to avoid off-by-one month when it's the 1st in user timezone
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Get all active policy clients due for billing or specific one
    const nowStr = new Date().toISOString();
    let query = supabase
      .from('policy_clients')
      .select(`
        id,
        policy_id,
        start_date,
        billing_frequency_type,
        billing_frequency_value,
        next_billing_run,
        clients(name, email),
        insurance_policies(monthly_fee, policy_name)
      `)
      .eq('is_active', true);

    if (requestBody.policy_client_id) {
      query = query.eq('client_id', requestBody.policy_client_id);
    } else if (!requestBody.generate_immediate) {
      // Only get those due for billing now
      query = query.lte('next_billing_run', nowStr);
    }

    const { data: policyClients, error: pcError } = await query;

    if (pcError) {
      console.error('Error loading policy clients:', pcError);
      throw pcError;
    }

    console.log(`Found ${policyClients?.length || 0} active policy clients`);

    let created = 0;
    let skipped = 0;
    const details: any[] = [];

    for (const policyClient of policyClients || []) {
      try {
        const clientName = (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name;
        const clientEmail = (policyClient.clients as any)?.[0]?.email || (policyClient.clients as any)?.email;
        const policyName = (policyClient.insurance_policies as any)?.[0]?.policy_name || (policyClient.insurance_policies as any)?.policy_name;
        const monthlyFee = (policyClient.insurance_policies as any)?.[0]?.monthly_fee || (policyClient.insurance_policies as any)?.monthly_fee || 0;

        // Array to store payments to create
        const paymentsToCreate: any[] = [];

        // Get policy start date
        const policyStart = new Date(policyClient.start_date);
        let iterMonth = policyStart.getMonth() + 1;
        let iterYear = policyStart.getFullYear();

        // Generate payments for each month where day 1 has passed since policy start
        while (true) {
          const firstOfMonth = new Date(iterYear, iterMonth - 1, 1);
          
          // Stop if this month's 1st hasn't arrived yet
          if (firstOfMonth > today) {
            break;
          }

          const dueDate = new Date(iterYear, iterMonth - 1, 5).toISOString().split('T')[0];
          
          // Check if payment already exists
          const { data: existing } = await supabase
            .from('policy_payments')
            .select('id')
            .eq('policy_client_id', policyClient.id)
            .eq('payment_month', iterMonth)
            .eq('payment_year', iterYear)
            .maybeSingle();

          if (!existing) {
            paymentsToCreate.push({
              policy_client_id: policyClient.id,
              payment_month: iterMonth,
              payment_year: iterYear,
              amount: monthlyFee,
              account_type: 'no_fiscal',
              due_date: dueDate,
              is_paid: false,
              payment_status: 'pendiente',
            });
            
            // Create pending collection notification
            if (clientEmail) {
              await supabase.from('pending_collections').insert({
                policy_client_id: policyClient.id,
                client_name: clientName,
                client_email: clientEmail,
                policy_name: policyName,
                amount: monthlyFee,
                due_date: dueDate,
                collection_type: 'policy_payment',
                status: 'pending',
                order_id: null,
                order_number: null,
                balance: 0
              });
            }
          }

          // Move to next month
          iterMonth++;
          if (iterMonth > 12) {
            iterMonth = 1;
            iterYear++;
          }
        }

        // Insert all payments for this policy client
        if (paymentsToCreate.length > 0) {
          const { error: insertError } = await supabase
            .from('policy_payments')
            .insert(paymentsToCreate);

          if (insertError) {
            console.error(`Error creating payments for policy client ${policyClient.id}:`, insertError);
            details.push({
              policy_client_id: policyClient.id,
              client_name: clientName,
              status: 'error',
              message: insertError.message
            });
            continue;
          }

          console.log(`Created ${paymentsToCreate.length} payment(s) for ${clientName}`);
          created += paymentsToCreate.length;
          
          paymentsToCreate.forEach(payment => {
            details.push({
              policy_client_id: policyClient.id,
              client_name: clientName,
              policy_name: policyName,
              status: 'created',
              month: payment.payment_month,
              year: payment.payment_year,
              amount: monthlyFee,
              due_date: payment.due_date
            });
          });
        } else {
          console.log(`No new payments needed for ${clientName}`);
          skipped++;
          details.push({
            policy_client_id: policyClient.id,
            client_name: clientName,
            status: 'skipped',
            message: 'Payments already exist'
          });
        }

        // Update next billing run - always to 1st of next month
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        nextBilling.setDate(1);
        nextBilling.setHours(0, 0, 0, 0);

        await supabase
          .from('policy_clients')
          .update({ next_billing_run: nextBilling.toISOString() })
          .eq('id', policyClient.id);

      } catch (error: any) {
        console.error(`Unexpected error processing policy client ${policyClient.id}:`, error);
        details.push({
          policy_client_id: policyClient.id,
          client_name: (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name,
          status: 'error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Check for overdue payments and update status
    const { error: overdueError } = await supabase
      .from('policy_payments')
      .update({ payment_status: 'vencido' })
      .lt('due_date', today.toISOString().substring(0, 10))
      .eq('is_paid', false)
      .eq('payment_status', 'pendiente');

    if (overdueError) {
      console.error('Error updating overdue payments:', overdueError);
    } else {
      console.log('Updated overdue payments status');
    }

    const response = {
      success: true,
      processed: policyClients?.length || 0,
      created: created,
      skipped: skipped,
      current_month: currentMonth,
      current_year: currentYear,
      next_generation_date: getNextFirstOfMonth(),
      details: details,
      timestamp: new Date().toISOString()
    };

    console.log('Policy payments generation completed:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200
      }
    );
    
  } catch (error: any) {
    console.error('Fatal error in policy payments generation:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});