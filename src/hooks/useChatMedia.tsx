import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useChatMedia() {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const capturePhoto = async (userId: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      // Create video element to display camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          // Create canvas to capture photo
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0);
          
          // Stop camera stream
          stream.getTracks().forEach(track => track.stop());
          
          // Convert to blob and upload
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const result = await uploadPhoto(file, userId);
            resolve(result);
          }, 'image/jpeg', 0.8);
        };
      });
    } catch (error) {
      console.error('Error capturing photo:', error);
      toast({
        title: "Error",
        description: "No se pudo acceder a la cámara",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

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

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; address?: string; houseNumber?: string } | null> => {
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
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Use OpenStreetMap Nominatim for reverse geocoding (free service)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            let houseNumber = '';
            
            if (data && data.display_name) {
              // Extract detailed address information
              const addressParts = [];
              if (data.address) {
                // Prioritize house number
                if (data.address.house_number) {
                  houseNumber = data.address.house_number;
                  addressParts.push(`#${data.address.house_number}`);
                }
                
                // Add street information
                if (data.address.road) addressParts.push(data.address.road);
                
                // Add neighborhood or locality
                if (data.address.neighbourhood) {
                  addressParts.push(data.address.neighbourhood);
                } else if (data.address.suburb) {
                  addressParts.push(data.address.suburb);
                }
                
                // Add city information
                if (data.address.city || data.address.town || data.address.village) {
                  addressParts.push(data.address.city || data.address.town || data.address.village);
                }
                
                // Add state/region if available
                if (data.address.state) {
                  addressParts.push(data.address.state);
                }
              }
              
              address = addressParts.length > 0 ? addressParts.join(', ') : data.display_name;
            }
            
            resolve({ lat: latitude, lng: longitude, address, houseNumber });
          } catch (error) {
            console.error('Geocoding error:', error);
            // Fallback to coordinates
            resolve({ 
              lat: latitude, 
              lng: longitude, 
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              houseNumber: ''
            });
          }
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
          timeout: 15000,
          maximumAge: 300000
        }
      );
    });
  };

  return {
    uploadPhoto,
    capturePhoto,
    getCurrentLocation,
    uploading
  };
}