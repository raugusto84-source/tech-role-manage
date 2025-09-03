import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle } from 'lucide-react';

interface ClientChat {
  id: string;
  name: string;
  email: string;  
  lastMessage: string;
  lastMessageTime: string | null;
  unreadCount: number;
}

interface ClientChatSelectorProps {
  onClientSelect: (clientId: string, clientName: string) => void;
  selectedClientId?: string;
}

export function ClientChatSelector({ onClientSelect, selectedClientId }: ClientChatSelectorProps) {
  const { user } = useAuth();
  const [clientChats, setClientChats] = useState<ClientChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadClientChats();
      setupRealtimeSubscription();
    }
  }, [user]);

  const loadClientChats = async () => {
    setLoading(true);
    try {
      // Get all clients first
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email')
        .order('name');

      if (clientsError) throw clientsError;

      if (!clients || clients.length === 0) {
        setClientChats([]);
        setLoading(false);
        return;
      }

      // Get latest message for each client and unread counts
      const clientChatsData: ClientChat[] = [];

      for (const client of clients) {
        // Get latest message for this client
        const { data: latestMessage } = await supabase
          .from('general_chats')
          .select('message, created_at, sender_id')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Count unread messages for this client
        const { count: unreadCount } = await supabase
          .from('general_chats')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .not('sender_id', 'eq', user?.id || '')
          .not('read_by', 'cs', JSON.stringify([user?.id || '']));

        clientChatsData.push({
          id: client.id,
          name: client.name,
          email: client.email,
          lastMessage: latestMessage?.message || '',
          lastMessageTime: latestMessage?.created_at || null,
          unreadCount: unreadCount || 0
        });
      }

      // Sort by latest message time (most recent first)
      clientChatsData.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setClientChats(clientChatsData);
    } catch (error) {
      console.error('Error loading client chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('client-chat-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'general_chats' }, 
        () => {
          loadClientChats(); // Reload when any chat message changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString('es-MX', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const totalUnread = clientChats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Chats de Clientes
          {totalUnread > 0 && (
            <Badge variant="destructive">{totalUnread}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="space-y-1 p-4 pt-0">
            {/* Office Chat Option */}
            <Button
              variant={selectedClientId === '' ? 'default' : 'ghost'}
              className="w-full justify-start h-auto p-3"
              onClick={() => onClientSelect('', 'Chat Oficina')}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <MessageCircle className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="font-medium">Chat Oficina</div>
                  <div className="text-sm text-muted-foreground">
                    Conversación interna del equipo
                  </div>
                </div>
              </div>
            </Button>

            {/* Loading state */}
            {loading && (
              <div className="text-center py-4 text-muted-foreground">
                Cargando chats...
              </div>
            )}

            {/* Client chats */}
            {!loading && clientChats.map((chat) => (
              <Button
                key={chat.id}
                variant={selectedClientId === chat.id ? 'default' : 'ghost'}
                className="w-full justify-start h-auto p-3"
                onClick={() => onClientSelect(chat.id, chat.name)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {chat.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{chat.name}</div>
                      <div className="flex items-center gap-1">
                        {chat.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 text-xs">
                            {chat.unreadCount}
                          </Badge>
                        )}
                        {chat.lastMessageTime && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(chat.lastMessageTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {chat.lastMessage || 'Sin mensajes'}
                    </div>
                  </div>
                </div>
              </Button>
            ))}

            {/* Empty state */}
            {!loading && clientChats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay conversaciones con clientes
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}