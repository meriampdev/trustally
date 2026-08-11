import { Box, Skeleton, Stat, StatHelpText, StatLabel, StatNumber } from "@chakra-ui/react";
import { formatCurrency, formatPercent, formatWholeNumber } from "../lib/format";

interface MetricCardProps {
  label: string;
  value: number;
  hint: string;
  loading?: boolean;
  color?: string;
  valueType?: "currency" | "number" | "percent";
}

export function MetricCard({
  label,
  value,
  hint,
  loading = false,
  color = "canvas.900",
  valueType = "currency",
}: MetricCardProps) {
  return (
    <Box
      bg="whiteAlpha.900"
      borderRadius="24px"
      px={4}
      py={4}
      shadow="sm"
      border="1px solid"
      borderColor="blackAlpha.100"
    >
      {loading ? (
        <Skeleton height="88px" borderRadius="20px" />
      ) : (
        <Stat>
          <StatLabel color="canvas.700">{label}</StatLabel>
          <StatNumber color={color}>
            {valueType === "percent"
              ? formatPercent(value)
              : valueType === "number"
                ? formatWholeNumber(value)
                : formatCurrency(value)}
          </StatNumber>
          <StatHelpText mb={0}>{hint}</StatHelpText>
        </Stat>
      )}
    </Box>
  );
}
