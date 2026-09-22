"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useTenantContext } from "@/contexts/tenant-context";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { Button } from "@/components/ui/Button";
import { PasswordVisibilityToggle } from "@/components/ui/PasswordVisibilityToggle";
import {
  clearVendorLicensingToken,
  getVendorLicensingToken,
  setVendorLicensingToken,
  VENDOR_SIDEBAR_MODULES,
  isVendorSidebarModule,
} from "@/lib/vendor-licensing";

type AdminModule = {
  id: string;
  code: string;
  displayName: string;
  category: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  isEnabled: boolean;
};

type AdminState = {
  companyName: string;
  subscription: {
    planName: string;
    status: string;
  };
  modules: AdminModule[];
};

const CATEGORY_ORDER = [
  "Core",
  "Workforce",
  "Intelligence",
  "Audit & Compliance",
  "Administration",
  "Help",
];

function vendorHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function VendorModuleAccessPanel() {
  const { refreshProfile, isAuthenticated } = useAuth();
  const { tenant } = useTenantContext();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setLoginError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setPassword("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const existing = getVendorLicensingToken();
    setToken(existing);
  }, [open]);

  const loadState = useCallback(
    async (vendorToken: string) => {
      setLoading(true);
      setSaveError(null);
      try {
        const data = await apiFetch<AdminState>("/api/vendor-licensing/state", {
          headers: vendorHeaders(vendorToken),
          skipAuthRedirect: true,
        });
        setState(data);
        setEnabled(
          new Set(
            data.modules
              .filter((m) => isVendorSidebarModule(m.code) && m.isEnabled)
              .map((m) => m.code),
          ),
        );
      } catch {
        clearVendorLicensingToken();
        setToken(null);
        setState(null);
        setLoginError("Session expired. Sign in again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !token) return;
    void loadState(token);
  }, [open, token, loadState]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const result = await apiFetch<{ token: string; companyName?: string }>(
        "/api/vendor-licensing/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
          skipAuthRedirect: true,
        },
      );
      setVendorLicensingToken(result.token);
      setToken(result.token);
      setPassword("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoggingIn(false);
    }
  }

  function toggleModule(code: string, isRequired: boolean, checked: boolean) {
    if (isRequired) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    setSaveSuccess(null);
  }

  async function saveModules() {
    if (!token || !state) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const optionalOn = VENDOR_SIDEBAR_MODULES.filter(
        (def) =>
          def.code !== "Dashboard" &&
          enabled.has(def.code),
      ).map((def) => def.code);
      await apiFetch("/api/vendor-licensing/entitlements", {
        method: "PUT",
        headers: vendorHeaders(token),
        skipAuthRedirect: true,
        body: JSON.stringify({ enabledOptionalModuleCodes: optionalOn }),
      });
      setSaveSuccess("Module access saved for this company.");
      await loadState(token);
      if (isAuthenticated) await refreshProfile();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function signOutVendor() {
    clearVendorLicensingToken();
    setToken(null);
    setState(null);
    setUsername("");
    setPassword("");
  }

  const grouped = useMemo(() => {
    const byCode = new Map((state?.modules ?? []).map((m) => [m.code, m]));
    const map = new Map<string, AdminModule[]>();
    VENDOR_SIDEBAR_MODULES.forEach((def, index) => {
      const fromApi = byCode.get(def.code);
      const row: AdminModule = fromApi
        ? {
            ...fromApi,
            displayName: def.displayName,
            category: def.category,
            sortOrder: index,
          }
        : {
            id: def.code,
            code: def.code,
            displayName: def.displayName,
            category: def.category,
            sortOrder: index,
            isRequired: def.code === "Dashboard",
            isActive: true,
            isEnabled: def.code === "Dashboard",
          };
      const list = map.get(def.category) ?? [];
      list.push(row);
      map.set(def.category, list);
    });
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
      category,
      modules: map.get(category) ?? [],
    }));
  }, [state]);

  const companyLabel =
    state?.companyName || tenant?.name || "This company";
  const optionalModules = VENDOR_SIDEBAR_MODULES.filter((m) => m.code !== "Dashboard");
  const allOptionalOn =
    optionalModules.length > 0 && optionalModules.every((m) => enabled.has(m.code));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/55 px-4 py-10 backdrop-blur-[3px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-module-panel-title"
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.5)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white px-7 py-5">
          <div className="mb-1 inline-flex rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            OpenSky vendor
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="vendor-module-panel-title" className="text-lg font-semibold text-slate-800">
                Company module access
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Choose which sidebar modules this company can open.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-8 w-8 place-items-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="px-7 py-6">
          {!token ? (
            <form onSubmit={(e) => void handleLogin(e)} className="mx-auto max-w-sm space-y-4">
              <FormErrorAlert message={loginError} onDismiss={() => setLoginError(null)} />
              <label className="block text-sm">
                <span className="font-medium text-slate-600">Username</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-600">Password</span>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <PasswordVisibilityToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </div>
              </label>
              <Button type="submit" disabled={loggingIn} className="w-full">
                {loggingIn ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Company</div>
                  <div className="text-base font-semibold text-slate-900">{companyLabel}</div>
                  {state?.subscription.planName ? (
                    <div className="text-xs text-slate-500">
                      Plan {state.subscription.planName} · {state.subscription.status}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={signOutVendor}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  Sign out
                </button>
              </div>

              <FormErrorAlert message={saveError} onDismiss={() => setSaveError(null)} />
              {saveSuccess ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {saveSuccess}
                </p>
              ) : null}

              {loading && !state ? (
                <p className="text-sm text-slate-500">Loading modules…</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-500">
                      Unchecked modules stay hidden in the sidebar and cannot be opened.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                      onClick={() => {
                        if (allOptionalOn) {
                          setEnabled(new Set(["Dashboard"]));
                        } else {
                          setEnabled(new Set(VENDOR_SIDEBAR_MODULES.map((m) => m.code)));
                        }
                        setSaveSuccess(null);
                      }}
                    >
                      {allOptionalOn ? "Clear optional" : "Select all"}
                    </button>
                  </div>

                  <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
                    {grouped.map(({ category, modules }) => (
                      <section key={category}>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {category}
                        </h3>
                        <ul className="space-y-1.5">
                          {modules.map((mod) => {
                            const checked = mod.isRequired || enabled.has(mod.code);
                            return (
                              <li key={mod.id}>
                                <label
                                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                                    checked
                                      ? "border-blue-200 bg-blue-50/70"
                                      : "border-slate-200 bg-white"
                                  } ${mod.isRequired ? "cursor-default opacity-90" : ""}`}
                                >
                                  <span>
                                    <span className="block text-sm font-medium text-slate-900">
                                      {mod.displayName}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                      {mod.isRequired ? "Always included" : "Purchased add-on"}
                                    </span>
                                  </span>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                    checked={checked}
                                    disabled={mod.isRequired || saving}
                                    onChange={(e) =>
                                      toggleModule(mod.code, mod.isRequired, e.target.checked)
                                    }
                                  />
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                    <section>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Help
                      </h3>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <span>
                          <span className="block text-sm font-medium text-slate-900">Help &amp; guides</span>
                          <span className="block text-xs text-slate-500">Always available</span>
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          checked
                          disabled
                          readOnly
                        />
                      </div>
                    </section>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" onClick={close}>
                      Close
                    </Button>
                    <Button disabled={saving || loading} onClick={() => void saveModules()}>
                      {saving ? "Saving…" : "Save module access"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
