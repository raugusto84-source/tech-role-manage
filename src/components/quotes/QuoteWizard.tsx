// src/components/quotes/QuoteWizard.tsx
// Nuevo flujo definitivo: Cliente → Problema → Posible Solución (checklist) → Resumen
// La pestaña "Impuestos" queda OCULTA mediante feature flag (VITE_SHOW_TAX_TAB=false),
// pero la lógica de impuestos se mantiene en background (taxRate sigue aplicando).
//
// Notas:
// - Este archivo es autocontenido. Ajusta imports si tu estructura difiere.
// - Si tienes tablas en Supabase para problemas/soluciones, revisa la función
//   loadProblemsAndSolutions() y cambia los nombres de tablas/campos.
// - Mantiene botones Aceptar / No aceptar en tarjetas de solución.
// - Navegación respeta el orden solicitado y salta cualquier paso oculto.

import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, Lightbulb, ArrowRight, ArrowLeft } from 'lucide-react';

// =========================
// Tipos de datos
// =========================

type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

type Quote = {
  subtotal?: number;
  taxRate?: number; // se aplica aunque la UI esté oculta
  notes?: string;
  selectedSolutionId?: string | null;
};

type ChecklistQuestion = {
  id: string;
  text: string;
  fieldKey: string; // clave usada en "answers"
};

type Problem = {
  id: string;
  name: string;
  questions: ChecklistQuestion[];
};

type Solution = {
  id: string;
  name: string;
  description: string;
  // Criterios esperados: { [fieldKey]: boolean esperado }
  criteria: Record<string, boolean>;
  baseCost?: number; // opcional: para sugerir subtotal
};

// =========================
// Utilidades
// =========================

const SHOW_TAX_TAB = (import.meta.env.VITE_SHOW_TAX_TAB ?? 'false') === 'true';

function scoreSolution(solution: Solution, answers: Record<string, boolean>): number {
  // Puntúa cuántas coincidencias tiene la solución con las respuestas dadas
  let score = 0;
  for (const key of Object.keys(solution.criteria)) {
    const expected = solution.criteria[key];
    if (answers[key] === expected) score += 1;
  }
  return score;
}

// Carga dinámica (opcional) desde Supabase; si falla, usa datos locales
async function loadProblemsAndSolutions(): Promise<{ problems: Problem[]; solutions: Solution[] } | null> {
  try {
    // ⚠️ Ajusta a tus tablas reales si existen
    // Ejemplo: tablas "sales_problems" y "sales_solutions" con estructuras compatibles
    const { data: pData, error: pErr } = await supabase
      .from('sales_problems')
      .select('*');
    const { data: sData, error: sErr } = await supabase
      .from('sales_solutions')
      .select('*');

    if (pErr || sErr) return null;

    // Esperado (ejemplo):
    // sales_problems: { id, name, questions: [{id,text,fieldKey}, ...] }
    // sales_solutions: { id, name, description, criteria (json), baseCost }

    const problems: Problem[] = (pData as any[])?.map((r) => ({
      id: String(r.id),
      name: r.name,
      questions: (r.questions ?? []).map((q: any) => ({
        id: String(q.id ?? q.fieldKey ?? Math.random()),
        text: q.text,
        fieldKey: q.fieldKey,
      })),
    })) ?? [];

    const solutions: Solution[] = (sData as any[])?.map((r) => ({
      id: String(r.id),
      name: r.name,
      description: r.description,
      criteria: r.criteria ?? {},
      baseCost: typeof r.baseCost === 'number' ? r.baseCost : undefined,
    })) ?? [];

    if (!problems.length || !solutions.length) return null;
    return { problems, solutions };
  } catch (e) {
    return null;
  }
}

// Datos locales de respaldo (puedes borrarlos si ya tienes tablas en Supabase)
const FALLBACK: { problems: Problem[]; solutions: Solution[] } = {
  problems: [
    {
      id: 'p1',
      name: 'Cámaras de seguridad con cortes de señal',
      questions: [
        { id: 'q1', text: '¿La fuente de poder presenta fallas?', fieldKey: 'psu_fault' },
        { id: 'q2', text: '¿El cableado es UTP categoría 6 o superior?', fieldKey: 'cat6' },
        { id: 'q3', text: '¿Se requiere visualización remota estable?', fieldKey: 'remote' },
      ],
    },
    {
      id: 'p2',
      name: 'Control de acceso con lentitud o fallas de apertura',
      questions: [
        { id: 'q4', text: '¿Hay ruido eléctrico o picos de voltaje?', fieldKey: 'noise' },
        { id: 'q5', text: '¿Se necesitan logs de entrada/salida?', fieldKey: 'logs' },
      ],
    },
  ],
  solutions: [
    {
      id: 's1',
      name: 'Reemplazo de fuentes + estabilizador',
      description: 'Cambiar fuentes dañadas y añadir regulación para evitar caídas de tensión.',
      criteria: { psu_fault: true },
      baseCost: 2500,
    },
    {
      id: 's2',
      name: 'Mejora de cableado y conectores',
      description: 'Migrar a UTP Cat6/6A, crimpar conectores de calidad y validar continuidad.',
      criteria: { cat6: false },
      baseCost: 3200,
    },
    {
      id: 's3',
      name: 'Router + QoS para monitoreo remoto',
      description: 'Optimizar red con QoS, doble WAN o balanceo para acceso remoto estable.',
      criteria: { remote: true },
      baseCost: 4200,
    },
    {
      id: 's4',
      name: 'Supresor/UPS y filtrado EMI',
      description: 'Mitigar ruido eléctrico y picos con supresores y UPS de línea interactiva.',
      criteria: { noise: true },
      baseCost: 2800,
    },
    {
      id: 's5',
      name: 'Controladora con bitácoras',
      description: 'Actualizar a panel con registro de eventos y reportes.',
      criteria: { logs: true },
      baseCost: 3600,
    },
  ],
};

// =========================
// Componente principal
// =========================

export default function QuoteWizard() {
  const [active, setActive] = useState<string>('cliente');

  // Estado negocio
  const [client, setClient] = useState<Client | null>(null);
  const [quote, setQuote] = useState<Quote>({ subtotal: 0, taxRate: 0.16, selectedSolutionId: null });

  // Estado de problemas/soluciones
  const [problems, setProblems] = useState<Problem[]>(FALLBACK.problems);
  const [solutions, setSolutions] = useState<Solution[]>(FALLBACK.solutions);
  const [selectedProblemId, setSelectedProblemId] = useState<string>(FALLBACK.problems[0]?.id ?? '');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [rejected, setRejected] = useState<Record<string, boolean>>({}); // soluciones marcadas como "No aceptar"

  // Carga remota opcional (si existen tablas). Si falla, permanecen los datos de respaldo.
  useEffect(() => {
    (async () => {
      const remote = await loadProblemsAndSolutions();
      if (remote) {
        setProblems(remote.problems);
        setSolutions(remote.solutions);
        setSelectedProblemId(remote.problems[0]?.id ?? '');
      }
    })();
  }, []);

  // Problema activo y preguntas
  const selectedProblem = useMemo(
    () => problems.find((p) => p.id === selectedProblemId) ?? null,
    [problems, selectedProblemId]
  );

  // Sugerencias ordenadas por score (desc)
  const suggestions = useMemo(() => {
    const scored = solutions.map((s) => ({ s, score: scoreSolution(s, answers) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map(({ s, score }) => ({ ...s, _score: score } as Solution & { _score: number }));
  }, [solutions, answers]);

  // Totales (impuestos se aplican aunque no exista tab visual)
  const subtotal = quote.subtotal ?? 0;
  const taxRate = quote.taxRate ?? 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Pasos visibles definitivos (sin impuestos)
  const visibleSteps: string[] = ['cliente', 'problema', 'solucion', 'resumen'];

  const goNext = () => {
    const i = visibleSteps.indexOf(active);
    if (i < visibleSteps.length - 1) setActive(visibleSteps[i + 1]);
  };
  const goPrev = () => {
    const i = visibleSteps.indexOf(active);
    if (i > 0) setActive(visibleSteps[i - 1]);
  };

  // Acciones Aceptar / No aceptar
  const acceptSolution = (id: string, baseCost?: number) => {
    setQuote((q) => ({ ...q, selectedSolutionId: id, subtotal: typeof baseCost === 'number' ? baseCost : q.subtotal }));
    toast({ title: 'Solución seleccionada', description: 'Se aplicó la solución al resumen.' });
  };

  const rejectSolution = (id: string) => {
    setRejected((prev) => ({ ...prev, [id]: true }));
  };

  // UI helpers
  const SolutionCard: React.FC<{ sol: Solution & { _score?: number } }> = ({ sol }) => {
    const isRejected = rejected[sol.id];
    const isSelected = quote.selectedSolutionId === sol.id;

    return (
      <Card className={`border ${isRejected ? 'opacity-60 grayscale' : ''}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            <CardTitle className="text-base">{sol.name}</CardTitle>
            {typeof sol._score === 'number' && (
              <Badge variant="secondary">Score {sol._score}</Badge>
            )}
            {isSelected && <Badge>Seleccionada</Badge>}
          </div>
          <CardDescription>{sol.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(sol.criteria).map((k) => (
              <Badge key={k} variant="outline">{k}: {String(sol.criteria[k])}</Badge>
            ))}
          </div>

          {typeof sol.baseCost === 'number' && (
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">Costo sugerido: </span>
              <span className="font-medium">${sol.baseCost.toFixed(2)}</span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => acceptSolution(sol.id, sol.baseCost)}>
              <Check className="h-4 w-4 mr-1" /> Aceptar
            </Button>
            <Button size="sm" variant="outline" onClick={() => rejectSolution(sol.id)}>
              <X className="h-4 w-4 mr-1" /> No aceptar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wizard de Cotización</CardTitle>
        <CardDescription>
          Flujo: <strong>Cliente → Problema → Posible Solución (checklist) → Resumen</strong>
          {SHOW_TAX_TAB ? ' (Impuestos visible)' : ' (Impuestos oculto por configuración)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={setActive} className="w-full">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
            <TabsTrigger value="problema">Problema</TabsTrigger>
            <TabsTrigger value="solucion">Posible solución</TabsTrigger>
            {/* Tab impuestos oculto por flag (no forma parte del flujo) */}
            {SHOW_TAX_TAB && <TabsTrigger value="impuestos">Impuestos</TabsTrigger>}
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>

          {/* ====== CLIENTE ====== */}
          <TabsContent value="cliente" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre del cliente</Label>
                <Input
                  placeholder="Ingresa el nombre"
                  value={client?.name ?? ''}
                  onChange={(e) => setClient((c) => ({ ...(c ?? { id: 'tmp', name: '' }), name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="10 dígitos"
                  value={client?.phone ?? ''}
                  onChange={(e) => setClient((c) => ({ ...(c ?? { id: 'tmp', name: '' }), phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Correo</Label>
                <Input
                  placeholder="cliente@dominio.com"
                  type="email"
                  value={client?.email ?? ''}
                  onChange={(e) => setClient((c) => ({ ...(c ?? { id: 'tmp', name: '' }), email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Dirección</Label>
                <Textarea
                  placeholder="Calle, número, colonia, ciudad…"
                  value={client?.address ?? ''}
                  onChange={(e) => setClient((c) => ({ ...(c ?? { id: 'tmp', name: '' }), address: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button variant="outline" disabled>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button onClick={goNext}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          {/* ====== PROBLEMA ====== */}
          <TabsContent value="problema" className="mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Selecciona el problema</Label>
                  <div className="grid gap-2">
                    <select
                      className="border rounded-md px-3 py-2 bg-background"
                      value={selectedProblemId}
                      onChange={(e) => {
                        setSelectedProblemId(e.target.value);
                        setAnswers({});
                        setRejected({});
                        setQuote((q) => ({ ...q, selectedSolutionId: null }));
                      }}
                    >
                      {problems.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedProblem && (
                <div className="mt-2">
                  <Label className="mb-2 block">Checklist de diagnóstico</Label>
                  <div className="grid gap-2">
                    {selectedProblem.questions.map((q) => (
                      <label key={q.id} className="flex items-center gap-3 py-2">
                        <Checkbox
                          checked={!!answers[q.fieldKey]}
                          onCheckedChange={(v) => setAnswers((a) => ({ ...a, [q.fieldKey]: Boolean(v) }))}
                        />
                        <span>{q.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button variant="outline" onClick={goPrev}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button onClick={goNext}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          {/* ====== POSIBLE SOLUCIÓN (checklist) ====== */}
          <TabsContent value="solucion" className="mt-4">
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                Sugerencias basadas en tus respuestas del checklist. Puedes <strong>Aceptar</strong> una solución para llevarla al resumen, o <strong>No aceptar</strong> para descartarla.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {suggestions
                  .filter((s) => !rejected[s.id])
                  .map((s) => (
                    <SolutionCard key={s.id} sol={s} />
                  ))}
              </div>

              {suggestions.filter((s) => !rejected[s.id]).length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No hay sugerencias activas. Ajusta tus respuestas del checklist o regresa al paso anterior.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button variant="outline" onClick={goPrev}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button onClick={goNext}>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          {/* ====== IMPUESTOS (UI OCULTA por default) ====== */}
          {SHOW_TAX_TAB && (
            <TabsContent value="impuestos" className="mt-4">
              <div className="grid gap-2 max-w-sm">
                <Label>Tasa de impuesto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={taxRate}
                  onChange={(e) => setQuote((q) => ({ ...q, taxRate: Number(e.target.value) }))}
                />
              </div>
            </TabsContent>
          )}

          {/* ====== RESUMEN ====== */}
          <TabsContent value="resumen" className="mt-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cliente</CardTitle>
                  <CardDescription>Datos generales</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1 text-sm">
                    <div><span className="text-muted-foreground">Nombre:</span> {client?.name ?? '—'}</div>
                    <div><span className="text-muted-foreground">Teléfono:</span> {client?.phone ?? '—'}</div>
                    <div><span className="text-muted-foreground">Correo:</span> {client?.email ?? '—'}</div>
                    <div><span className="text-muted-foreground">Dirección:</span> {client?.address ?? '—'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Solución seleccionada</CardTitle>
                  <CardDescription>Resumen de la propuesta</CardDescription>
                </CardHeader>
                <CardContent>
                  {quote.selectedSolutionId ? (
                    (() => {
                      const sel = solutions.find((s) => s.id === quote.selectedSolutionId);
                      if (!sel) return <div className="text-sm">—</div>;
                      return (
                        <div className="grid gap-2">
                          <div className="font-medium">{sel.name}</div>
                          <div className="text-sm text-muted-foreground">{sel.description}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.keys(sel.criteria).map((k) => (
                              <Badge key={k} variant="outline">{k}: {String(sel.criteria[k])}</Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-muted-foreground">Aún no has aceptado una solución. Selecciona en el paso anterior.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Totales</CardTitle>
                  <CardDescription>Impuestos aplican en background</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 max-w-sm">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <Input
                        className="w-32 text-right"
                        type="number"
                        step="0.01"
                        value={subtotal}
                        onChange={(e) => setQuote((q) => ({ ...q, subtotal: Number(e.target.value) }))}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span>Impuestos ({Math.round(taxRate * 100)}%)</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-2 flex items-center gap-2">
                <Button variant="outline" onClick={goPrev}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button onClick={() => toast({ title: 'Cotización lista', description: 'Puedes guardar o enviar la cotización.' })}>
                  Finalizar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
