import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Rajdhani, Roboto_Mono } from "next/font/google";
import { repository } from "@/lib/data";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const rajdhani = Rajdhani({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Odyssey Task Scheduler",
  description: "Capture the work. Schedule the week. Nothing moves without the button.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the persisted theme on the server so the first paint is already
  // correct — a flash of the wrong view on a true-black app is glaring.
  const settings = await repository().getSettings();

  return (
    <html
      lang="en"
      data-theme={settings.theme}
      className={`${bebas.variable} ${rajdhani.variable} ${robotoMono.variable}`}
    >
      <body>
        <ThemeProvider initialTheme={settings.theme}>
          <div className="flex min-h-[100dvh] justify-center bg-black">
            <div className="relative flex min-h-[100dvh] w-full max-w-[390px] flex-col bg-bg">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
