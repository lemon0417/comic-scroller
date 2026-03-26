/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app.html",
    "./manage.html",
    "./popup.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        comic: {
          ink: "#0F172A",
          paper: "#FFFFFF",
          paper2: "#EEF2F7",
          accent: "#2563EB",
          muted: "#64748B",
        },
        grey: {
          200: "#eeeeee",
          300: "#e0e0e0",
          400: "#bdbdbd",
          800: "#424242",
          900: "#212121",
        },
        "deep-orange": {
          500: "#ff5722",
        },
      },
      boxShadow: {
        comic: "4px 4px 0 #111827",
        "comic-sm": "2px 2px 0 #111827",
        "paper-1":
          "0 1px 6px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.24)",
        "paper-2":
          "0 3px 10px rgba(0, 0, 0, 0.16), 0 3px 10px rgba(0, 0, 0, 0.23)",
        "paper-3":
          "0 10px 30px rgba(0, 0, 0, 0.19), 0 6px 10px rgba(0, 0, 0, 0.23)",
        "paper-4":
          "0 14px 45px rgba(0, 0, 0, 0.25), 0 10px 18px rgba(0, 0, 0, 0.22)",
        "paper-5":
          "0 19px 60px rgba(0, 0, 0, 0.30), 0 15px 20px rgba(0, 0, 0, 0.22)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      backgroundImage: {
        halftone:
          "radial-gradient(rgba(17, 24, 39, 0.18) 1px, transparent 1px)",
      },
      backgroundSize: {
        halftone: "12px 12px",
      },
      keyframes: {
        "circular-rotate": {
          "100%": { transform: "rotate(360deg)" },
        },
        "circular-dash": {
          "0%": {
            "stroke-dasharray": "1.25, 250",
            "stroke-dashoffset": "1.25",
          },
          "50%": {
            "stroke-dasharray": "111.25, 250",
            "stroke-dashoffset": "-43.75",
          },
          "100%": {
            "stroke-dasharray": "111.25, 250",
            "stroke-dashoffset": "-155",
          },
        },
      },
      animation: {
        "circular-rotate": "circular-rotate 2s linear infinite",
        "circular-dash": "circular-dash 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
