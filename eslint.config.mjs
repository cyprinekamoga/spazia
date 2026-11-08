import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", ".next-app/**", "out/**", "node_modules/**", "next-env.d.ts", "supabase/functions/**"] },
];

export default config;
