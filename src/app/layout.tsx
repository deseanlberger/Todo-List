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
          <div className="flex min-h-[100dvh] justify-center bg-bg">
            <div className="relative flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-bg">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
