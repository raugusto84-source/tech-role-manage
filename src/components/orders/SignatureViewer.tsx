import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenTool, User, Calendar, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCOPCeilToTen } from '@/utils/currency';

interface AuthorizationSignature {
  id: string;
  client_signature_data: string;
  client_name: string;
  signed_at: string;
  authorization_notes?: string;
  modification_reason?: string | null;
  new_amount?: number | null;
}

interface SignatureViewerProps {
  signatures: AuthorizationSignature[];
  loading?: boolean;
}

export function SignatureViewer({ signatures, loading }: SignatureViewerProps) {
  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenTool className="h-4 w-4" />
            Firmas de Autorización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Cargando firmas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (signatures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenTool className="h-4 w-4" />
            Firmas de Autorización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <PenTool className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay firmas de autorización registradas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PenTool className="h-4 w-4" />
          Firmas de Autorización ({signatures.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {signatures.map((signature, index) => (
          <div key={signature.id} className="border rounded-lg p-4 space-y-3">
            {/* Header con información */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">{signature.client_name}</span>
                <Badge variant="outline" className="text-xs">
                  Firma #{index + 1}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateTime(signature.signed_at)}
              </div>
            </div>

            {/* Razón de la firma y monto */}
            {(signature.modification_reason || signature.new_amount) && (
              <div className="grid grid-cols-1 gap-2 text-sm">
                {signature.modification_reason && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">Razón:</span>
                    <span className="font-medium">{signature.modification_reason}</span>
                  </div>
                )}
                {signature.new_amount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">Monto autorizado:</span>
                    <span className="font-bold text-primary">{formatCOPCeilToTen(signature.new_amount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Firma */}
            <div className="border-2 border-dashed border-border rounded-lg p-2 bg-muted/20">
              <div className="text-xs text-muted-foreground mb-2">Firma digital:</div>
              <div className="bg-white rounded border min-h-[120px] flex items-center justify-center">
                <img
                  src={signature.client_signature_data}
                  alt={`Firma de ${signature.client_name}`}
                  className="max-w-full max-h-[100px] object-contain"
                  style={{ 
                    filter: 'contrast(1.2)',
                    imageRendering: 'crisp-edges'
                  }}
                />
              </div>
            </div>

            {/* Notas si existen */}
            {signature.authorization_notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-medium text-blue-800 mb-1">Notas de autorización:</div>
                <p className="text-sm text-blue-700">{signature.authorization_notes}</p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}