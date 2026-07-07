import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "rgb(var(--zama-gold-rgb) / <alpha-value>)",
        "gold-soft": "rgb(var(--zama-gold-soft-rgb) / <alpha-value>)",
        void: "rgb(var(--void-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        faint: "rgb(var(--faint-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "sans-serif"],
      },
      borderColor: {
        hairline: "var(--hairline)",
      },
      maxWidth: {
        content: "1180px",
      },
    },
  },
  plugins: [],
};
export default config;
