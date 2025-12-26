import "./globals.css";
import ClientEffects from "./client-effects";

export const metadata = {
  title: "ForgeSite AI",
  description: "Build professional websites instantly with ForgeSite AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientEffects />
        {children}
      </body>
    </html>
  );
}


