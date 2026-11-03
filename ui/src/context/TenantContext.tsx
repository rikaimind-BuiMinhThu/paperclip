import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api/client";

export type TenantKind = "legacy" | "apex" | "admin" | "company" | "unknown";

export interface TenantCompany {
  id: string;
  name: string | null;
  slug: string | null;
  issuePrefix: string | null;
  origin: string | null;
}

export interface TenantState {
  loaded: boolean;
  hostTenancyEnabled: boolean;
  kind: TenantKind;
  rootDomain: string | null;
  company: TenantCompany | null;
  origins: {
    apex: string | null;
    admin: string | null;
  };
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantState | null>(null);

const EMPTY: Omit<TenantState, "loaded" | "refresh"> = {
  hostTenancyEnabled: false,
  kind: "legacy",
  rootDomain: null,
  company: null,
  origins: { apex: null, admin: null },
};

export function TenantProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{
        hostTenancyEnabled: boolean;
        kind: TenantKind;
        rootDomain: string | null;
        company: TenantCompany | null;
        origins: { apex: string | null; admin: string | null };
      }>("/tenant");
      setState({
        hostTenancyEnabled: Boolean(data.hostTenancyEnabled),
        kind: data.kind ?? "legacy",
        rootDomain: data.rootDomain ?? null,
        company: data.company ?? null,
        origins: data.origins ?? { apex: null, admin: null },
      });
    } catch {
      setState(EMPTY);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<TenantState>(
    () => ({
      ...state,
      loaded,
      refresh,
    }),
    [state, loaded, refresh],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return {
      ...EMPTY,
      loaded: true,
      refresh: async () => undefined,
    };
  }
  return ctx;
}

/** True when board URLs should omit `/{issuePrefix}` (company host tenancy). */
export function useHostCompanyRouting(): boolean {
  const tenant = useTenant();
  return tenant.hostTenancyEnabled && tenant.kind === "company";
}
