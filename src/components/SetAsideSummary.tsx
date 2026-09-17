import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { calculateCashOnlySetAside } from "../lib/setAside";
import { CycleSetAside } from "../lib/types";
import { MetricCard } from "./MetricCard";

export function SetAsideSummary({ value, onMetricClick }: { value: CycleSetAside; onMetricClick?: (metric: string) => void }) {
  const puresafeValue = value.missingPuresafeCost
    ? "Unable to calculate"
    : formatCurrency(value.puresafeCapital);
  const totalValue = value.totalSetAside == null ? "Unable to calculate" : formatCurrency(value.totalSetAside);
  const earningsValue = value.remainingEarnings == null ? "Unable to calculate" : formatCurrency(value.remainingEarnings);
  const shortfallValue = value.shortfall == null ? "Unable to calculate" : formatCurrency(value.shortfall);
  const cashAfterSetAside = calculateCashOnlySetAside(value).cashAfterSetAside;

  return (
    <Stack spacing={4}>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
        <MetricCard label="Cash available for reserves" value={formatCurrency(value.cashAvailableAfterChangeFloat)} hint="After preserving the change float" onClick={onMetricClick ? () => onMetricClick("cashAvailableAfterChangeFloat") : undefined} />
        <MetricCard label="Puresafe Capital" value={puresafeValue} onClick={onMetricClick ? () => onMetricClick("puresafeCapital") : undefined} />
        <MetricCard label="Electricity Share" value={formatCurrency(value.electricityShare)} hint={value.isEstimate ? "Estimated for the active cycle" : undefined} onClick={onMetricClick ? () => onMetricClick("electricityShare") : undefined} />
        <MetricCard label="Other Products Capital" value={value.miscCapital == null ? "Unable to calculate" : formatCurrency(value.miscCapital)} onClick={onMetricClick ? () => onMetricClick("miscCapital") : undefined} />
        <MetricCard label="Total set aside" value={totalValue} onClick={onMetricClick ? () => onMetricClick("totalSetAside") : undefined} />
        <MetricCard label="Cash shortfall" value={shortfallValue} hint="Reserves not covered by available cash" onClick={onMetricClick ? () => onMetricClick("shortfall") : undefined} />
        <MetricCard
          label="To Stash"
          value={earningsValue}
          hint="Untouched online payments plus cash left after reserves"
          accent={(
            <StashBreakdown
              availableOnlinePayments={value.availableOnlinePayments}
              cashAfterSetAside={cashAfterSetAside}
            />
          )}
          onClick={onMetricClick ? () => onMetricClick("remainingEarnings") : undefined}
        />
      </SimpleGrid>

      <Box bg="canvas.50" borderRadius="20px" p={4}>
        <Text fontWeight="900">Calculation</Text>
        <Text color="canvas.700" mt={1}>
          Set aside is deducted from cash only. Online payments remain untouched.
        </Text>
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
        {cashAfterSetAside != null ? (
          <Text color="canvas.700" mt={2}>
            Cash after set aside: {formatCurrency(cashAfterSetAside)} · Online to stash: {formatCurrency(value.availableOnlinePayments)}
          </Text>
        ) : null}
      </Box>
    </Stack>
  );
}

export function StashBreakdown({
  availableOnlinePayments,
  cashAfterSetAside,
}: {
  availableOnlinePayments: number;
  cashAfterSetAside: number | null;
}) {
  return (
    <Stack spacing={0.5} mt={2} color="canvas.700" fontSize="sm" lineHeight="short">
      <Text>Online payments: {formatCurrency(availableOnlinePayments)}</Text>
      <Text>Cash after reserves: {cashAfterSetAside == null ? "Unable to calculate" : formatCurrency(cashAfterSetAside)}</Text>
    </Stack>
  );
}
