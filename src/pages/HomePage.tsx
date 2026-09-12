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
import { SectionCard } from "../components/SectionCard";
import { useCurrentLocation } from "../lib/location";
import {
  fetchCashMovements,
  fetchCycleDetail,
  fetchCycleDisclosureAndCollection,
  fetchHistoryFeed,
  fetchHomeDashboard,
  fetchOutstandingBalances,
  fetchProducts,
  fetchReportsSnapshot,
} from "../lib/api";
import {
  formatCount,
  formatCurrency,
  formatDateTimeLabel,
  formatDurationFromNow,
  formatPercent,
} from "../lib/format";
import { CashMovement, CycleDetail, CycleHonestyDetail, HistoryItem, HomeDashboard, PayLaterBalance, Product, ReportsSnapshot } from "../lib/types";

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
  const [recentCycleDetail, setRecentCycleDetail] = useState<CycleDetail | null>(null);
  const [metricsRange, setMetricsRange] = useState<MetricsRange>("latest");
  const [rangeMetrics, setRangeMetrics] = useState<ReportsSnapshot | null>(null);
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
      setMetricsError("");
      setIsMetricsLoading(false);
      return;
    }

    setIsMetricsLoading(true);
    setRangeMetrics(null);
    setMetricsError("");
    void fetchReportsSnapshot(metricsRange)
      .then((result) => {
        if (!cancelled) setRangeMetrics(result);
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
      const [nextHonesty, nextCycleDetail] = recentCycleId
        ? await Promise.all([
            fetchCycleDisclosureAndCollection(recentCycleId),
            fetchCycleDetail(recentCycleId),
          ])
        : [null, null];
      setRecentHonesty(nextHonesty);
      setRecentCycleDetail(nextCycleDetail);
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
    .reduce((sum, movement) => sum + movement.amount, 0);
  const estimatedPhysicalCash =
    dashboard.currentCycle?.estimatedPhysicalCash ??
    (cashRemovedSinceLastVisit > 0 || cashReturnedSinceLastVisit > 0
      ? Math.max(cashReturnedSinceLastVisit - cashRemovedSinceLastVisit, 0)
      : null);
  const isLatestMetrics = metricsRange === "latest";
  const metricsAvailable = isLatestMetrics ? Boolean(dashboard.recentResult) : Boolean(rangeMetrics);
  const metricsTitle = isLatestMetrics
    ? dashboard.recentResult?.label ?? "No completed checks yet"
    : metricsRangeOptions.find((option) => option.value === metricsRange)?.label ?? "Selected period";
  const metricsHonestyRate = isLatestMetrics ? recentHonesty?.summary.disclosureRate ?? null : rangeMetrics?.summary.disclosureRate ?? null;
  const metricsCollectionRate = isLatestMetrics
    ? recentHonesty?.summary.collectionRate ?? dashboard.recentResult?.settledRate ?? null
    : rangeMetrics?.summary.collectionRate ?? null;
  const metricsUnaccounted = isLatestMetrics ? dashboard.recentResult?.unaccountedAmount ?? 0 : rangeMetrics?.summary.unaccountedAmount ?? 0;
  const metricsPaymentGap = isLatestMetrics
    ? recentHonesty?.summary.outstandingRequiredAmount ?? 0
    : rangeMetrics?.summary.outstandingRequiredAmount ?? 0;
  const metricsPayLaterOutstanding = isLatestMetrics
    ? outstandingBalances
        .filter((balance) => balance.sourceCycleId === dashboard.recentResult?.cycleId)
        .reduce((total, balance) => total + balance.remainingAmount, 0)
    : (rangeMetrics?.reportPayLaterBalances ?? []).reduce((total, balance) => total + balance.remainingAmount, 0);
  const metricsExpectedCollection = isLatestMetrics
    ? recentHonesty?.summary.currentlyDueAmount ?? dashboard.recentResult?.expectedRevenue ?? 0
    : rangeMetrics?.summary.paymentRequiredAmount ?? 0;
  const metricsActualCollection = isLatestMetrics
    ? recentHonesty?.summary.totalPayments ?? dashboard.recentResult?.immediatePayments ?? 0
    : rangeMetrics?.summary.totalPayments ?? 0;
  const metricsSelfReported = isLatestMetrics ? recentHonesty?.summary.selfReportedBottles ?? 0 : rangeMetrics?.summary.selfReportedBottles ?? 0;
  const metricsUnattributed = isLatestMetrics ? recentHonesty?.summary.unattributedMissingBottles ?? 0 : rangeMetrics?.summary.unattributedMissingBottles ?? 0;
  const metricsUnclassified = isLatestMetrics ? recentHonesty?.summary.unclassifiedHistoricalRecords ?? 0 : rangeMetrics?.summary.unclassifiedHistoricalRecords ?? 0;
  const metricsGrossSales = isLatestMetrics
    ? recentCycleDetail?.totals.expectedRevenue ?? dashboard.recentResult?.expectedRevenue ?? 0
    : rangeMetrics?.summary.expectedRevenue ?? 0;
  const metricsCapitalUsed = isLatestMetrics
    ? recentCycleDetail?.totals.cogs ?? 0
    : rangeMetrics?.summary.cogs ?? 0;
  const metricsGrossProfit = isLatestMetrics
    ? recentCycleDetail?.totals.grossProfit ?? 0
    : rangeMetrics?.summary.grossProfit ?? 0;
  const metricsGrossMargin = isLatestMetrics
    ? recentCycleDetail?.totals.grossMargin ?? null
    : rangeMetrics?.summary.grossMargin ?? null;

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
                ? "No recorded cash movements since the last visit"
                : "Estimated from recorded removals and returns"
            }
          />
          <MetricCard
            label="Unaccounted"
            value={formatCurrency(dashboard.recentResult?.unaccountedAmount ?? 0)}
            hint="Not yet explained by payment, pay-later, or an authorized adjustment"
          />
          <MetricCard
            label="Known pay-later"
            value={formatCurrency(dashboard.recentResult?.knownPayLater ?? 0)}
            hint="Recorded as expected later"
          />
          <MetricCard
            label="Complimentary value"
            value={formatCurrency(recentHonesty?.summary.complimentaryValue ?? 0)}
            hint={recentHonesty ? `${recentHonesty.summary.complimentaryBottles} complimentary bottle${recentHonesty.summary.complimentaryBottles === 1 ? "" : "s"}` : "No classified complimentary bottles"}
          />
        </SimpleGrid>
        <Text color="canvas.700" mt={3} fontSize="sm">
          Cash movements since last visit: {formatCurrency(cashRemovedSinceLastVisit)} removed · {formatCurrency(cashReturnedSinceLastVisit)} returned
        </Text>
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
                hint="Selling value of bottles taken"
              />
              <MetricCard
                label="Capital used"
                value={formatCurrency(metricsCapitalUsed)}
                hint="Cost of goods sold"
              />
              <MetricCard
                label="Gross profit"
                value={formatCurrency(metricsGrossProfit)}
                hint="Gross sales less product cost"
              />
              <MetricCard
                label="Gross margin"
                value={formatPercent(metricsGrossMargin)}
                hint="Gross profit as a share of sales"
              />
            </SimpleGrid>
            <Text color="canvas.700" fontSize="sm" mt={3}>
              Net profit is not shown because operating expenses are not tracked yet.
            </Text>
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
