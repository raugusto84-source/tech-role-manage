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

    // Get due recurring payrolls
    const { data: rec, error: rpErr } = await supabase
      .from('recurring_payrolls')
      .select('id, employee_name, base_salary, net_salary, account_type, payment_method, next_run_date')
      .eq('active', true)
      .lte('next_run_date', today);

    if (rpErr) throw rpErr;

    let created = 0;
    const details: any[] = [];

    for (const row of rec ?? []) {
      // Insert payroll record
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

      // Create expense entry for payroll
      const { error: expErr } = await supabase.from('expenses').insert({
        amount: row.net_salary,
        description: `[Recurrente Nómina] ${row.employee_name} ${month}/${year}`,
        category: 'nomina',
        account_type: row.account_type,
        payment_method: row.payment_method ?? null,
        expense_date: today,
      } as any);
      if (expErr) {
        details.push({ id: row.id, status: 'partial', message: expErr.message });
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
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
