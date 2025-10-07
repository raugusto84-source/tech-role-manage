import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Camera, MapPin, Image } from 'lucide-react';
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
  sender_role?: string;
}

interface ClientOfficeChatProps {
  className?: string;
}

export function ClientOfficeChat({ className }: ClientOfficeChatProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { uploadPhoto, capturePhoto, getCurrentLocation, uploading } = useChatMedia();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Resolve or create a client_id linked to this user
  const resolveClientId = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      // Try by user_id
      const { data: byUser } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (byUser?.id) {
        setClientId(byUser.id);
        return byUser.id;
      }
      // Try by email
      const { data: byEmail } = await supabase
        .from('clients')
        .select('id')
        .eq('email', profile?.email || '')
        .maybeSingle();
      if (byEmail?.id) {
        setClientId(byEmail.id);
        return byEmail.id;
      }
      return null;
    } catch (err) {
      console.error('Error resolving client ID:', err);
      return null;
    }
  };

  const loadMessages = async (cid?: string) => {
    if (!user) return;
    try {
      setLoading(true);
      const currentCid = cid || clientId;
      if (!currentCid) {
        console.warn('No client_id available for loading messages');
        return;
      }

      const { data, error } = await supabase
        .from('general_chats')
        .select('*,sender:sender_id(full_name,role)')
        .eq('client_id', currentCid)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithSenderInfo = (data || []).map((msg: any) => ({
        ...msg,
        sender_name: msg.sender?.full_name || 'Desconocido',
        sender_role: msg.sender?.role || 'unknown'
      }));

      setMessages(messagesWithSenderInfo);
      
      // Count unread messages
      const unread = messagesWithSenderInfo.filter((msg: Message) => 
        msg.sender_id !== user.id && 
        !msg.read_by.includes(user.id)
      ).length;
      
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los mensajes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (cid?: string) => {
    const currentCid = cid || clientId;
    if (!currentCid) return;

    const channel = supabase
      .channel('office-client-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'general_chats',
          filter: `client_id=eq.${currentCid}`
        },
        async (payload) => {
          console.log('Chat realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            const { data: sender } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('user_id', (payload.new as any).sender_id)
              .single();

            setMessages((prev) => [...prev, {
              ...(payload.new as Message),
              sender_name: sender?.full_name || 'Desconocido',
              sender_role: sender?.role || 'unknown'
            }]);
            
            // Update unread count
            if ((payload.new as Message).sender_id !== user?.id) {
              setUnreadCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => 
              prev.map((msg) => 
                msg.id === (payload.new as Message).id 
                  ? { ...msg, ...(payload.new as Message) }
                  : msg
              )
            );
            
            // Update unread count
            const updatedMsg = payload.new as Message;
            if (updatedMsg.read_by.includes(user?.id || '')) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (user && profile?.role === 'cliente') {
      (async () => {
        const id = await resolveClientId();
        await loadMessages(id || undefined);
        setupRealtimeSubscription(id || undefined);
      })();
    }
    
    return () => {
      supabase.removeAllChannels();
    };
  }, [user, profile]);

  // Mark messages as read when component becomes visible
  useEffect(() => {
    const markAsReadOnVisibility = () => {
      if (document.visibilityState === 'visible' && messages.length > 0) {
        markMessagesAsRead();
      }
    };

    document.addEventListener('visibilitychange', markAsReadOnVisibility);
    
    // Also mark as read when component mounts with messages
    if (messages.length > 0) {
      markMessagesAsRead();
    }

    return () => {
      document.removeEventListener('visibilitychange', markAsReadOnVisibility);
    };
  }, [user, profile, messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      // Get unread messages from office staff
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user.id && 
        ['administrador', 'supervisor', 'vendedor'].includes(msg.sender_role) &&
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

  const sendMessage = async (messageType = 'text', messageContent = newMessage.trim(), attachmentUrl?: string) => {
    if ((!messageContent && !attachmentUrl) || !user || loading) return;

    setLoading(true);
    try {
      // Ensure we have a client_id for this user
      const id = await resolveClientId();

      const messageData: any = {
        sender_id: user.id,
        message: messageContent,
        message_type: messageType,
        attachment_url: attachmentUrl
      };

      if (id) {
        messageData.client_id = id;
      }

      const { error } = await supabase
        .from('general_chats')
        .insert(messageData);

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

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Atención a Clientes
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Comunícate directamente con nuestro equipo de atención
        </p>
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
                
                {dayMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 mb-4 ${
                      message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender_id !== user?.id && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {message.sender_name?.charAt(0) || 'O'}
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
                            {message.sender_name} - Oficina
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
                          {profile?.full_name?.charAt(0) || 'C'}
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
              placeholder="Escribir mensaje a la oficina..."
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
              id="client-photo-upload"
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
              onClick={() => document.getElementById('client-photo-upload')?.click()}
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