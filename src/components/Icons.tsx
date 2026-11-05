import {
  Bike,
  Calendar,
  Camera,
  Car,
  Images,
  CreditCard,
  FileSignature,
  House,
  IdCard,
  Leaf,
  MapPin,
  MessageCircle,
  Package,
  Sprout,
  SquareParking,
  Sun,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { CategoryId } from "@/content/categories";

function base(props: LucideProps) {
  const { size = 24, strokeWidth = 2, className, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    ...rest,
  };
}

export function TyreIcon(props: LucideProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  );
}

export function SkisIcon(props: LucideProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 17 16.6 3.4a1.6 1.6 0 0 1 2.3 2.2" />
      <path d="M7 21 20.6 7.4a1.6 1.6 0 0 1 2.3 2.2" />
      <path d="M8.6 9.6l2.8 2.8M12.6 13.6l2.8 2.8" />
    </svg>
  );
}

export function SnowmobileIcon(props: LucideProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 18.5A1.5 1.5 0 0 0 4 20h6" />
      <path d="M7 20l1.6-4" />
      <rect x="11" y="16" width="10.5" height="4" rx="2" />
      <path d="M6 16h15.5v-1.5A2.5 2.5 0 0 0 19 12h-3l-2-3h-2.5L9.5 12H8" />
      <path d="M11.5 9 13 6" />
    </svg>
  );
}

export const categoryIcons: Record<CategoryId, LucideIcon | typeof TyreIcon> = {
  tyres: TyreIcon,
  skis: SkisIcon,
  snowmobile: SnowmobileIcon,
  bikes: Bike,
  boxes: Package,
  car: Car,
  parking: SquareParking,
};

export const trustIcons: Record<string, LucideIcon> = {
  id: IdCard,
  photos: Images,
  contract: FileSignature,
  camera: Camera,
  card: CreditCard,
  support: MessageCircle,
};

export const whyIcons: LucideIcon[] = [MapPin, Wallet, Calendar, House];

export const seasonIcons: LucideIcon[] = [Leaf, Sprout, Sun];
