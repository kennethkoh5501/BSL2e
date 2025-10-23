import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "@/components/layout/Header";
import MainNav from "@/components/layout/MainNav";

export const metadata: Metadata = {
  title: "LabWatch BSL2e Dashboard",
  description: "Centralized operations dashboard for the BSL2e facility",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">
        <div className="flex min-h-screen flex-col">
          <Header />
          <div className="flex flex-1">
            <MainNav />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
