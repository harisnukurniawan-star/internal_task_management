import type { Metadata } from "next";
import "./globals.css";
import { InvitationPasswordRedirect } from "@/components/invitation-password-redirect";

export const metadata: Metadata = {
  title: "Internal Task Management",
  description: "Weekly performance management for supervisors and employees",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <InvitationPasswordRedirect />
        {children}
      </body>
    </html>
  );
}
