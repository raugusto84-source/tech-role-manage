import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RejectPayload {
  orderId: string;
  modificationId?: string | null;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client tied to the calling user (for auth/role checks)
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged DB operations (bypass RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user & role
    const { data: authData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !authData?.user) {
      throw new Error('Invalid or missing user');
    }
    const user = authData.user;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profileErr || !profile) throw new Error('Profile not found');

    const body = (await req.json()) as RejectPayload;
    const orderId = body.orderId;
    const modificationId = body.modificationId || null;
    if (!orderId) throw new Error('orderId is required');

    console.log('[reject-order-modification] Start', { orderId, modificationId, user: user.id, role: profile.role });

    // Load order & client (admin to avoid RLS issues)
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, client_id, status')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) throw new Error('Order not found');

    const { data: client, error: clientErr } = await admin
      .from('clients')
      .select('email')
      .eq('id', order.client_id)
      .single();
    if (clientErr || !client) throw new Error('Client not found for order');

    // Authorization: staff allowed, client only if owns order email
    const staffRoles = ['administrador', 'supervisor', 'vendedor', 'tecnico'];
    const isStaff = staffRoles.includes(profile.role);
    const isOwnerClient = !!(user.email && client.email && user.email.toLowerCase() === client.email.toLowerCase());

    if (!isStaff && !isOwnerClient) {
      throw new Error('Unauthorized to reject modification for this order');
    }

    // Find the modification
    let modification: any = null;
    if (modificationId) {
      const { data, error } = await admin
        .from('order_modifications')
        .select('id, created_at, items_added, previous_total, new_total')
        .eq('id', modificationId)
        .single();
      if (error || !data) throw new Error('Modification not found');
      modification = data;
    } else {
      const { data, error } = await admin
        .from('order_modifications')
        .select('id, created_at, items_added, previous_total, new_total')
        .eq('order_id', orderId)
        .is('client_approved', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error || !data) throw new Error('No pending modification found for order');
      modification = data;
    }

    // Parse items_added
    let itemsAdded: any[] = [];
    if (modification.items_added) {
      if (typeof modification.items_added === 'string') {
        try {
          itemsAdded = JSON.parse(modification.items_added);
        } catch (e) {
          console.warn('items_added parse error, treating as empty', e);
          itemsAdded = [];
        }
      } else if (Array.isArray(modification.items_added)) {
        itemsAdded = modification.items_added;
      } else if (typeof modification.items_added === 'object') {
        itemsAdded = [modification.items_added];
      }
    }

    console.log(`[reject-order-modification] Items added count: ${itemsAdded.length}`);

    // Load current order items
    const { data: orderItems, error: itemsErr } = await admin
      .from('order_items')
      .select('id, service_type_id, service_name, quantity, unit_cost_price, unit_base_price, vat_rate, profit_margin_rate, total_amount, status, pricing_locked, created_at')
      .eq('order_id', orderId);
    if (itemsErr) throw itemsErr;

    const modCreatedAt = modification.created_at ? new Date(modification.created_at) : null;

    // Matching with scoring (mirrors frontend logic, but slightly relaxed to be robust)
    const idsToDelete = new Set<string>();
    const matches: Array<{ targetName: string; candidateId: string; score: number }> = [];

    for (const item of itemsAdded) {
      const name = item.service_name || item.name;
      const qty = item.quantity ?? 1;
      const candidates = (orderItems || []).map((row: any) => {
        let score = 0;
        const createdAfter = !modCreatedAt || new Date(row.created_at) >= modCreatedAt;
        const notLocked = row.pricing_locked === false || row.pricing_locked == null;
        const statusPend = row.status === 'pendiente' || row.status == null;
        if (!createdAfter || !notLocked || !statusPend) return { row, score: -1 };

        if (row.service_name === name) score += 50; else return { row, score: -1 };
        if (row.quantity === qty) score += 30; else return { row, score: -1 };
        if (item.service_type_id && row.service_type_id === item.service_type_id) score += 15;
        if (typeof item.total_amount === 'number' && Math.abs(Number(row.total_amount) - Number(item.total_amount)) < 0.01) score += 20;
        if (item.unit_base_price != null && Math.abs(Number(row.unit_base_price) - Number(item.unit_base_price)) < 0.01) score += 10;
        if (item.vat_rate != null && Math.abs(Number(row.vat_rate) - Number(item.vat_rate)) < 0.01) score += 5;
        return { row, score };
      }).filter((c: any) => c.score > 0).sort((a: any, b: any) => b.score - a.score);

      if (candidates.length > 0 && candidates[0].score >= 80) { // slightly relaxed for server
        idsToDelete.add(candidates[0].row.id);
        matches.push({ targetName: name, candidateId: candidates[0].row.id, score: candidates[0].score });
      } else {
        console.warn(`[reject-order-modification] No reliable match for ${name}. Best: ${candidates[0]?.score ?? 0}`);
      }
    }

    console.log('[reject-order-modification] idsToDelete', Array.from(idsToDelete));

    // Delete matched items
    let deletedCount = 0;
    if (idsToDelete.size > 0) {
      const { error: delErr, count } = await admin
        .from('order_items')
        .delete({ count: 'exact' })
        .in('id', Array.from(idsToDelete));
      if (delErr) throw delErr;
      deletedCount = count ?? 0;
    }

    // Delete the modification row
    const { error: modDelErr } = await admin
      .from('order_modifications')
      .delete()
      .eq('id', modification.id);
    if (modDelErr) throw modDelErr;

    // Revert order status and total
    const { error: updOrderErr } = await admin
      .from('orders')
      .update({
        status: 'en_proceso',
        estimated_cost: modification.previous_total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    if (updOrderErr) throw updOrderErr;

    return new Response(
      JSON.stringify({ success: true, deleted_count: deletedCount, matches, modification_id: modification.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('[reject-order-modification] Error', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});