import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ClientChat {
  client_id: string;
  client_name: string;
  client_email: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  sender_name: string;
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
    loadClientChats();
    setupRealtimeSubscription();
    
    return () => {
      supabase.removeAllChannels();
    };
  }, [user]);

  const loadClientChats = async () => {
    if (!user) return;

    try {
      // Get all unique clients who have sent messages
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

      // Get profiles for all senders
      const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', senderIds);

      // Filter messages from clients only and group by client
      const clientMessages = messages?.filter(m => 
        profiles?.find(p => p.user_id === m.sender_id)?.role === 'cliente'
      ) || [];

      // Group messages by client
      const clientGroups: { [key: string]: any[] } = {};
      clientMessages.forEach(message => {
        const profile = profiles?.find(p => p.user_id === message.sender_id);
        if (profile) {
          if (!clientGroups[profile.user_id]) {
            clientGroups[profile.user_id] = [];
          }
          clientGroups[profile.user_id].push({
            ...message,
            sender_name: profile.full_name,
            sender_email: profile.email
          });
        }
      });

      // Create client chat list
      const chatList = Object.entries(clientGroups).map(([clientId, messages]) => {
        const lastMessage = messages[0]; // Most recent message
        const unreadCount = messages.filter(m => 
          !m.read_by || !m.read_by.includes(user.id)
        ).length;

        return {
          client_id: clientId,
          client_name: lastMessage.sender_name,
          client_email: lastMessage.sender_email,
          last_message: lastMessage.message,
          last_message_time: lastMessage.created_at,
          unread_count: unreadCount,
          sender_name: lastMessage.sender_name
        };
      });

      // Sort by last message time
      chatList.sort((a, b) => 
        new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      );

      setClientChats(chatList);
    } catch (error) {
      console.error('Error loading client chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('client-chat-selector')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'general_chats' }, 
        () => loadClientChats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Clientes en Chat
          {clientChats.reduce((sum, chat) => sum + chat.unread_count, 0) > 0 && (
            <Badge variant="destructive" className="ml-2">
              {clientChats.reduce((sum, chat) => sum + chat.unread_count, 0)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-2">
            {/* General Chat Option */}
            <Button
              variant={!selectedClientId ? "default" : "ghost"}
              className="w-full justify-start h-auto p-3"
              onClick={() => onClientSelect('', 'Chat General')}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <MessageCircle className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="font-medium">Chat General</div>
                  <div className="text-sm text-muted-foreground">
                    Todos los mensajes del sistema
                  </div>
                </div>
              </div>
            </Button>

            {/* Client Chats */}
            {clientChats.map((chat) => (
              <Button
                key={chat.client_id}
                variant={selectedClientId === chat.client_id ? "default" : "ghost"}
                className="w-full justify-start h-auto p-3"
                onClick={() => onClientSelect(chat.client_id, chat.client_name)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {chat.client_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{chat.client_name}</div>
                      {chat.unread_count > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {chat.unread_count}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {chat.last_message}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(chat.last_message_time)}
                    </div>
                  </div>
                </div>
              </Button>
            ))}

            {loading && (
              <div className="text-center py-4 text-muted-foreground">
                Cargando chats...
              </div>
            )}

            {!loading && clientChats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay mensajes de clientes aún</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}