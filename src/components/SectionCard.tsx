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
      bg="linear-gradient(180deg, rgba(20, 43, 67, 0.9) 0%, rgba(13, 29, 46, 0.88) 100%)"
      borderRadius="30px"
      p={{ base: 4, md: 5, xl: 6 }}
      border="1px solid"
      borderColor="rgba(142, 182, 215, 0.18)"
      backdropFilter="blur(18px)"
      shadow="0 22px 50px rgba(1, 10, 20, 0.36)"
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
