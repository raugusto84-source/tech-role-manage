import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useGlobalUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        const { count } = await supabase
          .from('general_chats')
          .select('*', { count: 'exact', head: true })
          .not('sender_id', 'eq', user.id)
          .not('read_by', 'cs', JSON.stringify([user.id]));

        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    };

    loadUnreadCount();

    // Set up realtime subscription for unread count updates
    const channel = supabase
      .channel('global-unread-count')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'general_chats' }, 
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return unreadCount;
}