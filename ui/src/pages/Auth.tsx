import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { healthApi } from "../api/health";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { CloudSignIn } from "@/components/CloudSignIn";
import { clearCloudSignInAttempt } from "@/lib/cloud-sign-in";
import { resolveAuthCallbackUrl } from "@paperclipai/shared";
import { authFormErrorKey, oauthReturnErrorKey, safeAuthErrorMessage } from "@/lib/auth-errors";
import { validateEmailAuthForm, type EmailAuthMode } from "@/lib/auth-form";
import { queryKeys } from "../lib/queryKeys";
import { getRememberedInvitePath } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { PaperclipLoading } from "@/components/AnimatedPaperclipIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KujiraLockup } from "../components/KujiraLockup";

type AuthMode = EmailAuthMode;

function authErrorMessage(
  error: unknown,
  translate: (key: string) => string,
): string {
  const key = authFormErrorKey(error);
  if (key) return translate(`auth.${key}`);
  return safeAuthErrorMessage(error) ?? translate("auth.failed");
}

export function AuthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const modeFromUrl: AuthMode = searchParams.get("mode") === "sign_up" ? "sign_up" : "sign_in";
  const [mode, setModeState] = useState<AuthMode>(modeFromUrl);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const errorId = "auth-error";

  const nextPath = useMemo(
    () => resolveAuthCallbackUrl(searchParams.get("next") || getRememberedInvitePath() || "/"),
    [searchParams],
  );
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });
  const providersQuery = useQuery({
    queryKey: queryKeys.auth.providers,
    queryFn: () => authApi.getProviders(),
    retry: false,
    enabled: healthQuery.isSuccess && !healthQuery.data?.cloud,
  });
  const { data: session, isLoading: isSessionLoading, error: sessionError } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const googleEnabled = providersQuery.data?.providers.some((provider) => provider.id === "google") ?? false;

  useEffect(() => {
    setModeState(modeFromUrl);
  }, [modeFromUrl]);

  useEffect(() => {
    const oauthError = oauthReturnErrorKey(searchParams.get("error"));
    if (!oauthError) return;
    setError(t(`auth.${oauthError}`));
  }, [searchParams, t]);

  useEffect(() => {
    if (session) {
      clearCloudSignInAttempt();
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  function setMode(nextMode: AuthMode) {
    setError(null);
    setModeState(nextMode);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("mode", nextMode);
      params.delete("error");
      return params;
    }, { replace: true });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      // Reset rather than invalidate: the `["companies"]` entry is shared app-wide and
      // is not account-scoped, so invalidating leaves the previous account's list
      // readable (and any fetch for that session in flight) until the refetch lands.
      // Sign-in can change accounts, so drop the list outright.
      await queryClient.resetQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(authErrorMessage(err, (key) => t(key)));
    },
  });

  const busy = mutation.isPending || googlePending;
  const fieldError = validateEmailAuthForm({
    mode,
    name,
    email,
    password,
    confirmPassword,
  });

  async function continueWithGoogle() {
    if (busy) return;
    setError(null);
    setGooglePending(true);
    const errorParams = new URLSearchParams();
    errorParams.set("mode", mode);
    if (nextPath !== "/") errorParams.set("next", nextPath);
    try {
      await authApi.signInWithGoogle({
        callbackURL: nextPath,
        errorCallbackURL: `/auth?${errorParams.toString()}`,
      });
    } catch (err) {
      setGooglePending(false);
      setError(authErrorMessage(err, (key) => t(key)));
    }
  }

  if (healthQuery.isLoading || isSessionLoading || session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <PaperclipLoading className="min-h-0" />
      </div>
    );
  }

  // A health/session failure must not be mistaken for a self-hosted instance.
  if (healthQuery.error || sessionError) {
    return <p role="alert" className="p-6 text-sm text-destructive">{t("auth.unableToCheck")}</p>;
  }

  if (healthQuery.data?.cloud) {
    return <CloudSignIn cloud={healthQuery.data.cloud} returnTo={nextPath} />;
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex min-h-full w-full flex-col md:flex-row">
        <div className="flex w-full flex-col md:w-1/2">
          <div className="mx-auto my-auto w-full max-w-md px-4 py-16 sm:px-6">
            <div className="mb-8">
              <KujiraLockup className="h-16 w-auto" />
            </div>

            <h1 className="text-xl font-semibold">
              {mode === "sign_in" ? t("auth.welcomeTitle") : t("auth.signUpTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("auth.welcomeDescription")}
            </p>

            {googleEnabled && (
              <div className="mt-6 space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    void continueWithGoogle();
                  }}
                >
                  <GoogleMark />
                  {googlePending ? t("auth.connectingGoogle") : t("auth.continueWithGoogle")}
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>{t("auth.or")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            <form
              className="mt-6 space-y-4"
              method="post"
              action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                if (fieldError === "name") {
                  setError(t("auth.nameRequired"));
                  return;
                }
                if (fieldError === "email") {
                  setError(t("auth.invalidEmail"));
                  return;
                }
                if (fieldError === "password") {
                  setError(mode === "sign_up" ? t("auth.passwordTooShort") : t("auth.fillRequired"));
                  return;
                }
                if (fieldError === "confirm") {
                  setError(t("auth.passwordMismatch"));
                  return;
                }
                mutation.mutate();
              }}
            >
              {mode === "sign_up" && (
                <div>
                  <label htmlFor="name" className="mb-1 block text-xs text-muted-foreground">{t("auth.name")}</label>
                  <input
                    id="name"
                    name="name"
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    aria-required="true"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="mb-1 block text-xs text-muted-foreground">{t("auth.email")}</label>
                <input
                  id="email"
                  name="email"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  autoFocus={mode === "sign_in"}
                />
              </div>
              <PasswordField
                id="password"
                name="password"
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
                shown={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
                showLabel={t("auth.showPassword")}
                hideLabel={t("auth.hidePassword")}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                describedBy={error ? errorId : undefined}
                invalid={Boolean(error)}
              />
              {mode === "sign_up" && (
                <PasswordField
                  id="confirmPassword"
                  name="confirmPassword"
                  label={t("auth.confirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  shown={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  showLabel={t("auth.showPassword")}
                  hideLabel={t("auth.hidePassword")}
                  autoComplete="new-password"
                  describedBy={error ? errorId : undefined}
                  invalid={Boolean(error)}
                />
              )}
              {error && (
                <p id={errorId} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="w-full"
              >
                {mutation.isPending
                  ? (mode === "sign_in" ? t("auth.signingIn") : t("auth.creatingAccount"))
                  : mode === "sign_in"
                    ? t("auth.signIn")
                    : t("auth.createAccount")}
              </Button>
            </form>

            <div className="mt-5 text-sm text-muted-foreground">
              {mode === "sign_in" ? t("auth.needAccount") : t("auth.alreadyHaveAccount")}{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
              >
                {mode === "sign_in" ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </div>
          </div>
        </div>

        <div className="hidden overflow-hidden md:block md:w-1/2">
          <AsciiArtAnimation />
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  shown,
  onToggle,
  showLabel,
  hideLabel,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  autoComplete: string;
  describedBy?: string;
  invalid: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 pr-10 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          aria-required="true"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={shown ? hideLabel : showLabel}
          aria-pressed={shown}
          onClick={onToggle}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
