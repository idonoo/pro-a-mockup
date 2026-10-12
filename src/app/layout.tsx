import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/session";
import "./globals.css";

const sarabun = Sarabun({ variable: "--font-sarabun", subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Pro A – Workflow Mockup",
  description: "Sales → Approval → BOM/Stock → Production → Warehouse → Cost/Commission (PE steel-reinforced pipe)",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
