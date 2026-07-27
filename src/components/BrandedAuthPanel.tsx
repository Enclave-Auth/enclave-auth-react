import type { ReactNode } from "react";

import { useEnclaveAuthContext } from "../context/EnclaveAuthProvider.js";
import { ApplicationBranding } from "./ApplicationBranding.js";
import { AuthPanel } from "./ui.js";

export function BrandedAuthPanel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { config } = useEnclaveAuthContext();

  return (
    <AuthPanel
      title={title}
      subtitle={subtitle}
      footer={footer}
      header={<ApplicationBranding branding={config?.brandingConfig} />}
    >
      {children}
    </AuthPanel>
  );
}
