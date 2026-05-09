import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, updateDoc, doc, deleteDoc } from "firebase/firestore";
import OrderInput from "../components/OrderInput";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { format, parseISO } from "date-fns";
import { Calendar, MoreVertical, Trash2, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Laden der Aufträge.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus, updatedAt: new Date().toISOString() });
      toast.success("Status aktualisiert");
      fetchOrders();
    } catch (error) {
      toast.error("Status konnte nicht geändert werden");
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("Auftrag wirklich löschen?")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      toast.success("Gelöscht");
      fetchOrders();
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <header className="h-16 bg-slate-950 flex items-center justify-between px-8 border-b border-slate-900 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white uppercase">VERWALTUNG</h1>
        <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <p className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Data Secure</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 space-y-12">
        <section className="max-w-4xl mx-auto">
          <OrderInput onOrderCreated={fetchOrders} />
        </section>

        <section className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alle Einträge</h2>
            <p className="text-xs text-slate-600">{orders.length} Aufträge gefunden</p>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="bento-card border-dashed py-16 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <Clock className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="font-semibold text-slate-300 italic">Noch keine Daten vorhanden</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {orders.map((order) => (
                <div key={order.id} className="bento-card flex flex-col justify-between group min-h-[160px]">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                       <span className={cn(
                        "w-2 h-2 rounded-full mt-2",
                        order.status === 'completed' ? 'bg-emerald-500' : 
                        order.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-600'
                      )} />
                      <Badge variant="outline" className="text-[9px] uppercase tracking-widest py-0 border-slate-800 bg-slate-950 text-slate-500">
                        {order.priority}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-slate-100 text-lg leading-tight mb-1 truncate">{order.title}</h3>
                    <p className="text-xs font-semibold text-emerald-400 mb-3 tracking-wide">{order.client}</p>
                    <p className="text-xs text-slate-500 line-clamp-2 italic leading-relaxed">{order.description}</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/50">
                    <Select value={order.status} onValueChange={(val) => updateStatus(order.id, val)}>
                      <SelectTrigger className="w-[110px] h-8 bg-slate-800 border-none rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-300">
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="in_progress">Laufend</SelectItem>
                        <SelectItem value="completed">Fertig</SelectItem>
                        <SelectItem value="cancelled">Storno</SelectItem>
                      </SelectContent>
                    </Select>
                    <button 
                      onClick={() => deleteOrder(order.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
