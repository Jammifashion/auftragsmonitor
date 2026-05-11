import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { db } from "../lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

export default function EditClientDialog({ client, onClose, onUpdated }: { client: any, onClose: () => void, onUpdated: () => void }) {
  const [name, setName] = useState(client.name || "");
  const [telefon, setTelefon] = useState(client.telefon || "");
  const [email, setEmail] = useState(client.email || "");
  const [adresse, setAdresse] = useState(client.adresse || "");
  const [insights, setInsights] = useState(client.insights || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "clients", client.id), {
        name,
        telefon,
        email,
        adresse,
        insights,
        updatedAt: serverTimestamp() // Added mandatory timestamp for Firestore rules
      });
      toast.success("Kunde aktualisiert.");
      onUpdated();
      onClose();
    } catch (error: any) {
      toast.error("Fehler beim Aktualisieren.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bento max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-400 font-bold uppercase tracking-wider text-sm">Kunde bearbeiten</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Telefon</Label>
            <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Adresse</Label>
            <Textarea value={adresse} onChange={(e) => setAdresse(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Stimmungs-Radar (Insights)</Label>
            <Textarea value={insights} onChange={(e) => setInsights(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" rows={3} />
          </div>
          
          <DialogFooter className="mt-6 gap-2">
             <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 dark:border-slate-700 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800">Abbrechen</Button>
             <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 font-bold text-slate-900 dark:text-white">
               {isSubmitting ? "Speichert..." : "Speichern"}
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
