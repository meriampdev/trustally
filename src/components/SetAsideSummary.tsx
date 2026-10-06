import { Box, Button, Progress, SimpleGrid, Stack, Text } from "@chakra-ui/react";
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
    ? null : shares.puresafe.target + shares.otherProducts.target + shares.electricity.target + shares.contingency.target + shares.toStash.target;
  const bpiUnionbankReserveFunding = (value.unionbankPayments ?? 0) + (value.bpiPayments ?? 0);
  const cashToSetAside = value.cashAvailableAfterChangeFloat + bpiUnionbankReserveFunding;

  return (
    <Stack spacing={4}>
      {onRecordActual && showActual ? <Button variant="outline" alignSelf="start" onClick={onRecordActual}>{actual ? "Correct actual set aside" : "Record actual set aside"}</Button> : null}
      {showActual ? <SimpleGrid columns={{ base: 1, sm: 2, md: 5 }} spacing={3}>
        <MetricCard label="Total targets" value={totalTargets == null ? "Unable to calculate" : formatCurrency(totalTargets)} />
        <MetricCard label="Actual reserve funding" value={actual ? formatCurrency(actual.fundedReserveTotal ?? actual.physicalCashTotal) : "Not recorded"} hint={actual ? `${formatCurrency(actual.creditTotal ?? 0)} awaiting cash credit` : undefined} />
        <MetricCard label="Used for restocks" value={reserve?.usedForRestocks == null ? "Not tracked yet" : formatCurrency(reserve.usedForRestocks)} hint="Other Products purchases" />
        <MetricCard label="Net Set Aside" value={reserve?.netSetAside == null ? "Not recorded" : formatCurrency(reserve.netSetAside)} hint="Other Products actual less restocks" />
        <MetricCard label="Closing reserve" value={reserve?.closingBalance == null ? "Not tracked yet" : formatCurrency(reserve.closingBalance)} hint={reserve?.openingBalance == null ? undefined : `${formatCurrency(reserve.openingBalance)} opening`} />
      </SimpleGrid> : null}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
        <MetricCard label="Cash to set aside" value={formatCurrency(cashToSetAside)} hint={`Physical cash ${formatCurrency(value.cashAvailableAfterChangeFloat)} + BPI/UnionBank ${formatCurrency(bpiUnionbankReserveFunding)}`} onClick={onMetricClick ? () => onMetricClick("cashAvailableAfterChangeFloat") : undefined} />
        <SetAsideShareCard label="Puresafe Capital" target={shares.puresafe.target} canSetAside={shares.puresafe.canSetAside} showActual={showActual} actual={actual ? actual.puresafeCapital + (actual.creditPuresafeCapital ?? 0) : null} actualLabel="Actual funded" onClick={onMetricClick ? () => onMetricClick("puresafeCapital") : undefined}>
          {actual ? <Text>{formatCurrency(actual.puresafeCapital)} physical · {formatCurrency(actual.creditPuresafeCapital ?? 0)} credit</Text> : null}
          {value.fundBalances ? <ReserveBalanceLine value={value.fundBalances.puresafe} /> : null}
        </SetAsideShareCard>
        <SetAsideShareCard label="Other Products Capital" target={shares.otherProducts.target} canSetAside={shares.otherProducts.canSetAside} showActual={showActual} actual={actual ? actual.otherProductsCapital + (actual.creditOtherProductsCapital ?? 0) : null} actualLabel="Actual funded" onClick={onMetricClick ? () => onMetricClick("miscCapital") : undefined}>
          {actual ? <Text>{formatCurrency(actual.otherProductsCapital)} physical · {formatCurrency(actual.creditOtherProductsCapital ?? 0)} credit</Text> : null}
          {value.fundBalances ? <ReserveBalanceLine value={value.fundBalances.otherProducts} /> : null}
          {reserve ? <Stack spacing={0.5}><Text>Used for restocks: {reserve.usedForRestocks == null ? "Not tracked yet" : formatCurrency(reserve.usedForRestocks)}</Text><Text>Net set aside: {reserve.netSetAside == null ? "Not recorded" : formatCurrency(reserve.netSetAside)}</Text><Text>Reserve: {reserve.openingBalance == null ? "Not tracked" : formatCurrency(reserve.openingBalance)} opening · {reserve.closingBalance == null ? "Not tracked" : formatCurrency(reserve.closingBalance)} closing</Text></Stack> : null}
        </SetAsideShareCard>
        <SetAsideShareCard label="Electricity Share" target={shares.electricity.target} canSetAside={shares.electricity.canSetAside} showActual={showActual} actual={actual ? actual.electricityShare + (actual.creditElectricityShare ?? 0) : null} actualLabel="Actual funded" hint={value.isEstimate ? "Estimated for the active cycle" : undefined} onClick={onMetricClick ? () => onMetricClick("electricityShare") : undefined}>
          {actual ? <Text>{formatCurrency(actual.electricityShare)} physical · {formatCurrency(actual.creditElectricityShare ?? 0)} credit</Text> : null}
          {value.fundBalances ? <ReserveBalanceLine value={value.fundBalances.electricity} /> : null}
        </SetAsideShareCard>
        <SetAsideShareCard label="Contingency Savings" target={shares.contingency.target} canSetAside={shares.contingency.canSetAside} showActual={showActual} actual={actual ? actual.contingency + (actual.creditContingency ?? 0) : null} actualLabel="Actual funded" hint="Receives contributions redirected from funds that reached their goals" onClick={onMetricClick ? () => onMetricClick("contingencyCapital") : undefined}>
          {actual ? <Text>{formatCurrency(actual.contingency)} physical · {formatCurrency(actual.creditContingency ?? 0)} credit</Text> : null}
          {value.fundBalances ? <Text>Physical: {formatCurrency(value.fundBalances.contingency.physicalBalance)} · Credit: {formatCurrency(value.fundBalances.contingency.creditAwaitingCash)} · Funded: {formatCurrency(value.fundBalances.contingency.fundedBalance)}</Text> : null}
        </SetAsideShareCard>
        <MetricCard label="Cash shortfall" value={shortfallValue} hint="Reserves not covered by available cash" onClick={onMetricClick ? () => onMetricClick("shortfall") : undefined} />
        <SetAsideShareCard
          label="To Stash"
          target={shares.toStash.target}
          canSetAside={shares.toStash.canSetAside}
          showActual={showActual}
          actual={actual?.toStashTotal ?? null}
          actualLabel="Actual total to Stash"
          hint="GCash and unearmarked online payments plus cash left after reserves"
          onClick={onMetricClick ? () => onMetricClick("remainingEarnings") : undefined}
        >
            <StashBreakdown
              availableOnlinePayments={shares.toStash.onlinePayments}
              gcashPayments={value.gcashPayments}
              mayaPayments={value.mayaPayments}
              unionbankPayments={value.unionbankPayments}
              bpiPayments={value.bpiPayments}
              legacyBankPayments={value.legacyBankPayments}
              otherOnlinePayments={value.otherOnlinePayments}
              reserveCredit={actual?.creditTotal ?? value.recommendedReserveCredit ?? 0}
              cashAfterSetAside={shares.toStash.cashAfterReserves}
            />
            {actual ? <Text>Total actually to Stash: {formatCurrency(actual.toStashTotal)}</Text> : null}
            {actual ? <Text>Recorded physical cash: {formatCurrency(actual.toStashCash)}</Text> : null}
        </SetAsideShareCard>
      </SimpleGrid>

      <Box bg="canvas.50" borderRadius="20px" p={4}>
        <Text fontWeight="900">Calculation</Text>
        <Text color="canvas.700" mt={1}>
          Reserve funding follows this priority: Puresafe, other products, electricity, then contingency. GCash goes directly to Stash. Maya, UnionBank, and BPI can cover a reserve target as credit awaiting equal physical cash later.
        </Text>
        {value.missingPuresafeCost ? (
          <Stack mt={2} spacing={2}>
            <Text color="caution.600">Puresafe capital cannot be calculated because its cost per unit is missing.</Text>
            <Button as={Link} to="/products" size="sm" variant="outline" alignSelf="start">Complete Puresafe product cost</Button>
          </Stack>
        ) : (
          <Text color="canvas.700" mt={1}>
            Puresafe need: {value.puresafeBottlesToReplace} bottle{value.puresafeBottlesToReplace === 1 ? "" : "s"} × {formatCurrency(value.puresafeCostPerUnit ?? 0)} = {formatCurrency(value.originalPuresafeCapital ?? value.puresafeCapital)} · This cycle's Puresafe target: {formatCurrency(value.puresafeCapital)}
          </Text>
        )}
        <Text color="canvas.700" mt={1}>
          {value.missingMiscellaneousCost
            ? "Other products: Unable to calculate because at least one depleted product has no unit cost"
            : `Other products need: ${value.miscellaneousBottlesToReplace ?? 0} bottle${value.miscellaneousBottlesToReplace === 1 ? "" : "s"} to replace = ${formatCurrency(value.originalMiscCapital ?? value.miscCapital)} · This cycle's target: ${formatCurrency(value.miscCapital)}`}
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
          Electricity need: {value.cycleHours.toFixed(2)} hours × {formatCurrency(value.electricityCostPerHour)} = {formatCurrency(value.originalElectricityShare ?? value.electricityShare)} · This cycle's target: {formatCurrency(value.electricityShare)}{value.isEstimate ? " (Estimated)" : ""}
        </Text>
        {value.puresafeReserveGoalSnapshot != null || value.otherProductsReserveGoalSnapshot != null || value.electricityReserveGoalSnapshot != null ? <Text color="canvas.700" mt={1}>Goal settings saved with this cycle: Puresafe {value.puresafeReserveGoalSnapshot == null ? "Not available" : formatCurrency(value.puresafeReserveGoalSnapshot)} · Other Products {value.otherProductsReserveGoalSnapshot == null ? "Not available" : formatCurrency(value.otherProductsReserveGoalSnapshot)} · Electricity {value.electricityReserveGoalSnapshot == null ? "Not available" : formatCurrency(value.electricityReserveGoalSnapshot)}</Text> : null}
        {(value.contingencyCapital ?? 0) > 0 ? <Text color="canvas.700" mt={1}>Redirected to contingency: {formatCurrency(value.contingencyCapital)}</Text> : null}
        {cashAfterSetAside != null ? (
          <Stack spacing={1} mt={2} color="canvas.700">
            <Text>Cash after set aside: {formatCurrency(cashAfterSetAside)} · BPI/UnionBank added to set-aside: {formatCurrency(bpiUnionbankReserveFunding)} · GCash directly to Stash: {formatCurrency(value.gcashPayments ?? 0)} · Eligible online reserve funding: {formatCurrency(value.eligibleOnlineReservePayments ?? 0)}</Text>
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
  const progressAmount = showActual ? actual : canSetAside;
  return (
    <MetricCard
      label={label}
      value={target == null ? "Target unavailable" : `Target ${formatCurrency(target)}`}
      hint={hint}
      onClick={onClick}
      accent={(
        <Stack spacing={0.5} mt={2} color="canvas.700" fontSize="sm" lineHeight="short">
          {showActual ? <Text fontWeight="800">{actualLabel}: {actual == null ? "Not recorded" : formatCurrency(actual)}</Text> : null}
          {target != null ? (
            <Progress
              value={setAsideProgress(progressAmount, target)}
              size="sm"
              borderRadius="full"
              colorScheme={progressAmount != null && progressAmount >= target ? "green" : "cyan"}
              aria-label={`${label} set-aside progress`}
            />
          ) : null}
          {showActual && actual != null && target != null ? <Text>{!actualComparisonAvailable ? "Shortage/excess unavailable until every included cycle is recorded" : actual < target ? `Shortage: ${formatCurrency(target - actual)}` : actual > target ? `Excess: ${formatCurrency(actual - target)}` : "Matches target"}</Text> : null}
          <Text fontWeight="700">Can set aside: {canSetAside == null ? "Unable to calculate" : formatCurrency(canSetAside)}</Text>
          {children}
        </Stack>
      )}
    />
  );
}

function setAsideProgress(value: number | null | undefined, target: number) {
  if (value == null || target <= 0) return 0;
  return Math.min((value / target) * 100, 100);
}

export function StashBreakdown({
  availableOnlinePayments,
  gcashPayments,
  mayaPayments,
  unionbankPayments,
  bpiPayments,
  legacyBankPayments,
  otherOnlinePayments,
  reserveCredit,
  cashAfterSetAside,
}: {
  availableOnlinePayments: number;
  gcashPayments?: number;
  mayaPayments?: number;
  unionbankPayments?: number;
  bpiPayments?: number;
  legacyBankPayments?: number;
  otherOnlinePayments?: number;
  reserveCredit?: number;
  cashAfterSetAside: number | null;
}) {
  const hasMethodBreakdown = gcashPayments != null || mayaPayments != null || unionbankPayments != null || bpiPayments != null || legacyBankPayments != null || otherOnlinePayments != null;
  return (
    <Stack spacing={0.5}>
      {hasMethodBreakdown ? <>
        <Text>GCash received → Stash: {formatCurrency(gcashPayments ?? 0)}</Text>
        <Text>Maya received: {formatCurrency(mayaPayments ?? 0)}</Text>
        <Text>UnionBank received: {formatCurrency(unionbankPayments ?? 0)}</Text>
        <Text>BPI received: {formatCurrency(bpiPayments ?? 0)}</Text>
        {(legacyBankPayments ?? 0) > 0 ? <Text>Legacy bank: {formatCurrency(legacyBankPayments ?? 0)}</Text> : null}
        {(otherOnlinePayments ?? 0) > 0 ? <Text>Other online: {formatCurrency(otherOnlinePayments ?? 0)}</Text> : null}
      </> : <Text>Online payments: {formatCurrency(availableOnlinePayments)}</Text>}
      {hasMethodBreakdown ? <Text fontWeight="700">Online going to Stash: {formatCurrency(availableOnlinePayments)}</Text> : null}
      {(reserveCredit ?? 0) > 0 ? <Text>Online earmarked for reserves: {formatCurrency(reserveCredit ?? 0)} credit awaiting cash</Text> : null}
      <Text>Cash after reserves: {cashAfterSetAside == null ? "Unable to calculate" : formatCurrency(cashAfterSetAside)}</Text>
    </Stack>
  );
}

function ReserveBalanceLine({ value }: { value: { goal: number; physicalBalance: number; creditAwaitingCash: number; fundedBalance: number; remaining: number; goalMet: boolean } }) {
  return <Stack spacing={0.5}><Text>Physical: {formatCurrency(value.physicalBalance)}</Text><Text>Credit awaiting cash: {formatCurrency(value.creditAwaitingCash)}</Text><Text>Funded: {formatCurrency(value.fundedBalance)} / {formatCurrency(value.goal)}{value.goalMet ? " · Goal met" : ` · ${formatCurrency(value.remaining)} needed`}</Text></Stack>;
}
