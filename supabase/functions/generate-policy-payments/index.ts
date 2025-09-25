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

function getNextDueDate(currentMonth: number, currentYear: number): { month: number; year: number; due_date: string } {
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  
  // Due on the 5th of each month
  const due_date = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-05`;
  
  return { month: nextMonth, year: nextYear, due_date };
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
    const currentMonth = today.getUTCMonth() + 1;
    const currentYear = today.getUTCFullYear();

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
        // Create payment for current period
        const paymentMonth = currentMonth;
        const paymentYear = currentYear;

        const due_date = new Date().toISOString().split('T')[0];
        
        // Check if payment for this billing run already exists (prevent duplicates)
        const { data: existingPayment, error: checkError } = await supabase
          .from('policy_payments')
          .select('id')
          .eq('policy_client_id', policyClient.id)
          .eq('payment_month', paymentMonth)
          .eq('payment_year', paymentYear)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`Error checking existing payment for policy client ${policyClient.id}:`, checkError);
          details.push({
            policy_client_id: policyClient.id,
            client_name: (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name,
            status: 'error',
            message: `Check error: ${checkError.message}`
          });
          continue;
        }

        if (existingPayment) {
          const clientName = (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name;
          console.log(`Payment already exists for ${clientName} for ${paymentMonth}/${paymentYear}`);
          skipped++;
          details.push({
            policy_client_id: policyClient.id,
            client_name: clientName,
            status: 'skipped',
            message: `Payment for ${paymentMonth}/${paymentYear} already exists`
          });
          continue;
        }

        // Create new payment
        const { error: insertError } = await supabase
          .from('policy_payments')
          .insert({
            policy_client_id: policyClient.id,
            payment_month: paymentMonth,
            payment_year: paymentYear,
            amount: (policyClient.insurance_policies as any)?.[0]?.monthly_fee || (policyClient.insurance_policies as any)?.monthly_fee || 0,
            account_type: 'no_fiscal',
            due_date: due_date,
            is_paid: false,
            payment_status: 'pendiente',
          });

        if (insertError) {
          console.error(`Error creating payment for policy client ${policyClient.id}:`, insertError);
          details.push({
            policy_client_id: policyClient.id,
            client_name: (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name,
            status: 'error',
            message: insertError.message
          });
          continue;
        }

        // Create pending collection notification
        const clientEmail = (policyClient.clients as any)?.[0]?.email || (policyClient.clients as any)?.email;
        if (clientEmail) {
          await supabase
            .from('pending_collections')
            .insert({
              policy_client_id: policyClient.id,
              client_name: (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name,
              client_email: clientEmail,
              policy_name: (policyClient.insurance_policies as any)?.[0]?.policy_name || (policyClient.insurance_policies as any)?.policy_name,
              amount: (policyClient.insurance_policies as any)?.[0]?.monthly_fee || (policyClient.insurance_policies as any)?.monthly_fee || 0,
              due_date: due_date,
              collection_type: 'policy_payment',
              status: 'pending',
              order_id: null,
              order_number: null,
              balance: 0
            });
        }

        // Advance next billing run
        const nextBilling = new Date(policyClient.next_billing_run);
        if (policyClient.billing_frequency_type === 'minutes') {
          nextBilling.setMinutes(nextBilling.getMinutes() + policyClient.billing_frequency_value);
        } else if (policyClient.billing_frequency_type === 'days') {
          nextBilling.setDate(nextBilling.getDate() + policyClient.billing_frequency_value);
        } else { // monthly_on_day
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          nextBilling.setDate(policyClient.billing_frequency_value);
        }

        await supabase
          .from('policy_clients')
          .update({ next_billing_run: nextBilling.toISOString() })
          .eq('id', policyClient.id);

        const clientName = (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name;
        const policyName = (policyClient.insurance_policies as any)?.[0]?.policy_name || (policyClient.insurance_policies as any)?.policy_name;
        const monthlyFee = (policyClient.insurance_policies as any)?.[0]?.monthly_fee || (policyClient.insurance_policies as any)?.monthly_fee;
        
        console.log(`Created payment for ${clientName} - ${paymentMonth}/${paymentYear}`);
        created++;
        details.push({
          policy_client_id: policyClient.id,
          client_name: clientName,
          policy_name: policyName,
          status: 'created',
          month: paymentMonth,
          year: paymentYear,
          amount: monthlyFee,
          due_date: due_date,
          next_billing_run: nextBilling.toISOString()
        });

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
      next_generation_month: getNextDueDate(currentMonth, currentYear).month,
      next_generation_year: getNextDueDate(currentMonth, currentYear).year,
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