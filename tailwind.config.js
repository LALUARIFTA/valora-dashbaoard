export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    "extend": {
      "fontFamily": {
        "sans": [
          "\"Plus Jakarta Sans Variable\"",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ]
      },
      "colors": {
        "brand": {
          "50": "#EEF2FF",
          "100": "#E0E7FF",
          "200": "#C7D2FE",
          "500": "#6366F1",
          "600": "#4F46E5",
          "700": "#4338CA",
          "800": "#3730A3",
          "900": "#312E81"
        },
        "tealcard": {
          "50": "#F0FDFA",
          "100": "#CCFBF1",
          "400": "#2DD4BF",
          "500": "#14B8A6",
          "600": "#0D9488",
          "700": "#0F766E",
          "800": "#115E59"
        },
        "amberpromo": {
          "400": "#FBBF24",
          "500": "#F59E0B",
          "600": "#D97706"
        }
      },
      "boxShadow": {
        "shell": "0 24px 60px -15px rgba(30, 41, 59, 0.10)",
        "nav": "0 4px 20px -2px rgba(30, 27, 75, 0.08)",
        "card-soft": "0 10px 25px -5px rgba(15, 23, 42, 0.05)",
        "dial": "0 14px 30px -6px rgba(67, 56, 202, 0.32)",
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
        "xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)"
      },
      "opacity": {
        "15": "0.15",
        "35": "0.35",
        "45": "0.45",
        "55": "0.55",
        "85": "0.85"
      },
      "backdropBlur": {
        "xs": "2px"
      }
    }
  },
};
