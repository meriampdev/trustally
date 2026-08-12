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
  fetchHistoryFeed,
  fetchHomeDashboard,
  fetchOutstandingBalances,
  fetchProducts,
} from "../lib/api";
import {
  formatCount,
  formatCurrency,
  formatDateTimeLabel,
  formatDurationFromNow,
  formatPercent,
} from "../lib/format";
import { CashMovement, HistoryItem, HomeDashboard, PayLaterBalance, Product } from "../lib/types";

export default function HomePage() {
  const { currentLocationId } = useCurrentLocation();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [latestStockEntry, setLatestStockEntry] = useState<HistoryItem | null>(null);
  const [latestBoxCheckEntry, setLatestBoxCheckEntry] = useState<HistoryItem | null>(null);
  const [outstandingBalances, setOutstandingBalances] = useState<PayLaterBalance[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void load(currentLocationId);
  }, [currentLocationId]);

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

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Current cycle" title={dashboard.locationName ?? "Your box"}>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <MetricCard
            label="Last checked"
            value={formatDateTimeLabel(lastCheckedAt)}
            hint={lastCheckedAt ? "Most recent box check" : "No completed box check yet"}
          />
          <MetricCard label="Running for" value={formatDurationFromNow(cycleStartedAt)} />
          <MetricCard
            label="Last loaded into box"
            value={formatCount(lastLoadedQuantity)}
            hint={
              latestStockEntry
                ? `Added ${formatDateTimeLabel(latestStockEntry.happenedAt)}`
                : cycleStartedAt
                  ? `Tracking from ${formatDateTimeLabel(cycleStartedAt)}`
                  : "No stock-add record yet"
            }
          />
          <MetricCard
            label="Outstanding"
            value={formatCurrency(outstandingAmount)}
            hint={
              outstandingBalances.length
                ? `${outstandingBalances.length} pay-later balance${outstandingBalances.length === 1 ? "" : "s"}`
                : "No open pay-later balances"
            }
          />
        </SimpleGrid>
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

      <SectionCard eyebrow="Cash status" title="Physical cash in the honesty box">
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
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
            label="Removed since last visit"
            value={formatCurrency(cashRemovedSinceLastVisit)}
          />
          <MetricCard
            label="Returned since last visit"
            value={formatCurrency(cashReturnedSinceLastVisit)}
          />
        </SimpleGrid>
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

      <SectionCard eyebrow="Recent result" title={dashboard.recentResult?.label ?? "No completed checks yet"}>
        {dashboard.recentResult ? (
          <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4}>
            <MetricCard
              label="Expected from bottles taken"
              value={formatCurrency(dashboard.recentResult.expectedRevenue)}
            />
            <MetricCard
              label="Money received this period"
              value={formatCurrency(dashboard.recentResult.immediatePayments)}
            />
            <MetricCard
              label="Known pay-later"
              value={formatCurrency(dashboard.recentResult.knownPayLater)}
            />
            <MetricCard
              label="Unaccounted"
              value={formatCurrency(dashboard.recentResult.unaccountedAmount)}
            />
            <MetricCard
              label="Accounted rate"
              value={formatPercent(dashboard.recentResult.accountedRate)}
            />
            <MetricCard
              label="Settled rate"
              value={formatPercent(dashboard.recentResult.settledRate)}
            />
          </SimpleGrid>
        ) : (
          <Text color="canvas.700">
            No box checks yet. Complete your first check to see sales, pay-later, and settlement metrics.
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
