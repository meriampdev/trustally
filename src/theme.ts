import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: "#fff9eb",
      100: "#f8e8b6",
      200: "#f1d17c",
      300: "#e5b34e",
      400: "#c88c1d",
      500: "#9f6a13",
      600: "#774d0d",
      700: "#513306",
      800: "#2e1b02",
      900: "#140a00",
    },
    canvas: {
      50: "#fffdf8",
      100: "#f7f0e0",
      200: "#eadfc7",
      700: "#64584a",
      900: "#1e1914",
    },
    honesty: {
      50: "#eefdf4",
      400: "#2f9a60",
      500: "#23764a",
      700: "#16472d",
    },
    caution: {
      50: "#fff3ed",
      400: "#d36a2e",
      600: "#973f14",
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
      },
      body: {
        color: "canvas.900",
        bg: "canvas.100",
        backgroundImage:
          "radial-gradient(circle at top, rgba(200, 140, 29, 0.2), transparent 30%), linear-gradient(180deg, #fbf5e8 0%, #f2e7d0 100%)",
        backgroundAttachment: "fixed",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        minH: "46px",
        borderRadius: "full",
        fontWeight: "800",
        letterSpacing: "-0.01em",
      },
      variants: {
        solid: {
          bg: "brand.400",
          color: "white",
          _hover: { bg: "brand.500" },
          _active: { bg: "brand.600" },
        },
        outline: {
          bg: "rgba(255,255,255,0.72)",
          color: "canvas.900",
          border: "1px solid",
          borderColor: "canvas.200",
          _hover: {
            bg: "white",
            borderColor: "brand.200",
          },
          _active: {
            bg: "canvas.50",
          },
        },
        ghost: {
          color: "canvas.900",
          _hover: {
            bg: "blackAlpha.50",
          },
          _active: {
            bg: "blackAlpha.100",
          },
        },
        subtle: {
          bg: "rgba(255,255,255,0.62)",
          color: "canvas.700",
          _hover: {
            bg: "rgba(255,255,255,0.88)",
            color: "canvas.900",
          },
          _active: {
            bg: "white",
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: "rgba(255,255,255,0.92)",
            borderColor: "canvas.200",
            color: "canvas.900",
            _placeholder: {
              color: "canvas.700",
            },
            _hover: {
              borderColor: "brand.200",
            },
          },
        },
      },
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
    NumberInput: {
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            bg: "rgba(255,255,255,0.92)",
            borderColor: "canvas.200",
            color: "canvas.900",
            _hover: {
              borderColor: "brand.200",
            },
          },
        },
      },
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
    Textarea: {
      variants: {
        outline: {
          bg: "rgba(255,255,255,0.92)",
          borderColor: "canvas.200",
          color: "canvas.900",
          _placeholder: {
            color: "canvas.700",
          },
          _hover: {
            borderColor: "brand.200",
          },
        },
      },
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
  },
});
