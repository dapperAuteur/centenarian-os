// centenarian-os/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { RouteGuard } from "@/components/auth/RouteGuard"; // Import the new guard


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Centenarian OS",
  description: "The definitive personal operating system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <RouteGuard>
            {children}
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  );
}

