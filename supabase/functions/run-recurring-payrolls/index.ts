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

    const today = new Date().toISOString().substring(0, 10);
    
    // Check if this is a manual execution (force parameter)
    const { force } = await req.json().catch(() => ({ force: false }));

    // Get due recurring payrolls
    let query = supabase
      .from('recurring_payrolls')
      .select('id, employee_name, base_salary, net_salary, account_type, payment_method, next_run_date')
      .eq('active', true);
    
    // Only filter by date if not forced (manual execution)
    if (!force) {
      query = query.lte('next_run_date', today);
    }
    
    const { data: rec, error: rpErr } = await query;

    if (rpErr) throw rpErr;

    let created = 0;
    const details: any[] = [];

    for (const row of rec ?? []) {
      // Check if payroll already exists for this week/employee
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Saturday)
      
      const { data: existing, error: checkErr } = await supabase
        .from('payrolls')
        .select('id')
        .eq('employee_name', row.employee_name)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .limit(1);
      
      if (checkErr) {
        details.push({ id: row.id, status: 'error', message: checkErr.message });
        continue;
      }
      
      if (existing && existing.length > 0) {
        details.push({ id: row.id, status: 'skipped', message: 'Nómina ya existe para esta semana' });
        continue;
      }

      // Insert payroll record with status 'pendiente' - NO crear expense automáticamente
      const month = new Date().getUTCMonth() + 1;
      const year = new Date().getUTCFullYear();
      const { error: payErr } = await supabase.from('payrolls').insert({
        employee_name: row.employee_name,
        base_salary: row.base_salary,
        net_salary: row.net_salary,
        period_month: month,
        period_year: year,
        status: 'pendiente',
      } as any);
      if (payErr) {
        details.push({ id: row.id, status: 'error', message: payErr.message });
        continue;
      }

      // Update next_run_date and last_run_date
      const next = addOneMonth(row.next_run_date || today);
      const { error: upErr } = await supabase
        .from('recurring_payrolls')
        .update({ last_run_date: today, next_run_date: next })
        .eq('id', row.id);
      if (upErr) {
        details.push({ id: row.id, status: 'partial', message: upErr.message });
        continue;
      }

      created += 1;
      details.push({ id: row.id, status: 'ok', next_run_date: next });
    }

    return new Response(
      JSON.stringify({ processed: rec?.length ?? 0, created, details }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
