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
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { MetricCard } from "../components/MetricCard";
import { PaymentDetailsModal } from "../components/PaymentDetailsModal";
import { SectionCard } from "../components/SectionCard";
import { SetAsideSummary } from "../components/SetAsideSummary";
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
import { formatReportDateRange, ReportRangeKey, reportRangeOptions } from "../lib/reportRange";
import { CashMovement, CycleCashFloatDetail, CycleHonestyDetail, CyclePaymentDetail, CyclePaymentRecord, CycleSetAside, HistoryItem, HomeDashboard, PayLaterBalance, Product, ReportSetAside, ReportsSnapshot } from "../lib/types";

type MetricsRange = "latest" | ReportRangeKey;
type DashboardDetail = { title: string; description: string; values: Array<[string, string]>; route?: string; routeLabel?: string };

const metricsRangeOptions: Array<{ value: MetricsRange; label: string }> = [
  { value: "latest", label: "Latest cycle" },
  ...reportRangeOptions,
];

export default function HomePage() {
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
  const metricsSelfReported = isLatestMetrics ? recentHonesty?.summary.selfReportedBottles ?? 0 : rangeMetrics?.summary.selfReportedBottles ?? 0;
  const metricsUnattributed = isLatestMetrics ? recentHonesty?.summary.unattributedMissingBottles ?? 0 : rangeMetrics?.summary.unattributedMissingBottles ?? 0;
  const metricsUnclassified = isLatestMetrics ? recentHonesty?.summary.unclassifiedHistoricalRecords ?? 0 : rangeMetrics?.summary.unclassifiedHistoricalRecords ?? 0;
  const metricsGrossSales = metricsPaymentTotal;
  const metricsPuresafeCapital = isLatestMetrics
    ? recentSetAside?.puresafeCapital ?? null
    : rangeSetAside?.summary.puresafeCapital ?? null;
  const metricsElectricityShare = isLatestMetrics
    ? recentSetAside?.electricityShare ?? 0
    : rangeSetAside?.summary.electricityShare ?? 0;
  const metricsMiscCapital = isLatestMetrics
    ? recentSetAside?.miscCapital ?? null
    : rangeSetAside?.summary.miscCapital ?? null;
  const metricsTotalCapital = metricsPuresafeCapital == null || metricsMiscCapital == null
    ? null
    : metricsPuresafeCapital + metricsMiscCapital;
  const metricsGrossProfit = metricsTotalCapital == null
    ? null
    : metricsGrossSales - metricsTotalCapital;
  const metricsTotalSetAside = isLatestMetrics
    ? recentSetAside?.totalSetAside ?? null
    : rangeSetAside?.summary.totalSetAside ?? null;
  const metricsRemainingEarnings = isLatestMetrics
    ? recentSetAside?.remainingEarnings ?? null
    : rangeSetAside?.summary.remainingEarnings ?? null;
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
    <Stack spacing={5}>
      <SectionCard eyebrow="Current cycle" title={dashboard.locationName ?? "Your box"}>
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
          <SimpleGrid columns={{ base: 2, md: 4 }}>
            <CompactCycleStat label="Last checked" value={formatDateTimeLabel(lastCheckedAt)} />
            <CompactCycleStat label="Running for" value={formatDurationFromNow(cycleStartedAt)} />
            <CompactCycleStat label="Last loaded" value={formatCount(lastLoadedQuantity)} />
            <CompactCycleStat
              label={outstandingBalances.length ? "Pay-later outstanding" : "Known pay-later"}
              value={outstandingBalances.length ? formatCurrency(outstandingAmount) : "None"}
            />
          </SimpleGrid>
        </Box>
        <HStack mt={5} spacing={3} flexWrap="wrap">
          <Button as={Link} to="/check-box">
            Check box
          </Button>
          <Button as={Link} to="/stock" variant="outline">
            + Add stock
          </Button>
          <Button as={Link} to="/pay-later" variant="outline">
            Record pay-later
          </Button>
          <Button as={Link} to="/payments" variant="outline">
            Record payment
          </Button>
          <Button as={Link} to="/cash-movements" variant="outline">
            Cash removed
          </Button>
        </HStack>
      </SectionCard>

      <SectionCard eyebrow="Cash status" title="Cash position and explained amounts">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
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
            <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
              <MetricCard label="Opening change float" value={recentCashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(recentCashFloat.openingChangeFloat)} hint="View completed cash check" onClick={() => showDetail("Opening change float", "Cash already in the box when the completed cycle began.", [["Opening", recentCashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(recentCashFloat.openingChangeFloat)], ["Source", recentCashFloat.openingChangeFloatSource]])} />
              <MetricCard label="Cash counted" value={formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)} hint="View completed cash check" onClick={() => showDetail("Cash counted", "Physical cash counted before the cycle withdrawal.", [["Counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Withdrawn", formatCurrency(recentCashFloat.cashWithdrawn)]])} />
              <MetricCard label="Cash generated" value={recentCashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(recentCashFloat.cashGenerated)} hint="View calculation" onClick={() => showDetail("Customer cash generated", "Counted cash plus interim withdrawals, less opening float and tracked non-sales additions.", [["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Interim withdrawals", formatCurrency(recentCashFloat.interimOwnerWithdrawals)], ["Opening float", formatCurrency(recentCashFloat.openingChangeFloat)], ["Generated", recentCashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(recentCashFloat.cashGenerated)]])} />
              <MetricCard label="Left for Change" value={formatCurrency(recentCashFloat.closingChangeFloat)} hint="View completed cash check" onClick={() => showDetail("Left for Change", "Physical cash deliberately left in the box for the next cycle.", [["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)]])} />
              <MetricCard label="Cash withdrawn" value={formatCurrency(recentCashFloat.cashWithdrawn)} hint="View completed cash check" onClick={() => showDetail("Cash withdrawn", "Cash counted minus the amount left for change.", [["Cash counted", formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)], ["Left for Change", formatCurrency(recentCashFloat.closingChangeFloat)], ["Withdrawn", formatCurrency(recentCashFloat.cashWithdrawn)]])} />
            </SimpleGrid>
          </Box>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Metrics" title={metricsTitle}>
        <HStack spacing={2} flexWrap="wrap" mb={4}>
          {metricsRangeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
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
        </HStack>
        {isMetricsLoading ? <Spinner color="brand.400" /> : metricsError ? (
          <Text color="caution.600">{metricsError}</Text>
        ) : metricsAvailable ? (
          <Stack spacing={3}>
          <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} spacing={4}>
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
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              <MetricCard
                label="Gross sales"
                value={formatCurrency(metricsGrossSales)}
                hint="Actual recorded payments · Click to view"
                onClick={() => setPaymentDetailView("all")}
              />
              <MetricCard label="Total Capital" value={metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)} hint="View calculation" onClick={() => showDetail("Total capital", "Replacement capital for Puresafe plus all other depleted products.", [["Puresafe", metricsPuresafeCapital == null ? "Unable to calculate" : formatCurrency(metricsPuresafeCapital)], ["Other products", metricsMiscCapital == null ? "Unable to calculate" : formatCurrency(metricsMiscCapital)], ["Total", metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)]])} />
              <MetricCard label="Gross Profit" value={metricsGrossProfit == null ? "Unable to calculate" : formatCurrency(metricsGrossProfit)} hint="View calculation" onClick={() => showDetail("Gross profit", "Actual recorded sales less product replacement capital.", [["Gross sales", formatCurrency(metricsGrossSales)], ["Total capital", metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)], ["Gross profit", metricsGrossProfit == null ? "Unable to calculate" : formatCurrency(metricsGrossProfit)]])} />
            </SimpleGrid>
            {isLatestMetrics && recentSetAside ? (
              <Box mt={4}><SetAsideSummary value={recentSetAside} onMetricClick={(metric) => {
                const detailMap: Record<string, DashboardDetail> = {
                  cashAvailableAfterChangeFloat: { title: "Cash after change float", description: "Cash available after preserving the closing change float.", values: [["Available cash", formatCurrency(recentSetAside.cashAvailableAfterChangeFloat)]] },
                  availableOnlinePayments: { title: "Available online payments", description: "Online payments recorded for this cycle.", values: [["Online payments", formatCurrency(recentSetAside.availableOnlinePayments)]] },
                  totalAvailable: { title: "Total available", description: "Cash after change float plus available online payments.", values: [["Cash", formatCurrency(recentSetAside.cashAvailableAfterChangeFloat)], ["Online", formatCurrency(recentSetAside.availableOnlinePayments)], ["Total", formatCurrency(recentSetAside.totalAvailable)]] },
                  puresafeCapital: { title: "Puresafe capital", description: "Replacement cost reserved for depleted Puresafe bottles.", values: [["Bottles", String(recentSetAside.puresafeBottlesToReplace)], ["Cost per bottle", formatCurrency(recentSetAside.puresafeCostPerUnit)], ["Capital", recentSetAside.puresafeCapital == null ? "Unable to calculate" : formatCurrency(recentSetAside.puresafeCapital)]] },
                  electricityShare: { title: "Electricity share", description: "Cycle duration multiplied by the saved hourly electricity rate.", values: [["Hours", recentSetAside.cycleHours.toFixed(2)], ["Rate", formatCurrency(recentSetAside.electricityCostPerHour)], ["Share", formatCurrency(recentSetAside.electricityShare)]] },
                  miscCapital: { title: "Other-products capital", description: "Replacement capital for depleted non-Puresafe products.", values: [["Capital", recentSetAside.miscCapital == null ? "Unable to calculate" : formatCurrency(recentSetAside.miscCapital)]] },
                  totalSetAside: { title: "Total set aside", description: "All product capital and electricity reserves.", values: [["Total", recentSetAside.totalSetAside == null ? "Unable to calculate" : formatCurrency(recentSetAside.totalSetAside)]] },
                  remainingEarnings: { title: "To Stash", description: "Net earnings available after change float and all reserves.", values: [["Remaining", recentSetAside.remainingEarnings == null ? "Unable to calculate" : formatCurrency(recentSetAside.remainingEarnings)]] },
                  shortfall: { title: "Shortfall", description: "How far available funds fall below required reserves.", values: [["Shortfall", recentSetAside.shortfall == null ? "Unable to calculate" : formatCurrency(recentSetAside.shortfall)]] },
                };
                const selected = detailMap[metric];
                if (selected) setDashboardDetail({ ...selected, route: metricsDetailRoute, routeLabel: "View full cycle" });
              }} /></Box>
            ) : !isLatestMetrics && rangeSetAside ? (
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mt={4}>
                <MetricCard label="Puresafe Capital" value={rangeSetAside.summary.puresafeCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.puresafeCapital)} hint="View by cycle in reports" onClick={() => showDetail("Puresafe capital", "Replacement capital reserved for Puresafe bottles in this period.", [["Capital", rangeSetAside.summary.puresafeCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.puresafeCapital)]])} />
                <MetricCard label="Electricity Share" value={formatCurrency(rangeSetAside.summary.electricityShare)} hint="View by cycle in reports" onClick={() => showDetail("Electricity share", "Cycle duration multiplied by each cycle's saved hourly rate.", [["Electricity share", formatCurrency(rangeSetAside.summary.electricityShare)]])} />
                <MetricCard label="Other Products Capital" value={rangeSetAside.summary.miscCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.miscCapital)} hint="View by cycle in reports" onClick={() => showDetail("Other-products capital", "Replacement cost for depleted non-Puresafe products.", [["Capital", rangeSetAside.summary.miscCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.miscCapital)]])} />
                <MetricCard label="Total Set Aside" value={rangeSetAside.summary.totalSetAside == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.totalSetAside)} hint="View by cycle in reports" onClick={() => showDetail("Total set aside", "Product capital plus electricity reserve.", [["Total", rangeSetAside.summary.totalSetAside == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.totalSetAside)]])} />
                <MetricCard label="To Stash" value={rangeSetAside.summary.remainingEarnings == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.remainingEarnings)} hint="View by cycle in reports" onClick={() => showDetail("To Stash", "Earnings remaining after change float and reserves.", [["Remaining", rangeSetAside.summary.remainingEarnings == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.remainingEarnings)]])} />
                <MetricCard label="Shortfall" value={rangeSetAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.shortfall)} hint="View by cycle in reports" onClick={() => showDetail("Set-aside shortfall", "The amount by which available funds fall short of required reserves.", [["Shortfall", rangeSetAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.shortfall)]])} />
              </SimpleGrid>
            ) : null}
          </Box>
          {metricsUnclassified > 0 ? <Text color="canvas.700" mt={3}>{metricsUnclassified} historical record{metricsUnclassified === 1 ? " is" : "s are"} still unclassified.</Text> : null}
          </Stack>
        ) : (
          <Text color="canvas.700">No completed cycles in this period.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Box contents" title="What products are in the box?">
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

      <SectionCard eyebrow="Last stock added" title={latestStockEntry ? latestStockEntry.title : "Initial box load"}>
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

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5}>
        <SectionCard eyebrow="Outstanding" title="Open balances">
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
              <Button as={Link} to="/payments" variant="outline">
                View outstanding payments
              </Button>
            </Stack>
          ) : (
            <Text color="canvas.700">No open balances right now.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Restock soon" title="Alerts">
          {dashboard.alerts.length ? (
            <Stack spacing={3}>
              {dashboard.alerts.map((item) => (
                <Box key={item.productId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => showDetail(item.productName, "Low-stock estimate based on recent consumption.", [["Estimated days remaining", item.estimatedDaysRemaining == null ? "Not enough history" : String(item.estimatedDaysRemaining)], ["Suggested to bring", String(item.suggestedBring ?? 0)]], "/products", "View product") }>
                  <Text fontWeight="800">{item.productName}</Text>
                  <Text color="canvas.700" mt={1}>
                    {item.estimatedDaysRemaining == null
                      ? "Not enough history yet"
                      : `${item.estimatedDaysRemaining} day${item.estimatedDaysRemaining === 1 ? "" : "s"} left at the current pace`}
                  </Text>
                  <Text mt={2} fontWeight="800" color="honesty.500">
                    Bring about {item.suggestedBring ?? 0}
                  </Text>
                </Box>
              ))}
            </Stack>
          ) : (
            <Text color="canvas.700">
              No urgent alerts right now. Trustally will flag products that are running low.
            </Text>
          )}
        </SectionCard>
      </SimpleGrid>

      <SectionCard eyebrow="What should I bring?" title="Restock suggestions">
        {dashboard.whatToBring.length ? (
          <Stack spacing={3}>
            {dashboard.whatToBring.map((item) => (
              <Box key={item.productId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => showDetail(item.productName, "Restock suggestion based on average daily consumption and estimated stock.", [["Average per day", item.averageDailyConsumption == null ? "Not enough history" : item.averageDailyConsumption.toFixed(1)], ["Estimated remaining", String(item.estimatedRemaining ?? 0)], ["Suggested to bring", String(item.suggestedBring ?? 0)], ["Status", item.status]], "/reports", "View product performance") }>
                <Text fontWeight="800">{item.productName}</Text>
                <Text color="canvas.700" mt={1}>
                  {item.averageDailyConsumption == null
                    ? "Not enough history yet"
                    : `Average ${item.averageDailyConsumption.toFixed(1)}/day • Estimated remaining ${item.estimatedRemaining ?? 0}`}
                </Text>
                <Text mt={2} fontWeight="800" color="honesty.500">
                  {item.suggestedBring && item.suggestedBring > 0
                    ? `Bring about ${item.suggestedBring}`
                    : item.status}
                </Text>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text color="canvas.700">
            Complete a few box cycles and Trustally will suggest what to bring.
          </Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Retail value" title="Current box value">
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
