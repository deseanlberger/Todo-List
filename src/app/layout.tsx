import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odyssey Tasks",
  description: "What is left to do.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Tasks" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // One appearance. The brand is black with a gold accent, so there is no
    // light variant to remember and nothing to read from the database before
    // the first paint.
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="app-column">{children}</div>
        </div>
      </body>
    </html>
  );
}
