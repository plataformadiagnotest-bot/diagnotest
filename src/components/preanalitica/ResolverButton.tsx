"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";

export function ResolverButton({ controlId }: { controlId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function resolver() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("control_preanalitica")
      .update({ estado: "ok" })
      .eq("id", controlId);
    setSaving(false);
    if (error) { toast("error", "No se pudo resolver"); return; }
    toast("success", "Observación resuelta ✓");
    router.refresh();
  }

  return (
    <button onClick={resolver} disabled={saving}
      className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-g50 text-g700 border border-g200 rounded-[6px] hover:bg-g100 disabled:opacity-50">
      <i className="ti ti-check text-[13px]" /> Resolver
    </button>
  );
}
