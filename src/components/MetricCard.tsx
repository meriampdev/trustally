import { Box, HStack, Text, Tooltip } from "@chakra-ui/react";
import { Info } from "lucide-react";
import { KeyboardEvent, MouseEvent, ReactNode } from "react";

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
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
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
      <HStack align="center" spacing={1.5}>
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.14em" color="canvas.700">
          {label}
        </Text>
        {hint ? (
          <Tooltip
            label={hint}
            hasArrow
            placement="top"
            openDelay={150}
            bg="canvas.900"
            color="canvas.50"
            borderRadius="12px"
            px={3}
            py={2}
            maxW="280px"
          >
            <Box
              as="span"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              color="canvas.700"
              cursor="help"
              tabIndex={0}
              aria-label={`Information about ${label}`}
              onClick={(event: MouseEvent<HTMLSpanElement>) => event.stopPropagation()}
              onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => event.stopPropagation()}
            >
              <Info size={14} aria-hidden="true" />
            </Box>
          </Tooltip>
        ) : null}
      </HStack>
      <Text mt={2} fontSize="2xl" fontWeight="900" color="canvas.900">
        {value}
      </Text>
      {accent}
    </Box>
  );
}
