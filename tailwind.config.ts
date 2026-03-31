import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Terminal/hacker aesthetic
        sp: {
          black: "#0a0a0a",
          dark: "#111111",
          panel: "#1a1a1a",
          border: "#2a2a2a",
          text: "#e0e0e0",
          muted: "#666666",
          green: "#00ff88",
          red: "#ff4444",
          yellow: "#ffaa00",
          blue: "#4488ff",
          purple: "#aa44ff",
          cyan: "#00ccff",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
