import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Edit2, Star } from 'lucide-react';

interface SkillLevelEditorProps {
  currentLevel: number;
  currentExperience?: number;
  currentExperienceMonths?: number;
  currentNotes?: string;
  currentCertifications?: string[];
  serviceName: string;
  onSave: (data: {
    skill_level: number;
    years_experience?: number;
    months_experience?: number;
    notes?: string;
    certifications?: string[];
  }) => Promise<void>;
  children?: React.ReactNode;
}

export function SkillLevelEditor({ 
  currentLevel, 
  currentExperience = 0,
  currentExperienceMonths = 0,
  currentNotes = '',
  currentCertifications = [],
  serviceName, 
  onSave,
  children 
}: SkillLevelEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [skillLevel, setSkillLevel] = useState(currentLevel);
  const [yearsExperience, setYearsExperience] = useState(currentExperience);
  const [monthsExperience, setMonthsExperience] = useState(currentExperienceMonths);
  const [notes, setNotes] = useState(currentNotes);
  const [certifications, setCertifications] = useState(currentCertifications.join(', '));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const certArray = certifications
        .split(',')
        .map(cert => cert.trim())
        .filter(cert => cert.length > 0);
      
      await onSave({
        skill_level: skillLevel,
        years_experience: yearsExperience,
        months_experience: monthsExperience,
        notes: notes || undefined,
        certifications: certArray.length > 0 ? certArray : undefined
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving skill level:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (level: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-5 w-5 cursor-pointer transition-colors ${
              i < level 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-300 hover:text-yellow-200'
            }`}
            onClick={interactive ? () => setSkillLevel(i + 1) : undefined}
          />
        ))}
      </div>
    );
  };

  const getSkillLevelLabel = (level: number) => {
    const labels = ['Principiante', 'Básico', 'Intermedio', 'Avanzado', 'Experto'];
    return labels[level - 1] || 'Sin definir';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Edit2 className="h-3 w-3" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Habilidad - {serviceName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Nivel de Habilidad */}
          <div className="space-y-3">
            <Label>Nivel de Habilidad</Label>
            <div className="space-y-2">
              {renderStars(skillLevel, true)}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Nivel {skillLevel}/5
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {getSkillLevelLabel(skillLevel)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Haz clic en las estrellas para cambiar el nivel
              </p>
            </div>
          </div>

          {/* Experiencia */}
          <div className="space-y-3">
            <Label>Experiencia</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="years" className="text-sm text-muted-foreground">Años</Label>
                <Input
                  id="years"
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="months" className="text-sm text-muted-foreground">Meses</Label>
                <Input
                  id="months"
                  type="number"
                  min="0"
                  max="11"
                  value={monthsExperience}
                  onChange={(e) => setMonthsExperience(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Certificaciones */}
          <div className="space-y-2">
            <Label htmlFor="certifications">Certificaciones</Label>
            <Input
              id="certifications"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="Separadas por comas"
            />
            <p className="text-xs text-muted-foreground">
              Ejemplo: Certificación A, Certificación B
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre la habilidad, logros especiales, etc."
              rows={3}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}