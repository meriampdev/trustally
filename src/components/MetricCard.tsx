import { Box, Text } from "@chakra-ui/react";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: ReactNode;
}

export function MetricCard({ label, value, hint, accent }: MetricCardProps) {
  return (
    <Box
      bg="rgba(255,255,255,0.86)"
      borderRadius="26px"
      p={4}
      border="1px solid"
      borderColor="whiteAlpha.700"
      shadow="sm"
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
