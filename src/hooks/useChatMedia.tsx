import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useChatMedia() {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: "No se pudo subir la foto",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; address?: string } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({
          title: "Error",
          description: "La geolocalización no está disponible en este navegador",
          variant: "destructive"
        });
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Try to get address from coordinates (optional)
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=YOUR_MAPBOX_TOKEN&limit=1`)
            .then(response => response.json())
            .then(data => {
              const address = data.features?.[0]?.place_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
              resolve({ lat: latitude, lng: longitude, address });
            })
            .catch(() => {
              resolve({ lat: latitude, lng: longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
            });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Error",
            description: "No se pudo obtener la ubicación. Verifica los permisos del navegador.",
            variant: "destructive"
          });
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  return {
    uploadPhoto,
    getCurrentLocation,
    uploading
  };
}