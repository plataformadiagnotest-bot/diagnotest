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
        g900: "#0d3b1e",
        g800: "#1a5c2e",
        g700: "#226b37",
        g600: "#2d8547",
        g500: "#3ca05a",
        g400: "#5ab875",
        g200: "#a8dbb8",
        g100: "#d4eedd",
        g50: "#eef8f2",
        amber: "#f5a623",
        "amber-bg": "#fff8ec",
        "amber-text": "#7a4e00",
        gy50: "#f7f8fa",
        gy100: "#eef0f3",
        gy200: "#e2e5eb",
        gy300: "#ccd0d9",
        gy400: "#9ba3af",
        gy600: "#5a6270",
        gy800: "#2c3140",
        gy900: "#1a1f2e",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
