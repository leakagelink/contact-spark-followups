import { useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { normalizePhone } from "@/lib/contacts/phone";
import { startCall } from "@/lib/contacts/db";
import { waNumber } from "@/lib/contacts/whatsapp";
import type { ContactFields } from "@/lib/contacts/types";
import { WhatsAppComposer } from "./WhatsAppComposer";

type C = ContactFields & { id: string };

export function CallButton({ contact, size = "sm", label = false }: { contact: C; size?: "sm" | "default" | "lg"; label?: boolean }) {
  const ok = normalizePhone(contact.phone).valid;
  if (!ok) return null;
  return (
    <Button
      size={size}
      variant="default"
      aria-label={`Call ${contact.full_name ?? contact.phone}`}
      onClick={(e) => {
        e.stopPropagation();
        startCall({ id: contact.id, full_name: contact.full_name ?? null }, contact.phone!);
      }}
    >
      <Phone className="h-4 w-4" />
      {label && "Call"}
    </Button>
  );
}

export function WhatsAppButton({ contact, size = "sm", label = false }: { contact: C; size?: "sm" | "default" | "lg"; label?: boolean }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const num = waNumber(contact);
  const ok = normalizePhone(num).valid;
  return (
    <>
      <Button
        size={size}
        className="bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
        aria-label={`WhatsApp ${contact.full_name ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!ok) return toast.error("No valid number for WhatsApp. Edit the contact to add one with country code.");
          setOpen(true);
        }}
      >
        <MessageCircle className="h-4 w-4" />
        {label && "WhatsApp"}
      </Button>
      {open && (
        <WhatsAppComposer
          contact={contact}
          open={open}
          onOpenChange={setOpen}
          onDone={() => qc.invalidateQueries()}
        />
      )}
    </>
  );
}
