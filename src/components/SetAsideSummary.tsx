import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { CycleSetAside } from "../lib/types";
import { MetricCard } from "./MetricCard";

export function SetAsideSummary({ value, onMetricClick }: { value: CycleSetAside; onMetricClick?: (metric: string) => void }) {
  const puresafeValue = value.missingPuresafeCost
    ? "Unable to calculate"
    : formatCurrency(value.puresafeCapital);
  const totalValue = value.totalSetAside == null ? "Unable to calculate" : formatCurrency(value.totalSetAside);
  const earningsValue = value.remainingEarnings == null ? "Unable to calculate" : formatCurrency(value.remainingEarnings);
  const shortfallValue = value.shortfall == null ? "Unable to calculate" : formatCurrency(value.shortfall);

  return (
    <Stack spacing={4}>
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
        <MetricCard label="Cash after change float" value={formatCurrency(value.cashAvailableAfterChangeFloat)} onClick={onMetricClick ? () => onMetricClick("cashAvailableAfterChangeFloat") : undefined} />
        <MetricCard label="Available online payments" value={formatCurrency(value.availableOnlinePayments)} onClick={onMetricClick ? () => onMetricClick("availableOnlinePayments") : undefined} />
        <MetricCard label="Total available" value={formatCurrency(value.totalAvailable)} onClick={onMetricClick ? () => onMetricClick("totalAvailable") : undefined} />
        <MetricCard label="Puresafe Capital" value={puresafeValue} onClick={onMetricClick ? () => onMetricClick("puresafeCapital") : undefined} />
        <MetricCard label="Electricity Share" value={formatCurrency(value.electricityShare)} hint={value.isEstimate ? "Estimated for the active cycle" : undefined} onClick={onMetricClick ? () => onMetricClick("electricityShare") : undefined} />
        <MetricCard label="Other Products Capital" value={value.miscCapital == null ? "Unable to calculate" : formatCurrency(value.miscCapital)} onClick={onMetricClick ? () => onMetricClick("miscCapital") : undefined} />
        <MetricCard label="Total set aside" value={totalValue} onClick={onMetricClick ? () => onMetricClick("totalSetAside") : undefined} />
        <MetricCard label="To Stash" value={earningsValue} hint="Net profit available after change float and all reserves" onClick={onMetricClick ? () => onMetricClick("remainingEarnings") : undefined} />
        <MetricCard label="Shortfall" value={shortfallValue} onClick={onMetricClick ? () => onMetricClick("shortfall") : undefined} />
      </SimpleGrid>

      <Box bg="canvas.50" borderRadius="20px" p={4}>
        <Text fontWeight="900">Calculation</Text>
        {value.missingPuresafeCost ? (
          <Stack mt={2} spacing={2}>
            <Text color="caution.600">Puresafe capital cannot be calculated because its cost per unit is missing.</Text>
            <Button as={Link} to="/products" size="sm" variant="outline" alignSelf="start">Complete Puresafe product cost</Button>
          </Stack>
        ) : (
          <Text color="canvas.700" mt={1}>
            Puresafe: {value.puresafeBottlesToReplace} bottle{value.puresafeBottlesToReplace === 1 ? "" : "s"} × {formatCurrency(value.puresafeCostPerUnit ?? 0)} = {formatCurrency(value.puresafeCapital)}
          </Text>
        )}
        <Text color="canvas.700" mt={1}>
          Electricity: {value.cycleHours.toFixed(2)} hours × {formatCurrency(value.electricityCostPerHour)} = {formatCurrency(value.electricityShare)}{value.isEstimate ? " (Estimated)" : ""}
        </Text>
        <Text color="canvas.700" mt={1}>
          {value.missingMiscellaneousCost
            ? "Other products: Unable to calculate because at least one depleted product has no unit cost"
            : `Other products: ${value.miscellaneousBottlesToReplace ?? 0} bottle${value.miscellaneousBottlesToReplace === 1 ? "" : "s"} to replace = ${formatCurrency(value.miscCapital)}`}
        </Text>
        {value.miscellaneousProductBreakdown?.map((product) => (
          <Text key={product.productId} color="canvas.700" mt={1} pl={3}>
            {product.productName}: {product.unitsToReplace} × {product.unitCost == null || product.unitCost <= 0 ? "Missing cost" : formatCurrency(product.unitCost)} = {product.capital == null ? "Unable to calculate" : formatCurrency(product.capital)}
          </Text>
        ))}
        {value.missingMiscellaneousCost ? (
          <Button as={Link} to="/products" size="sm" variant="outline" mt={3}>Complete product costs</Button>
        ) : null}
      </Box>
    </Stack>
  );
}
