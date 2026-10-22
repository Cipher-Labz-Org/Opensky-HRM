import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/config/constants";
import { AuthProvider } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { VendorModuleAccessPanel } from "@/components/licensing/VendorModuleAccessPanel";
import { ErpEmbedTheme } from "@/components/theme/ErpEmbedTheme";
import { NativeSelectMenu } from "@/components/ui/NativeSelectMenu";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(location.search);var r=p.get("redirect")||"";var embed=p.get("embed")==="1"||r.indexOf("embed=1")>=0||sessionStorage.getItem("opensky-erp-embed")==="1";if(p.get("embed")==="1"||r.indexOf("embed=1")>=0){sessionStorage.setItem("opensky-erp-embed","1");document.cookie="opensky_erp_embed=1; path=/; samesite=lax";}var t=p.get("theme");if(t!=="dark"&&t!=="light"){if(r.indexOf("theme=dark")>=0)t="dark";else if(r.indexOf("theme=light")>=0)t="light";}if(t==="dark"||t==="light")sessionStorage.setItem("opensky-erp-theme",t);else t=sessionStorage.getItem("opensky-erp-theme")||"dark";if(embed){document.documentElement.classList.add("erp-embed");document.documentElement.classList.toggle("dark",t==="dark");}}catch(e){}})();`,
          }}
        />
        <ErpEmbedTheme />
        <TenantProvider>
          <AuthProvider>
            {children}
            <VendorModuleAccessPanel />
            <NativeSelectMenu />
          </AuthProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
