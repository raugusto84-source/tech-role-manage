import { AppLayout } from "@/components/layout/AppLayout";
import { AccessDevelopmentsManager } from "@/components/access/AccessDevelopmentsManager";

const AccessDevelopments = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Acceso by Syslag</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de fraccionamientos, contratos de acceso e inversionistas
          </p>
        </div>
        <AccessDevelopmentsManager />
      </div>
    </AppLayout>
  );
};

export default AccessDevelopments;
