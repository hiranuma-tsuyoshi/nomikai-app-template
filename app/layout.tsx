import type { Metadata } from "next";
import { M_PLUS_Rounded_1c, Nunito } from "next/font/google";
import "./globals.css";

const mplus = M_PLUS_Rounded_1c({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mplus",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "以心伝心ゲーム",
  description: "チーム対抗・回答一致率ゲーム。飲み会の出し物に。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${mplus.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
