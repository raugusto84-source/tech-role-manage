-- Fix security: set view to security invoker and add immutable search_path to functions

-- 1) Ensure views execute with invoker privileges (enforce caller RLS)
ALTER VIEW public.pending_collections SET (security_invoker = on);

-- 2) Recreate functions with fixed search_path

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo registrar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_logs (
      order_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'en_camino' THEN 'Técnico en camino al sitio'
        WHEN NEW.status = 'en_proceso' THEN 'Técnico iniciando trabajo'
        WHEN NEW.status = 'finalizada' THEN 'Trabajo completado'
        ELSE NULL
      END
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  achievement_record RECORD;
  user_record RECORD;
  current_period_start DATE;
  current_period_end DATE;
  actual_value NUMERIC;
  formats_count INTEGER;
  monthly_sales NUMERIC;
  monthly_income NUMERIC;
  monthly_expenses NUMERIC;
  profit_margin NUMERIC;
BEGIN
  -- Get current month period
  current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  current_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;

  -- Loop through all active achievements
  FOR achievement_record IN 
    SELECT * FROM public.achievements WHERE is_active = true
  LOOP
    -- Loop through all users (staff members)
    FOR user_record IN 
      SELECT DISTINCT user_id FROM public.profiles 
      WHERE role = ANY(ARRAY['administrador'::user_role, 'empleado'::user_role, 'tecnico'::user_role])
    LOOP
      -- Skip if achievement already earned for this period
      IF EXISTS (
        SELECT 1 FROM public.user_achievements 
        WHERE user_id = user_record.user_id 
        AND achievement_id = achievement_record.id 
        AND period_start = current_period_start
      ) THEN
        CONTINUE;
      END IF;

      -- Calculate actual value based on achievement type
      CASE achievement_record.achievement_type
        WHEN 'format_count' THEN
          -- Count orders with service_type 'formateo' by this user in current month
          SELECT COUNT(*) INTO formats_count
          FROM public.orders 
          WHERE assigned_technician = user_record.user_id
          AND service_type = 'formateo'
          AND created_at >= current_period_start
          AND created_at <= current_period_end + INTERVAL '1 day - 1 second';
          
          actual_value := formats_count;

        WHEN 'monthly_sales' THEN
          -- Sum sales amount for current month
          SELECT COALESCE(SUM(amount), 0) INTO monthly_sales
          FROM public.sales 
          WHERE user_id = user_record.user_id
          AND sale_date >= current_period_start
          AND sale_date <= current_period_end;
          
          actual_value := monthly_sales;

        WHEN 'income_threshold' THEN
          -- Sum incomes for current month
          SELECT COALESCE(SUM(amount), 0) INTO monthly_income
          FROM public.incomes 
          WHERE created_by = user_record.user_id
          AND income_date >= current_period_start
          AND income_date <= current_period_end;
          
          actual_value := monthly_income;

        WHEN 'profit_margin' THEN
          -- Calculate profit margin (income vs expenses)
          SELECT COALESCE(SUM(amount), 0) INTO monthly_income
          FROM public.incomes 
          WHERE income_date >= current_period_start
          AND income_date <= current_period_end;
          
          SELECT COALESCE(SUM(amount), 0) INTO monthly_expenses
          FROM public.expenses 
          WHERE expense_date >= current_period_start
          AND expense_date <= current_period_end;
          
          IF monthly_expenses > 0 THEN
            profit_margin := (monthly_income - monthly_expenses) / monthly_expenses;
          ELSE
            profit_margin := 0;
          END IF;
          
          actual_value := profit_margin;

        ELSE
          actual_value := 0;
      END CASE;

      -- Check if achievement is earned
      IF (achievement_record.comparison_operator = 'gte' AND actual_value >= achievement_record.target_value) OR
         (achievement_record.comparison_operator = 'lte' AND actual_value <= achievement_record.target_value) OR
         (achievement_record.comparison_operator = 'eq' AND actual_value = achievement_record.target_value) THEN
        
        -- Award achievement
        INSERT INTO public.user_achievements (
          user_id, 
          achievement_id, 
          period_start, 
          period_end, 
          actual_value
        ) VALUES (
          user_record.user_id, 
          achievement_record.id, 
          current_period_start, 
          current_period_end, 
          actual_value
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_route_efficiency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Calculate efficiency if fuel consumed is provided
  IF NEW.fuel_consumed IS NOT NULL AND NEW.fuel_consumed > 0 THEN
    NEW.efficiency_km_per_liter := NEW.distance_km / NEW.fuel_consumed;
  END IF;
  
  -- Update vehicle mileage
  UPDATE public.vehicles 
  SET current_mileage = NEW.end_mileage
  WHERE id = NEW.vehicle_id AND current_mileage < NEW.end_mileage;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_upcoming_reminders(days_ahead integer DEFAULT 30)
RETURNS TABLE(vehicle_model text, license_plate text, reminder_type reminder_type, description text, due_date date, days_until_due integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.model,
    v.license_plate,
    vr.reminder_type,
    vr.description,
    vr.due_date,
    (vr.due_date - CURRENT_DATE)::INTEGER as days_until_due
  FROM public.vehicle_reminders vr
  JOIN public.vehicles v ON v.id = vr.vehicle_id
  WHERE vr.is_completed = false
    AND vr.due_date <= CURRENT_DATE + INTERVAL '1 day' * days_ahead
    AND vr.due_date >= CURRENT_DATE
  ORDER BY vr.due_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_monthly_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER;
  current_year INTEGER;
  avg_rating NUMERIC(3,2);
  total_count INTEGER;
  recommendation_text TEXT;
  priority_level TEXT;
BEGIN
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Calculate average rating for the current month
  SELECT 
    ROUND(AVG(sr.rating), 2),
    COUNT(*)
  INTO avg_rating, total_count
  FROM public.survey_responses sr
  JOIN public.satisfaction_surveys ss ON sr.survey_id = ss.id
  WHERE EXTRACT(MONTH FROM sr.created_at) = current_month
    AND EXTRACT(YEAR FROM sr.created_at) = current_year
    AND sr.question_type = 'overall';
  
  -- Skip if no responses this month
  IF total_count = 0 THEN
    RETURN;
  END IF;
  
  -- Generate recommendation based on average rating
  IF avg_rating >= 4.5 THEN
    recommendation_text := 'Excelente desempeño este mes. Mantener los estándares de calidad actuales y considerar implementar las mejores prácticas en todos los equipos.';
    priority_level := 'baja';
  ELSIF avg_rating >= 4.0 THEN
    recommendation_text := 'Buen desempeño general. Revisar comentarios específicos para identificar áreas de mejora menores y optimizar procesos.';
    priority_level := 'media';
  ELSIF avg_rating >= 3.0 THEN
    recommendation_text := 'Desempeño promedio. Se requiere revisión de procesos y capacitación adicional para mejorar la satisfacción del cliente.';
    priority_level := 'alta';
  ELSE
    recommendation_text := 'Desempeño bajo el estándar. Se requiere intervención inmediata: revisar procedimientos, capacitar personal y mejorar control de calidad.';
    priority_level := 'alta';
  END IF;
  
  -- Insert recommendation if it doesn't exist for this month
  INSERT INTO public.survey_recommendations (
    period_month,
    period_year,
    average_rating,
    total_responses,
    recommendation_text,
    priority_level
  )
  SELECT 
    current_month,
    current_year,
    avg_rating,
    total_count,
    recommendation_text,
    priority_level
  WHERE NOT EXISTS (
    SELECT 1 FROM public.survey_recommendations
    WHERE period_month = current_month AND period_year = current_year
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role::text FROM profiles WHERE user_id = auth.uid()),
    'cliente'::text
  );
$function$;