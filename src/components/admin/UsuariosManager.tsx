"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillStatus, RoleBadge } from "@/components/ui/PillStatus";
import { toast } from "@/components/ui/ToastNotification";

export interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}

const ROLES: { value: string; label: string }[] = [
  { value: "personal_logistica", label: "Personal logística (cadete)" },
  { value: "jefe_logistica", label: "Jefe de logística" },
  { value: "preanalitica", label: "Preanalítica" },
  { value: "cobranzas", label: "Cobranzas" },
  { value: "dueno", label: "Dueño" },
  { value: "super_admin", label: "Super Admin" },
];

type Editing =
  | { mode: "nuevo" }
  | { mode: "editar"; user: UsuarioRow }
  | null;

export function UsuariosManager({ usuarios }: { usuarios: UsuarioRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActivo(u: UsuarioRow) {
    setBusyId(u.id);
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, activo: !u.activo }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) { toast("error", json.error ?? "No se pudo actualizar"); return; }
    toast("success", !u.activo ? "Usuario activado ✓" : "Usuario desactivado");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
        <i className="ti ti-users text-g600" />
        <span className="text-[14px] font-semibold flex-1">Usuarios y roles</span>
        <button onClick={() => setEditing({ mode: "nuevo" })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[6px] hover:bg-g700">
          <i className="ti ti-plus" /> Nuevo
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-gy50">
              {["Nombre", "Email", "Rol", "Estado", "Acciones"].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                <td className="px-3.5 py-2.5 font-medium text-gy900">{u.nombre}</td>
                <td className="px-3.5 py-2.5 text-gy600 text-[11px]">{u.email}</td>
                <td className="px-3.5 py-2.5"><RoleBadge rol={u.rol} /></td>
                <td className="px-3.5 py-2.5"><PillStatus variant={u.activo ? "ok" : "grey"} label={u.activo ? "Activo" : "Inactivo"} /></td>
                <td className="px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing({ mode: "editar", user: u })}
                      title="Editar"
                      className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50 flex items-center gap-1">
                      <i className="ti ti-edit text-[13px]" /> Editar
                    </button>
                    <button onClick={() => toggleActivo(u)} disabled={busyId === u.id}
                      title={u.activo ? "Desactivar (bloquea el ingreso)" : "Activar"}
                      role="switch" aria-checked={u.activo}
                      className={`relative w-10 h-[22px] rounded-full transition-colors disabled:opacity-50 ${u.activo ? "bg-g500" : "bg-gy300"}`}>
                      <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${u.activo ? "translate-x-[18px]" : ""}`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-gy400">Sin usuarios</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <UsuarioModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function UsuarioModal({ editing, onClose, onSaved }: {
  editing: Exclude<Editing, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = editing.mode === "nuevo";
  const user = editing.mode === "editar" ? editing.user : null;

  const [nombre, setNombre] = useState(user?.nombre ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState(user?.rol ?? "personal_logistica");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!nombre.trim()) { toast("error", "Ingresá el nombre"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast("error", "Email con formato inválido"); return; }
    if (esNuevo && password.length < 6) { toast("error", "La contraseña debe tener al menos 6 caracteres"); return; }
    if (!esNuevo && password.length > 0 && password.length < 6) { toast("error", "La nueva contraseña debe tener al menos 6 caracteres"); return; }

    setSaving(true);
    const res = await fetch("/api/admin/usuarios", {
      method: esNuevo ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        esNuevo
          ? { nombre, email, password, rol }
          : { id: user!.id, nombre, email, rol, ...(password ? { password } : {}) }
      ),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo guardar"); return; }
    toast("success", esNuevo ? "Usuario creado ✓" : "Usuario actualizado ✓");
    onSaved();
  }

  const inputCls = "w-full px-3 py-2 border-2 border-gy200 rounded-[8px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-[16px] shadow-xl w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gy100 flex items-center gap-2">
          <i className={`ti ${esNuevo ? "ti-user-plus" : "ti-user-edit"} text-g600`} />
          <span className="text-[15px] font-semibold flex-1">{esNuevo ? "Nuevo usuario" : "Editar usuario"}</span>
          <button onClick={onClose} className="text-gy400 hover:text-gy600"><i className="ti ti-x text-[18px]" /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Nombre completo</label>
            <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Email (con el que inicia sesión)</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@diagnotest.com" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gy600 mb-1.5">
              {esNuevo ? "Contraseña" : "Nueva contraseña (opcional)"}
            </label>
            <input className={inputCls} type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={esNuevo ? "Mínimo 6 caracteres" : "Dejar vacío para no cambiarla"} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Rol</label>
            <select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gy100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-2 text-[13px] font-medium text-gy600 bg-white border border-gy200 rounded-[8px] hover:bg-gy50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-g800 rounded-[8px] hover:bg-g700 disabled:opacity-60">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {esNuevo ? "Crear usuario" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
