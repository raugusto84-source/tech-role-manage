import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * OrderChat
 * Chat en vivo y privado para una orden específica.
 * - Visible solo si la orden está activa (controlado por prop `disabled`)
 * - Escucha en tiempo real nuevos mensajes (Supabase Realtime)
 * - Guarda el historial en la tabla `order_chat_messages`
 * - Interfaz mínima y usable desde móvil (sin menús extra)
 */
export interface OrderChatProps {
  orderId: string;
  disabled?: boolean;
  onMessagesRead?: () => void; // Callback para notificar que se leyeron mensajes
}

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at?: string | null;
  sender_profile?: {
    full_name: string;
  } | null;
}

export function OrderChat({ orderId, disabled, onMessagesRead }: OrderChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => !!user && !disabled && newMessage.trim().length > 0, [user, disabled, newMessage]);

  // Cargar historial inicial y marcar mensajes como leídos
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("order_chat_messages")
        .select("id, order_id, sender_id, message, created_at, read_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading chat:", error);
        return;
      }
      setMessages(data || []);
      
      // Marcar como leídos todos los mensajes que no son del usuario actual y no están leídos
      if (user?.id && data) {
        const unreadMessages = data.filter(
          msg => msg.sender_id !== user.id && msg.read_at === null
        );
        
        console.log('Unread messages found:', unreadMessages.length);
        console.log('Current user ID:', user.id);
        console.log('All messages:', data.map(m => ({ 
          id: m.id, 
          sender_id: m.sender_id, 
          read_at: m.read_at,
          is_from_current_user: m.sender_id === user.id
        })));
        
        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map(msg => msg.id);
          
          console.log('Marking messages as read:', messageIds);
          
          // Marcar mensajes como leídos con un timestamp específico
          const readTimestamp = new Date().toISOString();
          console.log('Using read timestamp:', readTimestamp);
          
          const { error, data: updatedData } = await supabase
            .from("order_chat_messages")
            .update({ read_at: readTimestamp })
            .in("id", messageIds)
            .select('id, read_at');
          
          console.log('Update response:', { error, updatedData });
          
          if (error) {
            console.error('Error marking messages as read:', error);
          } else {
            console.log('Messages marked as read successfully:', updatedData);
            // Actualizar los mensajes localmente para reflejar el cambio inmediatamente
            setMessages(prev => prev.map(msg => 
              messageIds.includes(msg.id) 
                ? { ...msg, read_at: readTimestamp }
                : msg
            ));
            // Notificar al componente padre que se leyeron mensajes
            onMessagesRead?.();
          }
        } else {
          console.log('No unread messages to mark as read');
        }
      }
      
      // Obtener todos los user_ids únicos (incluyendo el usuario actual)
      const allUserIds = new Set(data?.map(msg => msg.sender_id) || []);
      if (user?.id) {
        allUserIds.add(user.id);
      }
      
      // Cargar perfiles de todos los usuarios
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(allUserIds));
        
        if (profiles) {
          const profileMap = profiles.reduce((acc, profile) => {
            acc[profile.user_id] = profile.full_name;
            return acc;
          }, {} as Record<string, string>);
          setUserProfiles(profileMap);
        }
      }
    };
    load();
  }, [orderId, user?.id, onMessagesRead]);

  // Realtime: escuchar nuevos mensajes de esta orden
  useEffect(() => {
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_chat_messages",
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, msg]);
          
          // Cargar el perfil del nuevo usuario si no lo tenemos
          if (!userProfiles[msg.sender_id]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_id, full_name")
              .eq("user_id", msg.sender_id)
              .maybeSingle();
            
            if (profile) {
              setUserProfiles(prev => ({
                ...prev,
                [profile.user_id]: profile.full_name
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, userProfiles]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async () => {
    if (!canSend || !user) return;
    const text = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("order_chat_messages").insert({
      order_id: orderId,
      sender_id: user.id,
      message: text,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
      // Reestablecer el texto para no perderlo si falló
      setNewMessage(text);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Historial */}
      <ScrollArea className="h-64 rounded-md border border-border p-3 bg-background/50">
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            const isOwn = m.sender_id === user?.id;
            const senderName = userProfiles[m.sender_id] || "Usuario";
            return (
              <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm border border-border/50 ${
                    isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${isOwn ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    {senderName}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.message}</p>
                  <div className={`mt-1 text-[10px] ${isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Entrada de mensaje */}
      {disabled ? (
        <div className="text-sm text-muted-foreground">El chat está disponible solo en órdenes activas.</div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            aria-label="Mensaje de chat"
          />
          <Button onClick={sendMessage} disabled={!canSend} aria-label="Enviar mensaje">
            Enviar
          </Button>
        </div>
      )}
    </div>
  );
}
