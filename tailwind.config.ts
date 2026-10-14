import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#12313D", moss: "#075A78", sea: "#075A78", aqua: "#9BE7DF", ice: "#E8F6F8", lime: "#9BE7DF", cloud: "#F3F9FA" },
      boxShadow: { soft: "0 14px 40px rgba(7, 67, 91, 0.09)" },
    },
  },
  plugins: [],
};

export default config;
