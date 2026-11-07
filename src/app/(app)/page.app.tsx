import type { Metadata } from "next";
import { AppStart } from "@/components/app/AppStart";

export const metadata: Metadata = { title: "Spazia" };

export default function Page() {
  return <AppStart />;
}
