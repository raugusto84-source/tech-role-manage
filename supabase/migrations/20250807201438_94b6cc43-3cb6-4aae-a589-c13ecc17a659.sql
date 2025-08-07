-- Verificar y limpiar datos inconsistentes
DO $$
DECLARE
    existing_user_id UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Buscar el usuario en auth.users
    SELECT id INTO existing_user_id
    FROM auth.users 
    WHERE email = 'tecnico@syslag.com';

    IF existing_user_id IS NOT NULL THEN
        -- Verificar si ya tiene perfil
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = existing_user_id) INTO profile_exists;
        
        IF NOT profile_exists THEN
            -- Crear solo el perfil que falta
            INSERT INTO public.profiles (
                user_id,
                email,
                full_name,
                role,
                created_at,
                updated_at
            ) VALUES (
                existing_user_id,
                'tecnico@syslag.com',
                'Técnico SYSLAG',
                'tecnico'::user_role,
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Perfil creado para usuario existente';
        ELSE
            -- Actualizar el perfil existente para asegurar que tenga rol técnico
            UPDATE public.profiles 
            SET 
                role = 'tecnico'::user_role,
                full_name = 'Técnico SYSLAG',
                updated_at = NOW()
            WHERE user_id = existing_user_id;
            RAISE NOTICE 'Perfil actualizado para usuario existente';
        END IF;
    ELSE
        RAISE NOTICE 'Usuario no encontrado en auth.users';
    END IF;
END $$;