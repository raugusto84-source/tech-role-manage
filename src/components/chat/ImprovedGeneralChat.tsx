import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientChatSelector } from './ClientChatSelector';
import { FilteredChatPanel } from './FilteredChatPanel';
import { MessageCircle } from 'lucide-react';

interface ImprovedGeneralChatProps {
  className?: string;
}

export function ImprovedGeneralChat({ className }: ImprovedGeneralChatProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('Chat Oficina');

  const handleClientSelect = (clientId: string, clientName: string) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Fixed height grid for consistent sizing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Client Selector - Left Side */}
        <div className="lg:col-span-1 h-full">
          <ClientChatSelector
            onClientSelect={handleClientSelect}
            selectedClientId={selectedClientId}
          />
        </div>
        
        {/* Chat Panel - Right Side */}
        <div className="lg:col-span-2 h-full">
          <FilteredChatPanel
            selectedClientId={selectedClientId}
            selectedClientName={selectedClientName}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}