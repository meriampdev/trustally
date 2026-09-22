import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { ActualSetAsideModal } from "../components/ActualSetAsideModal";
import { BusinessPerformance } from "../components/BusinessPerformance";
import { MetricCard } from "../components/MetricCard";
import { PaymentDetailsModal } from "../components/PaymentDetailsModal";
import { SectionCard } from "../components/SectionCard";
import { SetAsideShareCard, SetAsideSummary, StashBreakdown } from "../components/SetAsideSummary";
import { useCurrentLocation } from "../lib/location";
import {
  fetchCashMovements,
  fetchCycleCashFloatDetail,
  fetchCycleDisclosureAndCollection,
  fetchCyclePaymentDetail,
  fetchCycleSetAside,
  fetchHistoryFeed,
  fetchHomeDashboard,
  fetchOutstandingBalances,
  fetchProducts,
  fetchReportsSnapshot,
  fetchReportSetAside,
} from "../lib/api";
import {
  formatCount,
  formatCurrency,
  formatDateTimeLabel,
  formatDurationFromNow,
  formatPercent,
} from "../lib/format";
import { formatReportDateRange, ReportRangeKey } from "../lib/reportRange";
import { calculateReportSetAsideShareComparison, calculateSetAsideShareComparison, summarizeOnlinePayments } from "../lib/setAside";
import { CashMovement, CycleCashFloatDetail, CycleHonestyDetail, CyclePaymentDetail, CyclePaymentRecord, CycleSetAside, HistoryItem, HomeDashboard, PayLaterBalance, Product, ReportSetAside, ReportsSnapshot } from "../lib/types";

type MetricsRange = "latest" | ReportRangeKey;
type DashboardDetail = { title: string; description: string; values: Array<[string, string]>; route?: string; routeLabel?: string };

const metricsRangeOptions: Array<{ value: MetricsRange; label: string }> = [
  { value: "latest", label: "Current cycle" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom dates" },
];

export default function HomePage() {
  const toast = useToast();
  const { currentLocationId } = useCurrentLocation();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [latestStockEntry, setLatestStockEntry] = useState<HistoryItem | null>(null);
  const [latestBoxCheckEntry, setLatestBoxCheckEntry] = useState<HistoryItem | null>(null);
  const [outstandingBalances, setOutstandingBalances] = useState<PayLaterBalance[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [recentHonesty, setRecentHonesty] = useState<CycleHonestyDetail | null>(null);
  const [recentCyclePayments, setRecentCyclePayments] = useState<CyclePaymentDetail | null>(null);
  const [recentCashFloat, setRecentCashFloat] = useState<CycleCashFloatDetail | null>(null);
  const [recentSetAside, setRecentSetAside] = useState<CycleSetAside | null>(null);
  const [currentCashFloat, setCurrentCashFloat] = useState<CycleCashFloatDetail | null>(null);
  const [paymentDetailView, setPaymentDetailView] = useState<CyclePaymentRecord["channel"] | "all" | null>(null);
  const [metricsRange, setMetricsRange] = useState<MetricsRange>("latest");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [rangeMetrics, setRangeMetrics] = useState<ReportsSnapshot | null>(null);
  const [rangeSetAside, setRangeSetAside] = useState<ReportSetAside | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardDetail, setDashboardDetail] = useState<DashboardDetail | null>(null);
  const [isActualSetAsideOpen, setIsActualSetAsideOpen] = useState(false);

  useEffect(() => {
    void load(currentLocationId);
  }, [currentLocationId]);

  useEffect(() => {
    let cancelled = false;
    if (metricsRange === "latest") {
      setRangeMetrics(null);
      setRangeSetAside(null);
      setMetricsError("");
      setIsMetricsLoading(false);
      return;
    }
    if (metricsRange === "custom" && (!customStartDate || !customEndDate)) return;

    setIsMetricsLoading(true);
    setRangeMetrics(null);
    setRangeSetAside(null);
    setMetricsError("");
    const startDate = metricsRange === "custom" ? customStartDate : null;
    const endDate = metricsRange === "custom" ? customEndDate : null;
    void Promise.all([
      fetchReportsSnapshot(metricsRange, startDate, endDate),
      fetchReportSetAside(metricsRange, startDate, endDate),
    ])
      .then(([result, setAsideResult]) => {
        if (!cancelled) {
          setRangeMetrics(result);
          setRangeSetAside(setAsideResult);
        }
      })
      .catch((error) => {
        if (!cancelled) setMetricsError(error instanceof Error ? error.message : "Could not load this period.");
      })
      .finally(() => {
        if (!cancelled) setIsMetricsLoading(false);
      });

    return () => { cancelled = true; };
  }, [metricsRange, customStartDate, customEndDate, currentLocationId]);

  async function load(selectedLocationId?: string | null) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        nextDashboard,
        nextProducts,
        stockHistory,
        boxCheckHistory,
        nextOutstandingBalances,
        nextCashMovements,
      ] = await Promise.all([
        fetchHomeDashboard(selectedLocationId),
        fetchProducts(),
        fetchHistoryFeed("stock_added", 1, 0),
        fetchHistoryFeed("box_checks", 1, 0),
        fetchOutstandingBalances(),
        fetchCashMovements(),
      ]);

      setDashboard(nextDashboard);
      setProducts(nextProducts);
      setLatestStockEntry(stockHistory[0] ?? null);
      setLatestBoxCheckEntry(boxCheckHistory[0] ?? null);
      setOutstandingBalances(nextOutstandingBalances);
      setCashMovements(nextCashMovements);
      const recentCycleId = nextDashboard.recentResult?.cycleId;
      const [nextHonesty, nextCyclePayments, nextRecentCashFloat, nextSetAside] = recentCycleId
        ? await Promise.all([
            fetchCycleDisclosureAndCollection(recentCycleId),
            fetchCyclePaymentDetail(recentCycleId),
            fetchCycleCashFloatDetail(recentCycleId),
            fetchCycleSetAside(recentCycleId),
          ])
        : [null, null, null, null];
      setRecentHonesty(nextHonesty);
      setRecentCyclePayments(nextCyclePayments);
      setRecentCashFloat(nextRecentCashFloat);
      setRecentSetAside(nextSetAside);
      setCurrentCashFloat(nextDashboard.currentCycle?.id ? await fetchCycleCashFloatDetail(nextDashboard.currentCycle.id) : null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load your box.");
    } finally {
      setIsLoading(false);
    }
  }

  const outstandingAmount = useMemo(
    () => outstandingBalances.reduce((sum, balance) => sum + balance.remainingAmount, 0),
    [outstandingBalances],
  );

  if (isLoading) {
    return (
      <VStack py={12}>
        <Spinner size="xl" color="brand.400" />
      </VStack>
    );
  }

  if (errorMessage) {
    return (
        <SectionCard title="Couldn’t load Trustally">
        <Text color="caution.600">{errorMessage}</Text>
        <Button mt={4} onClick={() => void load(currentLocationId)}>
          Try again
        </Button>
      </SectionCard>
    );
  }

  if (!dashboard?.hasSetup) {
    return (
      <SectionCard eyebrow="Set up your box" title="Tell Trustally what’s in the honesty box right now.">
        <Text color="canvas.700">
          This creates your initial inventory snapshot and starts Cycle #1. No sales or honesty results are created yet.
        </Text>
        <Button as={Link} to="/setup" mt={5}>
          Start tracking
        </Button>
      </SectionCard>
    );
  }

  const visibleProducts = products
    .filter((product) => product.active || (product.lastKnownQuantity ?? 0) > 0)
    .sort((left, right) => (right.lastKnownQuantity ?? 0) - (left.lastKnownQuantity ?? 0));

  const derivedBoxUnits = visibleProducts.reduce(
    (sum, product) => sum + (product.lastKnownQuantity ?? 0),
    0,
  );
  const derivedRetailValue = visibleProducts.reduce(
    (sum, product) => sum + (product.lastKnownQuantity ?? 0) * product.currentSellingPrice,
    0,
  );
  const cycleStartedAt = dashboard.currentCycle?.startedAt ?? latestStockEntry?.happenedAt ?? null;
  const lastCheckedAt = latestBoxCheckEntry?.happenedAt ?? dashboard.currentCycle?.lastCheckedAt ?? null;
  const lastLoadedQuantity =
    latestStockEntry?.quantity ??
    dashboard.currentCycle?.startingBoxStock ??
    derivedBoxUnits;
  const retailValue =
    (dashboard.currentCycle?.retailValue ?? 0) > 0
      ? dashboard.currentCycle?.retailValue ?? 0
      : derivedRetailValue;

  const cycleCashMovements = cashMovements.filter((movement) =>
    cycleStartedAt ? new Date(movement.occurredAt).getTime() >= new Date(cycleStartedAt).getTime() : false,
  );
  const cashRemovedSinceLastVisit = cycleCashMovements
    .filter((movement) => movement.type === "CASH_REMOVED")
    .reduce((sum, movement) => sum + movement.amount, 0);
  const cashReturnedSinceLastVisit = cycleCashMovements
    .filter((movement) => movement.type === "CASH_RETURNED")
    .reduce<(typeof cycleCashMovements)[number] | null>((latest, movement) => (
      !latest || new Date(movement.occurredAt).getTime() > new Date(latest.occurredAt).getTime()
        ? movement
        : latest
    ), null)?.amount ?? 0;
  const estimatedPhysicalCash = currentCashFloat?.openingChangeFloat == null
    ? null
    : Math.max(currentCashFloat.openingChangeFloat - cashRemovedSinceLastVisit, 0);
  const isLatestMetrics = metricsRange === "latest";
  const metricsAvailable = isLatestMetrics ? Boolean(dashboard.recentResult) : Boolean(rangeMetrics);
  const metricsTitle = isLatestMetrics
    ? dashboard.recentResult?.label ?? "No completed checks yet"
    : metricsRange === "custom"
      ? formatReportDateRange(customStartDate, customEndDate)
      : metricsRangeOptions.find((option) => option.value === metricsRange)?.label ?? "Selected period";
  const metricsHonestyRate = isLatestMetrics ? recentHonesty?.summary.disclosureRate ?? null : rangeMetrics?.summary.disclosureRate ?? null;
  const metricsPaymentTotal = isLatestMetrics
    ? recentCyclePayments?.summary.totalPayments ?? recentHonesty?.summary.totalPayments ?? dashboard.recentResult?.immediatePayments ?? 0
    : rangeMetrics?.summary.totalPayments ?? 0;
  const metricsRequiredAmount = isLatestMetrics
    ? recentHonesty?.summary.currentlyDueAmount ?? dashboard.recentResult?.expectedRevenue ?? 0
    : rangeMetrics?.summary.paymentRequiredAmount ?? 0;
  const metricsCollectionRate = metricsRequiredAmount > 0
    ? Math.min((metricsPaymentTotal / metricsRequiredAmount) * 100, 100)
    : null;
  const metricsUnaccounted = Math.max(metricsRequiredAmount - metricsPaymentTotal, 0);
  const metricsPaymentGap = metricsUnaccounted;
  const metricsPayLaterOutstanding = isLatestMetrics
    ? outstandingBalances
        .filter((balance) => balance.sourceCycleId === dashboard.recentResult?.cycleId)
        .reduce((total, balance) => total + balance.remainingAmount, 0)
    : (rangeMetrics?.reportPayLaterBalances ?? []).reduce((total, balance) => total + balance.remainingAmount, 0);
  const metricsExpectedCollection = isLatestMetrics
    ? metricsRequiredAmount
    : rangeMetrics?.summary.paymentRequiredAmount ?? 0;
  const metricsActualCollection = metricsPaymentTotal;
  const metricsCashPayments = isLatestMetrics
    ? recentCyclePayments?.summary.cashPayments ?? recentHonesty?.summary.physicalCashCollected ?? 0
    : rangeMetrics?.summary.cashPayments ?? 0;
  const metricsOnlinePayments = isLatestMetrics
    ? recentCyclePayments?.summary.onlinePayments ?? recentHonesty?.summary.onlinePayments ?? 0
    : rangeMetrics?.summary.onlinePayments ?? 0;
  const metricsPaymentRecords = isLatestMetrics
    ? recentCyclePayments?.records ?? []
    : rangeMetrics?.reportPaymentRecords ?? [];
  const metricsOnlineBreakdown = summarizeOnlinePayments(metricsPaymentRecords);
  const metricsSelfReported = isLatestMetrics ? recentHonesty?.summary.selfReportedBottles ?? 0 : rangeMetrics?.summary.selfReportedBottles ?? 0;
  const metricsUnattributed = isLatestMetrics ? recentHonesty?.summary.unattributedMissingBottles ?? 0 : rangeMetrics?.summary.unattributedMissingBottles ?? 0;
  const metricsUnclassified = isLatestMetrics ? recentHonesty?.summary.unclassifiedHistoricalRecords ?? 0 : rangeMetrics?.summary.unclassifiedHistoricalRecords ?? 0;
  const metricsGrossSales = metricsPaymentTotal;
  const metricsPuresafeCapital = isLatestMetrics
    ? recentSetAside?.puresafeCapital ?? null
    : rangeSetAside?.summary.puresafeCapital ?? null;
  const metricsMiscCapital = isLatestMetrics
    ? recentSetAside?.miscCapital ?? null
    : rangeSetAside?.summary.miscCapital ?? null;
  const metricsTotalCapital = metricsPuresafeCapital == null || metricsMiscCapital == null
    ? null
    : metricsPuresafeCapital + metricsMiscCapital;
  const metricsGrossProfit = metricsTotalCapital == null
    ? null
    : metricsGrossSales - metricsTotalCapital;
  const recentSetAsideShares = recentSetAside ? calculateSetAsideShareComparison(recentSetAside) : null;
  const displayedRecentSetAside = recentSetAside ? {
    ...recentSetAside,
    gcashPayments: metricsOnlineBreakdown.gcashPayments,
    mayaPayments: metricsOnlineBreakdown.mayaPayments,
    otherOnlinePayments: metricsOnlineBreakdown.otherOnlinePayments,
  } : null;
  const rangeSetAsideShares = rangeSetAside ? calculateReportSetAsideShareComparison(rangeSetAside) : null;
  const rangeActualComplete = Boolean(rangeSetAside && (rangeSetAside.summary.actualRecordedCycles ?? 0) > 0 && (rangeSetAside.summary.actualUnrecordedCycles ?? 0) === 0);
  const rangeTotalTargets = rangeSetAsideShares?.puresafe.target == null || rangeSetAsideShares.otherProducts.target == null || rangeSetAsideShares.toStash.target == null
    ? null : rangeSetAsideShares.puresafe.target + rangeSetAsideShares.otherProducts.target + rangeSetAsideShares.electricity.target + rangeSetAsideShares.toStash.target;
  const rangeActualToStashTotal = rangeSetAside?.summary.actualToStashCash == null ? null
    : rangeSetAside.summary.actualToStashCash + (rangeSetAside.summary.onlineToStash ?? 0);
  const recentCycleRoute = dashboard.recentResult?.cycleId ? `/history/${dashboard.recentResult.cycleId}` : "/history";
  const latestUnaccounted = recentHonesty && recentCyclePayments
    ? Math.max(recentHonesty.summary.currentlyDueAmount - recentCyclePayments.summary.totalPayments, 0)
    : dashboard.recentResult?.unaccountedAmount ?? 0;
  const metricsDetailRoute = isLatestMetrics
    ? recentCycleRoute
    : "/reports";
  const showDetail = (title: string, description: string, values: Array<[string, string]>, route = metricsDetailRoute, routeLabel = isLatestMetrics ? "View full cycle" : "Open reports") => {
    setDashboardDetail({ title, description, values, route, routeLabel });
  };

  return (
    <Stack spacing={5} width="100%" minWidth={0}>
      <SectionCard eyebrow="Current cycle" title={dashboard.locationName ?? "Your box"} minW={0} collapsible collapseKey="dashboard-current-cycle">
        <Box
          as="button"
          width="100%"
          textAlign="left"
          cursor="pointer"
          onClick={() => showDetail("Current cycle", "The live box state since the last completed check.", [["Last checked", formatDateTimeLabel(lastCheckedAt)], ["Running for", formatDurationFromNow(cycleStartedAt)], ["Last loaded", formatCount(lastLoadedQuantity)], ["Pay-later outstanding", outstandingBalances.length ? formatCurrency(outstandingAmount) : "None"]], "/check-box", "Open box check")}
          bg="linear-gradient(180deg, rgba(25, 53, 82, 0.9) 0%, rgba(14, 31, 49, 0.86) 100%)"
          borderRadius="24px"
          border="1px solid"
          borderColor="rgba(142, 182, 215, 0.16)"
          boxShadow="0 16px 32px rgba(1, 10, 20, 0.28)"
          px={{ base: 2, md: 3 }}
          py={2}
        >
          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }}>
            <CompactCycleStat label="Last checked" value={formatDateTimeLabel(lastCheckedAt)} />
            <CompactCycleStat label="Running for" value={formatDurationFromNow(cycleStartedAt)} />
            <CompactCycleStat label="Last loaded" value={formatCount(lastLoadedQuantity)} />
            <CompactCycleStat
              label={outstandingBalances.length ? "Pay-later outstanding" : "Known pay-later"}
              value={outstandingBalances.length ? formatCurrency(outstandingAmount) : "None"}
            />
          </SimpleGrid>
        </Box>
        <SwipeableButtonRow mt={5} ariaLabel="Dashboard actions">
          <Button as={Link} to="/check-box" flexShrink={0}>
            Check box
          </Button>
          <Button as={Link} to="/stock" variant="outline" flexShrink={0}>
            + Add stock
          </Button>
          <Button as={Link} to="/pay-later" variant="outline" flexShrink={0}>
            Record pay-later
          </Button>
          <Button as={Link} to="/payments" variant="outline" flexShrink={0}>
            Record payment
          </Button>
          <Button as={Link} to="/cash-movements" variant="outline" flexShrink={0}>
            Cash removed
          </Button>
          <Button as={Link} to="/expenses" variant="outline" flexShrink={0}>
            Add expense
          </Button>
        </SwipeableButtonRow>
      </SectionCard>

      <BusinessPerformance cycleStartedAt={dashboard.currentCycle?.startedAt} />

      <SectionCard eyebrow="Cash status" title="Cash position and explained amounts" collapsible collapseKey="dashboard-cash-status">
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={4}>
          <MetricCard
            label="Estimated in box"
            value={formatCurrency(estimatedPhysicalCash)}
            hint={
              estimatedPhysicalCash == null
                ? "Opening change float is unknown"
                : "Known opening float less recorded withdrawals; excludes uncounted customer cash"
            }
            onClick={() => showDetail("Estimated cash in box", "This is the last known change float adjusted by recorded cash movements in the current cycle.", [["Opening change float", formatCurrency(currentCashFloat?.openingChangeFloat)], ["Cash removed", formatCurrency(cashRemovedSinceLastVisit)], ["Estimated in box", formatCurrency(estimatedPhysicalCash)]], "/cash-movements", "View cash movements")}
          />
          <MetricCard
            label="Unaccounted"
            value={formatCurrency(latestUnaccounted)}
            hint="Not yet explained by payment, pay-later, or an authorized adjustment"
            onClick={() => showDetail("Unaccounted amount", "The required amount that has not yet been matched to a recorded payment.", [["Currently due", formatCurrency(recentHonesty?.summary.currentlyDueAmount)], ["Recorded payments", formatCurrency(recentCyclePayments?.summary.totalPayments)], ["Unaccounted", formatCurrency(latestUnaccounted)]], recentCycleRoute, "View full cycle")}
          />
          <MetricCard
            label="Known pay-later"
            value={formatCurrency(recentHonesty?.summary.payLaterAmount ?? dashboard.recentResult?.knownPayLater ?? 0)}
            hint="Recorded as expected later"
            onClick={() => showDetail("Known pay-later", "Amounts explicitly recorded as expected later remain visible until settled.", [["Recorded pay-later", formatCurrency(recentHonesty?.summary.payLaterAmount ?? dashboard.recentResult?.knownPayLater)], ["Open balance", formatCurrency(outstandingAmount)]], "/payments", "View balances")}
          />
          <MetricCard
            label="Complimentary value"
            value={formatCurrency(recentHonesty?.summary.complimentaryValue ?? 0)}
            hint={recentHonesty ? `${recentHonesty.summary.complimentaryBottles} complimentary bottle${recentHonesty.summary.complimentaryBottles === 1 ? "" : "s"}` : "No classified complimentary bottles"}
            onClick={() => showDetail("Complimentary value", "These bottles were classified as complimentary, so they are excluded from payment due.", [["Bottles", String(recentHonesty?.summary.complimentaryBottles ?? 0)], ["Value", formatCurrency(recentHonesty?.summary.complimentaryValue)]], recentCycleRoute, "View full cycle")}
          />
        </SimpleGrid>
        <Text color="canvas.700" mt={3} fontSize="sm">
          Cash movements since last visit: {formatCurrency(cashRemovedSinceLastVisit)} removed · {formatCurrency(cashReturnedSinceLastVisit)} latest legacy Left for Change
        </Text>
        {recentCashFloat ? (
          <Box mt={5}>
            <Text fontWeight="900" mb={3}>Latest completed cash check</Text>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 5 }} spacing={4}>
              <MetricCard label="Opening change float" value={recentCashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(recentCashFloat.openingChangeFloat)} hint="View completed cash check" onClick={() => showDetail("Opening change float", "Cash already in the box when the completed cycle began.", [["Opening", recentCashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(recentCashFloat.openingChangeFloat)], ["Source", recentCashFloat.openingChangeFloatSource]])} />
              <MetricCard label="Cash counted" value={formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)} hint="View completed cash check" onClick={() => showDetail("Cash counted", "Physical cash counted before the cycle withdrawal.", [["Counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Withdrawn", formatCurrency(recentCashFloat.cashWithdrawn)]])} />
              <MetricCard label="Cash generated" value={recentCashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(recentCashFloat.cashGenerated)} hint="View calculation" onClick={() => showDetail("Customer cash generated", "Counted cash plus interim withdrawals, less opening float and tracked non-sales additions.", [["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Interim withdrawals", formatCurrency(recentCashFloat.interimOwnerWithdrawals)], ["Opening float", formatCurrency(recentCashFloat.openingChangeFloat)], ["Generated", recentCashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(recentCashFloat.cashGenerated)]])} />
              <MetricCard label="Left for Change" value={formatCurrency(recentCashFloat.closingChangeFloat)} hint="View completed cash check" onClick={() => showDetail("Left for Change", "Physical cash deliberately left in the box for the next cycle.", [["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)]])} />
              <MetricCard label="Cash withdrawn" value={formatCurrency(recentCashFloat.cashWithdrawn)} hint="View completed cash check" onClick={() => showDetail("Cash withdrawn", "Cash counted minus the amount left for change.", [["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Withdrawn", formatCurrency(recentCashFloat.cashWithdrawn)]])} />
            </SimpleGrid>
          </Box>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Metrics" title={metricsTitle} minW={0} collapsible collapseKey="dashboard-metrics">
        <SwipeableButtonRow mb={4} ariaLabel="Dashboard reporting ranges">
          {metricsRangeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              flexShrink={0}
              variant={metricsRange === option.value ? "solid" : "outline"}
              onClick={() => {
                if (option.value === "custom") {
                  setIsDateRangeOpen(true);
                } else {
                  setMetricsRange(option.value);
                }
              }}
            >
              {option.value === "custom" && metricsRange === "custom"
                ? formatReportDateRange(customStartDate, customEndDate)
                : option.label}
            </Button>
          ))}
        </SwipeableButtonRow>
        {isMetricsLoading ? <Spinner color="brand.400" /> : metricsError ? (
          <Text color="caution.600">{metricsError}</Text>
        ) : metricsAvailable ? (
          <Stack spacing={3}>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 5 }} spacing={4}>
            <MetricCard
              label="Honesty rate"
              value={formatPercent(metricsHonestyRate)}
              hint={`Disclosure honesty · ${metricsSelfReported} self-reported · ${metricsUnattributed} unattributed`}
              onClick={() => showDetail("Disclosure honesty", "Only quantities attributed to a person and marked self-reported count in the disclosure rate.", [["Self-reported", String(metricsSelfReported)], ["Unattributed", String(metricsUnattributed)], ["Disclosure rate", formatPercent(metricsHonestyRate)]])}
            />
            <MetricCard
              label="Collection rate"
              value={metricsCollectionRate == null ? "Payment not required" : formatPercent(metricsCollectionRate)}
              hint={metricsPaymentGap > 0 ? `${formatCurrency(metricsPaymentGap)} required payment gap` : "No required payment gap"}
              onClick={() => showDetail("Collection rate", "Recorded payments compared with the amount currently due.", [["Currently due", formatCurrency(metricsRequiredAmount)], ["Recorded payments", formatCurrency(metricsPaymentTotal)], ["Collection rate", metricsCollectionRate == null ? "Payment not required" : formatPercent(metricsCollectionRate)]])}
            />
            <MetricCard label="Unaccounted" value={formatCurrency(metricsUnaccounted)} hint="View calculation" onClick={() => showDetail("Unaccounted amount", "Currently due less all recorded payments in this period.", [["Currently due", formatCurrency(metricsRequiredAmount)], ["Payments", formatCurrency(metricsPaymentTotal)], ["Unaccounted", formatCurrency(metricsUnaccounted)]])} />
            <MetricCard
              label="Cash payments"
              value={formatCurrency(metricsCashPayments)}
              hint="Click to view cash payment details"
              onClick={() => setPaymentDetailView("cash")}
            />
            <MetricCard
              label="Online payments"
              value={formatCurrency(metricsOnlinePayments)}
              hint="Click to view online payment details"
              onClick={() => setPaymentDetailView("online")}
            />
            {metricsPayLaterOutstanding > 0 ? (
              <MetricCard
                label="Outstanding"
                value={formatCurrency(metricsPayLaterOutstanding)}
                hint="Remaining known pay-later balance"
                onClick={() => showDetail("Outstanding pay-later", "Known balances that still have an amount remaining.", [["Outstanding", formatCurrency(metricsPayLaterOutstanding)], ["Balances", String(isLatestMetrics ? outstandingBalances.filter((balance) => balance.sourceCycleId === dashboard.recentResult?.cycleId).length : rangeMetrics?.reportPayLaterBalances.length ?? 0)]], "/payments", "View balances")}
              />
            ) : null}
            <MetricCard
              label="Expected vs actual collection"
              value={`${formatCurrency(metricsExpectedCollection)} / ${formatCurrency(metricsActualCollection)}`}
              hint="Expected due / actually collected"
              onClick={() => showDetail("Expected vs actual collection", "Compares the amount currently due with all recorded cash and online payments.", [["Expected due", formatCurrency(metricsExpectedCollection)], ["Actually collected", formatCurrency(metricsActualCollection)], ["Gap", formatCurrency(metricsPaymentGap)]])}
            />
          </SimpleGrid>
          <Box pt={2}>
            <Text fontWeight="900" mb={3}>Sales</Text>
            <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={4}>
              <MetricCard
                label="Gross sales"
                value={formatCurrency(metricsGrossSales)}
                hint="Actual recorded payments · Click to view"
                onClick={() => setPaymentDetailView("all")}
              />
              <MetricCard label="Total Capital" value={metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)} hint="View calculation" onClick={() => showDetail("Total capital", "Replacement capital for Puresafe plus all other depleted products.", [["Puresafe", metricsPuresafeCapital == null ? "Unable to calculate" : formatCurrency(metricsPuresafeCapital)], ["Other products", metricsMiscCapital == null ? "Unable to calculate" : formatCurrency(metricsMiscCapital)], ["Total", metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)]])} />
              <MetricCard label="Gross Profit" value={metricsGrossProfit == null ? "Unable to calculate" : formatCurrency(metricsGrossProfit)} hint="View calculation" onClick={() => showDetail("Gross profit", "Actual recorded sales less product replacement capital.", [["Gross sales", formatCurrency(metricsGrossSales)], ["Total capital", metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)], ["Gross profit", metricsGrossProfit == null ? "Unable to calculate" : formatCurrency(metricsGrossProfit)]])} />
            </SimpleGrid>
          </Box>
          {metricsUnclassified > 0 ? <Text color="canvas.700" mt={3}>{metricsUnclassified} historical record{metricsUnclassified === 1 ? " is" : "s are"} still unclassified.</Text> : null}
          </Stack>
        ) : (
          <Text color="canvas.700">No completed cycles in this period.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Set Aside" title={`${metricsTitle} reserves`} collapsible collapseKey="dashboard-set-aside">
        {isMetricsLoading ? <Spinner color="brand.400" /> : metricsError ? (
          <Text color="caution.600">{metricsError}</Text>
        ) : isLatestMetrics && displayedRecentSetAside ? (
          <SetAsideSummary value={displayedRecentSetAside} onRecordActual={() => setIsActualSetAsideOpen(true)} onMetricClick={(metric) => {
            const detailMap: Record<string, DashboardDetail> = {
              cashAvailableAfterChangeFloat: { title: "Cash available for reserves", description: "Cash available for set aside after preserving the closing change float.", values: [["Available cash", formatCurrency(displayedRecentSetAside.cashAvailableAfterChangeFloat)]] },
              puresafeCapital: { title: "Puresafe capital", description: "Replacement cost reserved first from available cash.", values: [["Target", recentSetAsideShares?.puresafe.target == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.puresafe.target)], ["Can set aside", recentSetAsideShares?.puresafe.canSetAside == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.puresafe.canSetAside)], ["Bottles", String(displayedRecentSetAside.puresafeBottlesToReplace)], ["Cost per bottle", formatCurrency(displayedRecentSetAside.puresafeCostPerUnit)]] },
              electricityShare: { title: "Electricity share", description: "Funded from cash remaining after Puresafe and other-products capital.", values: [["Target", recentSetAsideShares?.electricity.target == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.electricity.target)], ["Can set aside", recentSetAsideShares?.electricity.canSetAside == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.electricity.canSetAside)], ["Hours", displayedRecentSetAside.cycleHours.toFixed(2)], ["Rate", formatCurrency(displayedRecentSetAside.electricityCostPerHour)]] },
              miscCapital: { title: "Other-products capital", description: "Funded from cash remaining after Puresafe capital.", values: [["Target", recentSetAsideShares?.otherProducts.target == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.otherProducts.target)], ["Can set aside", recentSetAsideShares?.otherProducts.canSetAside == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.otherProducts.canSetAside)]] },
              remainingEarnings: { title: "To Stash", description: "Untouched online payments plus cash remaining after all reserve shares.", values: [["Target", recentSetAsideShares?.toStash.target == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.toStash.target)], ["Can set aside", recentSetAsideShares?.toStash.canSetAside == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.toStash.canSetAside)], ["GCash", formatCurrency(metricsOnlineBreakdown.gcashPayments)], ["Maya", formatCurrency(metricsOnlineBreakdown.mayaPayments)], ...(metricsOnlineBreakdown.otherOnlinePayments > 0 ? [["Other online", formatCurrency(metricsOnlineBreakdown.otherOnlinePayments)] as [string, string]] : []), ["Cash after reserves", recentSetAsideShares?.toStash.cashAfterReserves == null ? "Unable to calculate" : formatCurrency(recentSetAsideShares.toStash.cashAfterReserves)]] },
              shortfall: { title: "Cash shortfall", description: "How far available cash falls below the required reserves. Online payments are not used to cover it.", values: [["Cash shortfall", displayedRecentSetAside.shortfall == null ? "Unable to calculate" : formatCurrency(displayedRecentSetAside.shortfall)]] },
            };
            const selected = detailMap[metric];
            if (selected) setDashboardDetail({ ...selected, route: metricsDetailRoute, routeLabel: "View full cycle" });
          }} />
        ) : !isLatestMetrics && rangeSetAside && rangeSetAsideShares ? (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={4}>
            <MetricCard label="Cash available for reserves" value={formatCurrency(rangeSetAside.summary.cashAvailableAfterChangeFloat)} hint="After preserving change float" />
            <MetricCard label="Total targets" value={rangeTotalTargets == null ? "Unable to calculate" : formatCurrency(rangeTotalTargets)} hint="All four shares" />
            <MetricCard label="Actual Set Aside" value={rangeSetAside.summary.actualPhysicalTotal == null ? "Not recorded" : formatCurrency(rangeSetAside.summary.actualPhysicalTotal)} hint="Recorded physical cash" />
            <MetricCard label="Used for restocks" value={rangeSetAside.summary.usedForOtherProductRestocks == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.usedForOtherProductRestocks)} hint="Other Products purchases" />
            <MetricCard label="Net Set Aside" value={rangeSetAside.summary.netOtherProductsSetAside == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.netOtherProductsSetAside)} hint="Other Products actual less restocks" />
            <MetricCard label="Opening reserve" value={rangeSetAside.summary.openingOtherProductsReserve == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.openingOtherProductsReserve)} />
            <MetricCard label="Closing reserve" value={rangeSetAside.summary.closingOtherProductsReserve == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.closingOtherProductsReserve)} />
            <SetAsideShareCard label="Puresafe Capital" target={rangeSetAsideShares.puresafe.target} canSetAside={rangeSetAsideShares.puresafe.canSetAside} showActual actual={rangeSetAside.summary.actualPuresafeCapital ?? null} actualComparisonAvailable={rangeActualComplete} onClick={() => showDetail("Puresafe capital", "Target compared with actual physical cash recorded for the included completed cycles.", [["Target", rangeSetAsideShares.puresafe.target == null ? "Unable to calculate" : formatCurrency(rangeSetAsideShares.puresafe.target)], ["Actual", rangeSetAside.summary.actualPuresafeCapital == null ? "Not recorded" : formatCurrency(rangeSetAside.summary.actualPuresafeCapital)]])} />
            <SetAsideShareCard label="Other Products Capital" target={rangeSetAsideShares.otherProducts.target} canSetAside={rangeSetAsideShares.otherProducts.canSetAside} showActual actual={rangeSetAside.summary.actualOtherProductsCapital ?? null} actualComparisonAvailable={rangeActualComplete} onClick={() => showDetail("Other-products capital", "Actual physical cash adds to the reserve; other-product restocks automatically use it.", [["Target", rangeSetAsideShares.otherProducts.target == null ? "Unable to calculate" : formatCurrency(rangeSetAsideShares.otherProducts.target)], ["Actual set aside", rangeSetAside.summary.actualOtherProductsCapital == null ? "Not recorded" : formatCurrency(rangeSetAside.summary.actualOtherProductsCapital)], ["Used for restocks", rangeSetAside.summary.usedForOtherProductRestocks == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.usedForOtherProductRestocks)], ["Net set aside", rangeSetAside.summary.netOtherProductsSetAside == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.netOtherProductsSetAside)], ["Opening reserve", rangeSetAside.summary.openingOtherProductsReserve == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.openingOtherProductsReserve)], ["Closing reserve", rangeSetAside.summary.closingOtherProductsReserve == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.closingOtherProductsReserve)]])}>
              <Text>Used for restocks: {rangeSetAside.summary.usedForOtherProductRestocks == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.usedForOtherProductRestocks)}</Text><Text>Net set aside: {rangeSetAside.summary.netOtherProductsSetAside == null ? "Not tracked yet" : formatCurrency(rangeSetAside.summary.netOtherProductsSetAside)}</Text><Text>Reserve: {rangeSetAside.summary.openingOtherProductsReserve == null ? "Not tracked" : formatCurrency(rangeSetAside.summary.openingOtherProductsReserve)} opening · {rangeSetAside.summary.closingOtherProductsReserve == null ? "Not tracked" : formatCurrency(rangeSetAside.summary.closingOtherProductsReserve)} closing</Text>
            </SetAsideShareCard>
            <SetAsideShareCard label="Electricity Share" target={rangeSetAsideShares.electricity.target} canSetAside={rangeSetAsideShares.electricity.canSetAside} showActual actual={rangeSetAside.summary.actualElectricityShare ?? null} actualComparisonAvailable={rangeActualComplete} onClick={() => showDetail("Electricity share", "Target compared with actual physical cash recorded for the included completed cycles.", [["Target", formatCurrency(rangeSetAsideShares.electricity.target)], ["Actual", rangeSetAside.summary.actualElectricityShare == null ? "Not recorded" : formatCurrency(rangeSetAside.summary.actualElectricityShare)]])} />
            <MetricCard label="Cash shortfall" value={rangeSetAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.shortfall)} hint="View by cycle in reports" onClick={() => showDetail("Cash shortfall", "Required reserves not covered by available cash. Online payments remain untouched.", [["Cash shortfall", rangeSetAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.shortfall)]])} />
            <SetAsideShareCard
              label="To Stash"
              target={rangeSetAsideShares.toStash.target}
              canSetAside={rangeSetAsideShares.toStash.canSetAside}
              showActual
              actual={rangeActualToStashTotal}
              actualLabel="Actual total to Stash"
              actualComparisonAvailable={rangeActualComplete}
              hint="Online plus cash left after reserves"
              onClick={() => showDetail("To Stash", "Target compared with untouched online payments plus cash remaining after all reserve shares.", [["Target", rangeSetAsideShares.toStash.target == null ? "Unable to calculate" : formatCurrency(rangeSetAsideShares.toStash.target)], ["Can set aside", rangeSetAsideShares.toStash.canSetAside == null ? "Unable to calculate" : formatCurrency(rangeSetAsideShares.toStash.canSetAside)], ["GCash", formatCurrency(metricsOnlineBreakdown.gcashPayments)], ["Maya", formatCurrency(metricsOnlineBreakdown.mayaPayments)], ...(metricsOnlineBreakdown.otherOnlinePayments > 0 ? [["Other online", formatCurrency(metricsOnlineBreakdown.otherOnlinePayments)] as [string, string]] : []), ["Cash after reserves", rangeSetAsideShares.toStash.cashAfterReserves == null ? "Unable to calculate" : formatCurrency(rangeSetAsideShares.toStash.cashAfterReserves)]])}
            >
                <StashBreakdown
                  availableOnlinePayments={rangeSetAside.summary.onlineToStash ?? rangeSetAsideShares.toStash.onlinePayments}
                  gcashPayments={metricsOnlineBreakdown.gcashPayments}
                  mayaPayments={metricsOnlineBreakdown.mayaPayments}
                  otherOnlinePayments={metricsOnlineBreakdown.otherOnlinePayments}
                  cashAfterSetAside={rangeSetAsideShares.toStash.cashAfterReserves}
                />
            </SetAsideShareCard>
            {(rangeSetAside.summary.actualUnrecordedCycles ?? 0) > 0 ? <Text gridColumn={{ md: "1 / -1" }} color="canvas.700">{rangeSetAside.summary.actualUnrecordedCycles} completed cycle{rangeSetAside.summary.actualUnrecordedCycles === 1 ? " has" : "s have"} no Actual Set Aside record and are shown as Not recorded.</Text> : null}
          </SimpleGrid>
        ) : (
          <Text color="canvas.700">No set-aside calculation is available for this period.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Box contents" title="What products are in the box?" collapsible collapseKey="dashboard-box-contents">
        {visibleProducts.length ? (
          <Stack spacing={3}>
            {visibleProducts.map((product) => (
              <Box key={product.id} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => showDetail(product.displayName, "Current last-known stock and retail value for this product.", [["Last known in box", String(product.lastKnownQuantity ?? 0)], ["Selling price", formatCurrency(product.currentSellingPrice)], ["Product total", formatCurrency((product.lastKnownQuantity ?? 0) * product.currentSellingPrice)], ["Estimated remaining", String(product.estimatedRemaining ?? "Not enough history")]], "/products", "View product catalog")}>
                <HStack justify="space-between" align="start" spacing={4}>
                  <Box>
                    <Text fontWeight="800">{product.displayName}</Text>
                    <Text color="canvas.700" mt={1}>
                      Last known in box: {product.lastKnownQuantity ?? 0}
                    </Text>
                    <Text color="canvas.700" mt={1}>
                      Sell {formatCurrency(product.currentSellingPrice)}
                      {product.estimatedRemaining != null
                        ? ` • Estimated remaining ${product.estimatedRemaining}`
                        : ""}
                    </Text>
                  </Box>
                  <Box textAlign="right" minW="120px">
                    <Text fontSize="sm" color="canvas.700">
                      Product total
                    </Text>
                    <Text fontWeight="800">
                      {formatCurrency((product.lastKnownQuantity ?? 0) * product.currentSellingPrice)}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text color="canvas.700">No products are loaded into the box right now.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Last stock added" title={latestStockEntry ? latestStockEntry.title : "Initial box load"} collapsible collapseKey="dashboard-last-stock">
        {latestStockEntry ? (
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <MetricCard
              label="Bottles added"
              value={formatCount(latestStockEntry.quantity, "bottles")}
              hint="View stock event"
              onClick={() => showDetail("Last stock added", "The latest recorded stock addition for this box.", [["Bottles added", formatCount(latestStockEntry.quantity, "bottles")], ["Recorded", formatDateTimeLabel(latestStockEntry.happenedAt)], ["Note", latestStockEntry.subtitle]], "/history", "Open history")}
            />
            <MetricCard label="Recorded" value={formatDateTimeLabel(latestStockEntry.happenedAt)} hint="View stock event" onClick={() => showDetail("Stock addition time", "When the latest stock addition was recorded.", [["Recorded", formatDateTimeLabel(latestStockEntry.happenedAt)], ["Bottles", formatCount(latestStockEntry.quantity, "bottles")]], "/history", "Open history")} />
            <MetricCard label="Note" value={latestStockEntry.subtitle} hint="View stock event" onClick={() => showDetail("Stock addition note", "The note saved with the latest stock addition.", [["Note", latestStockEntry.subtitle], ["Recorded", formatDateTimeLabel(latestStockEntry.happenedAt)]], "/history", "Open history")} />
          </SimpleGrid>
        ) : (
          <Text color="canvas.700">
            No separate stock-add event yet. Trustally is using your cycle start as the last box load.
          </Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Outstanding" title="Open balances" collapsible collapseKey="dashboard-outstanding">
        {outstandingBalances.length ? (
          <Stack spacing={3}>
            {outstandingBalances.slice(0, 3).map((balance) => (
              <Box key={balance.id} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => showDetail(balance.customerLabel?.trim() || balance.cycleLabel, "Open pay-later balance and its saved context.", [["Original amount", formatCurrency(balance.originalAmount)], ["Remaining", formatCurrency(balance.remainingAmount)], ["Status", balance.status], ["Items", balance.itemsSummary?.trim() || "No item summary"]], "/payments", "View payment balances")}>
                <Text fontWeight="800">
                  {balance.customerLabel?.trim() || balance.cycleLabel}
                </Text>
                <Text color="canvas.700" mt={1}>
                  Remaining {formatCurrency(balance.remainingAmount)}
                  {balance.dueDate ? ` • Due ${formatDateTimeLabel(balance.dueDate)}` : ""}
                </Text>
                {balance.itemsSummary?.trim() ? (
                  <Text color="canvas.700" mt={1}>
                    Items: {balance.itemsSummary}
                  </Text>
                ) : null}
              </Box>
            ))}
            <Button as={Link} to="/payments" variant="outline" alignSelf="start">
              View outstanding payments
            </Button>
          </Stack>
        ) : (
          <Text color="canvas.700">No open balances right now.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Retail value" title="Current box value" collapsible collapseKey="dashboard-retail-value">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <MetricCard label="Retail value" value={formatCurrency(retailValue)} hint="View calculation" onClick={() => showDetail("Current retail value", "The selling-price value of all last-known units currently in the box.", [["Tracked units", formatCount(derivedBoxUnits, "units")], ["Retail value", formatCurrency(retailValue)]], "/products", "View products")} />
          <MetricCard
            label="Tracked units"
            value={formatCount(derivedBoxUnits, "units")}
            hint={
              dashboard.currentCycle?.estimatedRemaining != null
                ? `Estimated remaining ${dashboard.currentCycle.estimatedRemaining}`
                : "Estimated remaining updates after enough history"
            }
            onClick={() => showDetail("Tracked units", "The sum of every product's last-known quantity.", [["Tracked units", formatCount(derivedBoxUnits, "units")], ["Estimated remaining", String(dashboard.currentCycle?.estimatedRemaining ?? "Not enough history")]], "/products", "View products")}
          />
        </SimpleGrid>
      </SectionCard>

      <PaymentDetailsModal
        isOpen={paymentDetailView !== null}
        onClose={() => setPaymentDetailView(null)}
        title={paymentDetailView === "cash" ? "Cash payment details" : paymentDetailView === "online" ? "Online payment details" : "Gross sales payment details"}
        records={metricsPaymentRecords}
        channel={paymentDetailView === "cash" || paymentDetailView === "online" ? paymentDetailView : undefined}
      />

      <DateRangeModal
        isOpen={isDateRangeOpen}
        onClose={() => setIsDateRangeOpen(false)}
        startDate={customStartDate}
        endDate={customEndDate}
        title="Filter dashboard metrics by date"
        onApply={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setMetricsRange("custom");
        }}
      />

      {displayedRecentSetAside ? <ActualSetAsideModal isOpen={isActualSetAsideOpen} cycle={displayedRecentSetAside} onClose={() => setIsActualSetAsideOpen(false)} onSaved={(saved) => {
        setRecentSetAside(saved);
        toast({ title: "Actual set aside saved", description: "This cycle and the Other Products reserve were updated.", status: "success", position: "top" });
      }}/> : null}

      <Modal isOpen={dashboardDetail !== null} onClose={() => setDashboardDetail(null)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{dashboardDetail?.title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color="canvas.700">{dashboardDetail?.description}</Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3} mt={4}>
              {dashboardDetail?.values.map(([label, value]) => (
                <Box key={label} bg="canvas.50" borderRadius="18px" p={3}>
                  <Text color="canvas.700" fontSize="sm">{label}</Text>
                  <Text fontWeight="900" mt={1}>{value}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={() => setDashboardDetail(null)}>Close</Button>
            {dashboardDetail?.route ? <Button as={Link} to={dashboardDetail.route}>{dashboardDetail.routeLabel ?? "View details"}</Button> : null}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}

function CompactCycleStat({ label, value }: { label: string; value: string }) {
  return (
    <Box px={{ base: 2, md: 3 }} py={2} minW={0}>
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="canvas.700" noOfLines={1}>
        {label}
      </Text>
      <Text mt={1} fontSize={{ base: "md", md: "lg" }} fontWeight="900" color="canvas.900" noOfLines={1}>
        {value}
      </Text>
    </Box>
  );
}

function SwipeableButtonRow({
  children,
  ariaLabel,
  mt,
  mb,
}: {
  children: ReactNode;
  ariaLabel: string;
  mt?: number;
  mb?: number;
}) {
  return (
    <Box
      role="region"
      aria-label={ariaLabel}
      mt={mt}
      mb={mb}
      width="100%"
      maxWidth="100%"
      minWidth={0}
      overflowX="auto"
      overflowY="hidden"
      overscrollBehaviorX="contain"
      sx={{
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <HStack spacing={2} display="inline-flex" minWidth="max-content" pr={1}>
        {children}
      </HStack>
    </Box>
  );
}
