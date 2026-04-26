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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      data-mode="light"
      data-theme="indigo"
      data-density="regular"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        <ThemeSync />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
