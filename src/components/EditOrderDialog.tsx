import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "sonner";

export default function EditOrderDialog({ order, onClose, onUpdated }: { order: any, onClose: () => void, onUpdated?: () => void }) {
  const [title, setTitle] = useState(order.title || "");
  const [description, setDescription] = useState(order.description || "");
  const [clientName, setClientName] = useState(order.clientName || "");
  const [type, setType] = useState(order.type || "order");
  const [status, setStatus] = useState(order.status || "pending");
  const [priority, setPriority] = useState(order.priority || "medium");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        title,
        description,
        clientName,
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

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Auftrag bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label className="text-slate-400">Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
          <div className="grid gap-2">
            <Label className="text-slate-400">Kunde / Firma</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
          <div className="grid gap-2">
            <Label className="text-slate-400">Beschreibung</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950 border-slate-800 min-h-[100px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-slate-400">Typ (Label)</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="order">Kunde (Order)</SelectItem>
                  <SelectItem value="structure">Struktur/Orga</SelectItem>
                  <SelectItem value="callback">Rückruf</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-400">Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="hover:bg-slate-800 hover:text-white">Abbrechen</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {isSaving ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
