import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import { healthApi } from "@/api/health";
import { isTemporaryApiError } from "@/api/response";
import { PaperclipLoading } from "@/components/AnimatedPaperclipIcon";
import { CloudAccessError } from "@/components/CloudAccessGate";
import { queryKeys } from "@/lib/queryKeys";
import { MarketingLandingPage } from "./MarketingLandingPage";

const RECONNECT_INTERVAL_MS = 5_000;

/**
 * Public `/` entry: guests see the marketing landing; signed-in and
 * local-trusted users continue into the board via CompanyRootRedirect.
 */
export function PublicHome({ appEntry }: { appEntry: ReactNode }) {
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      if (query.state.error) return isTemporaryApiError(query.state.error) ? RECONNECT_INTERVAL_MS : false;
      return query.state.data?.status === "starting" ? RECONNECT_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
    refetchInterval: (query) => (isTemporaryApiError(query.state.error) ? RECONNECT_INTERVAL_MS : false),
    refetchIntervalInBackground: true,
  });

  const isServerStarting = healthQuery.data?.status === "starting";
  const blockingError =
    (healthQuery.error && !(healthQuery.data !== undefined && isTemporaryApiError(healthQuery.error))
      ? healthQuery.error
      : null) ??
    (isAuthenticatedMode &&
    sessionQuery.error &&
    !(sessionQuery.data !== undefined && isTemporaryApiError(sessionQuery.error))
      ? sessionQuery.error
      : null);

  const isLoading =
    healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading);

  if (blockingError || isServerStarting) {
    return (
      <CloudAccessError
        temporary={blockingError ? isTemporaryApiError(blockingError) : true}
        retrying={healthQuery.isFetching || sessionQuery.isFetching}
        onRetry={() => {
          if (healthQuery.error || isServerStarting) void healthQuery.refetch({ cancelRefetch: false });
          if (sessionQuery.error) void sessionQuery.refetch({ cancelRefetch: false });
        }}
      />
    );
  }

  if (isLoading || !healthQuery.data) {
    return <PaperclipLoading />;
  }

  if (!isAuthenticatedMode) {
    return <>{appEntry}</>;
  }

  if (sessionQuery.data) {
    return <>{appEntry}</>;
  }

  // Cloud stacks still land on marketing first; Sign in routes through /auth,
  // which already opens CloudSignIn when cloud metadata is present.
  return <MarketingLandingPage />;
}
