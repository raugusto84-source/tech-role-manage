-- Fix clean_workflow_data function - using dynamic SQL with exception handling
CREATE OR REPLACE FUNCTION public.clean_workflow_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tables_to_truncate TEXT[] := ARRAY[
    'workflow_tdr_tracking',
    'order_authorization_signatures',
    'delivery_signatures',
    'order_satisfaction_surveys',
    'technician_satisfaction_surveys',
    'order_status_logs',
    'order_diagnostics',
    'order_items',
    'order_modifications',
    'order_equipment',
    'order_assistance_records',
    'order_process_tracking',
    'automated_notifications_log',
    'pending_collections',
    'collections_cache',
    'orders',
    'sales_satisfaction_surveys',
    'quote_item_taxes',
    'quote_items',
    'quotes',
    'reward_transactions',
    'client_rewards',
    'fiscal_withdrawals',
    'order_payments',
    'employee_payments',
    'purchases',
    'expenses',
    'incomes',
    'policy_payments',
    'policy_visits',
    'scheduled_services',
    'policy_equipment',
    'client_requests',
    'policies',
    'diagnostic_sessions',
    'client_diagnostics',
    'chat_messages',
    'chat_rooms',
    'follow_up_reminders',
    'attendance_adjustments',
    'attendance_records',
    'order_warranties',
    'financial_history',
    'financial_audit_logs',
    'financial_notifications',
    'deletion_history'
  ];
  table_name TEXT;
  truncated_count INT := 0;
  skipped_count INT := 0;
BEGIN
  -- Only admins can clean workflow data
  IF get_current_user_role() != 'administrador' THEN
    RETURN json_build_object('error', 'No tiene permisos para limpiar datos del flujo de trabajo');
  END IF;
  
  -- Loop through tables and truncate each one
  FOREACH table_name IN ARRAY tables_to_truncate LOOP
    BEGIN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', table_name);
      truncated_count := truncated_count + 1;
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist, skip it
      skipped_count := skipped_count + 1;
    END;
  END LOOP;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Flujo de trabajo limpiado exitosamente',
    'tables_truncated', truncated_count,
    'tables_skipped', skipped_count
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;