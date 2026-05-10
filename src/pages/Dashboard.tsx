import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, writeBatch, updateDoc, serverTimestamp } from "firebase/firestore";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Clock, ListTodo, AlertCircle, Calendar as CalendarIcon, CalendarCheck, Trash2, Edit, UserPlus, MoreVertical, Menu } from "lucide-react";
import { format, parseISO, addDays, isWithinInterval, startOfToday, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { createGoogleCalendarEvent } from "../services/calendarService";
import { cn } from "@/lib/utils";

import { Search, User } from "lucide-react";
import { Link } from "react-router-dom";
import EditOrderDialog from "../components/EditOrderDialog";
import EditClientDialog from "../components/EditClientDialog";
import MergeClientDialog from "../components/MergeClientDialog";
import AppHeader from "../components/AppHeader";
import MobileMenu from "../components/MobileMenu";

function CalendarEditDialog({ order, onClose, googleToken }: { order: any, onClose: () => void, googleToken: string | null }) {
  const [summary, setSummary] = useState(`${order?.type?.toUpperCase() || ''}: ${order?.title || ''}`);
  const [description, setDescription] = useState(`${order?.description || ''}${order?.clientName ? `\n\nKunde: ${order?.clientName}` : ''}`);
  
  const getInitialStart = () => {
    let d = new Date();
    if (order?.deadline) {
      const parsed = parseISO(order.deadline);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
        d.setHours(9, 0, 0, 0);
      }
    }
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const getInitialEnd = (startStr: string) => {
    const d = new Date(startStr);
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  };

  const [start, setStart] = useState(getInitialStart());
  const [end, setEnd] = useState(getInitialEnd(getInitialStart()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!googleToken) {
      toast.error("Kein Google Kalender Zugriff.");
      return;
    }
    setIsSubmitting(true);
    try {
      const event = {
        summary,
        description,
        start: { dateTime: new Date(start).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: new Date(end).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      };
      await createGoogleCalendarEvent(googleToken, event);
      toast.success("Eingetragen!");
      onClose();
    } catch (e) {
      toast.error("Fehler beim Kalender-Export.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-bento max-w-md">
        <DialogHeader><DialogTitle className="text-emerald-400 font-bold uppercase text-sm">Kalender anpassen</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Titel</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Beschreibung</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950 border-slate-800 h-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="datetime-local" value={start} onChange={(e) => { setStart(e.target.value); setEnd(getInitialEnd(e.target.value)); }} className="bg-slate-950 border-slate-800 text-xs" />
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-slate-950 border-slate-800 text-xs" />
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-emerald-600 font-bold">
            {isSubmitting ? "Speichert..." : "In Kalender eintragen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Header() {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-slate-950 flex items-center justify-between px-4 md:px-8 border-b border-slate-900">
      <div className="flex items-center gap-2 md:gap-4">
        <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center">
          <span className="hidden md:inline">AUFTRAGS</span><span className="md:hidden">A</span> <span className="text-emerald-400">MONITOR</span> 
          <span className="hidden md:inline text-slate-600 font-normal ml-2">| Dashboard</span>
        </h1>
      </div>
      <div className="hidden md:flex items-center bg-slate-900 px-4 py-2 rounded-full w-96 border border-slate-800">
        <Search className="w-4 h-4 text-slate-500 mr-2" />
        <input 
          type="text" 
          placeholder="Suche nach Aufträgen..." 
          className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-300 placeholder-slate-600"
        />
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-slate-200 uppercase tracking-widest">{user?.displayName?.split(' ')[0]}</p>
          <p className="text-[10px] text-emerald-400">Verbunden</p>
        </div>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="User" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-slate-700" />
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
            <User className="text-slate-400 w-4 h-4 md:w-5 md:h-5" />
          </div>
        )}
        <button className="p-2 ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors md:hidden" onClick={() => toast.info("Navigationsmenü wird bald hinzugefügt.")}>
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}

export default function Dashboard() {
  const { user, googleToken } = useAuth();
  const [stats, setStats] = useState({ total: 0, orders: 0, aufgaben: 0, ideen: 0, callbacks: 0, structure: 0 });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]); // NEU
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailClient, setDetailClient] = useState<any>(null);
  const [detailClientView, setDetailClientView] = useState<any>(null);
  const [calendarOrder, setCalendarOrder] = useState<any>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  
  const [editingClient, setEditingClient] = useState<any>(null);
  const [mergingClient, setMergingClient] = useState<any>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [viewMode, setViewMode] = useState<"orders" | "clients">("orders"); // NEU

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

  const fetchData = async () => {
    if (!user) return;
    try {
      const qOrders = query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const qClients = query(collection(db, "clients"), where("userId", "==", user.uid), orderBy("updatedAt", "desc"));
      
      const [snapOrders, snapClients] = await Promise.all([getDocs(qOrders), getDocs(qClients)]);
      
      const ordersData = snapOrders.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const clientsData = snapClients.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const counts = ordersData.reduce((acc: any, curr: any) => {
        acc.total++;
        if (curr.type === 'order') acc.orders++;
        else if (curr.type === 'aufgabe') acc.aufgaben++;
        else if (curr.type === 'idee') acc.ideen++;
        else if (curr.type === 'callback') acc.callbacks++;
        else if (curr.type === 'structure') acc.structure++;
        return acc;
      }, { total: 0, orders: 0, aufgaben: 0, ideen: 0, callbacks: 0, structure: 0 });

      setStats(counts);
      setRecentEntries(ordersData);
      setClients(clientsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
      toast.success("Eintrag gelöscht");
      setDetailOrder(null);
      setDeletingOrderId(null);
      fetchData();
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(`Fehler beim Löschen: ${error?.message || "Unbekannt"}`);
      setDeletingOrderId(null);
    }
  };

  const toggleComplete = async (orderId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, "orders", orderId), { status: nextStatus, updatedAt: serverTimestamp() });
      toast.success(nextStatus === 'completed' ? "Erledigt!" : "Wieder offen");
      fetchData();
      if (detailOrder && detailOrder.id === orderId) {
        setDetailOrder({ ...detailOrder, status: nextStatus });
      }
    } catch (e) {
      toast.error("Status konnte nicht geändert werden.");
    }
  };

  const deleteClient = async (clientId: string) => {
    try {
      await deleteDoc(doc(db, "clients", clientId));
      toast.success("Kunde gelöscht. Hinweis: Zugehörige Aufträge wurden nicht gelöscht.");
      setDeletingClientId(null);
      fetchData();
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(`Fehler beim Löschen: ${error?.message || "Unbekannt"}`);
      setDeletingClientId(null);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Lade Dashboard...</div>;

  const callbacks = recentEntries.filter(e => e.type === 'callback' && e.status !== 'completed');
  const structure = recentEntries.filter(e => e.type === 'structure' || e.type === 'idee');
  const aufgaben = recentEntries.filter(e => e.type === 'aufgabe');
  const orders = recentEntries.filter(e => e.type === 'order');

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      <AppHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
      
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="p-4 md:p-6 flex flex-col gap-4 md:gap-6 flex-1 overflow-auto md:overflow-hidden">
        <div className="flex bg-slate-900/50 border border-slate-800 p-1 rounded-2xl w-full md:w-fit mx-auto md:mx-0 shrink-0">
          <button 
            onClick={() => setViewMode('orders')} 
            className={cn("flex-1 md:flex-none px-6 md:px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all", viewMode === 'orders' ? "bg-emerald-500/10 text-emerald-400" : "text-slate-500 hover:text-slate-300")}
          >
            Aufträge
          </button>
          <button 
            onClick={() => setViewMode('clients')} 
            className={cn("flex-1 md:flex-none px-6 md:px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all", viewMode === 'clients' ? "bg-blue-500/10 text-blue-400" : "text-slate-500 hover:text-slate-300")}
          >
            Kunden
          </button>
        </div>

        {viewMode === 'orders' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 md:overflow-auto pb-6">
        {/* Bento: New Item Action */}
        <div className="col-span-1 md:col-span-4 bento-card flex flex-row items-center justify-center p-5 md:p-6 bg-blue-500/5 border-blue-500/20">
          <Link to="/orders" className="w-full max-w-sm py-4 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-500 transition-all text-center shadow-xl">
            ERFASSUNG
          </Link>
        </div>

        {/* Bento: Stats Row */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-1 bento-gradient flex flex-col justify-between p-5 md:p-6">
          <div>
            <h3 className="text-emerald-400 font-semibold mb-1 uppercase text-xs tracking-wider">Übersicht</h3>
            <p className="text-2xl font-light text-white italic">Alles im Griff.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <Link to="/orders" state={{ filter: 'order' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-emerald-400 transition-colors">Aufträge</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.orders}</p>
            </Link>
            <Link to="/orders" state={{ filter: 'aufgabe' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-amber-400 transition-colors">KI-Tasks</p>
              <p className="text-2xl font-bold text-amber-400">{stats.aufgaben}</p>
            </Link>
            <Link to="/orders" state={{ filter: 'idee' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Ideen</p>
              <p className="text-2xl font-bold text-blue-400">{stats.ideen}</p>
            </Link>
            <Link to="/orders" state={{ filter: 'callback' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-orange-400 transition-colors">Rückrufe</p>
              <p className="text-2xl font-bold text-orange-400">{stats.callbacks}</p>
            </Link>
            <Link to="/orders" state={{ filter: 'structure' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-indigo-400 transition-colors">Struktur</p>
              <p className="text-2xl font-bold text-indigo-400">{stats.structure}</p>
            </Link>
            <Link to="/orders" state={{ filter: 'all' }} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all group border-dashed">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-white transition-colors">Gesamt</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </Link>
          </div>
        </div>

        {/* Bento: Urgent Callbacks */}
        <div className="col-span-1 row-span-1 bento-card border-orange-500/20 p-5 md:p-6">
          <h3 className="text-orange-400 font-semibold mb-4 uppercase text-xs tracking-wider flex items-center gap-2">
            <Clock className="w-3 h-3" /> Rückrufe
          </h3>
          <div className="space-y-3">
            {callbacks.length > 0 ? callbacks.slice(0, 2).map(cb => (
                <div key={cb.id} className="flex items-center gap-3 bg-slate-800/20 p-2 rounded-lg border border-slate-800 cursor-pointer hover:bg-slate-800/40 group" onClick={() => setDetailOrder(cb)}>
                <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-[10px] shrink-0">
                  📞
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate text-slate-200">{cb.clientName || 'Unbekannt'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{cb.title}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleComplete(cb.id, cb.status); }}
                  className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all text-slate-600 hover:text-emerald-500"
                >
                  <CheckCircle2 className="w-3 h-3" />
                </button>
              </div>
            )) : (
              <p className="text-[10px] text-slate-600 italic text-center py-4">Keine Rückrufe offen.</p>
            )}
          </div>
        </div>

        {/* Bento: Neue Aufgaben Area */}
        <div className="col-span-1 row-span-1 bento-card flex flex-col p-5 md:p-6 border-emerald-500/20 overflow-auto">
          <h3 className="text-emerald-400 font-semibold mb-4 uppercase text-xs tracking-wider flex items-center gap-2">
            <ListTodo className="w-3 h-3" /> Aufgaben (KI)
          </h3>
          <div className="space-y-3">
            {aufgaben.length > 0 ? aufgaben.map(aufgabe => (
              <div key={aufgabe.id} className="flex items-center justify-between bg-slate-800/20 p-2 rounded-lg border border-slate-800 cursor-pointer hover:bg-slate-800/40 group" onClick={() => setDetailOrder(aufgabe)}>
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleComplete(aufgabe.id, aufgabe.status); }}
                    className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                      aufgabe.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-slate-950" : "border-slate-700 text-transparent hover:border-emerald-500/50 hover:text-emerald-500"
                    )}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                  </button>
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold truncate", aufgabe.status === 'completed' ? "text-slate-500 line-through" : "text-slate-200")}>{aufgabe.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{aufgabe.clientName || 'Intern'}</p>
                  </div>
                </div>
                {aufgabe.deadline && (
                  <div className="text-[10px] text-emerald-400 whitespace-nowrap bg-emerald-400/10 px-2 py-1 rounded">
                    {format(parseISO(aufgabe.deadline), 'dd.MM')}
                  </div>
                )}
              </div>
            )) : (
              <p className="text-[10px] text-slate-600 italic text-center py-4">Keine KI-Aufgaben vorhanden.</p>
            )}
          </div>
        </div>

        {/* Bento: Active Orders Table */}
         <div className="col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 bento-card p-0 flex flex-col overflow-hidden min-h-[300px]">
          <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-emerald-400" /> Aktive Projekte
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 border-b border-slate-800 uppercase tracking-widest sticky top-0 bg-slate-900">
                <tr>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Thema</th>
                  <th className="px-6 py-3 font-semibold text-right">Frist</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {orders.map((order) => (
                  <tr 
                    key={order.id} 
                    onClick={() => setDetailOrder(order)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-slate-200 underline decoration-emerald-500/30 underline-offset-8 truncate max-w-[120px]">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleComplete(order.id, order.status); }}
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                            order.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-slate-950" : "border-slate-700 text-transparent hover:border-emerald-500/50 hover:text-emerald-500"
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <span className={cn(order.status === 'completed' && "text-slate-500 line-through")}>
                          {order.clientName}
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-6 py-4 text-slate-400 truncate max-w-[200px]", order.status === 'completed' && "text-slate-600 line-through")}>
                      {order.title}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 text-xs font-mono">
                      {order.deadline ? format(parseISO(order.deadline), 'dd.MM') : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bento: 3-Day Calendar */}
        <div className="col-span-1 lg:row-span-2 bento-card p-0 flex flex-col overflow-hidden border-emerald-500/20 min-h-[300px]">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-emerald-400 font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
              <CalendarIcon className="w-3 h-3" /> Nächste 3 Tage
            </h3>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            {recentEntries.filter(e => e.deadline && isWithinInterval(parseISO(e.deadline), { start: startOfToday(), end: endOfDay(addDays(startOfToday(), 3)) })).length > 0 ? 
              recentEntries.filter(e => e.deadline && isWithinInterval(parseISO(e.deadline), { start: startOfToday(), end: endOfDay(addDays(startOfToday(), 3)) })).map(s => (
              <div 
                key={s.id} 
                onClick={() => setDetailOrder(s)}
                className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-colors group"
              >
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-bold text-emerald-300 mb-1">{format(parseISO(s.deadline), 'dd.MM')}</p>
                  <CalendarCheck className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs font-bold text-slate-200">{s.title}</p>
                <p className="text-[10px] text-slate-500 line-clamp-1 italic">{s.clientName}</p>
              </div>
            )) : (
              <p className="text-[10px] text-slate-600 italic text-center py-8">Keine Aufgaben in den nächsten 3 Tagen.</p>
            )}
          </div>
        </div>

        {/* Bento: Structure / Tasks */}
        <div className="col-span-1 lg:row-span-2 bento-card p-0 flex flex-col overflow-hidden border-slate-500/20 min-h-[300px]">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-slate-400 font-semibold uppercase text-xs tracking-wider flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Sonstiges (Ideen)
            </h3>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            {structure.length > 0 ? structure.map(s => (
              <div 
                key={s.id} 
                onClick={() => setDetailOrder(s)}
                className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-500/40 transition-colors"
              >
                <p className="text-xs font-bold text-slate-200 mb-1">{s.title}</p>
                <p className="text-[10px] text-slate-500 line-clamp-2 italic">{s.description}</p>
              </div>
            )) : (
              <p className="text-[10px] text-slate-600 italic text-center py-8">Keine unkategorisierten Ideen.</p>
            )}
          </div>
        </div>
        </div>
        ) : (
          detailClientView ? (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                 <button 
                   onClick={() => setDetailClientView(null)}
                   className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-tight"
                 >
                   ← Alle Kunden 
                 </button>
                 <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-blue-400" onClick={() => setEditingClient(detailClientView)}>
                       <Edit className="w-3 h-3 mr-1" /> Bearbeiten
                    </Button>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Card Profile */}
                 <div className="lg:col-span-1 bento-card p-6 border-blue-500/20">
                    <div className="mb-6">
                       <h3 className="text-2xl font-bold text-white mb-1">{detailClientView.name}</h3>
                       {detailClientView.aliases && detailClientView.aliases.length > 0 && (
                         <div className="flex flex-wrap gap-2 mt-2">
                           {detailClientView.aliases.map((a: string) => (
                             <Badge key={a} variant="secondary" className="bg-slate-800 text-[10px] text-slate-400 border-none">{a}</Badge>
                           ))}
                         </div>
                       )}
                    </div>
                    
                    <div className="space-y-4">
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kontakt</p>
                          {detailClientView.telefon && <p className="text-sm text-slate-300">📞 {detailClientView.telefon}</p>}
                          {detailClientView.email && <p className="text-sm text-slate-300">✉️ {detailClientView.email}</p>}
                          {detailClientView.adresse && <p className="text-sm text-slate-300">📍 {detailClientView.adresse}</p>}
                       </div>
                       
                       {detailClientView.zahlungsinfo && (
                         <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zahlungsinfo</p>
                            <p className="text-sm text-emerald-400 font-mono">💳 {detailClientView.zahlungsinfo}</p>
                         </div>
                       )}

                       {detailClientView.insights && (
                         <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Stimmungs-Radar</p>
                            <p className="text-xs text-slate-400 italic">{detailClientView.insights}</p>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Open Tasks for Client */}
                 <div className="lg:col-span-2 bento-card p-6 border-blue-500/10 flex flex-col min-h-[400px]">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                       <ListTodo className="w-4 h-4 text-blue-400" /> Offene Einträge
                    </h3>
                    
                    <div className="space-y-3">
                       {recentEntries.filter(o => {
                         const isLinkedById = o.clientId === detailClientView.id;
                         const isLinkedByName = o.clientName?.toLowerCase().includes(detailClientView.name.toLowerCase());
                         const isLinkedByAlias = detailClientView.aliases?.some((a: string) => o.clientName?.toLowerCase().includes(a.toLowerCase()));
                         return (isLinkedById || isLinkedByName || isLinkedByAlias) && o.status !== 'completed';
                       }).length > 0 ? (
                         recentEntries.filter(o => {
                           const isLinkedById = o.clientId === detailClientView.id;
                           const isLinkedByName = o.clientName?.toLowerCase().includes(detailClientView.name.toLowerCase());
                           const isLinkedByAlias = detailClientView.aliases?.some((a: string) => o.clientName?.toLowerCase().includes(a.toLowerCase()));
                           return (isLinkedById || isLinkedByName || isLinkedByAlias) && o.status !== 'completed';
                         }).map(order => (
                           <div key={order.id} className="flex items-center justify-between bg-slate-800/30 p-4 rounded-xl border border-slate-800/50 hover:border-blue-500/30 transition-all cursor-pointer group" onClick={() => setDetailOrder(order)}>
                              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); toggleComplete(order.id, order.status); }}
                                    className="w-6 h-6 rounded-md border border-slate-700 flex items-center justify-center hover:bg-emerald-500/20 hover:border-emerald-500 transition-all text-transparent hover:text-emerald-500"
                                 >
                                    <CheckCircle2 className="w-4 h-4" />
                                 </button>
                                 <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate">{order.title}</h4>
                                    <p className="text-xs text-slate-500 truncate">{order.description}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                 <Badge variant="outline" className="text-[9px] uppercase border-slate-800 text-slate-500">
                                    {order.type}
                                 </Badge>
                                 {order.deadline && (
                                   <div className="text-[10px] font-mono text-slate-500">
                                      {format(parseISO(order.deadline), 'dd.MM')}
                                   </div>
                                 )}
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2 border-2 border-dashed border-slate-800 rounded-2xl p-8">
                            <CheckCircle2 className="w-8 h-8 opacity-20" />
                            <p className="text-xs italic">Keine offenen Aufgaben für diesen Kunden.</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-auto pb-6">
            {clients.map(client => (
              <div key={client.id} className="bento-card border-blue-500/20 flex flex-col cursor-pointer transition-all hover:scale-[1.02]" onClick={() => setDetailClientView(client)}>
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{client.name}</h3>
                      {client.aliases && client.aliases.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 italic">
                          Aliase: {client.aliases.join(", ")}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                      Client
                    </Badge>
                 </div>
                 
                 <div className="space-y-2 mb-4 flex-1">
                    {client.telefon && (
                      <p className="text-xs text-slate-300 flex items-center gap-2">
                        📞 {client.telefon}
                      </p>
                    )}
                    {client.email && (
                      <p className="text-xs text-slate-300 flex items-center gap-2">
                        ✉️ {client.email}
                      </p>
                    )}
                    {client.adresse && (
                      <p className="text-xs text-slate-300 flex items-center gap-2 text-wrap">
                        📍 {client.adresse}
                      </p>
                    )}
                 </div>

                 {client.insights ? (
                   <div className="mt-auto bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                     <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Stimmungs-Radar</p>
                     <p className="text-xs text-slate-400 italic line-clamp-3">{client.insights}</p>
                   </div>
                 ) : (
                   <div className="mt-auto bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                     <p className="text-[10px] text-slate-600 italic">Noch keine Insights gesammelt.</p>
                   </div>
                 )}

                 <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800/50">
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-8 text-xs text-slate-500 hover:text-red-400 hover:bg-red-400/10 px-2"
                     onClick={(e) => { e.stopPropagation(); setDeletingClientId(client.id); }}
                   >
                     <Trash2 className="w-3 h-3 mr-1" /> Löschen
                   </Button>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-8 text-xs text-slate-500 hover:text-orange-400 hover:bg-orange-400/10 px-2"
                     onClick={(e) => { e.stopPropagation(); setMergingClient(client); }}
                   >
                     <UserPlus className="w-3 h-3 mr-1" /> Merge
                   </Button>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-8 text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 px-2"
                     onClick={(e) => { e.stopPropagation(); setEditingClient(client); }}
                   >
                     <Edit className="w-3 h-3 mr-1" /> Bearbeiten
                   </Button>
                 </div>
              </div>
            ))}
            {clients.length === 0 && (
              <div className="col-span-full h-40 flex items-center justify-center text-slate-500">
                Keine Kunden gefunden
              </div>
            )}
          </div>
        )
      )}

        {/* Detail Dialog */}
        <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-bento max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 font-bold uppercase tracking-wider text-sm">Auftrags-Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold text-white leading-tight">{detailOrder?.title}</p>
                  <p className="text-emerald-400 font-semibold tracking-wide">{detailClient?.name || detailOrder?.clientName}</p>
                </div>
                <Button 
                  size="sm"
                  variant="outline"
                  className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white gap-2 h-9"
                  onClick={() => { setCalendarOrder(detailOrder); setDetailOrder(null); }}
                >
                  <CalendarCheck className="w-4 h-4" /> Kalender
                </Button>
              </div>

              {detailOrder?.structured_details ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="col-span-full bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-widest">Kern-Aufgabe</p>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">{detailOrder.structured_details.kern_aufgabe}</p>
                  </div>
                  <div className="col-span-full bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                    <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1 tracking-widest flex items-center gap-2">
                       <Clock className="w-3 h-3" /> Nächster Schritt
                    </p>
                    <p className="text-sm text-emerald-50 font-bold">{detailOrder.structured_details.naechster_schritt}</p>
                  </div>
                  {detailOrder.structured_details.hintergrund_info && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-widest">Hintergrund</p>
                      <p className="text-xs text-slate-400 leading-normal">{detailOrder.structured_details.hintergrund_info}</p>
                    </div>
                  )}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-widest font-mono">CRM: Klienten-Kartei</p>
                    <div className="space-y-1.5 pt-1">
                      {detailClient?.telefon && <p className="text-[11px] text-slate-300">📞 {detailClient.telefon}</p>}
                      {detailClient?.email && <p className="text-[11px] text-slate-300 truncate font-medium">✉️ {detailClient.email}</p>}
                      {detailClient?.adresse && <p className="text-[11px] text-slate-300">📍 {detailClient.adresse}</p>}
                      {detailClient?.zahlungsinfo && <p className="text-[11px] text-emerald-400 font-mono">💳 {detailClient.zahlungsinfo}</p>}
                      {!detailClient && (
                         <p className="text-[10px] text-slate-600 italic">Keine CRM-Daten verknüpft.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                   <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-widest">Beschreibung</p>
                   <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{detailOrder?.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <p className="text-[9px] uppercase font-bold text-slate-600">Deadline</p>
                    <p className="text-xs text-slate-300 font-medium">{detailOrder?.deadline || '--'}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[9px] uppercase font-bold text-slate-600">Status</p>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-slate-800 text-emerald-400 capitalize">{detailOrder?.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                    onClick={(e) => { e.stopPropagation(); setDeletingOrderId(detailOrder.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10"
                    onClick={(e) => { e.stopPropagation(); setEditingOrder(detailOrder); setDetailOrder(null); }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                    <Button 
                      size="sm"
                      className={cn(
                        "font-bold h-9 text-xs transition-all",
                        detailOrder?.status === 'completed' ? "bg-slate-700 text-slate-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      )}
                      onClick={() => toggleComplete(detailOrder.id, detailOrder.status)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> 
                      {detailOrder?.status === 'completed' ? "Erledigt" : "Abschließen"}
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white font-bold h-9 text-xs"
                      onClick={() => { setCalendarOrder(detailOrder); setDetailOrder(null); }}
                    >
                      <CalendarCheck className="w-3.5 h-3.5 mr-2" /> Kalender
                    </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingOrderId} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
          <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Auftrag unwiderruflich löschen?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel variant="outline" size="default" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white">Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingOrderId && deleteOrder(deletingOrderId)} className="bg-red-600 text-white hover:bg-red-500">Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        {editingOrder && (
          <EditOrderDialog 
            order={editingOrder} 
            onClose={() => setEditingOrder(null)} 
            onUpdated={fetchData}
          />
        )}

        {/* Client Dialogs */}
        {editingClient && (
          <EditClientDialog 
            client={editingClient}
            onClose={() => setEditingClient(null)}
            onUpdated={fetchData}
          />
        )}

        {mergingClient && (
          <MergeClientDialog
            client={mergingClient}
            allClients={clients}
            onClose={() => setMergingClient(null)}
            onUpdated={fetchData}
          />
        )}

        <AlertDialog open={!!deletingClientId} onOpenChange={(open) => !open && setDeletingClientId(null)}>
          <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Kunde löschen?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Möchtest du dieses Kundenprofil wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden, Aufträge bleiben jedoch ohne Profilzuweisung bestehen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel variant="outline" size="default" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white">Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingClientId && deleteClient(deletingClientId)} className="bg-red-600 text-white hover:bg-red-500">Kunde löschen</AlertDialogAction>
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

      </main>
    </div>
  );
}
