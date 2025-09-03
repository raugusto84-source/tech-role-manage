-- Insert default reward settings configuration
INSERT INTO public.reward_settings (
  new_client_cashback_percent, 
  general_cashback_percent, 
  apply_cashback_to_items, 
  is_active
) VALUES (
  5.0,  -- 5% para clientes nuevos por defecto
  2.0,  -- 2% para clientes existentes por defecto  
  false, -- Por defecto no aplicar al precio, aplicar como recompensa
  true
);