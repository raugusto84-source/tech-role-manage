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
        // Get user profile to check role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, email')
          .eq('user_id', user.id)
          .single();

        let query = supabase
          .from('general_chats')
          .select('*', { count: 'exact', head: true })
          .not('sender_id', 'eq', user.id)
          .not('read_by', 'cs', JSON.stringify([user.id]));

        // For client users, only count messages where they are involved as client
        if (profile?.role === 'cliente') {
          // Get client record for this user
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('email', profile.email)
            .single();

          if (client) {
            query = query.eq('client_id', client.id);
          } else {
            // If no client record, no messages to count
            setUnreadCount(0);
            return;
          }
        }

        const { count } = await query;
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