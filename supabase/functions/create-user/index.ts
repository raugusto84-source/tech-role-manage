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
  phone: z.string().optional().transform((val: string | undefined) => (val === '' ? undefined : val))
})

serve(async (req: Request) => {
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

    // Check if user is admin via user_roles (avoid relying on profiles.role)
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (rolesError) {
      throw new Error(`Error verifying roles: ${rolesError.message}`)
    }

    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'administrador')
    if (!isAdmin) {
      throw new Error('User not authorized to create users')
    }
  const body = await req.json()
  
  let validatedData
  try {
    validatedData = createUserSchema.parse(body)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: zodError.errors.map((e: z.ZodIssue) => ({ field: e.path.join('.'), message: e.message })),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
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

    const newUserId = newUser.user?.id
    if (!newUserId) {
      throw new Error('User created but missing id')
    }

    // Create/ensure profile row (used by the app UI)
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: newUserId,
          email,
          username,
          full_name,
          phone: phone || null,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (profileUpsertError) {
      throw new Error(`Error creating profile: ${profileUpsertError.message}`)
    }

    // Create/ensure user_roles row (required for has_role() RLS policies)
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: newUserId, role }, { onConflict: 'user_id,role' })

    if (roleUpsertError) {
      throw new Error(`Error assigning role: ${roleUpsertError.message}`)
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

  } catch (error: unknown) {
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