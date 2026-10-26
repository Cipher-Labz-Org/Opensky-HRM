"use client";

import { useEffect, useState } from "react";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import {
  Button,
  FlashMessageBanner,
  FormErrorAlert,
  FormSelect,
  type FlashMessage,
  type FormSelectOption,
} from "@/components/ui";
import { SUCCESS_BANNER_DISMISS_MS } from "@/lib/use-auto-dismiss";
import { apiFetch } from "@/lib/api";
import { resolveRolePermissionModules } from "@/lib/role-permission-modules";

export type RoleForPermissions = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions?: { module: string; action: string; scope: string }[];
};

const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

const ACTIONS = [
  { key: "Read", label: "View / Menu Access" },
  { key: "Create", label: "Create" },
  { key: "Update", label: "Update" },
  { key: "Delete", label: "Delete" },
];

const SCOPES = [
  { key: "All", label: "All" },
  { key: "Team", label: "Team" },
  { key: "Own", label: "Own" },
];

const SCOPE_FORM_OPTIONS: FormSelectOption[] = SCOPES.map((s) => ({ value: s.key, label: s.label }));

export function RolesPermissionsSection({
  roles,
  onSaved,
}: {
  roles: RoleForPermissions[];
  onSaved: () => void;
}) {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [modules, setModules] = useState<{ module: string; label: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<
    Record<string, Record<string, { enabled: boolean; scope: string }>>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState<FlashMessage | null>(null);

  useEffect(() => {
    apiFetch<{ module: string; label: string }[]>("/api/auth/roles/available-modules")
      .then((list) => setModules(resolveRolePermissionModules(Array.isArray(list) ? list : [])))
      .catch(() => setModules(resolveRolePermissionModules([])));
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    setSuccessMsg(null);
    setError("");
  }, [selectedRoleId]);

  useEffect(() => {
    if (!selectedRole) {
      setPermissions({});
      return;
    }
    const perms: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
    for (const mod of modules) {
      perms[mod.module] = {};
      for (const act of ACTIONS) {
        const existing = selectedRole.permissions?.find(
          (p) => p.module === mod.module && p.action === act.key,
        );
        perms[mod.module][act.key] = {
          enabled: !!existing,
          scope: existing?.scope || "All",
        };
      }
    }
    setPermissions(perms);
  }, [selectedRole, modules]);

  function togglePermission(module: string, action: string, enabled: boolean) {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: { ...prev[module]?.[action], enabled, scope: prev[module]?.[action]?.scope || "All" },
      },
    }));
  }

  function setScope(module: string, action: string, scope: string) {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: { ...prev[module]?.[action], scope },
      },
    }));
  }

  function grantAllPermissions() {
    setPermissions((prev) => {
      const next: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
      for (const mod of modules) {
        next[mod.module] = {};
        for (const act of ACTIONS) {
          next[mod.module][act.key] = {
            enabled: true,
            scope: prev[mod.module]?.[act.key]?.scope || "All",
          };
        }
      }
      return next;
    });
  }

  function clearAllPermissions() {
    setPermissions((prev) => {
      const next: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
      for (const mod of modules) {
        next[mod.module] = {};
        for (const act of ACTIONS) {
          next[mod.module][act.key] = {
            enabled: false,
            scope: prev[mod.module]?.[act.key]?.scope || "All",
          };
        }
      }
      return next;
    });
  }

  function grantAllForModule(module: string) {
    setPermissions((prev) => ({
      ...prev,
      [module]: Object.fromEntries(
        ACTIONS.map((act) => [
          act.key,
          { enabled: true, scope: prev[module]?.[act.key]?.scope || "All" },
        ]),
      ),
    }));
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setError("");
    setSuccessMsg(null);
    setSaving(true);
    const perms: { module: string; action: string; scope: string }[] = [];
    for (const [mod, acts] of Object.entries(permissions)) {
      for (const [act, val] of Object.entries(acts)) {
        if (val.enabled) perms.push({ module: mod, action: act, scope: val.scope });
      }
    }
    try {
      await apiFetch(`/api/auth/roles/${selectedRoleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms }),
      });
      setSuccessMsg({
        type: "ok",
        text: `Permissions saved successfully for ${selectedRole?.name ?? "role"}.`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Roles & permissions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure which menus and actions each role can access. Read = menu visibility. Use Grant all to
              enable every module in this list.
            </p>
          </div>
          <Button type="button" onClick={() => setShowCreateRole(true)}>
            + New Security Role
          </Button>
        </div>
        <div className="flex min-h-[400px] flex-col lg:flex-row">
          <div className="w-full border-b border-slate-100 p-4 lg:w-56 lg:border-b-0 lg:border-r">
            <div className="mb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Select Role</p>
            </div>
            <div className="space-y-1">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    selectedRoleId === r.id
                      ? "border border-slate-200 bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {r.name}
                  {r.code ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{r.code}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-x-auto p-6">
            {!selectedRole ? (
              <p className="py-8 text-sm text-slate-400">Select a role to configure its permissions.</p>
            ) : (
              <>
                <FlashMessageBanner
                  msg={successMsg}
                  onClear={() => setSuccessMsg(null)}
                  dismissMs={SUCCESS_BANNER_DISMISS_MS}
                  className="mb-4"
                />
                <FormErrorAlert
                  message={error}
                  onDismiss={() => setError("")}
                  className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
                />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">Permissions for {selectedRole.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={grantAllPermissions}>
                      Grant all
                    </Button>
                    <Button type="button" variant="secondary" onClick={clearAllPermissions}>
                      Clear all
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="py-2 pr-4 font-medium text-slate-600">Module / Menu</th>
                        {ACTIONS.map((a) => (
                          <th
                            key={a.key}
                            className="min-w-[100px] px-2 py-2 text-center font-medium text-slate-600"
                          >
                            {a.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((mod) => (
                        <tr key={mod.module} className="border-b border-slate-50">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{mod.label}</span>
                              <button
                                type="button"
                                onClick={() => grantAllForModule(mod.module)}
                                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                All
                              </button>
                            </div>
                          </td>
                          {ACTIONS.map((act) => {
                            const val = permissions[mod.module]?.[act.key] ?? {
                              enabled: false,
                              scope: "All",
                            };
                            return (
                              <td key={act.key} className="px-2 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={val.enabled}
                                    onChange={(e) =>
                                      togglePermission(mod.module, act.key, e.target.checked)
                                    }
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25"
                                  />
                                  {val.enabled ? (
                                    <FormSelect
                                      value={val.scope}
                                      onValueChange={(v) => setScope(mod.module, act.key, v)}
                                      options={SCOPE_FORM_OPTIONS}
                                      className="!h-8 min-h-8 w-[5.25rem] px-2 py-0 text-[11px] leading-tight"
                                    />
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Saving…" : "Save permissions"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <CreateRoleModal
        open={showCreateRole}
        onClose={() => setShowCreateRole(false)}
        onCreated={() => void onSaved()}
      />
    </>
  );
}
