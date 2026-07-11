/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./inbound-email.js",
      "./styles.css",
      "./**/*.html"
    ],
    theme: {
      extend: {
        colors: {
          // Premium, minimal palette
          surface: {
            light: "#F7F7F8",   // snapshot background
            card: "#FFFFFF",    // main cards
            accent: "#F0F5FF",  // coach insight background
          },
          border: {
            subtle: "#E5E7EB",
            strong: "#D1D5DB",
          },
          brand: {
            action: "#4CAF50",  // green accent for Next Actions
            insight: "#3A7AFE", // blue accent for Coach Insight
          }
        },
        boxShadow: {
          card: "0 2px 4px rgba(0,0,0,0.06)",
          cardStrong: "0 4px 8px rgba(0,0,0,0.08)"
        },
        borderRadius: {
          card: "12px"
        },
        spacing: {
          cardPadding: "20px"
        },
        fontFamily: {
          sans: ["Inter", "system-ui", "sans-serif"]
        }
      }
    },
    plugins: []
  }
  