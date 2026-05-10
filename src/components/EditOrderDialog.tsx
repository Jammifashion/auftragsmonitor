import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "sonner";
import { useAuth } from "../AuthContext";
import { Search, User, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EditOrderDialog({ order, onClose, onUpdated }: { order: any, onClose: () => void, onUpdated?: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(order.title || "");
  const [description, setDescription] = useState(order.description || "");
  const [clientName, setClientName] = useState(order.clientName || "");
  const [clientId, setClientId] = useState(order.clientId || "");
  const [type, setType] = useState(order.type || "order");
  const [status, setStatus] = useState(order.status || "pending");
  const [priority, setPriority] = useState(order.priority || "medium");
  const [isSaving, setIsSaving] = useState(false);

  const [allClients, setAllClients] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientSearch, setClientSearch] = useState(order.clientName || "");

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "clients"), where("userId", "==", user.uid), orderBy("name"));
        const snap = await getDocs(q);
        setAllClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching clients:", e);
      }
    };
    fetchClients();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        title,
        description,
        clientName,
        clientId,
        type,
        status,
        priority,
        updatedAt: serverTimestamp()
      });
      toast.success("Änderungen gespeichert");
      onUpdated?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClients = allClients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.aliases?.some((a: string) => a.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-white">Auftrag bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label className="text-slate-400">Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-950 border-slate-800 text-white" />
          </div>

          <div className="grid gap-2 relative">
            <Label className="text-slate-400">Kunde / Firma</Label>
            <div className="relative">
              <Input 
                value={clientSearch} 
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientName(e.target.value);
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                className="bg-slate-950 border-slate-800 pr-10 text-white"
                placeholder="Name suchen oder neu eingeben..."
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              
              {showClientSuggestions && (clientSearch.length > 0 || allClients.length > 0) && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-h-[200px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    {filteredClients.length > 0 ? (
                      filteredClients.map(client => (
                        <button
                          key={client.id}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 rounded-md transition-colors flex items-center justify-between group"
                          onClick={() => {
                            setClientName(client.name);
                            setClientSearch(client.name);
                            setClientId(client.id);
                            setShowClientSuggestions(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 group-hover:text-blue-400">{client.name}</span>
                            {client.aliases && client.aliases.length > 0 && (
                              <span className="text-[10px] text-slate-500 italic truncate max-w-[200px]">
                                {client.aliases.join(", ")}
                              </span>
                            )}
                          </div>
                          {clientId === client.id && <Check className="w-3 h-3 text-emerald-500" />}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-[10px] text-slate-500 italic">Keine Treffer - wird als neuer Kundenname gespeichert</p>
                    )}
                    <div className="border-t border-slate-800 my-1 pb-1">
                       <button
                         className="w-full text-left px-3 py-2 text-[10px] text-blue-400 font-bold hover:bg-slate-800 rounded-md"
                         onClick={() => setShowClientSuggestions(false)}
                       >
                         Eingabe übernehmen
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {showClientSuggestions && (
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setShowClientSuggestions(false)}
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-slate-400">Beschreibung</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="bg-slate-950 border-slate-800 min-h-[150px] md:resize-y text-sm text-slate-300" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-slate-400">Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="order">Kunde (Order)</SelectItem>
                  <SelectItem value="aufgabe">Aufgabe (KI)</SelectItem>
                  <SelectItem value="idee">Idee / Sonstiges</SelectItem>
                  <SelectItem value="callback">Rückruf</SelectItem>
                  <SelectItem value="structure">Struktur / Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-400">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="pending">Offen</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="hover:bg-slate-800 hover:text-white border border-slate-800">Abbrechen</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8">
            {isSaving ? "Speichert..." : "Änderungen Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

