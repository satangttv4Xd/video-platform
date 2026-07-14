import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12131a",
          soft: "#2a2c38",
        },
        paper: {
          DEFAULT: "#0f1015",
          card: "#181a22",
          line: "#262835",
        },
        accent: {
          DEFAULT: "#5b7cfa",
          hover: "#4869f5",
          soft: "#1c2340",
        },
        muted: "#8a8f9e",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
