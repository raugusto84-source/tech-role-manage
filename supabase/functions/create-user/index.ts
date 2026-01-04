import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema - relaxed for practical use
const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password too long'),
  full_name: z.string().min(1, 'Full name is required').max(100, 'Full name too long').trim(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  role: z.enum(['administrador', 'vendedor', 'tecnico', 'cliente', 'supervisor', 'visor_tecnico', 'jcf'], {
    errorMap: () => ({ message: 'Invalid role' })
  }),
  phone: z.string().optional().transform(val => val === '' ? undefined : val)
})

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create regular client to verify the requesting user is an admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Verify the user making the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'administrador') {
      throw new Error('User not authorized to create users')
    }

  // Get and validate request body
  const body = await req.json()
  
  let validatedData
  try {
    validatedData = createUserSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Validation failed',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
    throw error
  }

  const { email, password, full_name, username, phone, role } = validatedData

  // Create user with admin client
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      full_name,
      username,
      role,
      phone: phone || null
    },
    email_confirm: true // Auto-confirm email
  })

    if (createError) {
      throw createError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser.user,
        message: 'Usuario creado exitosamente'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
        status: 400
      }
    )
  }
})