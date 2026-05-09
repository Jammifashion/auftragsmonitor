import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Clock, ListTodo, AlertCircle } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";

import { Search, User } from "lucide-react";
import { Link } from "react-router-dom";

function Header() {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-slate-950 flex items-center justify-between px-8 border-b border-slate-900">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-white">
          AUFTRAGS <span className="text-emerald-400">MONITOR</span> 
          <span className="text-slate-600 font-normal ml-2">| Dashboard</span>
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
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-bold text-slate-200 uppercase tracking-widest">{user?.displayName?.split(' ')[0]}</p>
          <p className="text-[10px] text-emerald-400">Verbunden</p>
        </div>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border-2 border-slate-700" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
            <User className="text-slate-400 w-5 h-5" />
          </div>
        )}
      </div>
    </header>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, urgent: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const q = query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const urgent = data.filter((o: any) => o.status !== 'completed' && o.deadline && isAfter(now, parseISO(o.deadline)));

        setStats({
          total: data.length,
          pending: data.filter((o: any) => o.status === 'pending').length,
          inProgress: data.filter((o: any) => o.status === 'in_progress').length,
          urgent: urgent.length
        });

        setRecentOrders(data.slice(0, 5));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Lade Dashboard...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      <Header />
      
      <main className="p-6 grid grid-cols-4 gap-6 flex-1 overflow-auto">
        {/* Bento: Stats Row */}
        <div className="col-span-2 row-span-1 bento-gradient flex flex-col justify-between">
          <div>
            <h3 className="text-emerald-400 font-semibold mb-1 uppercase text-xs tracking-wider">Status Übersicht</h3>
            <p className="text-2xl font-light text-white">Deine aktuelle Performance</p>
          </div>
          <div className="flex items-end gap-4 mt-6">
            <div className="flex-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Offen</p>
              <p className="text-3xl font-bold text-emerald-400">{stats.pending}</p>
            </div>
            <div className="flex-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Gesamt</p>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Bento: Urgent Deadlines */}
        <div className="col-span-1 row-span-1 bento-card">
          <h3 className="text-orange-400 font-semibold mb-4 uppercase text-xs tracking-wider">Wichtig</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                {stats.urgent}
              </div>
              <div>
                <p className="text-sm font-semibold">Überfällig</p>
                <p className="text-[11px] text-slate-500">Sofort prüfen</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bento: Quick Action */}
        <div className="col-span-1 row-span-1 bento-card flex flex-col justify-between">
          <h3 className="text-blue-400 font-semibold mb-4 uppercase text-xs tracking-wider">Aktion</h3>
          <Link to="/orders" className="w-full py-3 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-emerald-400 transition-all text-center shadow-lg shadow-emerald-500/20">
            NEUER AUFTRAG
          </Link>
        </div>

        {/* Bento: Active Orders Table */}
        <div className="col-span-3 row-span-2 bento-card p-0 flex flex-col overflow-hidden">
          <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-white font-bold">Aktive Aufträge</h3>
            <div className="flex gap-2 text-[10px] uppercase font-bold">
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md">Realtime</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 border-b border-slate-800 uppercase tracking-widest sticky top-0 bg-slate-900">
                <tr>
                  <th className="px-6 py-3 font-semibold">Auftraggeber</th>
                  <th className="px-6 py-3 font-semibold">Titel</th>
                  <th className="px-6 py-3 font-semibold text-right">Frist</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-200 underline decoration-emerald-500/30 underline-offset-4 truncate max-w-[120px]">
                      {order.client}
                    </td>
                    <td className="px-6 py-4 text-slate-400 truncate max-w-[200px]">
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

        {/* Bento: Context Insight */}
        <div className="col-span-1 row-span-2 bg-emerald-950/10 rounded-bento p-6 border border-emerald-900/30 flex flex-col">
          <h3 className="text-emerald-400 font-semibold mb-4 uppercase text-xs tracking-wider">AI Insight</h3>
          <div className="bg-slate-900/60 rounded-2xl p-4 border border-emerald-500/10 mb-4 backdrop-blur-sm">
            <p className="text-[10px] text-emerald-500 font-bold mb-2 tracking-widest uppercase">System Status</p>
            <p className="text-xs text-slate-300 leading-relaxed italic mb-3 text-pretty">
              Der KI-Kontext wird automatisch bei jeder Eingabe aktualisiert.
            </p>
          </div>
          <div className="mt-auto">
            <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 flex flex-col gap-2">
              <p className="text-[10px] text-slate-500 font-bold">AUSLASTUNG</p>
              <div className="flex gap-1 items-end h-8">
                {[4, 2, 7, 3, 8, 5, 8].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-500/50" style={{ height: `${h * 10}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
