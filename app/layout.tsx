import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ForgeSite AI",
  description: "Build websites with ForgeSite",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


