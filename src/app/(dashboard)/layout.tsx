import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { Profile } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Personal de logística: experiencia 100% mobile, sin sidebar
  if (profile.rol === "personal_logistica") {
    return (
      <div className="min-h-screen bg-gy100 flex justify-center">
        <div className="w-full max-w-[480px] bg-white min-h-screen shadow-xl flex flex-col">
          {children}
        </div>
      </div>
    );
  }

  return <DashboardShell profile={profile as Profile}>{children}</DashboardShell>;
}
