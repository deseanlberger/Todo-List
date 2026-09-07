import { redirect } from "next/navigation";

// Every screen reads live data, and the root layout reads the saved theme.
// Without this Next prerenders "/" at build time and the build itself talks
// to the database.
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/today");
}
