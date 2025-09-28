import { AppLayout } from "@/components/layout/AppLayout";
import { WorkloadControlPanel } from "@/components/admin/WorkloadControlPanel";

export default function WorkloadManagement() {
  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <WorkloadControlPanel />
      </div>
    </AppLayout>
  );
}