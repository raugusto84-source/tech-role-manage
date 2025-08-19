import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

export interface MainCategory {
  id: string;
  name: string;
}

export interface Problem {
  id: string;
  name: string;
  category_id: string | null;
}

interface ProblemSelectorProps {
  selectedCategoryId?: string | null;
  selectedProblemId?: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onSelectProblem: (problemId: string) => void;
}

export function ProblemSelector({
  selectedCategoryId,
  selectedProblemId,
  onSelectCategory,
  onSelectProblem,
}: ProblemSelectorProps) {
  const [categories, setCategories] = useState<MainCategory[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase
        .from('main_service_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setCategories(cats || []);

      const { data: probs } = await supabase
        .from('problems')
        .select('id, name, category_id')
        .eq('is_active', true)
        .order('name');
      setProblems(probs || []);
    };
    load();
  }, []);

  const filteredProblems = problems.filter((p) => {
    const byCat = selectedCategoryId ? p.category_id === selectedCategoryId : true;
    const byText = p.name.toLowerCase().includes(search.toLowerCase());
    return byCat && byText;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecciona el Problema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Categoría principal</Label>
            <Select value={selectedCategoryId || 'all'} onValueChange={(v) => onSelectCategory(v === 'all' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Buscar problema</Label>
            <Input placeholder="Filtro por texto" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-auto">
          {filteredProblems.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectProblem(p.id)}
              className={`text-left p-3 rounded border transition-colors ${
                selectedProblemId === p.id ? 'border-primary bg-primary/10' : 'border-muted'
              }`}
            >
              {p.name}
            </button>
          ))}
          {filteredProblems.length === 0 && (
            <div className="text-sm text-muted-foreground">No hay problemas configurados aún.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
