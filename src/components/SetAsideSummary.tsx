import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { calculateCashOnlySetAside, calculateSetAsideShareComparison } from "../lib/setAside";
import { CycleSetAside } from "../lib/types";
import { MetricCard } from "./MetricCard";

export function SetAsideSummary({ value, onMetricClick }: { value: CycleSetAside; onMetricClick?: (metric: string) => void }) {
  const shortfallValue = value.shortfall == null ? "Unable to calculate" : formatCurrency(value.shortfall);
  const cashOnlySetAside = calculateCashOnlySetAside(value);
  const cashAfterSetAside = cashOnlySetAside.cashAfterSetAside;
  const shares = calculateSetAsideShareComparison(value);

  return (
    <Stack spacing={4}>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
        <MetricCard label="Cash available for reserves" value={formatCurrency(value.cashAvailableAfterChangeFloat)} hint="After preserving the change float" onClick={onMetricClick ? () => onMetricClick("cashAvailableAfterChangeFloat") : undefined} />
        <SetAsideShareCard label="Puresafe Capital" target={shares.puresafe.target} canSetAside={shares.puresafe.canSetAside} onClick={onMetricClick ? () => onMetricClick("puresafeCapital") : undefined} />
        <SetAsideShareCard label="Other Products Capital" target={shares.otherProducts.target} canSetAside={shares.otherProducts.canSetAside} onClick={onMetricClick ? () => onMetricClick("miscCapital") : undefined} />
        <SetAsideShareCard label="Electricity Share" target={shares.electricity.target} canSetAside={shares.electricity.canSetAside} hint={value.isEstimate ? "Estimated for the active cycle" : undefined} onClick={onMetricClick ? () => onMetricClick("electricityShare") : undefined} />
        <MetricCard label="Cash shortfall" value={shortfallValue} hint="Reserves not covered by available cash" onClick={onMetricClick ? () => onMetricClick("shortfall") : undefined} />
        <SetAsideShareCard
          label="To Stash"
          target={shares.toStash.target}
          canSetAside={shares.toStash.canSetAside}
          hint="Untouched online payments plus cash left after reserves"
          onClick={onMetricClick ? () => onMetricClick("remainingEarnings") : undefined}
        >
            <StashBreakdown
              availableOnlinePayments={shares.toStash.onlinePayments}
              cashAfterSetAside={shares.toStash.cashAfterReserves}
            />
        </SetAsideShareCard>
      </SimpleGrid>

      <Box bg="canvas.50" borderRadius="20px" p={4}>
        <Text fontWeight="900">Calculation</Text>
        <Text color="canvas.700" mt={1}>
          Set aside is deducted from cash only in this priority: Puresafe, other products, then electricity. Online payments remain untouched.
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
        <Text color="canvas.700" mt={1}>
          Electricity: {value.cycleHours.toFixed(2)} hours × {formatCurrency(value.electricityCostPerHour)} = {formatCurrency(value.electricityShare)}{value.isEstimate ? " (Estimated)" : ""}
        </Text>
        {cashAfterSetAside != null ? (
          <Stack spacing={1} mt={2} color="canvas.700">
            <Text>Cash after set aside: {formatCurrency(cashAfterSetAside)} · Online to stash: {formatCurrency(value.availableOnlinePayments)}</Text>
          </Stack>
        ) : null}
      </Box>
    </Stack>
  );
}

export function SetAsideShareCard({
  label,
  target,
  canSetAside,
  hint,
  onClick,
  children,
}: {
  label: string;
  target: number | null;
  canSetAside: number | null;
  hint?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <MetricCard
      label={label}
      value={target == null ? "Target unavailable" : `Target ${formatCurrency(target)}`}
      hint={hint}
      onClick={onClick}
      accent={(
        <Stack spacing={0.5} mt={2} color="canvas.700" fontSize="sm" lineHeight="short">
          <Text fontWeight="700">Can set aside: {canSetAside == null ? "Unable to calculate" : formatCurrency(canSetAside)}</Text>
          {children}
        </Stack>
      )}
    />
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
    <Stack spacing={0.5}>
      <Text>Online payments: {formatCurrency(availableOnlinePayments)}</Text>
      <Text>Cash after reserves: {cashAfterSetAside == null ? "Unable to calculate" : formatCurrency(cashAfterSetAside)}</Text>
    </Stack>
  );
}
