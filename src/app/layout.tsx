import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Design system Modernist: Archivo em tudo (400, 600, 800).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "Onboardinho",
  description: "Orientações do manual do time no momento certo de cada cliente",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
