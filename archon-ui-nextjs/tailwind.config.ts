import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          100: "var(--color-brand-100)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
          800: "var(--color-brand-800)",
        },
        light: {
          100: "var(--color-light-100)",
          200: "var(--color-light-200)",
          300: "var(--color-light-300)",
        },
        dark: {
          100: "var(--color-dark-100)",
          200: "var(--color-dark-200)",
        },
      },
      screens: {
        "3xl": "106rem",
        "4xl": "112.5rem",
      },
      animation: {
        fadeIn: "fadeIn 200ms ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [require("flowbite/plugin")],
  darkMode: "class",
};

export default config;
