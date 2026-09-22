import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { calculateCashOnlySetAside, calculateSetAsideShareComparison } from "../lib/setAside";
import { CycleSetAside } from "../lib/types";
import { MetricCard } from "./MetricCard";

export function SetAsideSummary({ value, onMetricClick, onRecordActual }: { value: CycleSetAside; onMetricClick?: (metric: string) => void; onRecordActual?: () => void }) {
  const shortfallValue = value.shortfall == null ? "Unable to calculate" : formatCurrency(value.shortfall);
  const cashOnlySetAside = calculateCashOnlySetAside(value);
  const cashAfterSetAside = cashOnlySetAside.cashAfterSetAside;
  const shares = calculateSetAsideShareComparison(value);
  const actual = value.actualSetAside;
  const reserve = value.otherProductsReserve;
  const showActual = !value.isEstimate;
  const totalTargets = shares.puresafe.target == null || shares.otherProducts.target == null || shares.toStash.target == null
    ? null : shares.puresafe.target + shares.otherProducts.target + shares.electricity.target + shares.toStash.target;

  return (
    <Stack spacing={4}>
      {onRecordActual && showActual ? <Button variant="outline" alignSelf="start" onClick={onRecordActual}>{actual ? "Correct actual set aside" : "Record actual set aside"}</Button> : null}
      {showActual ? <SimpleGrid columns={{ base: 1, sm: 2, md: 5 }} spacing={3}>
        <MetricCard label="Total targets" value={totalTargets == null ? "Unable to calculate" : formatCurrency(totalTargets)} />
        <MetricCard label="Actual Set Aside" value={actual ? formatCurrency(actual.physicalCashTotal) : "Not recorded"} hint="Physical cash only" />
        <MetricCard label="Used for restocks" value={reserve?.usedForRestocks == null ? "Not tracked yet" : formatCurrency(reserve.usedForRestocks)} hint="Other Products purchases" />
        <MetricCard label="Net Set Aside" value={reserve?.netSetAside == null ? "Not recorded" : formatCurrency(reserve.netSetAside)} hint="Other Products actual less restocks" />
        <MetricCard label="Closing reserve" value={reserve?.closingBalance == null ? "Not tracked yet" : formatCurrency(reserve.closingBalance)} hint={reserve?.openingBalance == null ? undefined : `${formatCurrency(reserve.openingBalance)} opening`} />
      </SimpleGrid> : null}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
        <MetricCard label="Cash available for reserves" value={formatCurrency(value.cashAvailableAfterChangeFloat)} hint="After preserving the change float" onClick={onMetricClick ? () => onMetricClick("cashAvailableAfterChangeFloat") : undefined} />
        <SetAsideShareCard label="Puresafe Capital" target={shares.puresafe.target} canSetAside={shares.puresafe.canSetAside} showActual={showActual} actual={actual?.puresafeCapital ?? null} onClick={onMetricClick ? () => onMetricClick("puresafeCapital") : undefined} />
        <SetAsideShareCard label="Other Products Capital" target={shares.otherProducts.target} canSetAside={shares.otherProducts.canSetAside} showActual={showActual} actual={actual?.otherProductsCapital ?? null} onClick={onMetricClick ? () => onMetricClick("miscCapital") : undefined}>
          {reserve ? <Stack spacing={0.5}><Text>Used for restocks: {reserve.usedForRestocks == null ? "Not tracked yet" : formatCurrency(reserve.usedForRestocks)}</Text><Text>Net set aside: {reserve.netSetAside == null ? "Not recorded" : formatCurrency(reserve.netSetAside)}</Text><Text>Reserve: {reserve.openingBalance == null ? "Not tracked" : formatCurrency(reserve.openingBalance)} opening · {reserve.closingBalance == null ? "Not tracked" : formatCurrency(reserve.closingBalance)} closing</Text></Stack> : null}
        </SetAsideShareCard>
        <SetAsideShareCard label="Electricity Share" target={shares.electricity.target} canSetAside={shares.electricity.canSetAside} showActual={showActual} actual={actual?.electricityShare ?? null} hint={value.isEstimate ? "Estimated for the active cycle" : undefined} onClick={onMetricClick ? () => onMetricClick("electricityShare") : undefined} />
        <MetricCard label="Cash shortfall" value={shortfallValue} hint="Reserves not covered by available cash" onClick={onMetricClick ? () => onMetricClick("shortfall") : undefined} />
        <SetAsideShareCard
          label="To Stash"
          target={shares.toStash.target}
          canSetAside={shares.toStash.canSetAside}
          showActual={showActual}
          actual={actual?.toStashTotal ?? null}
          actualLabel="Actual total to Stash"
          hint="Untouched online payments plus cash left after reserves"
          onClick={onMetricClick ? () => onMetricClick("remainingEarnings") : undefined}
        >
            <StashBreakdown
              availableOnlinePayments={shares.toStash.onlinePayments}
              gcashPayments={value.gcashPayments}
              mayaPayments={value.mayaPayments}
              otherOnlinePayments={value.otherOnlinePayments}
              cashAfterSetAside={shares.toStash.cashAfterReserves}
            />
            {actual ? <Text>Total actually to Stash: {formatCurrency(actual.toStashTotal)}</Text> : null}
            {actual ? <Text>Recorded physical cash: {formatCurrency(actual.toStashCash)}</Text> : null}
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
            <Text>Cash after set aside: {formatCurrency(cashAfterSetAside)} · GCash to Stash: {formatCurrency(value.gcashPayments ?? 0)} · Maya to Stash: {formatCurrency(value.mayaPayments ?? 0)}{(value.otherOnlinePayments ?? 0) > 0 ? ` · Other online: ${formatCurrency(value.otherOnlinePayments ?? 0)}` : ""}</Text>
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
  showActual = false,
  actual,
  actualLabel = "Actual set aside",
  actualComparisonAvailable = true,
}: {
  label: string;
  target: number | null;
  canSetAside: number | null;
  hint?: string;
  onClick?: () => void;
  children?: ReactNode;
  showActual?: boolean;
  actual?: number | null;
  actualLabel?: string;
  actualComparisonAvailable?: boolean;
}) {
  return (
    <MetricCard
      label={label}
      value={target == null ? "Target unavailable" : `Target ${formatCurrency(target)}`}
      hint={hint}
      onClick={onClick}
      accent={(
        <Stack spacing={0.5} mt={2} color="canvas.700" fontSize="sm" lineHeight="short">
          {showActual ? <Text fontWeight="800">{actualLabel}: {actual == null ? "Not recorded" : formatCurrency(actual)}</Text> : null}
          {showActual && actual != null && target != null ? <Text>{!actualComparisonAvailable ? "Shortage/excess unavailable until every included cycle is recorded" : actual < target ? `Shortage: ${formatCurrency(target - actual)}` : actual > target ? `Excess: ${formatCurrency(actual - target)}` : "Matches target"}</Text> : null}
          <Text fontWeight="700">Can set aside: {canSetAside == null ? "Unable to calculate" : formatCurrency(canSetAside)}</Text>
          {children}
        </Stack>
      )}
    />
  );
}

export function StashBreakdown({
  availableOnlinePayments,
  gcashPayments,
  mayaPayments,
  otherOnlinePayments,
  cashAfterSetAside,
}: {
  availableOnlinePayments: number;
  gcashPayments?: number;
  mayaPayments?: number;
  otherOnlinePayments?: number;
  cashAfterSetAside: number | null;
}) {
  const hasMethodBreakdown = gcashPayments != null || mayaPayments != null || otherOnlinePayments != null;
  return (
    <Stack spacing={0.5}>
      {hasMethodBreakdown ? <>
        <Text>GCash: {formatCurrency(gcashPayments ?? 0)}</Text>
        <Text>Maya: {formatCurrency(mayaPayments ?? 0)}</Text>
        {(otherOnlinePayments ?? 0) > 0 ? <Text>Other online: {formatCurrency(otherOnlinePayments ?? 0)}</Text> : null}
      </> : <Text>Online payments: {formatCurrency(availableOnlinePayments)}</Text>}
      <Text>Cash after reserves: {cashAfterSetAside == null ? "Unable to calculate" : formatCurrency(cashAfterSetAside)}</Text>
    </Stack>
  );
}
