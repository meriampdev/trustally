import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  breakpoints: {
    sm: "30em",
    md: "48em",
    lg: "64em",
    xl: "90em",
  },
  colors: {
    brand: {
      50: "#fff7e2",
      100: "#f9e0a8",
      200: "#f1c96d",
      300: "#e2a93a",
      400: "#be7a1e",
      500: "#8a5318",
      600: "#663d13",
      700: "#47290d",
      800: "#2a1707",
      900: "#130903",
    },
    deposit: {
      50: "#ebfff3",
      500: "#157347",
      700: "#0f5132",
    },
    withdrawal: {
      50: "#fff0ed",
      500: "#b03a23",
      700: "#7a2718",
    },
    canvas: {
      50: "#fffaf0",
      100: "#f7efe0",
      200: "#eadfc8",
      700: "#5e564c",
      900: "#201c17",
    },
  },
  fonts: {
    heading: `"Avenir Next", "Segoe UI", sans-serif`,
    body: `"Avenir Next", "Segoe UI", sans-serif`,
  },
  radii: {
    "4xl": "28px",
  },
  styles: {
    global: {
      "html, body, #root": {
        minHeight: "100dvh",
        bg: "canvas.100",
      },
      body: {
        color: "canvas.900",
        bg: "canvas.100",
        backgroundImage:
          "radial-gradient(circle at top, rgba(214, 147, 41, 0.18), transparent 30%), linear-gradient(180deg, #f7efe0 0%, #f3ebdc 100%)",
        backgroundAttachment: "fixed",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        minH: "44px",
        borderRadius: "full",
        fontWeight: "700",
      },
      variants: {
        solid: {
          bg: "brand.400",
          color: "white",
          _hover: { bg: "brand.500" },
          _active: { bg: "brand.600" },
        },
        subtle: {
          bg: "whiteAlpha.900",
          color: "canvas.900",
        },
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
  },
});
