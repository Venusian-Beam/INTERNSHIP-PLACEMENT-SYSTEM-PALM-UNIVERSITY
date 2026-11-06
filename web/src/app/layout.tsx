import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const ui = Poppins({ variable: "--font-ui", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Career Services · Internship Placement",
  description: "Internship placement management for the university's Career Services.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // SEC-07: render every page per request, so Next.js can stamp the proxy's CSP nonce on its scripts.
  await connection();
  return (
    <html lang="en" className={`${ui.variable} h-full`}>
      <body className="flex min-h-full flex-col text-[14px] leading-normal">
        {children}
      </body>
    </html>
  );
}
