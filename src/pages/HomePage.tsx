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
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { MetricCard } from "../components/MetricCard";
import { ReserveCashModal } from "../components/ReserveCashModal";
import { SectionCard } from "../components/SectionCard";
import { StashRecordModal } from "../components/StashRecordModal";
import { useCurrentLocation } from "../lib/location";
import {
  fetchCyclePaymentDetail,
  fetchCycleSetAside,
  fetchHistoryFeed,
  fetchHomeDashboard,
  fetchProducts,
  fetchReportSetAside,
} from "../lib/api";
import { formatCurrency, formatDateTimeLabel, formatDurationFromNow } from "../lib/format";
import { formatReportDateRange, getDefaultReportDateRange } from "../lib/reportRange";
import { calculateSetAsideShareComparison, summarizeOnlinePayments } from "../lib/setAside";
import type { ReportRangeKey } from "../lib/reportRange";
import type { CyclePaymentDetail, CycleSetAside, HomeDashboard, Product, ReportSetAside, ReserveKind } from "../lib/types";

type StashRange = "latest" | Extract<ReportRangeKey, "7d" | "30d" | "custom">;

const stashRangeOptions: Array<{ value: StashRange; label: string }> = [
  { value: "latest", label: "Latest check" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom dates" },
];

type DashboardDetail = {
  title: string;
  description?: string;
  values: Array<[string, string]>;
  route?: string;
  routeLabel?: string;
};

type ReserveRow = {
  key: string;
  reserveKind: ReserveKind;
  label: string;
  goal: number | null;
  cycleTarget: number | null;
  actual: number | null;
  remaining: number | null;
  detail: DashboardDetail;
};

export default function HomePage() {
  const toast = useToast();
  const { currentLocationId } = useCurrentLocation();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [payments, setPayments] = useState<CyclePaymentDetail | null>(null);
  const [setAside, setSetAside] = useState<CycleSetAside | null>(null);
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const [selectedReserve, setSelectedReserve] = useState<ReserveRow | null>(null);
  const [isStashRecordOpen, setIsStashRecordOpen] = useState(false);
  const [stashRange, setStashRange] = useState<StashRange>("latest");
  const [stashStartDate, setStashStartDate] = useState("");
  const [stashEndDate, setStashEndDate] = useState("");
  const [stashReport, setStashReport] = useState<ReportSetAside | null>(null);
  const [reserveHistory, setReserveHistory] = useState<ReportSetAside | null>(null);
  const [isStashLoading, setIsStashLoading] = useState(false);
  const [stashError, setStashError] = useState("");
  const [isStashDateOpen, setIsStashDateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void load();
  }, [currentLocationId]);

  useEffect(() => {
    if (stashRange === "latest") {
      setStashReport(null);
      setStashError("");
      setIsStashLoading(false);
      return;
    }
    if (stashRange === "custom" && (!stashStartDate || !stashEndDate)) return;
    let cancelled = false;
    setIsStashLoading(true);
    setStashError("");
    const startDate = stashRange === "custom" ? stashStartDate : null;
    const endDate = stashRange === "custom" ? stashEndDate : null;
    void fetchReportSetAside(stashRange, startDate, endDate)
      .then((result) => {
        if (!cancelled) setStashReport(result);
      })
      .catch((error) => {
        if (!cancelled) setStashError(error instanceof Error ? error.message : "Could not load To Stash.");
      })
      .finally(() => {
        if (!cancelled) setIsStashLoading(false);
      });
    return () => { cancelled = true; };
  }, [stashRange, stashStartDate, stashEndDate, currentLocationId]);

  async function load() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [nextDashboard, nextProducts, checks, nextReserveHistory] = await Promise.all([
        fetchHomeDashboard(currentLocationId),
        fetchProducts(),
        fetchHistoryFeed("box_checks", 1, 0),
        fetchReportSetAside("custom", "2000-01-01", getDefaultReportDateRange().endDate),
      ]);
      setDashboard(nextDashboard);
      setProducts(nextProducts);
      setLastCheckedAt(nextDashboard.currentCycle?.lastCheckedAt ?? checks[0]?.happenedAt ?? null);
      setReserveHistory(nextReserveHistory);

      if (nextDashboard.recentResult?.cycleId) {
        const [nextPayments, nextSetAside] = await Promise.all([
          fetchCyclePaymentDetail(nextDashboard.recentResult.cycleId),
          fetchCycleSetAside(nextDashboard.recentResult.cycleId),
        ]);
        setPayments(nextPayments);
        setSetAside(nextSetAside);
      } else {
        setPayments(null);
        setSetAside(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load your box.");
    } finally {
      setIsLoading(false);
    }
  }

  const visibleProducts = useMemo(
    () => products
      .filter((product) => (product.lastKnownQuantity ?? 0) > 0)
      .sort((left, right) => (right.lastKnownQuantity ?? 0) - (left.lastKnownQuantity ?? 0)),
    [products],
  );

  if (isLoading) {
    return <VStack py={12}><Spinner size="xl" color="brand.400" /></VStack>;
  }

  if (errorMessage) {
    return (
      <SectionCard title="Couldn’t load Trustally">
        <Text color="caution.600">{errorMessage}</Text>
        <Button mt={4} onClick={() => void load()}>Try again</Button>
      </SectionCard>
    );
  }

  if (!dashboard?.hasSetup) {
    return (
      <SectionCard eyebrow="Get started" title="Set up your box">
        <Text color="canvas.700">Add the products currently in the box to start the first cycle.</Text>
        <Button as={Link} to="/setup" mt={4}>Start setup</Button>
      </SectionCard>
    );
  }

  const derivedRetail = visibleProducts.reduce(
    (sum, product) => sum + (product.lastKnownQuantity ?? 0) * product.currentSellingPrice,
    0,
  );
  const boxCapital = visibleProducts.reduce(
    (sum, product) => sum + (product.lastKnownQuantity ?? 0) * product.defaultUnitCost,
    0,
  );
  const retailValue = (dashboard.currentCycle?.retailValue ?? 0) || derivedRetail;
  const boxProfit = retailValue - boxCapital;
  const recent = dashboard.recentResult;
  const collected = payments?.summary.totalPayments ?? recent?.totalCollected ?? 0;
  const online = payments ? summarizeOnlinePayments(payments.records) : null;
  const shareComparison = setAside ? calculateSetAsideShareComparison(setAside) : null;
  const actual = setAside?.actualSetAside;
  const fundBalances = setAside?.fundBalances;

  const reserveRows: ReserveRow[] = setAside && shareComparison ? [
    reserveRow(
      "puresafe",
      "PURESAFE",
      "Puresafe",
      fundBalances?.puresafe.goal ?? setAside.puresafeReserveGoalSnapshot ?? shareComparison.puresafe.target,
      shareComparison.puresafe.target,
      fundBalances?.puresafe.physicalBalance ?? actual?.puresafeCapital,
      null,
      [
        ["Cycle target", moneyOrNotRecorded(shareComparison.puresafe.target)],
        ["Physical balance", moneyOrNotRecorded(fundBalances?.puresafe.physicalBalance)],
        ["Credit awaiting cash", moneyOrNotRecorded(fundBalances?.puresafe.creditAwaitingCash)],
        ["Funded balance", moneyOrNotRecorded(fundBalances?.puresafe.fundedBalance)],
      ],
    ),
    reserveRow(
      "other-products",
      "OTHER_PRODUCTS",
      "Other Products",
      fundBalances?.otherProducts.goal ?? setAside.otherProductsReserveGoalSnapshot ?? shareComparison.otherProducts.target,
      shareComparison.otherProducts.target,
      fundBalances?.otherProducts.physicalBalance ?? actual?.otherProductsCapital,
      null,
      [
        ["Cycle target", moneyOrNotRecorded(shareComparison.otherProducts.target)],
        ["Physical balance", moneyOrNotRecorded(fundBalances?.otherProducts.physicalBalance)],
        ["Credit awaiting cash", moneyOrNotRecorded(fundBalances?.otherProducts.creditAwaitingCash)],
        ["Funded balance", moneyOrNotRecorded(fundBalances?.otherProducts.fundedBalance)],
        ["Used for restocks", moneyOrNotRecorded(setAside.otherProductsReserve?.usedForRestocks)],
      ],
    ),
    reserveRow(
      "electricity",
      "ELECTRICITY",
      "Electricity",
      fundBalances?.electricity.goal ?? setAside.electricityReserveGoalSnapshot ?? shareComparison.electricity.target,
      shareComparison.electricity.target,
      fundBalances?.electricity.physicalBalance ?? actual?.electricityShare,
      null,
      [
        ["Cycle target", moneyOrNotRecorded(shareComparison.electricity.target)],
        ["Running hours", `${setAside.cycleHours.toFixed(1)} hours`],
        ["Cost per hour", formatCurrency(setAside.electricityCostPerHour)],
        ["Credit awaiting cash", moneyOrNotRecorded(fundBalances?.electricity.creditAwaitingCash)],
        ["Funded balance", moneyOrNotRecorded(fundBalances?.electricity.fundedBalance)],
      ],
    ),
    reserveRow(
      "savings",
      "CONTINGENCY",
      "Savings",
      shareComparison.contingency.target,
      shareComparison.contingency.target,
      fundBalances?.contingency.physicalBalance ?? actual?.contingency ?? null,
      null,
      [
        ["Physical cash", moneyOrNotRecorded(fundBalances?.contingency.physicalBalance ?? actual?.contingency)],
        ["Credit awaiting cash", moneyOrNotRecorded(fundBalances?.contingency.creditAwaitingCash ?? actual?.creditContingency)],
        ["Funded balance", moneyOrNotRecorded(fundBalances?.contingency.fundedBalance)],
      ],
    ),
  ] : [];

  const stashCash = stashRange === "latest"
    ? actual?.toStashCash ?? null
    : stashReport?.summary.actualToStashCash ?? null;
  const stashOnline = stashRange === "latest"
    ? actual?.onlineToStash ?? setAside?.onlineToStash ?? 0
    : stashReport?.summary.onlineToStash ?? 0;
  const stashTotal = stashCash == null ? null : stashCash + stashOnline;
  const stashChannels = stashRange === "latest"
    ? {
        gcash: online?.gcashPayments ?? setAside?.gcashPayments ?? 0,
        maya: online?.mayaPayments ?? setAside?.mayaPayments ?? 0,
        unionbank: online?.unionbankPayments ?? setAside?.unionbankPayments ?? 0,
        bpi: online?.bpiPayments ?? setAside?.bpiPayments ?? 0,
        bank: online?.legacyBankPayments ?? setAside?.legacyBankPayments ?? 0,
        other: online?.otherOnlinePayments ?? setAside?.otherOnlinePayments ?? 0,
      }
    : {
        gcash: stashReport?.summary.gcashToStash ?? 0,
        maya: stashReport?.summary.mayaPayments ?? 0,
        unionbank: stashReport?.summary.unionbankPayments ?? 0,
        bpi: stashReport?.summary.bpiPayments ?? 0,
        bank: stashReport?.summary.legacyBankPayments ?? 0,
        other: stashReport?.summary.otherOnlineToStash ?? 0,
      };
  const totalReserveCashOnHand = reserveRows.every((row) => row.actual != null)
    ? reserveRows.reduce((sum, row) => sum + (row.actual ?? 0), 0)
    : null;
  const totalReserveCashStillNeeded = reserveRows.every((row) => row.remaining != null)
    ? reserveRows.reduce((sum, row) => sum + (row.remaining ?? 0), 0)
    : null;

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Current cycle" title={`Cycle ${dashboard.currentCycle?.cycleNumber ?? ""}`}>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
          <CompactValue label="Last checked" value={lastCheckedAt ? formatDateTimeLabel(lastCheckedAt) : "Not checked"} />
          <CompactValue label="Running" value={dashboard.currentCycle?.startedAt ? formatDurationFromNow(dashboard.currentCycle.startedAt) : "—"} />
          <CompactValue label="Retail value" value={formatCurrency(retailValue)} />
          <CompactValue label="Profit" value={formatCurrency(boxProfit)} />
        </SimpleGrid>
        <HStack mt={4} spacing={3} overflowX="auto" pb={1}>
          <Button onClick={() => setIsContentsOpen(true)} variant="outline" flexShrink={0}>Box contents</Button>
          <Button as={Link} to="/check-box" flexShrink={0}>Check box</Button>
        </HStack>
      </SectionCard>

      <SectionCard eyebrow="Latest check" title={recent?.label ?? "No completed check yet"}>
        {recent ? (
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
            <MetricCard label="Expected sales" value={formatCurrency(recent.expectedRevenue)} onClick={() => setDetail({ title: "Expected sales", description: "Sales expected from bottles taken in this check.", values: [["Bottles taken", String(recent.bottlesTaken)]] })} />
            <MetricCard label="Payments collected" value={formatCurrency(collected)} onClick={() => setDetail({ title: "Payments collected", description: "Customer payments assigned to this cycle, including payments recorded earlier.", values: [["Cash", formatCurrency(payments?.summary.cashPayments ?? 0)], ["Online", formatCurrency(payments?.summary.onlinePayments ?? 0)], ["Known pay-later", formatCurrency(recent.knownPayLater)]] })} />
            <MetricCard label="Unexplained gap" value={formatCurrency(recent.unaccountedAmount)} onClick={() => setDetail({ title: "Unexplained gap", description: "Expected sales not explained by payments or known pay-later amounts.", values: [["Expected", formatCurrency(recent.expectedRevenue)], ["Collected", formatCurrency(collected)], ["Known pay-later", formatCurrency(recent.knownPayLater)]] })} />
          </SimpleGrid>
        ) : <Text color="canvas.700">Complete a box check to see the latest result.</Text>}
        {recent ? <Button as={Link} to={`/history/${recent.cycleId}`} size="sm" variant="ghost" mt={3}>View completed check</Button> : null}
      </SectionCard>

      <SectionCard eyebrow="Set aside" title="Latest completed check">
        {setAside ? (
          <Stack spacing={3}>
            <SimpleGrid columns={2} spacing={3}>
              <CompactTotalCard label="Total cash on hand" value={moneyOrNotRecorded(totalReserveCashOnHand)} />
              <CompactTotalCard label="Cash still needed" value={moneyOrNotRecorded(totalReserveCashStillNeeded)} />
            </SimpleGrid>
            {reserveRows.map((row) => (
              <Button
                key={row.key}
                variant="ghost"
                height="auto"
                p={4}
                bg="canvas.50"
                borderRadius="22px"
                justifyContent="stretch"
                onClick={() => setSelectedReserve(row)}
              >
                <Box width="100%" textAlign="left">
                  <Text fontWeight="900">{row.label}</Text>
                  <Text color="canvas.700" fontSize="sm" mt={1}>This cycle target: {moneyOrNotRecorded(row.cycleTarget)}</Text>
                  <SimpleGrid columns={3} spacing={2} mt={2}>
                    <MiniValue label="Goal" value={moneyOrNotRecorded(row.goal)} />
                    <MiniValue label="Cash on hand" value={moneyOrNotRecorded(row.actual)} />
                    <MiniValue label="Still needed" value={moneyOrNotRecorded(row.remaining)} />
                  </SimpleGrid>
                  <Progress
                    value={progressPercent(row.actual, row.goal)}
                    mt={3}
                    size="sm"
                    borderRadius="full"
                    colorScheme={row.goal != null && row.actual != null && row.actual >= row.goal ? "green" : "cyan"}
                    aria-label={`${row.label} set-aside progress`}
                  />
                </Box>
              </Button>
            ))}
          </Stack>
        ) : <Text color="canvas.700">Set-aside details will appear after the first completed check.</Text>}
      </SectionCard>

      <SectionCard eyebrow="To Stash" title="Cash and online payments">
        <HStack mb={4} justify="space-between" align="end" spacing={3}>
          <Box minW={0}>
            <Text color="canvas.700" fontSize="sm">Latest cycle target</Text>
            <Text fontWeight="900">{moneyOrNotRecorded(shareComparison?.toStash.target)}</Text>
          </Box>
          <Button onClick={() => setIsStashRecordOpen(true)} isDisabled={!setAside} flexShrink={0}>Record</Button>
        </HStack>
        <Box overflowX="auto" maxW="100%" pb={1}>
          <HStack spacing={2} width="max-content">
            {stashRangeOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                flexShrink={0}
                variant={stashRange === option.value ? "solid" : "outline"}
                onClick={() => {
                  if (option.value === "custom") setIsStashDateOpen(true);
                  else setStashRange(option.value);
                }}
              >
                {option.value === "custom" && stashRange === "custom"
                  ? formatReportDateRange(stashStartDate, stashEndDate)
                  : option.label}
              </Button>
            ))}
          </HStack>
        </Box>

        {isStashLoading ? <Spinner mt={5} color="brand.400" /> : stashError ? (
          <Text mt={5} color="caution.600">{stashError}</Text>
        ) : (
          <Stack spacing={4} mt={5}>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
              <MetricCard label="Total To Stash" value={moneyOrNotRecorded(stashTotal)} />
              <MetricCard label="Cash" value={moneyOrNotRecorded(stashCash)} />
              <MetricCard label="Online" value={formatCurrency(stashOnline)} />
            </SimpleGrid>
            <Box bg="canvas.50" borderRadius="22px" p={4}>
              <Text fontWeight="900">Online payments by source</Text>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mt={3}>
                <MiniValue label="GCash" value={formatCurrency(stashChannels.gcash)} />
                <MiniValue label="Maya" value={formatCurrency(stashChannels.maya)} />
                <MiniValue label="UnionBank" value={formatCurrency(stashChannels.unionbank)} />
                <MiniValue label="BPI" value={formatCurrency(stashChannels.bpi)} />
                {stashChannels.bank > 0 ? <MiniValue label="Bank" value={formatCurrency(stashChannels.bank)} /> : null}
                {stashChannels.other > 0 ? <MiniValue label="Other" value={formatCurrency(stashChannels.other)} /> : null}
              </SimpleGrid>
              <Text color="canvas.700" fontSize="sm" mt={3}>GCash goes directly to Stash. Maya and bank payments may first be earmarked for reserve credit; the Online total above shows what remains for Stash.</Text>
            </Box>
          </Stack>
        )}
      </SectionCard>

      <Modal isOpen={isContentsOpen} onClose={() => setIsContentsOpen(false)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>Box contents</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              {visibleProducts.map((product) => (
                <HStack key={product.id} justify="space-between" bg="canvas.50" borderRadius="18px" p={3} width={'100%'}>
                  <Box minW={0} width={'100%'}>
                    <Text fontWeight="800">{product.displayName}</Text>
                    <Text fontSize="sm" color="canvas.700">{product.lastKnownQuantity ?? 0} in box · {formatCurrency(product.currentSellingPrice)} each</Text>
                    <HStack spacing={4} mt={2} align="start" width={'100%'} justify={'space-between'}>
                      <MiniValue label="Capital" value={formatCurrency((product.lastKnownQuantity ?? 0) * product.defaultUnitCost)} />
                      <MiniValue label="Profit" value={formatCurrency((product.lastKnownQuantity ?? 0) * (product.currentSellingPrice - product.defaultUnitCost))} />
                    </HStack>
                  </Box>
                </HStack>
              ))}
            </Stack>
          </ModalBody>
          <ModalFooter><Button onClick={() => setIsContentsOpen(false)}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>{detail?.title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {detail?.description ? <Text color="canvas.700" mb={4}>{detail.description}</Text> : null}
            <Stack spacing={3}>
              {detail?.values.map(([label, value]) => (
                <HStack key={label} justify="space-between" align="start"><Text color="canvas.700">{label}</Text><Text fontWeight="800" textAlign="right">{value}</Text></HStack>
              ))}
            </Stack>
            <Text color="canvas.700" fontSize="sm" mt={4}>Reserve credits, calculations, and goal-hit history remain available in Reports.</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button as={Link} to={detail?.route ?? "/reports"} variant="outline">{detail?.routeLabel ?? "Open reports"}</Button>
            <Button onClick={() => setDetail(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {selectedReserve && currentLocationId && setAside ? (
        <ReserveCashModal
          isOpen
          reserveKind={selectedReserve.reserveKind}
          label={selectedReserve.label}
          currentCash={selectedReserve.actual ?? 0}
          cycle={setAside}
          cycleTarget={selectedReserve.cycleTarget}
          history={reserveHistory?.cycles ?? []}
          locationId={currentLocationId}
          onClose={() => setSelectedReserve(null)}
          onSaved={async (saved, correctedFunds) => {
            if (saved) setSetAside(saved);
            await load();
            if (correctedFunds) {
              setSetAside((current) => current ? { ...current, fundBalances: correctedFunds } : current);
            }
            toast({ title: `${selectedReserve.label} cash updated`, status: "success", position: "top" });
          }}
        />
      ) : null}

      {setAside ? (
        <StashRecordModal
          isOpen={isStashRecordOpen}
          cycle={setAside}
          history={reserveHistory?.cycles ?? []}
          onClose={() => setIsStashRecordOpen(false)}
          onSaved={(saved) => {
            setSetAside(saved);
            setStashRange("latest");
            toast({ title: "To Stash recorded", status: "success", position: "top" });
          }}
        />
      ) : null}

      <DateRangeModal
        isOpen={isStashDateOpen}
        startDate={stashStartDate}
        endDate={stashEndDate}
        onClose={() => setIsStashDateOpen(false)}
        onApply={(startDate, endDate) => {
          setStashStartDate(startDate);
          setStashEndDate(endDate);
          setStashRange("custom");
          setIsStashDateOpen(false);
        }}
      />
    </Stack>
  );
}

function CompactValue({ label, value }: { label: string; value: string }) {
  return <Box><Text color="canvas.700" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em">{label}</Text><Text fontWeight="900" mt={1}>{value}</Text></Box>;
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return <Box minW={0}><Text color="canvas.700" fontSize="xs">{label}</Text><Text fontSize="sm" fontWeight="800" whiteSpace="normal">{value}</Text></Box>;
}

function CompactTotalCard({ label, value }: { label: string; value: string }) {
  return (
    <Box minW={0} bg="canvas.50" borderRadius="22px" p={{ base: 3, sm: 4 }}>
      <Text color="canvas.700" fontSize="11px" textTransform="uppercase" letterSpacing="0.08em" lineHeight="short">
        {label}
      </Text>
      <Text mt={2} fontSize={{ base: "lg", sm: "2xl" }} fontWeight="900" lineHeight="short" overflowWrap="anywhere">
        {value}
      </Text>
    </Box>
  );
}

function moneyOrNotRecorded(value?: number | null) {
  return value == null ? "Not recorded" : formatCurrency(value);
}

function progressPercent(actual?: number | null, goal?: number | null) {
  if (actual == null || goal == null || goal <= 0) return 0;
  return Math.min((actual / goal) * 100, 100);
}

function reserveRow(
  key: string,
  reserveKind: ReserveKind,
  label: string,
  goal: number | null | undefined,
  cycleTarget: number | null | undefined,
  actual: number | null | undefined,
  remaining: number | null | undefined,
  values: Array<[string, string]>,
): ReserveRow {
  const resolvedActual = actual ?? null;
  const resolvedGoal = goal ?? null;
  return {
    key,
    reserveKind,
    label,
    goal: resolvedGoal,
    cycleTarget: cycleTarget ?? null,
    actual: resolvedActual,
    remaining: remaining ?? (resolvedActual == null || resolvedGoal == null ? null : Math.max(resolvedGoal - resolvedActual, 0)),
    detail: { title: label, values },
  };
}
