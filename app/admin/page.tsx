import type { Metadata } from "next";
import "../landing.css";
import "./admin.css";
import AdminDashboard from "./dashboard";

export const metadata: Metadata = { title: "Admin · Still With You", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}
