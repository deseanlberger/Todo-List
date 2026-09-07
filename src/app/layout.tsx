import type { Metadata, Viewport } from "next";
import { repository } from "@/lib/data";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Capture the work. Schedule the week.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Scheduler" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the persisted appearance on the server so the first paint is already
  // right. Never let this be what stops the app rendering: an unreachable
  // database should cost the remembered appearance, not the whole page.
  let theme: "dark" | "light" = "light";
  try {
    theme = (await repository().getSettings()).theme;
  } catch (cause) {
    console.error("Could not read the appearance; falling back to light:", cause);
  }

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <ThemeProvider initialTheme={theme}>
          {/*
            A phone column under 900px. Above it the tab bar becomes a fixed
            left sidebar, so the shell leaves room for it and lets the column
            grow — a laptop or an iPad gets a wider app, not a phone strip.
          */}
          <div className="app-shell">
            <div className="app-column">{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
