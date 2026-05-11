import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { db } from "../lib/firebase";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "../AuthContext";

export default function MergeClientDialog({ 
  client, 
  allClients, 
  onClose, 
  onUpdated 
}: { 
  client: any, 
  allClients: any[], 
  onClose: () => void, 
  onUpdated: () => void 
}) {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [leadingClientId, setLeadingClientId] = useState(client.id); // default to the one clicked
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherClients = allClients.filter(c => c.id !== client.id);
  const selectedSecondary = allClients.find(c => c.id === selectedClientId);

  const handleSubmit = async () => {
    if (!selectedSecondary || !user) return;
    
    setIsSubmitting(true);
    try {
      const isCurrentLeading = leadingClientId === client.id;
      
      const primaryDocId = isCurrentLeading ? client.id : selectedSecondary.id;
      const primaryDocName = isCurrentLeading ? client.name : selectedSecondary.name;
      const primaryAliases = isCurrentLeading ? (client.aliases || []) : (selectedSecondary.aliases || []);
      
      const secondaryDocId = isCurrentLeading ? selectedSecondary.id : client.id;
      const secondaryDocName = isCurrentLeading ? selectedSecondary.name : client.name;
      const secondaryAliases = isCurrentLeading ? (selectedSecondary.aliases || []) : (client.aliases || []);
      
      // Update orders
      const qOrders = query(collection(db, "orders"), where("userId", "==", user.uid), where("clientId", "==", secondaryDocId));
      const snapOrders = await getDocs(qOrders);
      
      const batch = writeBatch(db);
      snapOrders.docs.forEach(docSnap => batch.update(docSnap.ref, { 
        clientId: primaryDocId, 
        clientName: primaryDocName,
        updatedAt: serverTimestamp() 
      }));
      
      // Merge aliases
      const newAliases = Array.from(new Set([...primaryAliases, ...secondaryAliases, secondaryDocName]));
      
      const primaryRef = doc(db, "clients", primaryDocId);
      batch.update(primaryRef, { 
        aliases: newAliases,
        updatedAt: serverTimestamp() 
      });
      
      const secondaryRef = doc(db, "clients", secondaryDocId);
      batch.delete(secondaryRef);
      
      await batch.commit();

      toast.success("Kunden erfolgreich zusammengeführt.");
      onUpdated();
      onClose();
    } catch (error: any) {
      toast.error("Fehler beim Zusammenführen.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-md">
        <DialogHeader>
          <DialogTitle className="text-orange-400 font-bold uppercase tracking-wider text-sm">Kunden zusammenführen</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs pt-1">
             Verschmilzt {client.name} mit einem anderen Eintrag. Aufträge werden umgeschrieben, Aliase kombiniert.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Mit wem soll "{client.name}" verbunden werden?</Label>
            <select 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-sm text-slate-800 dark:text-slate-200"
              value={selectedClientId}
              onChange={(e) => {
                 setSelectedClientId(e.target.value);
                 // Reset leading selection when changing the other client
                 if (leadingClientId === selectedSecondary?.id) {
                    setLeadingClientId(e.target.value);
                 }
              }}
            >
              <option value="">-- Bitte wählen --</option>
              {otherClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.telefon ? `(${c.telefon})` : ''}</option>
              ))}
            </select>
          </div>

          {selectedSecondary && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Welcher Eintrag ist der <strong>führende Name</strong> (Haupt-Profil)?</Label>
              
              <div 
                 className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${leadingClientId === client.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'}`}
                 onClick={() => setLeadingClientId(client.id)}
              >
                  <input type="radio" checked={leadingClientId === client.id} onChange={() => setLeadingClientId(client.id)} />
                  <div className="flex flex-col">
                    <p className="text-sm font-bold text-slate-900 dark:text-white max-w-[280px] break-words">{client.name}</p>
                    <span className="text-[10px] text-slate-500 dark:text-slate-500">
                      {client.email || ''} {client.telefon || ''}
                    </span>
                  </div>
              </div>

              <div 
                 className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${leadingClientId === selectedSecondary.id ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'}`}
                 onClick={() => setLeadingClientId(selectedSecondary.id)}
              >
                  <input type="radio" checked={leadingClientId === selectedSecondary.id} onChange={() => setLeadingClientId(selectedSecondary.id)} />
                  <div className="flex flex-col">
                    <p className="text-sm font-bold text-slate-900 dark:text-white max-w-[280px] break-words">{selectedSecondary.name}</p>
                    <span className="text-[10px] text-slate-500 dark:text-slate-500">
                      {selectedSecondary.email || ''} {selectedSecondary.telefon || ''}
                    </span>
                  </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 italic mt-2">Der unterlegene Name wandert ins "Aliase" (Suchmuster) Feld des Haupt-Profils. Nichts geht verloren.</p>
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
             <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 dark:border-slate-700 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800">Abbrechen</Button>
             <Button type="button" onClick={handleSubmit} disabled={!selectedSecondary || isSubmitting} className="bg-orange-600 hover:bg-orange-500 font-bold text-slate-900 dark:text-white">
               {isSubmitting ? "Zusammenführen..." : "Zusammenführen"}
             </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
