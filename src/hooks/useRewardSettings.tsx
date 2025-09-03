import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RewardSettings {
  id: string;
  new_client_cashback_percent: number;
  general_cashback_percent: number;
  apply_cashback_to_items: boolean;
  is_active: boolean;
}

export function useRewardSettings() {
  const [settings, setSettings] = useState<RewardSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading reward settings:', error);
        return;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    reloadSettings: loadSettings
  };
}