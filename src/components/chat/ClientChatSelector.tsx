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
  client_id: string;
  client_name: string;
  client_email: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
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
    try {
      setLoading(true);
      
      // Get all messages from general_chats with sender information
      const { data: messages, error } = await supabase
        .from('general_chats')
        .select(`
          id,
          sender_id,
          message,
          created_at,
          read_by
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get sender profiles for all unique sender IDs
      const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', senderIds);

      if (profilesError) throw profilesError;

      // Filter messages from clients only
      const clientMessages = messages?.filter(msg => {
        const profile = profiles?.find(p => p.user_id === msg.sender_id);
        return profile?.role === 'cliente';
      }) || [];

      // Group messages by client (sender)
      const clientGroups: { [key: string]: typeof clientMessages } = {};
      clientMessages.forEach(msg => {
        if (!clientGroups[msg.sender_id]) {
          clientGroups[msg.sender_id] = [];
        }
        clientGroups[msg.sender_id].push(msg);
      });

      // Create client chat entries
      const clientChatList: ClientChat[] = Object.entries(clientGroups).map(([senderId, msgs]) => {
        const profile = profiles?.find(p => p.user_id === senderId);
        const latestMessage = msgs[0]; // Already sorted by created_at desc
        
        // Count unread messages from this client
        const unreadCount = msgs.filter(msg => {
          const readBy = Array.isArray(msg.read_by) ? msg.read_by : [];
          return !readBy.includes(user.id);
        }).length;

        return {
          client_id: senderId,
          client_name: profile?.full_name || 'Cliente',
          client_email: profile?.email || '',
          last_message: latestMessage.message,
          last_message_time: latestMessage.created_at,
          unread_count: unreadCount
        };
      });

      // Sort by last message time
      clientChatList.sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );

      setClientChats(clientChatList);
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

  const totalUnread = clientChats.reduce((sum, chat) => sum + chat.unread_count, 0);

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
                key={chat.client_id}
                variant={selectedClientId === chat.client_id ? 'default' : 'ghost'}
                className="w-full justify-start h-auto p-3"
                onClick={() => onClientSelect(chat.client_id, chat.client_name)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {chat.client_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{chat.client_name}</div>
                      <div className="flex items-center gap-1">
                        {chat.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 text-xs">
                            {chat.unread_count}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(chat.last_message_time)}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {chat.last_message}
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