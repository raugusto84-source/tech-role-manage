import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit2, CheckCircle, MessageSquare, Calendar, Clock, Trash2, History } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DevelopmentLead {
  id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  monthly_payment_proposed: number;
  status: string;
  last_activity_at: string;
  last_activity_description: string | null;
  comments: string | null;
  reminder_date: string | null;
  has_investor: boolean;
  investor_name: string | null;
  investor_amount: number;
  created_at: string;
}

interface LeadComment {
  id: string;
  lead_id: string;
  comment_text: string;
  created_at: string;
}

interface DevelopmentLeadsListProps {
  onConvertToContract: (lead: DevelopmentLead) => void;
}

const statusColors: Record<string, string> = {
  nuevo: 'bg-blue-500',
  contactado: 'bg-yellow-500',
  negociando: 'bg-orange-500',
  propuesta_enviada: 'bg-purple-500',
  aceptado: 'bg-green-500',
  rechazado: 'bg-red-500',
  pausado: 'bg-gray-500',
};

const statusLabels: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  negociando: 'Negociando',
  propuesta_enviada: 'Propuesta Enviada',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  pausado: 'Pausado',
};

export function DevelopmentLeadsList({ onConvertToContract }: DevelopmentLeadsListProps) {
  const [leads, setLeads] = useState<DevelopmentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<DevelopmentLead | null>(null);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [selectedLeadForComments, setSelectedLeadForComments] = useState<DevelopmentLead | null>(null);
  const [leadComments, setLeadComments] = useState<LeadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    monthly_payment_proposed: 0,
    status: 'nuevo',
    comments: '',
    reminder_date: '',
    has_investor: false,
    investor_name: '',
    investor_amount: 0,
  });

  const [latestComments, setLatestComments] = useState<Record<string, LeadComment | null>>({});

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    if (leads.length > 0) {
      loadLatestComments();
    }
  }, [leads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_development_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast.error('Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadLatestComments = async () => {
    try {
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('access_development_lead_comments')
        .select('*')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by lead_id and get the latest comment for each
      const commentsByLead: Record<string, LeadComment | null> = {};
      leadIds.forEach(id => {
        const leadCommentsList = (data || []).filter(c => c.lead_id === id);
        commentsByLead[id] = leadCommentsList.length > 0 ? leadCommentsList[0] : null;
      });
      setLatestComments(commentsByLead);
    } catch (error) {
      console.error('Error loading latest comments:', error);
    }
  };

  const loadCommentsForLead = async (lead: DevelopmentLead) => {
    try {
      setLoadingComments(true);
      setSelectedLeadForComments(lead);
      setShowCommentsDialog(true);

      const { data, error } = await supabase
        .from('access_development_lead_comments')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeadComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Error al cargar comentarios');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedLeadForComments || !newComment.trim()) return;

    try {
      setSavingComment(true);
      const { error } = await supabase
        .from('access_development_lead_comments')
        .insert([{
          lead_id: selectedLeadForComments.id,
          comment_text: newComment.trim(),
        }]);

      if (error) throw error;

      // Update the lead's comments field and last activity
      await supabase
        .from('access_development_leads')
        .update({
          comments: newComment.trim(),
          last_activity_at: new Date().toISOString(),
          last_activity_description: 'Comentario agregado',
        })
        .eq('id', selectedLeadForComments.id);

      toast.success('Comentario agregado');
      setNewComment('');
      loadCommentsForLead(selectedLeadForComments);
      loadLeads();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Error al agregar comentario');
    } finally {
      setSavingComment(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      monthly_payment_proposed: 0,
      status: 'nuevo',
      comments: '',
      reminder_date: '',
      has_investor: false,
      investor_name: '',
      investor_amount: 0,
    });
  };

  const handleOpenNew = () => {
    resetForm();
    setEditingLead(null);
    setShowNewDialog(true);
  };

  const handleEdit = (lead: DevelopmentLead) => {
    setFormData({
      name: lead.name,
      address: lead.address || '',
      contact_name: lead.contact_name || '',
      contact_phone: lead.contact_phone || '',
      contact_email: lead.contact_email || '',
      monthly_payment_proposed: lead.monthly_payment_proposed,
      status: lead.status,
      comments: lead.comments || '',
      reminder_date: lead.reminder_date || '',
      has_investor: lead.has_investor,
      investor_name: lead.investor_name || '',
      investor_amount: lead.investor_amount,
    });
    setEditingLead(lead);
    setShowNewDialog(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        toast.error('El nombre es requerido');
        return;
      }

      const leadData = {
        name: formData.name,
        address: formData.address || null,
        contact_name: formData.contact_name || null,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        monthly_payment_proposed: formData.monthly_payment_proposed,
        status: formData.status,
        comments: formData.comments || null,
        reminder_date: formData.reminder_date || null,
        has_investor: formData.has_investor,
        investor_name: formData.has_investor ? formData.investor_name : null,
        investor_amount: formData.has_investor ? formData.investor_amount : 0,
        last_activity_at: new Date().toISOString(),
        last_activity_description: editingLead ? 'Actualizado' : 'Creado',
      };

      if (editingLead) {
        const { error } = await supabase
          .from('access_development_leads')
          .update(leadData)
          .eq('id', editingLead.id);
        if (error) throw error;

        // Save comment to history if it changed
        if (formData.comments && formData.comments !== editingLead.comments) {
          await supabase
            .from('access_development_lead_comments')
            .insert([{
              lead_id: editingLead.id,
              comment_text: formData.comments,
            }]);
        }

        toast.success('Cotización actualizada');
      } else {
        const { data: newLead, error } = await supabase
          .from('access_development_leads')
          .insert([leadData])
          .select()
          .single();
        if (error) throw error;

        // Save initial comment if provided
        if (formData.comments && newLead) {
          await supabase
            .from('access_development_lead_comments')
            .insert([{
              lead_id: newLead.id,
              comment_text: formData.comments,
            }]);
        }

        toast.success('Cotización creada');
      }

      setShowNewDialog(false);
      loadLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error('Error al guardar cotización');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta cotización?')) return;

    try {
      const { error } = await supabase
        .from('access_development_leads')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Cotización eliminada');
      loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Error al eliminar cotización');
    }
  };

  const handleConvert = (lead: DevelopmentLead) => {
    onConvertToContract(lead);
    // Update lead status to accepted
    supabase
      .from('access_development_leads')
      .update({ 
        status: 'aceptado',
        last_activity_at: new Date().toISOString(),
        last_activity_description: 'Convertido a contrato'
      })
      .eq('id', lead.id)
      .then(() => loadLeads());
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const isReminderDue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) <= new Date();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Cotizaciones de Fraccionamientos</CardTitle>
        <Button onClick={handleOpenNew} size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Nueva Cotización
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">Cargando...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay cotizaciones registradas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fraccionamiento</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Propuesta Mensual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Actividad</TableHead>
                  <TableHead>Último Comentario</TableHead>
                  <TableHead>Recordatorio</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.address}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{lead.contact_name}</p>
                        <p className="text-sm text-muted-foreground">{lead.contact_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(lead.monthly_payment_proposed)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.status] || 'bg-gray-500'}>
                        {statusLabels[lead.status] || lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{new Date(lead.last_activity_at).toLocaleDateString('es-MX')}</p>
                        <p className="text-xs text-muted-foreground">{lead.last_activity_description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {latestComments[lead.id] ? (
                        <div 
                          className="cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                          onClick={() => loadCommentsForLead(lead)}
                        >
                          <p className="text-sm line-clamp-2 max-w-[200px]">
                            {latestComments[lead.id]?.comment_text}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <History className="h-3 w-3" />
                            {new Date(latestComments[lead.id]!.created_at).toLocaleDateString('es-MX')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.reminder_date ? (
                        <Badge variant={isReminderDue(lead.reminder_date) ? 'destructive' : 'outline'}>
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(lead.reminder_date).toLocaleDateString('es-MX')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(lead)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {lead.status !== 'aceptado' && lead.status !== 'rechazado' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-green-600"
                            onClick={() => handleConvert(lead)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Lead Form Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Editar Cotización' : 'Nueva Cotización'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nombre del Fraccionamiento *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Residencial Las Palmas"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Dirección</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nombre de Contacto</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Propuesta Mensual</Label>
                  <Input
                    type="number"
                    value={formData.monthly_payment_proposed}
                    onChange={(e) => setFormData({ ...formData, monthly_payment_proposed: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="negociando">Negociando</SelectItem>
                      <SelectItem value="propuesta_enviada">Propuesta Enviada</SelectItem>
                      <SelectItem value="aceptado">Aceptado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recordatorio (Fecha)</Label>
                  <Input
                    type="date"
                    value={formData.reminder_date}
                    onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Comentarios</Label>
                  <Textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Investor Section */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Checkbox
                      id="has_investor"
                      checked={formData.has_investor}
                      onCheckedChange={(checked) => setFormData({ ...formData, has_investor: !!checked })}
                    />
                    <Label htmlFor="has_investor" className="font-medium cursor-pointer">
                      ¿Tiene Inversionista?
                    </Label>
                  </div>

                  {formData.has_investor && (
                    <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                      <div className="col-span-2">
                        <Label>Nombre del Inversionista</Label>
                        <Input
                          value={formData.investor_name}
                          onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Monto de Inversión</Label>
                        <Input
                          type="number"
                          value={formData.investor_amount}
                          onChange={(e) => setFormData({ ...formData, investor_amount: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comments History Dialog */}
        <Dialog open={showCommentsDialog} onOpenChange={setShowCommentsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Historial de Comentarios - {selectedLeadForComments?.name}
              </DialogTitle>
            </DialogHeader>
            {loadingComments ? (
              <div className="flex justify-center py-8">Cargando...</div>
            ) : leadComments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay comentarios registrados
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4 pr-4">
                  {leadComments.map((comment, index) => (
                    <div 
                      key={comment.id} 
                      className={`p-3 rounded-lg border ${index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(comment.created_at).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {index === 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">Más reciente</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            {/* Add new comment section */}
            <div className="border-t pt-4 space-y-2">
              <Label>Agregar nuevo comentario</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={3}
              />
              <Button 
                onClick={handleAddComment} 
                disabled={!newComment.trim() || savingComment}
                className="w-full gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                {savingComment ? 'Guardando...' : 'Agregar Comentario'}
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCommentsDialog(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
