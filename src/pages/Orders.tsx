import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, orderBy, updateDoc, doc, deleteDoc, serverTimestamp, addDoc } from "firebase/firestore";
import OrderInput from "../components/OrderInput";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { format, parseISO, addHours } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "../components/ui/alert-dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Calendar, MoreVertical, Trash2, CheckCircle, Clock, CalendarCheck, Merge, X, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createGoogleCalendarEvent } from "../services/calendarService";
import { mergeOrders } from "../services/geminiService";
import EditOrderDialog from "../components/EditOrderDialog";
import AppHeader from "../components/AppHeader";
import MobileMenu from "../components/MobileMenu";

function CalendarEditDialog({ order, onClose, googleToken }: { order: any, onClose: () => void, googleToken: string | null }) {
  const [summary, setSummary] = useState(`${order?.type?.toUpperCase() || ''}: ${order?.title || ''}`);
  const [description, setDescription] = useState(`${order?.description || ''}${order?.clientName ? `\n\nKunde: ${order?.clientName}` : ''}\n\nPriority: ${order?.priority || ''}`);
  
  // Format local date for datetime-local input
  const getInitialStart = () => {
    let d = new Date();
    if (order?.deadline) {
      const parsed = parseISO(order.deadline);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
        d.setHours(9, 0, 0, 0); // default 9am
      }
    }
    // offset to local time string
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const getInitialEnd = (startStr: string) => {
    const d = new Date(startStr);
    d.setHours(d.getHours() + 1); // add 1 hour
    return d.toISOString().slice(0, 16);
  };

  const [start, setStart] = useState(getInitialStart());
  const [end, setEnd] = useState(getInitialEnd(getInitialStart()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!googleToken) {
      toast.error("Kein Google Kalender Zugriff. Bitte neu einloggen.");
      return;
    }
    setIsSubmitting(true);
    try {
      const event = {
        summary,
        description,
        start: {
          dateTime: new Date(start).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: new Date(end).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      await createGoogleCalendarEvent(googleToken, event);
      toast.success("Erfolgreich im Kalender eingetragen");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Erstellen des Kalendereintrags.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-md">
        <DialogHeader>
          <DialogTitle className="text-accent-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" /> Kalendereintrag anpassen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Titel</Label>
            <Input 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Beschreibung</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-24 text-sm" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Start</Label>
              <Input 
                type="datetime-local" 
                value={start} 
                onChange={(e) => {
                  setStart(e.target.value);
                  setEnd(getInitialEnd(e.target.value));
                }} 
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs" 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Ende</Label>
              <Input 
                type="datetime-local" 
                value={end} 
                onChange={(e) => setEnd(e.target.value)} 
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs" 
              />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-accent-600 hover:bg-accent-500 font-bold mt-4">
            {isSubmitting ? "Speichert..." : "In Kalender eintragen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Orders() {
  const { user, googleToken } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailClient, setDetailClient] = useState<any>(null);
  const [calendarOrder, setCalendarOrder] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [queryState, setQueryState] = useState<any>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'aufgabe' | 'idee' | 'callback' | 'projekt'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (location.state?.filter) {
      setTypeFilter(location.state.filter);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchClient = async () => {
      if (detailOrder?.clientId) {
        try {
          const snap = await getDocs(query(collection(db, "clients"), where("__name__", "==", detailOrder.clientId)));
          if (!snap.empty) {
            setDetailClient(snap.docs[0].data());
          } else {
            setDetailClient(null);
          }
        } catch (e) {
          console.error("Error fetching client:", e);
          setDetailClient(null);
        }
      } else {
        setDetailClient(null);
      }
    };
    fetchClient();
  }, [detailOrder]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, "users", user.uid));
      let settings = {};
      if (settingsSnap.exists()) {
         settings = settingsSnap.data();
      }

      const q = query(collection(db, "orders"), where("userId", "==", user.uid));
      const qProjects = query(collection(db, "projects"), where("userId", "==", user.uid));
      const [snapshot, snapProjects] = await Promise.all([getDocs(q), getDocs(qProjects)]);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Sort in memory by createdAt desc
      data.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const dbTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return dbTime - da;
      });
      
      const pData = snapProjects.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setProjects(pData);
      
      if ((settings as any).autoArchive) {
         data = data.filter(o => {
            if (o.status !== 'completed') return true;
            if (!o.updatedAt) return true;
            const updatedDate = o.updatedAt.toDate ? o.updatedAt.toDate() : new Date(o.updatedAt);
            const daysDiff = (new Date().getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff < 30;
         });
      }

      setOrders(data);
      applyFilter(data, queryState, typeFilter, projectFilter);
    } catch (error: any) {
      console.error(error);
      toast.error("Fehler beim Laden der Aufträge: " + (error?.message || "Unbekannt"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  useEffect(() => {
    applyFilter(orders, queryState, typeFilter, projectFilter);
  }, [typeFilter, projectFilter, queryState, orders, showCompleted]);

  const applyFilter = (data: any[], qState: any, tFilter: string, pFilter: string = 'all') => {
    let result = [...data];

    if (tFilter !== 'all') {
      result = result.filter(o => o.type === tFilter);
    }
    
    if (pFilter !== 'all') {
      result = result.filter(o => o.projectId === pFilter);
    }

    if (!showCompleted) {
      result = result.filter(o => o.status !== 'completed');
    }

    if (!qState) {
      setFilteredOrders(result);
      return;
    }
    
    if (qState.filter_client) {
      result = result.filter(o => (o.clientName || "").toLowerCase().includes(qState.filter_client.toLowerCase()));
    }
    if (qState.filter_priority) {
      result = result.filter(o => o.priority === qState.filter_priority);
    }
    if (qState.filter_date_range === 'today') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(o => o.deadline && o.deadline.startsWith(today));
    } else if (qState.filter_date_range === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(o => o.deadline && o.deadline < today && o.status !== 'completed');
    }

    setFilteredOrders(result);
  };

  const handleQuery = (queryData: any) => {
    setQueryState(queryData);
  };

  const handleClearQuery = () => {
    setQueryState(null);
    setFilteredOrders(orders);
  }

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast.success("Status aktualisiert");
      fetchOrders();
    } catch (error) {
      toast.error("Status konnte nicht geändert werden");
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
      toast.success("Gelöscht");
      if (detailOrder?.id === orderId) setDetailOrder(null);
      setDeletingOrderId(null);
      fetchOrders();
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(`Fehler beim Löschen: ${error?.message || "Unbekannt"}`);
      setDeletingOrderId(null);
    }
  };

  const addToCalendar = async (order: any) => {
    if (!googleToken) {
      toast.error("Kalender Zugriff erforderlich. Bitte logge dich erneut ein.");
      return;
    }

    try {
      const startDateTime = order.deadline ? parseISO(order.deadline) : new Date();
      const endDateTime = addHours(startDateTime, 1);
      
      const event = {
        summary: `${order.type.toUpperCase()}: ${order.title}`,
        description: `${order.description}${order.clientName ? `\n\nKunde: ${order.clientName}` : ''}\n\nPriority: ${order.priority}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      await createGoogleCalendarEvent(googleToken, event);
      toast.success("In Kalender eingetragen");
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Kalender-Eintrag. Eventuell ist der Token abgelaufen.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 overflow-auto p-4 md:p-8 space-y-8 md:space-y-12">
        <section className="max-w-4xl mx-auto">
          <OrderInput onOrderCreated={fetchOrders} onQuery={handleQuery} />
        </section>

        <section className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                Alle Einträge
                {queryState && (
                  <Badge variant="secondary" className="bg-accent-500/20 text-accent-400 border-none ml-2 cursor-pointer" onClick={handleClearQuery}>
                    Filter aktiv (Klicken zum Löschen)
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-slate-600">{filteredOrders.length} Aufträge gefunden</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit flex-wrap">
                  {(['all', 'order', 'aufgabe', 'idee', 'callback', 'projekt'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setTypeFilter(tab as any)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-300",
                        typeFilter === tab 
                          ? "bg-accent-600 text-slate-900 dark:text-white shadow-md" 
                          : "text-slate-500 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {tab === 'all' ? 'Alle' : tab}
                    </button>
                  ))}
                </div>
                
                {typeFilter !== 'projekt' && (
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-[180px] bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400">
                      <SelectValue placeholder="Projekt Filter" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                      <SelectItem value="all">Alle Projekte</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {typeFilter !== 'projekt' && (
                <button 
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                    showCompleted 
                      ? "bg-accent-500/10 border-accent-500/50 text-accent-400"
                      : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:border-slate-700"
                  )}
                >
                  {showCompleted ? "Erledigte ausblenden" : "Erledigte einblenden"}
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl animate-pulse" />)}
            </div>
          ) : typeFilter === 'projekt' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div key={project.id} className="bento-card border-amber-500/20 flex flex-col transition-all hover:scale-[1.02]">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{project.name}</h3>
                      </div>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400">Projekt</Badge>
                   </div>
                   <div className="space-y-2 mb-4 flex-1">
                     {project.description && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{project.description}</p>}
                   </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="col-span-full h-40 flex items-center justify-center text-slate-500 dark:text-slate-500">
                  Keine Projekte gefunden
                </div>
              )}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bento-card border-dashed py-16 text-center">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300 dark:border-slate-700">
                <Clock className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-600 dark:text-slate-300 italic">{queryState ? "Keine Ergebnisse für diesen Filter" : "Noch keine Daten vorhanden"}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} onClick={() => setDetailOrder(order)} className="bento-card flex flex-col justify-between group min-h-[160px] cursor-pointer hover:border-slate-300 dark:border-slate-700">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex gap-2 items-center" 
                              onClick={(e) => e.stopPropagation()} 
                              onPointerDown={(e) => e.stopPropagation()}>
                         <Checkbox 
                           checked={selectedOrders.has(order.id)} 
                           onCheckedChange={() => { 
                             const next = new Set(selectedOrders); 
                             if (next.has(order.id)) next.delete(order.id); 
                             else next.add(order.id); 
                             setSelectedOrders(next);
                           }} 
                           className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-accent-500"
                         />
                         <span className={cn(
                            "w-2 h-2 rounded-full",
                            order.status === 'completed' ? 'bg-accent-500' : 
                            order.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-600'
                          )} />
                          <Badge variant="secondary" className={cn(
                            "text-[8px] uppercase font-bold px-1.5 py-0 rounded-sm border-none",
                            order.type === 'order' ? "bg-accent-500/10 text-accent-500" :
                            order.type === 'aufgabe' ? "bg-indigo-500/10 text-indigo-500" :
                            order.type === 'idee' ? "bg-blue-500/10 text-blue-500" :
                            "bg-orange-500/10 text-orange-500"
                          )}>
                            {order.type}
                          </Badge>
                       </div>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-widest py-0 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-500">
                        {order.priority}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight mb-1 truncate">{order.title}</h3>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <p className="text-xs font-semibold text-accent-400 tracking-wide">{order.clientName || 'Kein Kunde'}</p>
                      {order.projectName && (
                        <Badge variant="outline" className="text-[9px] uppercase tracking-widest py-0 border-amber-500/30 bg-amber-500/10 text-amber-400">
                          {order.projectName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 italic leading-relaxed">{order.description}</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/50">
                    <Select value={order.status} onValueChange={(val) => updateStatus(order.id, val)}>
                      <SelectTrigger className="w-[110px] h-8 bg-white dark:bg-slate-800 border-none rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="in_progress">Laufend</SelectItem>
                        <SelectItem value="completed">Fertig</SelectItem>
                        <SelectItem value="cancelled">Storno</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCalendarOrder(order); }}
                        className="text-slate-600 hover:text-blue-400 transition-colors p-2"
                        title="Kalendereintrag erstellen"
                      >
                        <CalendarCheck className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}
                        className="text-slate-600 hover:text-accent-400 transition-colors p-2"
                        title="Bearbeiten"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeletingOrderId(order.id); }}
                        className="text-slate-600 hover:text-red-400 transition-colors p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Floating Merge Action */}
      {selectedOrders.size > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bento-card flex items-center gap-4 bg-slate-100/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{selectedOrders.size} ausgewählt</p>
          <button 
            className="flex items-center gap-2 bg-accent-600 text-slate-900 dark:text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-accent-500"
            onClick={async () => {
                const toMerge = orders.filter(o => selectedOrders.has(o.id));
                toast("AI führt Zusammenführung aus...", { icon: "🧠" });
                try {
                    const mergedData = await mergeOrders(toMerge);
                    
                    // Create new merged order
                    await addDoc(collection(db, "orders"), {
                        ...mergedData,
                        clientId: toMerge[0]?.clientId || null,
                        userId: user!.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        status: 'pending'
                    });
                    
                    // Delete old orders
                    for (const order of toMerge) {
                        await deleteDoc(doc(db, "orders", order.id));
                    }
                    
                    toast.success("Erfolgreich zusammengeführt!");
                    fetchOrders();
                } catch (e) {
                    toast.error("Fehler beim Zusammenführen.");
                }
                setSelectedOrders(new Set());
            }}
          >
            <Merge className="w-4 h-4" /> Zusammenführen
          </button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-lg">
          <DialogHeader>
             <DialogTitle className="text-accent-400 font-bold uppercase tracking-wider text-sm">Auftrags-Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{detailOrder?.title}</p>
              <p className="text-accent-400 font-semibold tracking-wide">{detailClient?.name || detailOrder?.clientName}</p>
            </div>

            {detailOrder?.structured_details ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Core Task */}
                <div className="col-span-full bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                  <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1 tracking-widest">Kern-Aufgabe</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{detailOrder.structured_details.kern_aufgabe}</p>
                </div>

                {/* Next Step */}
                <div className="col-span-full bg-accent-500/5 p-4 rounded-2xl border border-accent-500/20">
                  <p className="text-[10px] uppercase font-bold text-accent-500 mb-1 tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Nächster Schritt
                  </p>
                  <p className="text-sm text-accent-50 font-bold">{detailOrder.structured_details.naechster_schritt}</p>
                </div>

                {/* Background */}
                {detailOrder.structured_details.hintergrund_info && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1 tracking-widest">Hintergrund</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{detailOrder.structured_details.hintergrund_info}</p>
                  </div>
                )}

                {/* Contacts from CRM (detailClient) */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1 tracking-widest font-mono">CRM: Klienten-Kartei</p>
                  <div className="space-y-1.5 pt-1">
                    {detailClient?.telefon && <p className="text-[11px] text-slate-600 dark:text-slate-300">📞 {detailClient.telefon}</p>}
                    {detailClient?.email && <p className="text-[11px] text-slate-600 dark:text-slate-300 underline decoration-slate-700">✉️ {detailClient.email}</p>}
                    {detailClient?.adresse && <p className="text-[11px] text-slate-600 dark:text-slate-300">📍 {detailClient.adresse}</p>}
                    {detailClient?.zahlungsinfo && <p className="text-[11px] text-accent-400 font-mono">💳 {detailClient.zahlungsinfo}</p>}
                    {!detailClient && (
                      <p className="text-[10px] text-slate-600 italic">Keine CRM-Daten verknüpft.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                 <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1 tracking-widest">Beschreibung</p>
                 <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{detailOrder?.description}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <p className="text-[9px] uppercase font-bold text-slate-600">Deadline</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{detailOrder?.deadline || '--'}</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-[9px] uppercase font-bold text-slate-600">Status</p>
                  <Badge variant="outline" className="text-[9px] py-0 h-4 border-slate-200 dark:border-slate-800 text-accent-400 capitalize">{detailOrder?.status}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-500 dark:text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                  onClick={(e) => { e.stopPropagation(); setDeletingOrderId(detailOrder.id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-500 dark:text-slate-500 hover:text-accent-400 hover:bg-accent-400/10"
                  onClick={(e) => { e.stopPropagation(); setEditingOrder(detailOrder); setDetailOrder(null); }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => { setCalendarOrder(detailOrder); setDetailOrder(null); }}
                  className="bg-accent-600 hover:bg-accent-500 font-bold h-9 text-xs"
                >
                  <CalendarCheck className="w-3.5 h-3.5 mr-2" /> Kalendereintrag
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      {editingOrder && (
        <EditOrderDialog 
          order={editingOrder} 
          onClose={() => setEditingOrder(null)} 
          onUpdated={fetchOrders}
        />
      )}
      
      <AlertDialog open={!!deletingOrderId} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
        <AlertDialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Auftrag unwiderruflich löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-slate-700 hover:text-slate-900 dark:text-white">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingOrderId && deleteOrder(deletingOrderId)} className="bg-red-600 text-slate-900 dark:text-white hover:bg-red-500">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calendar Edit Dialog */}
      {calendarOrder && (
        <CalendarEditDialog 
          order={calendarOrder} 
          onClose={() => setCalendarOrder(null)} 
          googleToken={googleToken} 
        />
      )}
    </div>
  );
}
