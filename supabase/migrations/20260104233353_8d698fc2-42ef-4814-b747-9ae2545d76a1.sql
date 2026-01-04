-- Update clean_workflow_data to include recurring_payrolls (programmed payrolls)
CREATE OR REPLACE FUNCTION public.clean_workflow_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tables_to_truncate TEXT[] := ARRAY[
    -- Access by Syslag module
    'access_investor_loans',
    'access_development_payments',
    'access_development_orders',
    'access_development_leads',
    'access_developments',
    -- Loans
    'loan_payments',
    'loans',
    -- Fleets (flotillas)
    'vehicle_routes',
    'vehicle_reminders',
    'fleet_service_categories',
    'fleet_assignments',
    'vehicles',
    'fleet_groups',
    -- Orders and workflow
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
    'technician_workload',
    'orders',
    -- Quotes
    'sales_satisfaction_surveys',
    'quote_item_taxes',
    'quote_items',
    'quotes',
    -- Rewards
    'reward_transactions',
    'client_rewards',
    -- Finance - including payrolls and recurring payrolls
    'fiscal_withdrawals',
    'order_payments',
    'employee_payments',
    'recurring_payrolls',
    'purchases',
    'expenses',
    'incomes',
    -- Policies (pólizas) - including policy payments
    'policy_payments',
    'policy_visits',
    'scheduled_services',
    'policy_equipment',
    'client_requests',
    'policies',
    -- Surveys (encuestas)
    'survey_responses',
    'satisfaction_surveys',
    'survey_recommendations',
    'programmable_surveys',
    'survey_questions',
    -- Diagnostics
    'diagnostic_sessions',
    'client_diagnostics',
    -- Chat
    'chat_messages',
    'chat_rooms',
    -- Follow-ups (seguimiento)
    'follow_up_reminders',
    'follow_up_history',
    -- Attendance
    'attendance_adjustments',
    'attendance_records',
    'time_records',
    'weekly_reports',
    -- Other
    'order_warranties',
    'financial_history',
    'financial_audit_logs',
    'financial_notifications',
    'deletion_history',
    'whatsapp_notifications'
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
    'message', 'Sistema limpiado exitosamente. Se conservaron: productos, servicios, clientes, empleados y usuarios.',
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