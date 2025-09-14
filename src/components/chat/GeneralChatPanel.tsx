import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Bell, BellOff, Camera, MapPin, Image } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChatMedia } from '@/hooks/useChatMedia';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  message_type: string;
  attachment_url?: string;
  created_at: string;
  read_by: string[];
  sender_name?: string;
}

interface GeneralChatPanelProps {
  className?: string;
}

export function GeneralChatPanel({ className }: GeneralChatPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { uploadPhoto, capturePhoto, getCurrentLocation, uploading } = useChatMedia();
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
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      // Fetch sender names separately
      const formattedMessages = await Promise.all((data || []).map(async (msg) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', msg.sender_id)
          .single();
        
        return {
          ...msg,
          read_by: Array.isArray(msg.read_by) ? msg.read_by.map(id => String(id)) : [],
          sender_name: profile?.full_name || 'Usuario'
        };
      }));

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

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('general-chat')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'general_chats' }, 
        (payload) => {
          const newMsg = payload.new as any;
          
          // Add sender name
          supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', newMsg.sender_id)
            .single()
            .then(({ data }) => {
              const messageWithSender = {
                ...newMsg,
                sender_name: data?.full_name || 'Usuario'
              };
              
              setMessages(prev => [...prev, messageWithSender]);
              
              // If message is from another user, play sound and show notification
              if (newMsg.sender_id !== user.id) {
                setUnreadCount(prev => prev + 1);
                
                if (soundEnabled) {
                  playNotificationSound();
                }
                
                // Show desktop notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Nuevo mensaje en chat general', {
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
      supabase.removeChannel(channel);
    };
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

  const sendMessage = async (messageType = 'text', messageContent = newMessage.trim(), attachmentUrl?: string) => {
    if ((!messageContent && !attachmentUrl) || !user || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('general_chats')
        .insert({
          sender_id: user.id,
          message: messageContent,
          message_type: messageType,
          attachment_url: attachmentUrl
        });

      if (error) throw error;
      
      if (messageType === 'text') setNewMessage('');
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const imageUrl = await uploadPhoto(file, user.id);
    if (imageUrl) {
      await sendMessage('image', 'Envió una imagen', imageUrl);
    }
    event.target.value = '';
  };

  const handleCameraCapture = async () => {
    if (!user) return;
    
    const imageUrl = await capturePhoto(user.id);
    if (imageUrl) {
      await sendMessage('image', 'Envió una foto', imageUrl);
    }
  };

  const handleLocationShare = async () => {
    if (!user) return;
    
    const location = await getCurrentLocation();
    if (location) {
      const locationMessage = `📍 Ubicación compartida: ${location.address}`;
      const locationUrl = `https://maps.google.com/maps?q=${location.lat},${location.lng}&z=17`;
      await sendMessage('location', locationMessage, locationUrl);
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
            Chat Oficina
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
                          : 'bg-muted'
                      }`}>
                        {message.sender_id !== user?.id && (
                          <div className="text-xs font-medium mb-1 opacity-70">
                            {message.sender_name}
                          </div>
                         )}
                         
                         {message.message_type === 'image' && message.attachment_url ? (
                           <div className="space-y-2">
                             <Dialog>
                               <DialogTrigger asChild>
                                 <img 
                                   src={message.attachment_url} 
                                   alt="Imagen compartida"
                                   className="max-w-48 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                 />
                               </DialogTrigger>
                               <DialogContent className="max-w-3xl">
                                 <img 
                                   src={message.attachment_url} 
                                   alt="Imagen compartida"
                                   className="w-full h-auto rounded"
                                 />
                               </DialogContent>
                             </Dialog>
                             <div className="text-sm">{message.message}</div>
                           </div>
                         ) : message.message_type === 'location' && message.attachment_url ? (
                            <div className="space-y-2">
                              <a 
                                href={message.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  // Intentar abrir con window.open como fallback para computadoras
                                  const newWindow = window.open(message.attachment_url, '_blank', 'noopener,noreferrer');
                                  if (!newWindow) {
                                    // Si el popup fue bloqueado, intentar navegación directa
                                    window.location.href = message.attachment_url || '';
                                  }
                                }}
                                className="flex items-center gap-2 p-2 bg-primary/10 rounded text-primary hover:bg-primary/20 transition-colors"
                             >
                               <MapPin className="h-4 w-4" />
                               <span className="text-sm">Ver ubicación</span>
                             </a>
                             <div className="text-sm">{message.message}</div>
                           </div>
                         ) : (
                           <div className="text-sm">{message.message}</div>
                         )}
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
              placeholder="Escribir mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading || uploading}
            />
            
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
              disabled={loading || uploading}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCameraCapture}
              disabled={loading || uploading}
              title="Tomar foto"
            >
              <Camera className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('photo-upload')?.click()}
              disabled={loading || uploading}
              title="Subir imagen"
            >
              <Image className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLocationShare}
              disabled={loading || uploading}
              title="Compartir ubicación"
            >
              <MapPin className="h-4 w-4" />
            </Button>
            
            <Button 
              onClick={() => sendMessage()} 
              disabled={loading || uploading || !newMessage.trim()}
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