import { Box, BoxProps, Text } from "@chakra-ui/react";
import { ReactNode } from "react";

interface SectionCardProps extends BoxProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
}

export function SectionCard({ title, eyebrow, children, ...boxProps }: SectionCardProps) {
  return (
    <Box
      bg="rgba(255,255,255,0.86)"
      borderRadius="30px"
      p={{ base: 4, md: 5, xl: 6 }}
      border="1px solid"
      borderColor="whiteAlpha.700"
      backdropFilter="blur(18px)"
      shadow="0 18px 45px rgba(30, 25, 20, 0.08)"
      {...boxProps}
    >
      {eyebrow ? (
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700">
          {eyebrow}
        </Text>
      ) : null}
      {title ? (
        <Text mt={eyebrow ? 1 : 0} fontSize="xl" fontWeight="900" color="canvas.900">
          {title}
        </Text>
      ) : null}
      <Box mt={title || eyebrow ? 4 : 0}>{children}</Box>
    </Box>
  );
}
