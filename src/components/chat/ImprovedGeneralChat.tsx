import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientChatSelector } from './ClientChatSelector';
import { FilteredChatPanel } from './FilteredChatPanel';
import { ClientOfficeChat } from './ClientOfficeChat';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ImprovedGeneralChatProps {
  className?: string;
}

export function ImprovedGeneralChat({ className }: ImprovedGeneralChatProps) {
  const { profile } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('Chat Oficina');
  const [showChatView, setShowChatView] = useState<boolean>(false);

  // For client users, show their individual chat directly
  if (profile?.role === 'cliente') {
    return (
      <div className={`space-y-4 ${className}`}>
        <ClientOfficeChat />
      </div>
    );
  }

  const handleClientSelect = (clientId: string, clientName: string) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setShowChatView(true);
  };

  const handleBackToList = () => {
    setShowChatView(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Single fixed-size card container */}
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {showChatView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {showChatView ? selectedClientName : 'Mensajes'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Single view container */}
          <div className="h-[500px]">
            {!showChatView ? (
              /* Chat List View */
              <ClientChatSelector
                onClientSelect={handleClientSelect}
                selectedClientId={selectedClientId}
              />
            ) : (
              /* Individual Chat View */
              <FilteredChatPanel
                selectedClientId={selectedClientId}
                selectedClientName={selectedClientName}
                className="border-0"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}