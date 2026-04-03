import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ClerkProvider } from "@clerk/nextjs";
import AppLayout from "@/components/AppLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todo Vibe",
  description: "A modern todo app built with Next.js and Ant Design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="zh-CN">
        <body suppressHydrationWarning>
          <AntdRegistry>
            <AppLayout>{children}</AppLayout>
          </AntdRegistry>
        </body>
      </html>
    </ClerkProvider>
  );
}
