"use client";

import { useState } from "react";
import { callTool, newKey } from "@/lib/client/api";
import { usePos } from "@/lib/client/pos-context";
import { Button, Field, Input, Sheet } from "@/components/ui";

/** Mount only while open so each opening starts with an empty form and a fresh idempotency key. */
export function AddCustomerSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const { toast } = usePos();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await callTool<{ id: string; name: string }>("add_customer", {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      idempotency_key: key,
    });
    setBusy(false);
    if (res.ok && res.data) {
      toast({ title: "Customer added", body: res.data.name, tone: "ok" });
      onAdded(res.data.id);
    } else if (!res.ok) {
      setError(res.error);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Add customer"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" disabled={!name.trim()} loading={busy} onClick={() => submit()}>
            Add customer
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" maxLength={80} autoFocus autoComplete="off" />
        </Field>
        <Field label="Email (optional)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" inputMode="email" autoComplete="off" />
        </Field>
        <Field label="Phone (optional)">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359 …" maxLength={30} autoComplete="off" />
        </Field>
        <Field label="Note (optional)" hint="Preferences, allergies, anything the team should know.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. oat milk flat white" maxLength={200} />
        </Field>
        {error ? <div className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</div> : null}
        {/* Lets Enter submit the form */}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
