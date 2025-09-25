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

    // Get all active policy clients or specific one
    let query = supabase
      .from('policy_clients')
      .select(`
        id,
        policy_id,
        start_date,
        clients(name, email),
        insurance_policies(monthly_fee, policy_name)
      `)
      .eq('is_active', true);

    if (requestBody.policy_client_id) {
      query = query.eq('client_id', requestBody.policy_client_id);
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
        // Generate payments for current month if immediate, or next month
        const monthsToGenerate = requestBody.generate_immediate ? 
          [{ month: currentMonth, year: currentYear }, getNextDueDate(currentMonth, currentYear)] :
          [getNextDueDate(currentMonth, currentYear)];

        for (const { month, year } of monthsToGenerate) {
          const due_date = `${year}-${month.toString().padStart(2, '0')}-05`;
          
          // Check if payment for this month already exists
          const { data: existingPayment, error: checkError } = await supabase
            .from('policy_payments')
            .select('id')
            .eq('policy_client_id', policyClient.id)
            .eq('payment_month', month)
            .eq('payment_year', year)
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
            console.log(`Payment already exists for ${clientName} for ${month}/${year}`);
            skipped++;
            details.push({
              policy_client_id: policyClient.id,
              client_name: clientName,
              status: 'skipped',
              message: `Payment for ${month}/${year} already exists`
            });
            continue;
          }

          // Create new payment
          const { error: insertError } = await supabase
            .from('policy_payments')
            .insert({
              policy_client_id: policyClient.id,
              payment_month: month,
              payment_year: year,
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

          const clientName = (policyClient.clients as any)?.[0]?.name || (policyClient.clients as any)?.name;
          const policyName = (policyClient.insurance_policies as any)?.[0]?.policy_name || (policyClient.insurance_policies as any)?.policy_name;
          const monthlyFee = (policyClient.insurance_policies as any)?.[0]?.monthly_fee || (policyClient.insurance_policies as any)?.monthly_fee;
          
          console.log(`Created payment for ${clientName} - ${month}/${year}`);
          created++;
          details.push({
            policy_client_id: policyClient.id,
            client_name: clientName,
            policy_name: policyName,
            status: 'created',
            month: month,
            year: year,
            amount: monthlyFee,
            due_date: due_date
          });
        }

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