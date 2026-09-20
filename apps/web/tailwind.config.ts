import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b2748",
        ocean: "#17678b",
        teal: "#13876f",
        mist: "#eef7f6",
        amber: "#eca52e",
      },
      borderRadius: { card: "1.5rem" },
      boxShadow: { soft: "0 24px 60px rgba(11, 39, 72, 0.10)" },
    },
  },
  plugins: [],
} satisfies Config;
