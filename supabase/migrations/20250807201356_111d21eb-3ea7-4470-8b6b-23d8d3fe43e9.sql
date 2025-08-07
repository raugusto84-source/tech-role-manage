-- Primero, verificar si existe y eliminar registros huérfanos
DELETE FROM public.profiles WHERE email = 'tecnico@syslag.com';

-- Crear el usuario técnico de manera manual usando INSERT directo
-- Esto simula el registro por la aplicación
DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Insertar en auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'tecnico@syslag.com',
        crypt('123456', gen_salt('bf')),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Técnico SYSLAG", "role": "tecnico"}',
        NOW(),
        NOW()
    ) RETURNING id INTO new_user_id;

    -- Insertar en profiles
    INSERT INTO public.profiles (
        user_id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        'tecnico@syslag.com',
        'Técnico SYSLAG',
        'tecnico'::user_role,
        NOW(),
        NOW()
    );
END $$;