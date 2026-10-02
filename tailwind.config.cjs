const withOpacity = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined) {
    return `rgb(var(${variable}) / 1)`;
  }
  return `rgb(var(${variable}) / ${opacityValue})`;
};

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
          ink: withOpacity("--cs-color-ink"),
          "ink-soft": withOpacity("--cs-color-ink-soft"),
          paper: withOpacity("--cs-color-paper"),
          "paper-soft": withOpacity("--cs-color-paper-soft"),
          "paper-hover": withOpacity("--cs-color-paper-hover"),
          "paper-hover-strong": withOpacity("--cs-color-paper-hover-strong"),
          "paper-wash": withOpacity("--cs-color-paper-wash"),
          paper2: withOpacity("--cs-color-paper-wash"),
          "tab-wash": withOpacity("--cs-color-tab-wash"),
          line: withOpacity("--cs-color-line"),
          accent: withOpacity("--cs-color-primary"),
          "accent-hover": withOpacity("--cs-color-primary-hover"),
          muted: withOpacity("--cs-color-ink-muted"),
          "danger-text": withOpacity("--cs-color-danger-text"),
          "danger-bg": withOpacity("--cs-color-danger-bg"),
          "danger-bg-hover": withOpacity("--cs-color-danger-bg-hover"),
          "success-bg": withOpacity("--cs-color-success-bg"),
          "cover-fallback": withOpacity("--cs-color-cover-fallback"),
        },
        grey: {
          200: withOpacity("--cs-color-legacy-grey-200"),
          300: withOpacity("--cs-color-legacy-grey-300"),
          400: withOpacity("--cs-color-legacy-grey-400"),
          800: withOpacity("--cs-color-legacy-grey-800"),
          900: withOpacity("--cs-color-legacy-grey-900"),
        },
        "deep-orange": {
          500: withOpacity("--cs-color-legacy-deep-orange-500"),
        },
      },
      boxShadow: {
        comic: "var(--cs-shadow-comic)",
        "comic-sm": "var(--cs-shadow-comic-sm)",
        subtle: "var(--cs-shadow-subtle)",
        "paper-1": "var(--cs-shadow-legacy-paper-1)",
        "paper-2": "var(--cs-shadow-legacy-paper-2)",
        "paper-3": "var(--cs-shadow-legacy-paper-3)",
        "paper-4": "var(--cs-shadow-legacy-paper-4)",
        "paper-5": "var(--cs-shadow-legacy-paper-5)",
      },
      fontFamily: {
        sans: [
          "Avenir Next",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        display: [
          "Avenir Next",
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
          "radial-gradient(rgb(var(--cs-color-shadow-ink) / 0.18) 1px, transparent 1px)",
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
