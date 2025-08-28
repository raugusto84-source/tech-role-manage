import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Bell, BellOff } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  message_type: string;
  attachment_url?: string;
  created_at: string;
  read_by: string[];
  sender_name?: string;
  sender_role?: string;
}

interface FilteredChatPanelProps {
  selectedClientId?: string;
  selectedClientName?: string;
  className?: string;
}

export function FilteredChatPanel({ selectedClientId, selectedClientName, className }: FilteredChatPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    setupRealtimeSubscription();
    
    return () => {
      supabase.removeAllChannels();
    };
  }, [user, selectedClientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          read_by
        `)
        .order('created_at', { ascending: true })
        .limit(100);

      const { data, error } = await query;

      if (error) throw error;

      // Fetch sender names and roles separately
      const formattedMessages = await Promise.all((data || []).map(async (msg) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('user_id', msg.sender_id)
          .single();
        
        return {
          ...msg,
          read_by: Array.isArray(msg.read_by) ? msg.read_by.map(id => String(id)) : [],
          sender_name: profile?.full_name || 'Usuario',
          sender_role: profile?.role || 'cliente'
        };
      }));

      // Filter messages based on selected client
      let filteredMessages = formattedMessages;
      if (selectedClientId) {
        // Show only messages from the selected client
        filteredMessages = formattedMessages.filter(msg => 
          msg.sender_id === selectedClientId || 
          (msg.sender_role !== 'cliente') // Include staff responses
        );
      }

      setMessages(filteredMessages);
      
      // Count unread messages
      const unread = filteredMessages.filter(msg => 
        msg.sender_id !== user.id && 
        (!msg.read_by || !msg.read_by.includes(user.id))
      ).length;
      
      setUnreadCount(unread);

      // Mark messages as read
      if (unread > 0) {
        markMessagesAsRead(filteredMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-${selectedClientId || 'general'}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'general_chats' }, 
        (payload) => {
          const newMsg = payload.new as any;
          
          // Add sender name and role
          supabase
            .from('profiles')
            .select('full_name, role')
            .eq('user_id', newMsg.sender_id)
            .single()
            .then(({ data }) => {
              const messageWithSender = {
                ...newMsg,
                sender_name: data?.full_name || 'Usuario',
                sender_role: data?.role || 'cliente'
              };
              
              // Filter based on selected client
              const shouldShowMessage = !selectedClientId || 
                newMsg.sender_id === selectedClientId || 
                data?.role !== 'cliente';

              if (shouldShowMessage) {
                setMessages(prev => [...prev, messageWithSender]);
                
                // If message is from another user, play sound and show notification
                if (newMsg.sender_id !== user.id) {
                  setUnreadCount(prev => prev + 1);
                  
                  if (soundEnabled) {
                    playNotificationSound();
                  }
                  
                  // Show desktop notification if permission granted
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(`Nuevo mensaje${selectedClientName ? ` de ${selectedClientName}` : ''}`, {
                      body: `${messageWithSender.sender_name}: ${newMsg.message}`,
                      icon: '/favicon.ico'
                    });
                  }
                }
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markMessagesAsRead = async (messagesToMark: Message[]) => {
    if (!user) return;

    try {
      // Get unread messages
      const unreadMessages = messagesToMark.filter(msg => 
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
      const { error } = await supabase
        .from('general_chats')
        .insert({
          sender_id: user.id,
          message: newMessage.trim(),
          message_type: 'text'
        });

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    return new Date(dateString).toLocaleTimeString('es-CO', {
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
      return date.toLocaleDateString('es-CO', {
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
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {selectedClientName || "Chat General"}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
        </div>
        {selectedClientName && (
          <p className="text-sm text-muted-foreground">
            Conversación con {selectedClientName}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96 px-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {Object.entries(messageGroups).map(([dateKey, dayMessages]) => (
              <div key={dateKey}>
                <div className="flex justify-center my-4">
                  <Badge variant="outline" className="text-xs">
                    {formatDate(dayMessages[0].created_at)}
                  </Badge>
                </div>
                
                {dayMessages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 mb-4 ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user?.id && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {message.sender_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`max-w-[70%] ${
                      message.sender_id === user?.id ? 'order-first' : ''
                    }`}>
                      <div className={`rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : message.sender_role === 'cliente'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-muted'
                      }`}>
                        {message.sender_id !== user?.id && (
                          <div className="text-xs font-medium mb-1 opacity-70 flex items-center gap-1">
                            {message.sender_name}
                            {message.sender_role === 'cliente' && (
                              <Badge variant="secondary" className="text-xs">Cliente</Badge>
                            )}
                          </div>
                        )}
                        <div className="text-sm">{message.message}</div>
                      </div>
                      <div className={`text-xs text-muted-foreground mt-1 ${
                        message.sender_id === user?.id ? 'text-right' : 'text-left'
                      }`}>
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                    
                    {message.sender_id === user?.id && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {profile?.full_name?.charAt(0) || 'T'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder={selectedClientName ? `Responder a ${selectedClientName}...` : "Escribir mensaje general..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
            />
            <Button 
              onClick={sendMessage} 
              disabled={loading || !newMessage.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}