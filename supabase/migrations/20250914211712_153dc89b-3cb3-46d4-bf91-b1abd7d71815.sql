-- Create function to clean workflow data while preserving base data
CREATE OR REPLACE FUNCTION public.clean_workflow_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Only admins can clean workflow data
  IF get_current_user_role() != 'administrador' THEN
    RETURN json_build_object('error', 'No tiene permisos para limpiar datos del flujo de trabajo');
  END IF;
  
  -- Delete workflow-related data in correct order (respecting foreign keys)
  
  -- 1. Delete order-related data first
  DELETE FROM public.order_authorization_signatures;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order authorization signatures', deleted_count;
  
  DELETE FROM public.delivery_signatures;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % delivery signatures', deleted_count;
  
  DELETE FROM public.order_satisfaction_surveys;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order satisfaction surveys', deleted_count;
  
  DELETE FROM public.technician_satisfaction_surveys;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % technician satisfaction surveys', deleted_count;
  
  DELETE FROM public.order_status_logs;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order status logs', deleted_count;
  
  DELETE FROM public.order_diagnostics;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order diagnostics', deleted_count;
  
  DELETE FROM public.order_items;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order items', deleted_count;
  
  DELETE FROM public.order_modifications;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order modifications', deleted_count;
  
  DELETE FROM public.orders;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % orders', deleted_count;
  
  -- 2. Delete quote-related data
  DELETE FROM public.sales_satisfaction_surveys;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % sales satisfaction surveys', deleted_count;
  
  DELETE FROM public.quote_item_taxes;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % quote item taxes', deleted_count;
  
  DELETE FROM public.quote_items;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % quote items', deleted_count;
  
  DELETE FROM public.quotes;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % quotes', deleted_count;
  
  -- 3. Delete financial data
  DELETE FROM public.reward_transactions;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % reward transactions', deleted_count;
  
  DELETE FROM public.client_rewards;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % client rewards', deleted_count;
  
  DELETE FROM public.fiscal_withdrawals;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % fiscal withdrawals', deleted_count;
  
  DELETE FROM public.order_payments;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order payments', deleted_count;
  
  DELETE FROM public.employee_payments;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % employee payments', deleted_count;
  
  DELETE FROM public.purchases;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % purchases', deleted_count;
  
  DELETE FROM public.expenses;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % expenses', deleted_count;
  
  DELETE FROM public.incomes;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % incomes', deleted_count;
  
  DELETE FROM public.financial_history;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % financial history records', deleted_count;
  
  -- 4. Delete survey-related data
  DELETE FROM public.survey_responses;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % survey responses', deleted_count;
  
  DELETE FROM public.satisfaction_surveys;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % satisfaction surveys', deleted_count;
  
  DELETE FROM public.scheduled_surveys;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % scheduled surveys', deleted_count;
  
  -- 5. Delete follow-up related data
  DELETE FROM public.follow_up_reminders;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % follow up reminders', deleted_count;
  
  -- 6. Delete other workflow-related data
  DELETE FROM public.whatsapp_notifications;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % whatsapp notifications', deleted_count;
  
  DELETE FROM public.order_requests;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'Deleted % order requests', deleted_count;
  
  -- Note: We preserve:
  -- - clients (base customer data)
  -- - service_types (service catalog)
  -- - sales_categories, sales_products (product catalog) 
  -- - main_service_categories, service_subcategories
  -- - profiles (user data)
  -- - technician_skills (skills data)
  -- - time_records (attendance data)
  -- - vehicles, fleet_* (fleet data)
  -- - policies (insurance policies)
  -- - achievements, user_achievements (achievement system)
  -- - reward_settings (reward system configuration)
  -- - survey_configurations (survey settings)
  -- - And other configuration/master data
  
  RETURN json_build_object(
    'success', true,
    'message', 'Flujo de trabajo limpiado exitosamente. Se preservaron artículos, servicios, clientes y configuraciones.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$