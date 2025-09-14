import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, FileText, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * NewRequestDialog
 * Diálogo rápido para que el cliente elija crear una Orden o una Cotización.
 * Reutilizable en cualquier lugar del sitio.
 */
export function NewRequestDialog({ open, onOpenChange }: NewRequestDialogProps) {
  const navigate = useNavigate();

  const ActionCard = ({
    title,
    description,
    icon: Icon,
    to,
  }: { title: string; description: string; icon: any; to: string }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(to)}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Icon />
          <ArrowRight />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva solicitud</DialogTitle>
          <DialogDescription>Elige el tipo de solicitud que deseas crear</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <ActionCard
            title="Cotización"
            description="Solicita una cotización rápida de servicios"
            icon={FileText}
            to="/quotes?new=1"
          />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
