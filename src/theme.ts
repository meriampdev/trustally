import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: "#dff7ff",
      100: "#aee7ff",
      200: "#79d4ff",
      300: "#46c1ff",
      400: "#12a7ef",
      500: "#0b87c4",
      600: "#086693",
      700: "#054662",
      800: "#02283a",
      900: "#01111c",
    },
    canvas: {
      50: "#17314d",
      100: "#0b1726",
      200: "#18314d",
      300: "#2b4d74",
      700: "#a4c6e1",
      900: "#f3fbff",
    },
    honesty: {
      50: "#dffdf8",
      400: "#34d5b4",
      500: "#23a98f",
      700: "#126659",
    },
    caution: {
      50: "#fff1ee",
      400: "#ff8966",
      600: "#d75932",
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
          "radial-gradient(circle at top, rgba(53, 189, 255, 0.28), transparent 26%), radial-gradient(circle at 20% 20%, rgba(120, 223, 255, 0.14), transparent 30%), linear-gradient(180deg, #102134 0%, #0b1726 54%, #07101a 100%)",
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
          color: "canvas.900",
          _hover: { bg: "brand.500" },
          _active: { bg: "brand.600" },
        },
        outline: {
          bg: "rgba(23, 49, 77, 0.72)",
          color: "canvas.900",
          border: "1px solid",
          borderColor: "rgba(142, 182, 215, 0.22)",
          _hover: {
            bg: "rgba(28, 59, 91, 0.96)",
            borderColor: "brand.300",
          },
          _active: {
            bg: "canvas.50",
          },
        },
        ghost: {
          color: "canvas.900",
          _hover: {
            bg: "whiteAlpha.120",
          },
          _active: {
            bg: "whiteAlpha.200",
          },
        },
        subtle: {
          bg: "rgba(24, 50, 78, 0.84)",
          color: "canvas.700",
          _hover: {
            bg: "rgba(31, 62, 95, 0.98)",
            color: "canvas.900",
          },
          _active: {
            bg: "canvas.50",
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: "rgba(19, 40, 63, 0.9)",
            borderColor: "rgba(142, 182, 215, 0.22)",
            color: "canvas.900",
            _placeholder: {
              color: "canvas.700",
            },
            _hover: {
              borderColor: "brand.300",
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
            bg: "rgba(19, 40, 63, 0.9)",
            borderColor: "rgba(142, 182, 215, 0.22)",
            color: "canvas.900",
            _hover: {
              borderColor: "brand.300",
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
          bg: "rgba(19, 40, 63, 0.9)",
          borderColor: "rgba(142, 182, 215, 0.22)",
          color: "canvas.900",
          _placeholder: {
            color: "canvas.700",
          },
          _hover: {
            borderColor: "brand.300",
          },
        },
      },
      defaultProps: {
        focusBorderColor: "brand.400",
      },
    },
  },
});
