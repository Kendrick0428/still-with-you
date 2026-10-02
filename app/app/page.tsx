import type { Metadata } from "next";
import Script from "next/script";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./app.css";

export const metadata: Metadata = { title: "Still With You" };

// The app shell is static markup; public/swy-app.js renders every screen into #app on the client.
const shell = readFileSync(join(process.cwd(), "app/app/device.html"), "utf8");

export default function AppPage() {
  return (
    <>
      <div className="app-root" dangerouslySetInnerHTML={{ __html: shell }} />
      <Script src="/swy-app.js" strategy="afterInteractive" />
    </>
  );
}
