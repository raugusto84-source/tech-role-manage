import { supabase } from '@/integrations/supabase/client';

export interface RevertPaymentResult {
  success: boolean;
  message: string;
  revertedOrderNumbers?: string[];
}

/**
 * Revierte un pago específico y restaura la deuda a la orden
 * @param incomeId ID del ingreso a revertir
 * @param description Descripción opcional para el log
 * @returns Resultado de la operación
 */
export async function revertPaymentByIncomeId(incomeId: string, description?: string): Promise<RevertPaymentResult> {
  try {
    // 1. Obtener información del ingreso
    const { data: income, error: incomeError } = await supabase
      .from('incomes')
      .select('*')
      .eq('id', incomeId)
      .single();

    if (incomeError) throw incomeError;
    if (!income) throw new Error('Ingreso no encontrado');

    // 2. Buscar pagos de órdenes relacionados con este ingreso
    const { data: relatedPayments, error: paymentsQueryError } = await supabase
      .from('order_payments')
      .select('id, order_id, order_number, payment_amount')
      .eq('income_id', incomeId);

    if (paymentsQueryError) throw paymentsQueryError;

    const orderNumbers = relatedPayments?.map(p => p.order_number) || [];

    // 3. Eliminar los pagos de órdenes y actualizar el estado de las órdenes
    if (relatedPayments && relatedPayments.length > 0) {
      const { error: deletePaymentsError } = await supabase
        .from('order_payments')
        .delete()
        .eq('income_id', incomeId);

      if (deletePaymentsError) throw deletePaymentsError;

      // 3.1. Actualizar las órdenes para que muestren la deuda restaurada
      for (const payment of relatedPayments) {
        await supabase
          .from('orders')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.order_id);
      }
    }

    // 4. Registrar la operación de reverso en el historial financiero
    const logDescription = description || `Reverso de ${income.account_type === 'fiscal' ? 'ingreso fiscal' : 'ingreso no fiscal'} ${income.income_number || ''} - ${income.description || ''}`.trim();
    
    try {
      await supabase.rpc('log_financial_operation', {
        p_operation_type: 'reverse',
        p_table_name: 'incomes', 
        p_record_id: incomeId,
        p_record_data: income,
        p_operation_description: logDescription,
        p_amount: income.amount,
        p_account_type: income.account_type,
        p_operation_date: income.income_date
      });
    } catch (logError) {
      console.error('Error logging financial operation:', logError);
      // Continue with the reversal even if logging fails
    }

    // 5. Eliminar el ingreso original
    const { error: deleteIncomeError } = await supabase
      .from('incomes')
      .delete()
      .eq('id', incomeId);

    if (deleteIncomeError) throw deleteIncomeError;

    return {
      success: true,
      message: orderNumbers.length > 0 
        ? `Pago revertido exitosamente. Órdenes ${orderNumbers.join(', ')} regresaron a pendientes de cobro.`
        : 'Pago revertido exitosamente.',
      revertedOrderNumbers: orderNumbers
    };

  } catch (error: any) {
    console.error('Error reverting payment:', error);
    return {
      success: false,
      message: error.message || 'Error al revertir el pago'
    };
  }
}

/**
 * Revierte todos los pagos de una orden específica
 * @param orderId ID de la orden
 * @returns Resultado de la operación
 */
export async function revertOrderPayments(orderId: string): Promise<RevertPaymentResult> {
  try {
    // 1. Obtener todos los pagos de la orden
    const { data: orderPayments, error: paymentsError } = await supabase
      .from('order_payments')
      .select('income_id, order_number, payment_amount')
      .eq('order_id', orderId);

    if (paymentsError) throw paymentsError;
    if (!orderPayments || orderPayments.length === 0) {
      return {
        success: false,
        message: 'No se encontraron pagos para esta orden'
      };
    }

    const orderNumber = orderPayments[0].order_number;
    const totalAmount = orderPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

    // 2. Revertir cada pago individual
    const revertPromises = orderPayments.map(payment => 
      revertPaymentByIncomeId(payment.income_id, `Reverso de pago de orden ${orderNumber}`)
    );

    await Promise.all(revertPromises);

    return {
      success: true,
      message: `Todos los pagos de la orden ${orderNumber} han sido revertidos. Total: $${totalAmount.toLocaleString()}`,
      revertedOrderNumbers: [orderNumber]
    };

  } catch (error: any) {
    console.error('Error reverting order payments:', error);
    return {
      success: false,
      message: error.message || 'Error al revertir los pagos de la orden'
    };
  }
}