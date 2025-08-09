import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Save } from "lucide-react";

const marginConfigSchema = z.object({
  min_price: z.number().min(0, "El precio mínimo debe ser mayor o igual a 0"),
  max_price: z.number().min(0, "El precio máximo debe ser mayor a 0"),
  margin_percentage: z.number().min(0, "El margen debe ser mayor o igual a 0").max(1000, "El margen no puede ser mayor a 1000%"),
}).refine(data => data.max_price >= data.min_price, {
  message: "El precio máximo debe ser mayor o igual al mínimo",
  path: ["max_price"],
});

type MarginConfig = z.infer<typeof marginConfigSchema>;

interface ProfitMarginConfigItem {
  id: string;
  min_price: number;
  max_price: number;
  margin_percentage: number;
  is_active: boolean;
}

export default function ProfitMarginConfig() {
  const [configs, setConfigs] = useState<ProfitMarginConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<MarginConfig>({
    resolver: zodResolver(marginConfigSchema),
    defaultValues: {
      min_price: 0,
      max_price: 0,
      margin_percentage: 0,
    },
  });

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("profit_margin_configs")
        .select("*")
        .eq("is_active", true)
        .order("min_price", { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error("Error loading margin configs:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones de márgenes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const onSubmit = async (values: MarginConfig) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("profit_margin_configs")
          .update(values)
          .eq("id", isEditing);

        if (error) throw error;
        toast({ title: "Éxito", description: "Configuración actualizada correctamente" });
      } else {
        const { error } = await supabase
          .from("profit_margin_configs")
          .insert([values]);

        if (error) throw error;
        toast({ title: "Éxito", description: "Nueva configuración creada correctamente" });
      }

      setIsEditing(null);
      form.reset();
      loadConfigs();
    } catch (error) {
      console.error("Error saving margin config:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (config: ProfitMarginConfigItem) => {
    setIsEditing(config.id);
    form.reset({
      min_price: config.min_price,
      max_price: config.max_price,
      margin_percentage: config.margin_percentage,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("profit_margin_configs")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Éxito", description: "Configuración eliminada correctamente" });
      loadConfigs();
    } catch (error) {
      console.error("Error deleting margin config:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la configuración",
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    setIsEditing(null);
    form.reset();
  };

  if (isLoading) {
    return <div>Cargando configuraciones...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Márgenes Automáticos</CardTitle>
          <CardDescription>
            Configura los porcentajes de ganancia automáticos basados en rangos de precio base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="min_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Mínimo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Máximo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="margin_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Margen (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isEditing ? "Actualizar" : "Agregar"}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuraciones Actuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    ${config.min_price} - ${config.max_price}
                  </span>
                  <Badge variant="secondary">
                    {config.margin_percentage}% margen
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(config)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}