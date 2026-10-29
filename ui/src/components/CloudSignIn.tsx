import { useEffect, useRef, useState } from "react";
import type { CloudInstanceHealthStatus } from "@/api/health";
import { cloudStackEntryUrl } from "@/lib/cloudLinks";
import { beginCloudSignIn, clearCloudSignInAttempt } from "@/lib/cloud-sign-in";
import { PaperclipLoading } from "@/components/AnimatedPaperclipIcon";
import { Button } from "@/components/ui/button";
import { t as i18nT } from "@/i18n";

export function CloudSignIn({ cloud, returnTo }: { cloud: CloudInstanceHealthStatus; returnTo: string }) {
  const entryUrl = cloudStackEntryUrl(cloud.cloudBaseUrl, cloud.stackSlug, returnTo);
  const started = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!entryUrl || started.current) return;
    started.current = true;
    setBlocked(!beginCloudSignIn(entryUrl));
  }, [entryUrl]);

  if (entryUrl && !blocked) return <PaperclipLoading />;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{i18nT("scan.s1253")}</h1>
      <p role="alert" className="text-sm text-muted-foreground">
        {entryUrl
          ? "We couldn't restore your session. Continue to Kujira AI Workforce Cloud to try again."
          : "Cloud sign-in is unavailable for this workspace. Please contact your administrator."}
      </p>
      {entryUrl && (
        <Button asChild>
          <a href={entryUrl} onClick={clearCloudSignInAttempt}>{i18nT("scan.s0282")}</a>
        </Button>
      )}
    </div>
  );
}
