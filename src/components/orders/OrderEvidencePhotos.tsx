/**
 * FOTOS DE EVIDENCIA DE ORDEN - COMPONENTE REUTILIZABLE
 * 
 * Permite a técnicos y administradores subir fotos de evidencia
 * del trabajo realizado en una orden.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Plus, X, Loader2, ImageIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderEvidencePhotosProps {
  orderId: string;
  canEdit?: boolean;
}

interface EvidencePhoto {
  id: string;
  order_id: string;
  photo_url: string;
  description?: string;
  uploaded_by: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

export function OrderEvidencePhotos({ orderId, canEdit = true }: OrderEvidencePhotosProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPhotos();
  }, [orderId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      // Fetch photos without join since there's no FK relationship
      const { data, error } = await (supabase
        .from('order_evidence_photos' as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      
      // Fetch profile names separately for each unique uploader
      const photosData = (data || []) as any[];
      const uploaderIdsSet = new Set<string>();
      photosData.forEach((p) => {
        if (p.uploaded_by) uploaderIdsSet.add(p.uploaded_by);
      });
      const uploaderIds = Array.from(uploaderIdsSet);
      
      let profilesMap: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uploaderIds);
        
        profilesMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {});
      }
      
      const photosWithProfiles: EvidencePhoto[] = [];
      for (const photo of photosData) {
        photosWithProfiles.push({
          ...photo,
          profiles: profilesMap[photo.uploaded_by] ? { full_name: profilesMap[photo.uploaded_by] } : undefined
        });
      }
      
      setPhotos(photosWithProfiles);
    } catch (error) {
      console.error('Error loading evidence photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !user?.id) return;

    setUploading(true);

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        // Comprimir imagen antes de subir
        const compressedFile = await compressImage(file);
        
        // Generar nombre único
        const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
        
        // Subir a storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-evidence')
          .upload(fileName, compressedFile, {
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Obtener URL pública
        const { data: urlData } = supabase.storage
          .from('order-evidence')
          .getPublicUrl(fileName);

        // Guardar referencia en la base de datos
        const { error: dbError } = await (supabase
          .from('order_evidence_photos' as any)
          .insert({
            order_id: orderId,
            photo_url: urlData.publicUrl,
            uploaded_by: user.id
          }) as any);

        if (dbError) throw dbError;
      }

      toast({
        title: "Fotos subidas",
        description: `Se subieron ${files.length} foto(s) correctamente`,
      });

      loadPhotos();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: "Error",
        description: "No se pudieron subir las fotos. Verifica los permisos de almacenamiento.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          } else if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => resolve(blob || file),
            'image/jpeg',
            0.8
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const deletePhoto = async (photo: EvidencePhoto) => {
    if (!confirm('¿Eliminar esta foto?')) return;

    try {
      // Extraer path del archivo desde la URL
      const urlParts = photo.photo_url.split('/order-evidence/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('order-evidence').remove([filePath]);
      }

      // Eliminar de la base de datos
      const { error } = await (supabase
        .from('order_evidence_photos' as any)
        .delete()
        .eq('id', photo.id) as any);

      if (error) throw error;

      toast({
        title: "Foto eliminada",
        description: "La foto se eliminó correctamente",
      });

      loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la foto",
        variant: "destructive",
      });
    }
  };

  const isOwner = (photo: EvidencePhoto) => {
    return photo.uploaded_by === user?.id || profile?.role === 'administrador';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Fotos de Evidencia
            </CardTitle>
            {canEdit && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay fotos de evidencia</p>
              {canEdit && (
                <p className="text-xs mt-1">Toca "Agregar" para subir fotos</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square">
                  <img
                    src={photo.photo_url}
                    alt="Evidencia"
                    className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedPhoto(photo.photo_url)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  {canEdit && isOwner(photo) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhoto(photo);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
                    {photo.profiles?.full_name || 'Usuario'} • {format(new Date(photo.created_at), 'dd/MM HH:mm', { locale: es })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para ver foto ampliada */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 z-10"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={selectedPhoto}
            alt="Evidencia ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
