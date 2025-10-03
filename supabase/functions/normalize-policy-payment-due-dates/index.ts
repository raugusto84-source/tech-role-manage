// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let body: { dry_run?: boolean } = {};
    try {
      if (req.method === 'POST') body = await req.json();
    } catch (_) {}

    const { data: payments, error } = await supabase
      .from('policy_payments')
      .select('id, policy_client_id, payment_month, payment_year, due_date, is_paid, payment_status')
      .eq('is_paid', false);

    if (error) throw error;

    let updated = 0;
    const updates: any[] = [];
    const collectionUpdates: any[] = [];

    for (const p of payments || []) {
      const targetDue = new Date(p.payment_year, p.payment_month - 1, 5).toISOString().split('T')[0];
      if (p.due_date !== targetDue) {
        updates.push({ id: p.id, due_date: targetDue });
        // Also normalize pending_collections for this policy_client if present
        const oldDate = p.due_date;
        collectionUpdates.push({ policy_client_id: p.policy_client_id, old_due: oldDate, new_due: targetDue });
      }
    }

    if (!body.dry_run && updates.length > 0) {
      // Batch update policy_payments
      for (const chunk of Array.from({ length: Math.ceil(updates.length / 100) }, (_, i) => updates.slice(i * 100, (i + 1) * 100))) {
        const { error: upErr } = await supabase.from('policy_payments').upsert(chunk, { onConflict: 'id' });
        if (upErr) throw upErr;
        updated += chunk.length;
      }

      // Best-effort update pending_collections
      for (const cu of collectionUpdates) {
        await supabase
          .from('pending_collections')
          .update({ due_date: cu.new_due })
          .eq('policy_client_id', cu.policy_client_id)
          .eq('collection_type', 'policy_payment')
          .eq('due_date', cu.old_due)
          .eq('status', 'pending');
      }
    }

    const res = {
      success: true,
      checked: payments?.length || 0,
      updated,
      dry_run: !!body.dry_run,
      timestamp: new Date().toISOString(),
    };

    console.log('normalize-policy-payment-due-dates result', res);

    return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err: any) {
    console.error('Normalization error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
