import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { Providers } from "@/components/shell/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vibeSQL — 자연어로 데이터에 질문하세요",
  description: "자연어로 질문하면 SQL을 만들어 실행하고, 결과를 보여줍니다.",
};

// Inline script that runs BEFORE first paint. Reads the persisted Zustand
// settings from localStorage and applies data-mode/data-theme/data-density
// to <html> synchronously, eliminating the light→dark flash on F5 reload.
// Defaults match useSettingsStore initial values.
const themeBootstrapScript = `(function(){try{var r=localStorage.getItem('vibesql-settings');var s=null;if(r){var p=JSON.parse(r);s=p&&p.state?p.state:null;}var m=(s&&s.mode)||'dark';var t=(s&&s.theme)||'indigo';var d=(s&&s.density)||'regular';var h=document.documentElement;h.setAttribute('data-mode',m);h.setAttribute('data-theme',t);h.setAttribute('data-density',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-mode="dark"
      data-theme="indigo"
      data-density="regular"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="h-full antialiased">
        <ThemeSync />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
