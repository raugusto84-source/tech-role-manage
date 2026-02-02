import { AppLayout } from "@/components/layout/AppLayout";
import { AccessDevelopmentsManager } from "@/components/access/AccessDevelopmentsManager";
import logoAcceso from "@/assets/logo-acceso.png";

const AccessDevelopments = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <img 
            src={logoAcceso} 
            alt="Acceso by Syslag" 
            className="h-16 object-contain"
          />
        </div>
        <AccessDevelopmentsManager />
      </div>
    </AppLayout>
  );
};

export default AccessDevelopments;
