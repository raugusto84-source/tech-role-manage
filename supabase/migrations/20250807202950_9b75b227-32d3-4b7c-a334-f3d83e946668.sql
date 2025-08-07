-- Crear algunas órdenes de ejemplo para el técnico
-- Primero obtener el ID del técnico y crear un cliente de ejemplo si no existe

DO $$
DECLARE
    tecnico_id UUID;
    cliente_id UUID;
    service_type_id UUID;
BEGIN
    -- Obtener ID del técnico
    SELECT user_id INTO tecnico_id 
    FROM public.profiles 
    WHERE email = 'tecnico@syslag.com' 
    LIMIT 1;

    -- Crear cliente de ejemplo si no existe
    INSERT INTO public.clients (
        name,
        client_number,
        email,
        phone,
        address,
        created_at,
        updated_at
    ) VALUES (
        'Cliente de Prueba',
        'CLI-DEMO',
        'demo@cliente.com',
        '555-0123',
        'Calle Principal 123, Ciudad',
        NOW(),
        NOW()
    ) 
    ON CONFLICT DO NOTHING
    RETURNING id INTO cliente_id;

    -- Si no se insertó (porque ya existía), obtener el ID
    IF cliente_id IS NULL THEN
        SELECT id INTO cliente_id
        FROM public.clients
        WHERE email = 'demo@cliente.com'
        LIMIT 1;
    END IF;

    -- Obtener un tipo de servicio existente
    SELECT id INTO service_type_id
    FROM public.service_types
    WHERE is_active = true
    LIMIT 1;

    -- Si no hay tipos de servicio, crear uno
    IF service_type_id IS NULL THEN
        INSERT INTO public.service_types (
            name,
            description,
            base_price,
            estimated_hours,
            created_at,
            updated_at
        ) VALUES (
            'Reparación de Computadora',
            'Diagnóstico y reparación de equipos de cómputo',
            50000,
            2,
            NOW(),
            NOW()
        ) RETURNING id INTO service_type_id;
    END IF;

    -- Crear órdenes de ejemplo si el técnico existe
    IF tecnico_id IS NOT NULL AND cliente_id IS NOT NULL AND service_type_id IS NOT NULL THEN
        -- Orden pendiente
        INSERT INTO public.orders (
            client_id,
            service_type,
            failure_description,
            delivery_date,
            status,
            assigned_technician,
            created_at,
            updated_at
        ) VALUES (
            cliente_id,
            service_type_id,
            'La computadora no enciende después de una tormenta eléctrica. Necesita revisión urgente.',
            CURRENT_DATE + INTERVAL '2 days',
            'pendiente',
            tecnico_id,
            NOW(),
            NOW()
        );

        -- Orden en proceso
        INSERT INTO public.orders (
            client_id,
            service_type,
            failure_description,
            delivery_date,
            status,
            assigned_technician,
            created_at,
            updated_at
        ) VALUES (
            cliente_id,
            service_type_id,
            'Virus en el sistema operativo, requiere formateo y reinstalación.',
            CURRENT_DATE + INTERVAL '1 day',
            'en_proceso',
            tecnico_id,
            NOW() - INTERVAL '1 hour',
            NOW()
        );

        -- Orden terminada (sin conformidad del cliente)
        INSERT INTO public.orders (
            client_id,
            service_type,
            failure_description,
            delivery_date,
            status,
            assigned_technician,
            client_approval,
            created_at,
            updated_at
        ) VALUES (
            cliente_id,
            service_type_id,
            'Mantenimiento preventivo completado - limpieza y actualización de software.',
            CURRENT_DATE,
            'finalizada',
            tecnico_id,
            NULL, -- Sin conformidad aún
            NOW() - INTERVAL '2 hours',
            NOW()
        );

        RAISE NOTICE 'Órdenes de ejemplo creadas para el técnico';
    ELSE
        RAISE NOTICE 'No se pudieron crear órdenes: técnico_id=%, cliente_id=%, service_type_id=%', tecnico_id, cliente_id, service_type_id;
    END IF;
END $$;