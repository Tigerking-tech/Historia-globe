import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import { getSEOTags, renderSchemaTags } from "@/lib/seo";

export const metadata = getSEOTags();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="preconnect" href="https://data.unesco.org" />
        {renderSchemaTags()}
      </head>
      <body className="bg-background h-full antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <main className="h-full">{children}</main>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
