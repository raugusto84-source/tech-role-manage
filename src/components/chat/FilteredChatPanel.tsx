import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Bell, BellOff, ChevronUp, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  message_type: string;
  attachment_url?: string;
  created_at: string;
  read_by: string[];
  client_id?: string | null;
  sender_name?: string;
  sender_role?: string;
}

interface FilteredChatPanelProps {
  selectedClientId: string;
  selectedClientName: string;
  className?: string;
}

export function FilteredChatPanel({ 
  selectedClientId, 
  selectedClientName, 
  className 
}: FilteredChatPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Cleanup previous channel and setup new one
  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel with unique name
    const channelName = `filtered-chat-${selectedClientId || 'general'}-${user.id}`;
    
    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'general_chats' }, 
        (payload) => {
          const newMsg = payload.new as any;
          
          // Check if message belongs to current chat context
          let shouldIncludeMessage = false;
          
          if (selectedClientId) {
            // For client chat, only show messages with matching client_id
            shouldIncludeMessage = newMsg.client_id === selectedClientId;
          } else {
            // For office chat, only show messages with no client_id
            shouldIncludeMessage = !newMsg.client_id;
          }
          
          if (!shouldIncludeMessage) return;
          
          // Add sender profile data
          supabase
            .from('profiles')
            .select('full_name, role')
            .eq('user_id', newMsg.sender_id)
            .single()
            .then(({ data }) => {
              const messageWithSender = {
                ...newMsg,
                read_by: Array.isArray(newMsg.read_by) ? newMsg.read_by.map(id => String(id)) : [],
                sender_name: data?.full_name || 'Usuario',
                sender_role: data?.role || 'cliente'
              };
              
              setMessages(prev => {
                // Prevent duplicate messages
                const exists = prev.some(msg => msg.id === messageWithSender.id);
                if (exists) return prev;
                return [...prev, messageWithSender];
              });
              
              // If message is from another user, play sound and show notification
              if (newMsg.sender_id !== user.id) {
                setUnreadCount(prev => prev + 1);
                
                if (soundEnabled) {
                  playNotificationSound();
                }
                
                // Show desktop notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Nuevo mensaje', {
                    body: `${messageWithSender.sender_name}: ${newMsg.message}`,
                    icon: '/favicon.ico'
                  });
                }
              }
            });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, selectedClientId, soundEnabled]);

  useEffect(() => {
    if (user) {
      loadMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user, selectedClientId, setupRealtimeSubscription]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll control functions
  const scrollToTop = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('general_chats')
        .select(`
          id,
          sender_id,
          message,
          message_type,
          attachment_url,
          created_at,
          read_by,
          client_id
        `)
        .order('created_at', { ascending: true })
        .limit(500);

      // Filter by client_id for truly independent chats
      if (selectedClientId) {
        // Get actual client UUID from selectedClientId (which might be user_id)
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('id', selectedClientId)
          .single();

        if (clientData) {
          query = query.eq('client_id', clientData.id);
        }
      } else {
        // Office chat - messages with no client_id (internal chat)
        query = query.is('client_id', null);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Get all unique sender IDs for profile lookup
      const senderIds = [...new Set(messages?.map(msg => msg.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('user_id', senderIds);

      // Format messages with sender info
      const formattedMessages = (messages || []).map(msg => {
        const profile = profiles?.find(p => p.user_id === msg.sender_id);
        return {
          ...msg,
          read_by: Array.isArray(msg.read_by) ? msg.read_by.map(id => String(id)) : [],
          sender_name: profile?.full_name || 'Usuario',
          sender_role: profile?.role || 'cliente'
        };
      });

      setMessages(formattedMessages);
      
      // Count unread messages
      const unread = formattedMessages.filter(msg => 
        msg.sender_id !== user.id && 
        (!msg.read_by || !msg.read_by.includes(user.id))
      ).length;
      
      setUnreadCount(unread);

      // Mark messages as read
      if (unread > 0) {
        markMessagesAsRead();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      // Get unread messages
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user.id && 
        (!msg.read_by || !msg.read_by.includes(user.id))
      );

      for (const message of unreadMessages) {
        const updatedReadBy = [...(message.read_by || []), user.id];
        
        await supabase
          .from('general_chats')
          .update({ read_by: updatedReadBy })
          .eq('id', message.id);
      }

      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Fallback to system beep
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.5);
      });
    } catch (error) {
      console.log('Could not play notification sound');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || loading) return;

    setLoading(true);
    try {
      const messageData: any = {
        sender_id: user.id,
        message: newMessage.trim(),
        message_type: 'text'
      };

      // Add client_id if we're in a client chat
      if (selectedClientId) {
        messageData.client_id = selectedClientId;
      }
      // For office chat, client_id remains null

      const { error } = await supabase
        .from('general_chats')
        .insert(messageData);

      if (error) throw error;
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.created_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className={`h-full flex flex-col border rounded-lg ${className}`}>
      {/* Header simplificado */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium text-sm">{selectedClientName}</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Scroll controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToTop}
            className="h-7 w-7 p-0"
            title="Ir al inicio"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToBottom}
            className="h-7 w-7 p-0"
            title="Ir al final"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-7 w-7 p-0"
            title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      
      {/* Messages area with fixed height */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full p-3" ref={scrollAreaRef}>
          <div className="space-y-3 min-h-full">
            {Object.entries(messageGroups).map(([dateKey, dayMessages]) => (
              <div key={dateKey}>
                <div className="flex justify-center my-3">
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    {formatDate(dayMessages[0].created_at)}
                  </Badge>
                </div>
                
                {dayMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 mb-3 ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user?.id && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {message.sender_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    
                    <div className={`max-w-[75%] ${
                      message.sender_id === user?.id ? 'order-first' : ''
                    }`}>
                      <div className={`rounded-xl px-3 py-2 text-sm ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        {message.sender_id !== user?.id && (
                          <div className="text-xs font-medium mb-1 opacity-70">
                            {message.sender_name}
                          </div>
                        )}
                        <div>{message.message}</div>
                      </div>
                      <div className={`text-xs text-muted-foreground mt-1 ${
                        message.sender_id === user?.id ? 'text-right' : 'text-left'
                      }`}>
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                    
                    {message.sender_id === user?.id && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {profile?.full_name?.charAt(0) || 'T'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
      
      {/* Input area */}
      <div className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder="Escribir mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={loading}
            className="text-sm"
          />
          <Button 
            onClick={sendMessage} 
            disabled={loading || !newMessage.trim()}
            size="sm"
            className="px-3"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}