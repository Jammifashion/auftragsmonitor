import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "sonner";

export default function EditProjectDialog({ project, onClose, onUpdated }: { project: any, onClose: () => void, onUpdated?: () => void }) {
  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Projektname darf nicht leer sein");
      return;
    }
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "projects", project.id), {
        name: name.trim(),
        description: description.trim(),
        updatedAt: serverTimestamp()
      });
      toast.success("Projekt aktualisiert");
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
      <DialogContent className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Projekt bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label className="text-slate-500 dark:text-slate-400">Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" 
              placeholder="Projektname..."
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-slate-500 dark:text-slate-400">Beschreibung (Optional)</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 min-h-[120px] text-sm text-slate-600 dark:text-slate-300" 
              placeholder="Worum geht es in diesem Projekt?"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="hover:bg-white dark:bg-slate-800 hover:text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">Abbrechen</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-accent-600 hover:bg-accent-500 text-slate-900 dark:text-white font-bold px-8">
            {isSaving ? "Speichert..." : "Änderungen Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
