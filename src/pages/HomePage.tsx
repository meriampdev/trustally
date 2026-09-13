import {
  Box,
  Button,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { CashMovement, CycleCashFloatDetail, CycleHonestyDetail, CyclePaymentDetail, CyclePaymentRecord, CycleSetAside, HistoryItem, HomeDashboard, PayLaterBalance, Product, ReportSetAside, ReportsSnapshot } from "../lib/types";

type MetricsRange = "latest" | "7d" | "30d" | "month" | "3m" | "6m" | "1y";

const metricsRangeOptions: Array<{ value: MetricsRange; label: string }> = [
  { value: "latest", label: "Latest cycle" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
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
  const [rangeMetrics, setRangeMetrics] = useState<ReportsSnapshot | null>(null);
  const [rangeSetAside, setRangeSetAside] = useState<ReportSetAside | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

    setIsMetricsLoading(true);
    setRangeMetrics(null);
    setRangeSetAside(null);
    setMetricsError("");
    void Promise.all([fetchReportsSnapshot(metricsRange), fetchReportSetAside(metricsRange)])
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
  }, [metricsRange, currentLocationId]);

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

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Current cycle" title={dashboard.locationName ?? "Your box"}>
        <Box
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
          />
          <MetricCard
            label="Unaccounted"
            value={formatCurrency(recentHonesty && recentCyclePayments ? Math.max(recentHonesty.summary.currentlyDueAmount - recentCyclePayments.summary.totalPayments, 0) : dashboard.recentResult?.unaccountedAmount ?? 0)}
            hint="Not yet explained by payment, pay-later, or an authorized adjustment"
          />
          <MetricCard
            label="Known pay-later"
            value={formatCurrency(recentHonesty?.summary.payLaterAmount ?? dashboard.recentResult?.knownPayLater ?? 0)}
            hint="Recorded as expected later"
          />
          <MetricCard
            label="Complimentary value"
            value={formatCurrency(recentHonesty?.summary.complimentaryValue ?? 0)}
            hint={recentHonesty ? `${recentHonesty.summary.complimentaryBottles} complimentary bottle${recentHonesty.summary.complimentaryBottles === 1 ? "" : "s"}` : "No classified complimentary bottles"}
          />
        </SimpleGrid>
        <Text color="canvas.700" mt={3} fontSize="sm">
          Cash movements since last visit: {formatCurrency(cashRemovedSinceLastVisit)} removed · {formatCurrency(cashReturnedSinceLastVisit)} latest legacy Left for Change
        </Text>
        {recentCashFloat ? (
          <Box mt={5}>
            <Text fontWeight="900" mb={3}>Latest completed cash check</Text>
            <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
              <MetricCard label="Opening change float" value={recentCashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(recentCashFloat.openingChangeFloat)} />
              <MetricCard label="Cash counted" value={formatCurrency(recentCashFloat.cashCountedBeforeWithdrawal)} />
              <MetricCard label="Cash generated" value={recentCashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(recentCashFloat.cashGenerated)} />
              <MetricCard label="Left for Change" value={formatCurrency(recentCashFloat.closingChangeFloat)} />
              <MetricCard label="Cash withdrawn" value={formatCurrency(recentCashFloat.cashWithdrawn)} />
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
              onClick={() => setMetricsRange(option.value)}
            >
              {option.label}
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
            />
            <MetricCard
              label="Collection rate"
              value={metricsCollectionRate == null ? "Payment not required" : formatPercent(metricsCollectionRate)}
              hint={metricsPaymentGap > 0 ? `${formatCurrency(metricsPaymentGap)} required payment gap` : "No required payment gap"}
            />
            <MetricCard label="Unaccounted" value={formatCurrency(metricsUnaccounted)} hint="Amount not yet explained" />
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
              />
            ) : null}
            <MetricCard
              label="Expected vs actual collection"
              value={`${formatCurrency(metricsExpectedCollection)} / ${formatCurrency(metricsActualCollection)}`}
              hint="Expected due / actually collected"
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
              <MetricCard label="Total Capital" value={metricsTotalCapital == null ? "Unable to calculate" : formatCurrency(metricsTotalCapital)} hint="Puresafe plus all other product capital" />
              <MetricCard label="Gross Profit" value={metricsGrossProfit == null ? "Unable to calculate" : formatCurrency(metricsGrossProfit)} hint="Actual recorded sales less all product capital" />
            </SimpleGrid>
            {isLatestMetrics && recentSetAside ? (
              <Box mt={4}><SetAsideSummary value={recentSetAside} /></Box>
            ) : !isLatestMetrics && rangeSetAside ? (
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mt={4}>
                <MetricCard label="Puresafe Capital" value={rangeSetAside.summary.puresafeCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.puresafeCapital)} />
                <MetricCard label="Electricity Share" value={formatCurrency(rangeSetAside.summary.electricityShare)} />
                <MetricCard label="Other Products Capital" value={rangeSetAside.summary.miscCapital == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.miscCapital)} />
                <MetricCard label="Total Set Aside" value={rangeSetAside.summary.totalSetAside == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.totalSetAside)} />
                <MetricCard label="To Stash" value={rangeSetAside.summary.remainingEarnings == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.remainingEarnings)} />
                <MetricCard label="Shortfall" value={rangeSetAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(rangeSetAside.summary.shortfall)} />
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
              <Box key={product.id} borderRadius="24px" bg="canvas.50" p={4}>
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
            />
            <MetricCard label="Recorded" value={formatDateTimeLabel(latestStockEntry.happenedAt)} />
            <MetricCard label="Note" value={latestStockEntry.subtitle} />
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
                <Box key={balance.id} borderRadius="24px" bg="canvas.50" p={4}>
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
                <Box key={item.productId} borderRadius="24px" bg="canvas.50" p={4}>
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
              <Box key={item.productId} borderRadius="24px" bg="canvas.50" p={4}>
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
          <MetricCard label="Retail value" value={formatCurrency(retailValue)} />
          <MetricCard
            label="Tracked units"
            value={formatCount(derivedBoxUnits, "units")}
            hint={
              dashboard.currentCycle?.estimatedRemaining != null
                ? `Estimated remaining ${dashboard.currentCycle.estimatedRemaining}`
                : "Estimated remaining updates after enough history"
            }
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
