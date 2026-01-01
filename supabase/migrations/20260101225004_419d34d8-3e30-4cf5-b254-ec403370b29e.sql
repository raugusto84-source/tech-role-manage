-- Fix clean_workflow_data function with correct table names
CREATE OR REPLACE FUNCTION public.clean_workflow_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  -- Only admins can clean workflow data
  IF get_current_user_role() != 'administrador' THEN
    RETURN json_build_object('error', 'No tiene permisos para limpiar datos del flujo de trabajo');
  END IF;
  
  -- Use TRUNCATE with CASCADE for much faster deletion
  
  -- 1. Truncate workflow TDR tracking
  TRUNCATE TABLE public.workflow_tdr_tracking CASCADE;
  
  -- 2. Truncate order-related data
  TRUNCATE TABLE public.order_authorization_signatures CASCADE;
  TRUNCATE TABLE public.delivery_signatures CASCADE;
  TRUNCATE TABLE public.order_satisfaction_surveys CASCADE;
  TRUNCATE TABLE public.technician_satisfaction_surveys CASCADE;
  TRUNCATE TABLE public.order_status_logs CASCADE;
  TRUNCATE TABLE public.order_diagnostics CASCADE;
  TRUNCATE TABLE public.order_items CASCADE;
  TRUNCATE TABLE public.order_modifications CASCADE;
  TRUNCATE TABLE public.order_equipment CASCADE;
  TRUNCATE TABLE public.order_assistance_records CASCADE;
  TRUNCATE TABLE public.order_process_tracking CASCADE;
  TRUNCATE TABLE public.automated_notifications_log CASCADE;
  
  -- 3. Truncate pending collections before orders
  TRUNCATE TABLE public.pending_collections CASCADE;
  TRUNCATE TABLE public.collections_cache CASCADE;
  
  -- 4. Truncate orders
  TRUNCATE TABLE public.orders CASCADE;
  
  -- 5. Truncate quote-related data
  TRUNCATE TABLE public.sales_satisfaction_surveys CASCADE;
  TRUNCATE TABLE public.quote_item_taxes CASCADE;
  TRUNCATE TABLE public.quote_items CASCADE;
  TRUNCATE TABLE public.quotes CASCADE;
  
  -- 6. Truncate financial data
  TRUNCATE TABLE public.reward_transactions CASCADE;
  TRUNCATE TABLE public.client_rewards CASCADE;
  TRUNCATE TABLE public.fiscal_withdrawals CASCADE;
  TRUNCATE TABLE public.order_payments CASCADE;
  TRUNCATE TABLE public.employee_payments CASCADE;
  TRUNCATE TABLE public.purchases CASCADE;
  TRUNCATE TABLE public.expenses CASCADE;
  TRUNCATE TABLE public.incomes CASCADE;
  
  -- 7. Truncate policy-related data (correct table names)
  TRUNCATE TABLE public.policy_payments CASCADE;
  TRUNCATE TABLE public.policy_visits CASCADE;
  TRUNCATE TABLE public.scheduled_services CASCADE;
  TRUNCATE TABLE public.policy_equipment CASCADE;
  TRUNCATE TABLE public.client_requests CASCADE;
  TRUNCATE TABLE public.policies CASCADE;
  
  -- 8. Truncate diagnostic data
  TRUNCATE TABLE public.diagnostic_sessions CASCADE;
  TRUNCATE TABLE public.client_diagnostics CASCADE;
  
  -- 9. Truncate chat data
  TRUNCATE TABLE public.chat_messages CASCADE;
  TRUNCATE TABLE public.chat_rooms CASCADE;
  
  -- 10. Truncate follow-up data
  TRUNCATE TABLE public.follow_up_reminders CASCADE;
  
  -- 11. Truncate attendance data
  TRUNCATE TABLE public.attendance_adjustments CASCADE;
  TRUNCATE TABLE public.attendance_records CASCADE;
  
  -- 12. Truncate warranty data
  TRUNCATE TABLE public.order_warranty_claims CASCADE;
  TRUNCATE TABLE public.order_warranties CASCADE;
  
  -- 13. Truncate financial history and audit logs
  TRUNCATE TABLE public.financial_history CASCADE;
  TRUNCATE TABLE public.financial_audit_logs CASCADE;
  TRUNCATE TABLE public.financial_notifications CASCADE;
  TRUNCATE TABLE public.deletion_history CASCADE;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Flujo de trabajo limpiado exitosamente'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;