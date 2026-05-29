import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/ToastNotification";
import { ServiceWorkerUpdater } from "@/components/pwa/ServiceWorkerUpdater";

export const metadata: Metadata = {
  title: "DIAGNOTEST — Plataforma Operativa",
  description: "Sistema de gestión para laboratorio veterinario de análisis clínicos",
  manifest: "/manifest.json",
  themeColor: "#1a5c2e",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Diagnotest",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        {children}
        <ToastContainer />
        <ServiceWorkerUpdater />
      </body>
    </html>
  );
}
