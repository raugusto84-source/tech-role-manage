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
      // Get all messages with client_id (not null)
      const { data: clientMessages, error: messagesError } = await supabase
        .from('general_chats')
        .select('client_id, message, created_at, sender_id')
        .not('client_id', 'is', null)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      if (!clientMessages || clientMessages.length === 0) {
        setClientChats([]);
        setLoading(false);
        return;
      }

      // Get unique client IDs
      const clientIds = [...new Set(clientMessages.map(msg => msg.client_id).filter(Boolean))];
      
      // Get client information
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      // Group messages by client and get latest message + unread count
      const clientChatsMap = new Map<string, ClientChat>();

      for (const msg of clientMessages) {
        if (!msg.client_id) continue;
        
        const client = clientsData?.find(c => c.id === msg.client_id);
        if (!client) continue;

        if (!clientChatsMap.has(msg.client_id)) {
          // Count unread messages for this client
          const { count: unreadCount } = await supabase
            .from('general_chats')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', msg.client_id)
            .not('sender_id', 'eq', user?.id || '')
            .not('read_by', 'cs', JSON.stringify([user?.id || '']));

          clientChatsMap.set(msg.client_id, {
            id: client.id,
            name: client.name,
            email: client.email,
            lastMessage: msg.message,
            lastMessageTime: msg.created_at,
            unreadCount: unreadCount || 0
          });
        }
      }

      // Convert to array and sort by latest message time (most recent first)
      const clientChatsData = Array.from(clientChatsMap.values());
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
        { event: 'INSERT', schema: 'public', table: 'general_chats' }, 
        (payload) => {
          console.log('New message received in ClientChatSelector:', payload);
          // Reload chats when new message arrives
          loadClientChats();
        }
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'general_chats' }, 
        (payload) => {
          console.log('Message updated in ClientChatSelector:', payload);
          // Reload chats when message is read
          loadClientChats();
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
    <div className="h-full flex flex-col">
      {/* Header simplificado */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium text-sm">Conversaciones</span>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-xs">
              {totalUnread}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Lista de chats */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Office Chat Option */}
          <Button
            variant={selectedClientId === '' ? 'secondary' : 'ghost'}
            className="w-full justify-start h-auto p-2 text-left"
            onClick={() => onClientSelect('', 'Chat Oficina')}
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Oficina</div>
                <div className="text-xs text-muted-foreground">Chat interno</div>
              </div>
            </div>
          </Button>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Cargando...
            </div>
          )}

          {/* Client chats */}
          {!loading && clientChats.map((chat) => (
            <Button
              key={chat.id}
              variant={selectedClientId === chat.id ? 'secondary' : 'ghost'}
              className="w-full justify-start h-auto p-2 text-left"
              onClick={() => onClientSelect(chat.id, chat.name)}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">
                    {chat.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-sm truncate">{chat.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {chat.unreadCount > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 text-xs px-1">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Badge>
                      )}
                      {chat.lastMessageTime && (
                        <span className="text-xs text-muted-foreground">
                          {formatTime(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {chat.lastMessage || 'Sin mensajes'}
                  </div>
                </div>
              </div>
            </Button>
          ))}

          {/* Empty state */}
          {!loading && clientChats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Sin conversaciones
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}