import { AppLayout } from "@/components/layout/AppLayout";
import { FollowUpManager } from "@/components/admin/FollowUpManager";

export default function FollowUpPage() {
  return (
    <AppLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <FollowUpManager />
      </div>
    </AppLayout>
  );
}