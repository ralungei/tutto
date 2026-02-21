import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tutto - Tu asistente para todo",
  description:
    "Asistente personal con IA y terminal integrada. Pregunta lo que quieras o ejecuta comandos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
