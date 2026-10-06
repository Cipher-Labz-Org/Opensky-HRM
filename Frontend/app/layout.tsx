import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/config/constants";
import { AuthProvider } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { VendorModuleAccessPanel } from "@/components/licensing/VendorModuleAccessPanel";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Enterprise workforce platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <TenantProvider>
          <AuthProvider>
            {children}
            <VendorModuleAccessPanel />
          </AuthProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
