import type { Metadata } from "next";
import { ModeChooser } from "@/components/app/ModeChooser";

export const metadata: Metadata = { title: "Ditt konto" };

export default function Page() {
  return <ModeChooser />;
}
