import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentGenerationResult {
  success: boolean;
  payments_created: number;
  payments_skipped: number;
  next_month: number;
  next_year: number;
  execution_date: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting monthly policy payments generation...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the database function to generate monthly payments
    const { data, error } = await supabase.rpc('generate_monthly_policy_payments');

    if (error) {
      console.error('❌ Error generating payments:', error);
      
      const errorResult: PaymentGenerationResult = {
        success: false,
        payments_created: 0,
        payments_skipped: 0,
        next_month: 0,
        next_year: 0,
        execution_date: new Date().toISOString(),
        error: error.message
      };

      return new Response(
        JSON.stringify(errorResult),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Monthly payments generation completed:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Fatal error in monthly payments generation:', error);
    
    const errorResult: PaymentGenerationResult = {
      success: false,
      payments_created: 0,
      payments_skipped: 0,
      next_month: 0,
      next_year: 0,
      execution_date: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return new Response(
      JSON.stringify(errorResult),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});