import { Box, Text } from "@chakra-ui/react";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: ReactNode;
  onClick?: () => void;
}

export function MetricCard({ label, value, hint, accent, onClick }: MetricCardProps) {
  return (
    <Box
      as={onClick ? "button" : "div"}
      onClick={onClick}
      textAlign="left"
      width="100%"
      cursor={onClick ? "pointer" : "default"}
      bg="linear-gradient(180deg, rgba(25, 53, 82, 0.9) 0%, rgba(14, 31, 49, 0.86) 100%)"
      borderRadius="26px"
      p={4}
      border="1px solid"
      borderColor="rgba(142, 182, 215, 0.16)"
      boxShadow="0 16px 32px rgba(1, 10, 20, 0.28)"
      transition="transform 160ms ease, border-color 160ms ease"
      _hover={onClick ? { transform: "translateY(-2px)", borderColor: "brand.400" } : undefined}
    >
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.14em" color="canvas.700">
        {label}
      </Text>
      <Text mt={2} fontSize="2xl" fontWeight="900" color="canvas.900">
        {value}
      </Text>
      {hint ? (
        <Text mt={1} color="canvas.700">
          {hint}
        </Text>
      ) : null}
      {accent}
    </Box>
  );
}
