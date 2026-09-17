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
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StashBreakdown } from "../components/SetAsideSummary";
import { fetchReportsSnapshot, fetchReportSetAside } from "../lib/api";
import { formatCurrency, formatManilaDateTime, formatPercent } from "../lib/format";
import { formatReportDateRange, ReportRangeKey, reportRangeOptions } from "../lib/reportRange";
import { calculateCashOnlySetAside } from "../lib/setAside";
import { ReportsSnapshot, ReportSetAside } from "../lib/types";

export default function ReportsPage() {
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [setAside, setSetAside] = useState<ReportSetAside | null>(null);
  const [detailView, setDetailView] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const expectedVsCollected = Array.isArray(snapshot?.expectedVsCollected)
    ? snapshot.expectedVsCollected
    : [];

  const accountedTrend = Array.isArray(snapshot?.accountedTrend) ? snapshot.accountedTrend : [];
  const productPerformance = Array.isArray(snapshot?.productPerformance)
    ? snapshot.productPerformance
    : [];
  const disclosureCollectionTrend = Array.isArray(snapshot?.disclosureCollectionTrend)
    ? snapshot.disclosureCollectionTrend
    : [];
  const reportCyclesAscending = [...(snapshot?.reportCycles ?? [])].sort(
    (left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
  );

    
  useEffect(() => {
    if (rangeKey === "custom" && (!customStartDate || !customEndDate)) return;
    let cancelled = false;
    setSnapshot(null);
    setSetAside(null);
    setDetailView(null);
    setErrorMessage("");
    const startDate = rangeKey === "custom" ? customStartDate : null;
    const endDate = rangeKey === "custom" ? customEndDate : null;
    void Promise.all([
      fetchReportsSnapshot(rangeKey, startDate, endDate),
      fetchReportSetAside(rangeKey, startDate, endDate),
    ])
      .then(([nextSnapshot, nextSetAside]) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setSetAside(nextSetAside);
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Could not load this report.");
      });
    return () => { cancelled = true; };
  }, [rangeKey, customStartDate, customEndDate]);

  const maxRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...expectedVsCollected.map((item) =>
          Math.max(item?.expectedRevenue, item?.totalCollected),
        ),
      ),
    [expectedVsCollected],
  );

  if (errorMessage) {
    return <Text color="caution.600">{errorMessage}</Text>;
  }

  if (!snapshot || !setAside) {
    return <Spinner color="brand.400" />;
  }

  const actualGrossSales = snapshot.summary.totalPayments;
  const totalCapital = setAside.summary.puresafeCapital == null || setAside.summary.miscCapital == null
    ? null
    : setAside.summary.puresafeCapital + setAside.summary.miscCapital;
  const grossProfit = totalCapital == null
    ? null
    : actualGrossSales - totalCapital;
  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Range" title="Choose a reporting window">
        <HStack spacing={3} flexWrap="wrap">
          {reportRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={rangeKey === option.value ? "solid" : "subtle"}
              onClick={() => {
                if (option.value === "custom") {
                  setIsDateRangeOpen(true);
                } else {
                  setRangeKey(option.value);
                }
              }}
            >
              {option.value === "custom" && rangeKey === "custom"
                ? formatReportDateRange(customStartDate, customEndDate)
                : option.label}
            </Button>
          ))}
        </HStack>
        <Text color="canvas.700" fontSize="sm" mt={3}>
          Showing completed cycles from {rangeKey === "custom"
            ? formatReportDateRange(customStartDate, customEndDate)
            : reportRangeOptions.find((option) => option.value === rangeKey)?.label.toLowerCase()}.
        </Text>
      </SectionCard>

      <SectionCard eyebrow="Operational totals" title="What happened during these cycles">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Total collected" value={formatCurrency(snapshot.summary.totalPayments)} hint="Includes retroactive payments · View details" onClick={() => setDetailView("totalPayments")} />
          <MetricCard label="Cash payments" value={formatCurrency(snapshot.summary.cashPayments)} hint="View cash records by cycle" onClick={() => setDetailView("cashPayments")} />
          <MetricCard label="Online payments" value={formatCurrency(snapshot.summary.onlinePayments)} hint="View online records by cycle" onClick={() => setDetailView("onlinePayments")} />
          <MetricCard label="Known pay-later" value={formatCurrency(snapshot.summary.knownPayLater)} hint="View balances" onClick={() => setDetailView("knownPayLater")} />
          <MetricCard label="Bottles taken" value={String(snapshot.summary.bottlesTaken)} hint="View cycle and bottle details" onClick={() => setDetailView("bottlesTaken")} />
          <MetricCard label="Avg expected sales / cycle" value={formatCurrency(snapshot.summary.averageRevenuePerCycle)} hint="Based on bottles taken · View cycles" onClick={() => setDetailView("expectedRevenue")} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Sales metrics" title="Financial performance">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Gross sales" value={formatCurrency(actualGrossSales)} hint="Actual recorded payments · View details" onClick={() => setDetailView("salesRevenue")} />
          <MetricCard label="Puresafe Capital" value={setAside.summary.puresafeCapital == null ? "Unable to calculate" : formatCurrency(setAside.summary.puresafeCapital)} hint="View replacement cost by cycle" onClick={() => setDetailView("puresafeCapital")} />
          <MetricCard label="Gross Profit" value={grossProfit == null ? "Unable to calculate" : formatCurrency(grossProfit)} hint="View the full calculation" onClick={() => setDetailView("grossProfit")} />
          <MetricCard label="Electricity Share" value={formatCurrency(setAside.summary.electricityShare)} hint="View duration and hourly rate by cycle" onClick={() => setDetailView("electricityShare")} />
          <MetricCard label="Other Products Capital" value={setAside.summary.miscCapital == null ? "Unable to calculate" : formatCurrency(setAside.summary.miscCapital)} hint="View product replacement capital by cycle" onClick={() => setDetailView("miscCapital")} />
          <MetricCard label="Total Capital" value={totalCapital == null ? "Unable to calculate" : formatCurrency(totalCapital)} hint="View capital components by cycle" onClick={() => setDetailView("totalCapital")} />
          <MetricCard label="Total Set Aside" value={setAside.summary.totalSetAside == null ? "Unable to calculate" : formatCurrency(setAside.summary.totalSetAside)} hint="View reserves by cycle" onClick={() => setDetailView("totalSetAside")} />
          <MetricCard
            label="To Stash"
            value={setAside.summary.remainingEarnings == null ? "Unable to calculate" : formatCurrency(setAside.summary.remainingEarnings)}
            hint="Untouched online plus cash left after reserves"
            accent={(
              <StashBreakdown
                availableOnlinePayments={setAside.summary.availableOnlinePayments}
                cashAfterSetAside={setAside.summary.remainingEarnings == null
                  ? null
                  : Math.max(setAside.summary.remainingEarnings - setAside.summary.availableOnlinePayments, 0)}
              />
            )}
            onClick={() => setDetailView("remainingEarnings")}
          />
        </SimpleGrid>
        <Text color="canvas.700" fontSize="sm" mt={3}>Gross sales use actual recorded payments. Change float stays in the box and is excluded from Set Aside and earnings.</Text>
      </SectionCard>

      <SectionCard eyebrow="Set Aside" title="Automatic reserves by cycle">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Cash available for reserves" value={formatCurrency(setAside.summary.cashAvailableAfterChangeFloat)} hint="After preserving change float" onClick={() => setDetailView("cashAvailableAfterChangeFloat")} />
          <MetricCard label="Other products capital" value={setAside.summary.miscCapital == null ? "Unable to calculate" : formatCurrency(setAside.summary.miscCapital)} hint="View by cycle" onClick={() => setDetailView("miscCapital")} />
          <MetricCard label="Total set aside" value={setAside.summary.totalSetAside == null ? "Unable to calculate" : formatCurrency(setAside.summary.totalSetAside)} hint="View by cycle" onClick={() => setDetailView("totalSetAside")} />
          <MetricCard label="Cash shortfall" value={setAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(setAside.summary.shortfall)} hint="Reserves not covered by cash" onClick={() => setDetailView("shortfall")} />
        </SimpleGrid>
        <Stack spacing={3} mt={4}>
          {setAside.cycles.map((cycle) => (
            <Box key={cycle.cycleId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${cycle.cycleId}`)}>
              <Text fontWeight="900">Cycle #{cycle.cycleNumber}</Text>
              <Text color="canvas.700" mt={1}>Cash for reserves {formatCurrency(cycle.cashAvailableAfterChangeFloat)}</Text>
              <Text color="canvas.700" mt={1}>Total set aside {cycle.totalSetAside == null ? "Unable to calculate" : formatCurrency(cycle.totalSetAside)} · To Stash {cycle.remainingEarnings == null ? "Unable to calculate" : formatCurrency(cycle.remainingEarnings)} · Cash shortfall {cycle.shortfall == null ? "Unable to calculate" : formatCurrency(cycle.shortfall)}</Text>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Cash box flow" title="Change float by cycle">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Cash counted" value={formatCurrency(snapshot.cashFloatSummary.cashCounted)} hint="View cash checks by cycle" onClick={() => setDetailView("cashCounted")} />
          <MetricCard label="Customer cash generated" value={formatCurrency(snapshot.cashFloatSummary.cashGenerated)} hint="View generated cash by cycle" onClick={() => setDetailView("cashGenerated")} />
          <MetricCard label="Cash withdrawn" value={formatCurrency(snapshot.cashFloatSummary.cashWithdrawn)} hint="View withdrawals by cycle" onClick={() => setDetailView("cashWithdrawn")} />
          <MetricCard label="Unknown opening floats" value={String(snapshot.cashFloatSummary.unknownOpeningFloatCycles)} hint="View excluded cycles" onClick={() => setDetailView("unknownOpeningFloats")} />
        </SimpleGrid>
        <Stack spacing={3} mt={4}>
          {snapshot.reportCashFloats.length ? snapshot.reportCashFloats.map((cashFloat) => (
            <Box key={cashFloat.cycleId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${cashFloat.cycleId}`)}>
              <Text fontWeight="900">{cashFloat.cycleLabel}</Text>
              <Text color="canvas.700" mt={1}>
                Opening {cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(cashFloat.openingChangeFloat)} · Counted {formatCurrency(cashFloat.cashCountedBeforeWithdrawal)} · Left for Change {formatCurrency(cashFloat.closingChangeFloat)}
              </Text>
              <Text color="canvas.700" mt={1}>
                Cash generated {cashFloat.cashGenerated == null ? "Cannot be determined until opening float is provided" : formatCurrency(cashFloat.cashGenerated)} · Withdrawn {formatCurrency(cashFloat.cashWithdrawn)}
              </Text>
            </Box>
          )) : <Text color="canvas.700">No completed cash checks in this range.</Text>}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Disclosure and collection" title="How bottles were disclosed and paid for">
        <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing={4}>
          <MetricCard label="Disclosure honesty" value={formatPercent(snapshot.summary.disclosureRate)} hint={`${snapshot.summary.selfReportedBottles} self-reported bottles · View details`} onClick={() => setDetailView("disclosure")} />
          <MetricCard label="Observed / recorded" value={String(snapshot.summary.ownerRecordedBottles)} hint="View records" onClick={() => setDetailView("owner_recorded")} />
          <MetricCard label="Inventory discrepancy" value={String(snapshot.summary.inventoryDiscrepancyBottles)} hint="View records" onClick={() => setDetailView("inventory_discrepancy")} />
          <MetricCard label="Unattributed missing" value={String(snapshot.summary.unattributedMissingBottles)} hint="View cycle details" onClick={() => setDetailView("unattributed")} />
          <MetricCard label="Complimentary bottles" value={String(snapshot.summary.complimentaryBottles)} hint="View records" onClick={() => setDetailView("complimentary")} />
          <MetricCard label="Unclassified history" value={String(snapshot.summary.unclassifiedHistoricalRecords)} hint="View records" onClick={() => setDetailView("unclassified")} />
          <MetricCard
            label="Known unpaid"
            value={`${snapshot.summary.knownUnpaidBottles} bottle${snapshot.summary.knownUnpaidBottles === 1 ? "" : "s"}`}
            hint={`${formatCurrency(snapshot.summary.knownUnpaidAmount)} recorded value · Click to view`}
            onClick={() => setDetailView("knownUnpaid")}
          />
          <MetricCard label="Collection rate" value={snapshot.summary.collectionRate == null ? "Payment not required" : formatPercent(snapshot.summary.collectionRate)} hint="View payment details" onClick={() => setDetailView("collection")} />
          <MetricCard label="Payment required" value={formatCurrency(snapshot.summary.paymentRequiredAmount)} hint="View cycles" onClick={() => setDetailView("paymentRequired")} />
          <MetricCard label="Pay later" value={formatCurrency(snapshot.summary.payLaterAmount)} hint="View records and balances" onClick={() => setDetailView("payLater")} />
          <MetricCard label="Complimentary value" value={formatCurrency(snapshot.summary.complimentaryValue)} hint="View records" onClick={() => setDetailView("complimentary")} />
          <MetricCard label="Required payment gap" value={formatCurrency(snapshot.summary.outstandingRequiredAmount)} hint="View cycles" onClick={() => setDetailView("outstanding")} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Disclosure and collection trend" title="Cycle-by-cycle results">
        <Stack spacing={3}>
          {disclosureCollectionTrend.length ? disclosureCollectionTrend.map((item) => (
            <Box as="button" width="100%" textAlign="left" cursor="pointer" key={item.cycleId} borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${item.cycleId}`)}>
              <HStack justify="space-between" align="start" flexWrap="wrap">
                <Text fontWeight="800">{item.label}</Text>
                <Text color="canvas.700">Disclosure {formatPercent(item.disclosureRate)} · Collection {item.collectionRate == null ? "Payment not required" : formatPercent(item.collectionRate)}</Text>
              </HStack>
              <Text color="canvas.700" mt={2}>{item.selfReportedBottles} of {item.knownAttributedBottles} attributed bottles self-reported · {item.knownUnpaidBottles} known unpaid · {formatCurrency(item.outstandingRequiredAmount)} required payment gap</Text>
            </Box>
          )) : <Text color="canvas.700">No completed cycles in this range yet.</Text>}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Expected vs immediate money" title="Cycle trend">
        <Stack spacing={4}>
          {expectedVsCollected.length ? (
            expectedVsCollected.map((item, index) => (
            <Box key={item.label} as="button" width="100%" textAlign="left" cursor="pointer" onClick={() => setDetailView(reportCyclesAscending[index] ? `cycle:${reportCyclesAscending[index].cycleId}` : "expectedRevenue")}>
              <HStack justify="space-between" mb={1}>
                <Text fontWeight="800">{item.label}</Text>
                <Text color="canvas.700">
                  {formatCurrency(item.totalCollected)} / {formatCurrency(item.expectedRevenue)}
                </Text>
              </HStack>
              <Progress
                value={(item.expectedRevenue / maxRevenue) * 100}
                colorScheme="yellow"
                borderRadius="full"
              />
              <Progress
                mt={2}
                value={(item.totalCollected / maxRevenue) * 100}
                colorScheme="green"
                borderRadius="full"
              />
            </Box>
            ))
          ) : (
            <Text color="canvas.700">No completed cycles in this range yet.</Text>
          )}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Settlement trend" title="How much of each cycle is accounted for?">
        <Stack spacing={4}>
          {accountedTrend.length ? (
            accountedTrend.map((item, index) => (
              <Box key={item.label} as="button" width="100%" textAlign="left" borderRadius="24px" bg="canvas.50" p={4} cursor="pointer" onClick={() => setDetailView(reportCyclesAscending[index] ? `cycle:${reportCyclesAscending[index].cycleId}` : "collection")}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="800">{item.label}</Text>
                  <Text color="canvas.700">
                    Accounted {formatPercent(item.accountedRate)} • Settled {formatPercent(item.settledRate)}
                  </Text>
                </HStack>
                <Text color="canvas.700">
                  Pay-later outstanding {formatCurrency(item.outstandingAmount)} • Unaccounted {formatCurrency(item.unaccountedAmount)}
                </Text>
              </Box>
            ))
          ) : (
            <Text color="canvas.700">No completed cycle settlements in this range yet.</Text>
          )}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Products" title="Product performance">
        <Stack spacing={3}>
          {productPerformance.length ? (
            productPerformance.map((item) => (
              <Box key={item.productId} as="button" width="100%" textAlign="left" borderRadius="24px" bg="canvas.50" p={4} cursor="pointer" onClick={() => setDetailView(`product:${item.productId}`)}>
                <Text fontWeight="800">{item.productName}</Text>
                <Text color="canvas.700" mt={1}>
                  {item.unitsTaken} taken • {formatCurrency(item.expectedRevenue)} earned • {formatCurrency(item.grossProfit)} gross profit
                </Text>
                <Text mt={2}>
                  Est. remaining {item.estimatedRemaining ?? "?"} • Avg/day {item.averageUnitsPerDay?.toFixed(1) ?? "?"}
                </Text>
              </Box>
            ))
          ) : (
            <Text color="canvas.700">No product history in this range yet.</Text>
          )}
        </Stack>
      </SectionCard>

      <Modal isOpen={Boolean(detailView)} onClose={() => setDetailView(null)} isCentered size="xl">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{getDetailTitle(detailView)}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {detailView ? <ReportDetailContent detailView={detailView} snapshot={snapshot} setAside={setAside} /> : null}
          </ModalBody>
          <ModalFooter><Button onClick={() => setDetailView(null)}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <DateRangeModal
        isOpen={isDateRangeOpen}
        onClose={() => setIsDateRangeOpen(false)}
        startDate={customStartDate}
        endDate={customEndDate}
        title="Filter reports by date"
        onApply={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setRangeKey("custom");
        }}
      />
    </Stack>
  );
}

const detailTitles: Record<string, string> = {
  immediateCollected: "Immediate collection details",
  totalPayments: "Total payment details",
  cashPayments: "Cash payment details",
  onlinePayments: "Online payment details",
  knownPayLater: "Known pay-later details",
  bottlesTaken: "Bottle details",
  expectedRevenue: "Expected revenue by cycle",
  disclosure: "Disclosure honesty details",
  owner_recorded: "Observed or recorded bottles",
  inventory_discrepancy: "Inventory discrepancy records",
  unattributed: "Unattributed missing bottles",
  complimentary: "Complimentary bottle details",
  unclassified: "Unclassified historical records",
  knownUnpaid: "Known unpaid records",
  collection: "Collection details",
  paymentRequired: "Payment-required details",
  payLater: "Pay-later details",
  outstanding: "Required payment gap",
  salesRevenue: "Gross sales details",
  capitalUsed: "Capital used details",
  grossProfit: "Gross profit details",
  grossMargin: "Gross margin details",
  puresafeCapital: "Puresafe capital by cycle",
  electricityShare: "Electricity share by cycle",
  miscCapital: "Other-products capital by cycle",
  totalCapital: "Total capital by cycle",
  totalSetAside: "Total set aside by cycle",
  remainingEarnings: "To Stash by cycle",
  cashAvailableAfterChangeFloat: "Cash available for reserves",
  availableOnlinePayments: "Untouched online payments",
  totalAvailable: "Cash + online total by cycle",
  shortfall: "Cash shortfall by cycle",
  cashCounted: "Cash counted by cycle",
  cashGenerated: "Customer cash generated by cycle",
  cashWithdrawn: "Cash withdrawn by cycle",
  unknownOpeningFloats: "Cycles with unknown opening float",
};

function getDetailTitle(detailView: string | null) {
  if (!detailView) return "Report details";
  if (detailView.startsWith("cycle:")) return "Cycle details";
  if (detailView.startsWith("product:")) return "Product details";
  return detailTitles[detailView] ?? "Report details";
}

function ReportDetailContent({ detailView, snapshot, setAside }: { detailView: string; snapshot: ReportsSnapshot; setAside: ReportSetAside }) {
  const cycleId = detailView.startsWith("cycle:") ? detailView.slice(6) : null;
  const productId = detailView.startsWith("product:") ? detailView.slice(8) : null;

  if (cycleId) {
    const cycle = snapshot.reportCycles.find((item) => item.cycleId === cycleId);
    if (!cycle) return <Text color="canvas.700">Cycle details are unavailable for this reporting range.</Text>;
    return (
      <Stack spacing={4}>
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
          <DetailValue label="Bottles taken" value={String(cycle.bottlesTaken)} />
          <DetailValue label="Expected" value={formatCurrency(cycle.expectedRevenue)} />
          <DetailValue label="Collected" value={formatCurrency(cycle.immediateCollected)} />
          <DetailValue label="Cash payments" value={formatCurrency(cycle.physicalCashCollected)} />
          <DetailValue label="Online payments" value={formatCurrency(cycle.onlinePayments)} />
          <DetailValue label="Total payments" value={formatCurrency(cycle.totalPayments)} />
          <DetailValue label="Disclosure" value={formatPercent(cycle.disclosureRate)} />
          <DetailValue label="Collection" value={cycle.collectionRate == null ? "Payment not required" : formatPercent(cycle.collectionRate)} />
          <DetailValue label="Required payment gap" value={formatCurrency(cycle.outstandingRequiredAmount)} />
        </SimpleGrid>
        <PaymentRecordList records={snapshot.reportPaymentRecords.filter((record) => record.cycleId === cycle.cycleId)} />
        <Text color="canvas.700">{formatManilaDateTime(cycle.startedAt)} to {formatManilaDateTime(cycle.completedAt)}</Text>
        <Button as={Link} to={`/history/${cycle.cycleId}`}>View full cycle</Button>
      </Stack>
    );
  }

  if (productId) {
    const product = snapshot.productPerformance.find((item) => item.productId === productId);
    const records = snapshot.reportBottleRecords.filter((entry) => entry.productId === productId);
    if (!product) return <Text color="canvas.700">Product details are unavailable.</Text>;
    return (
      <Stack spacing={4}>
        <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
          <DetailValue label="Units taken" value={String(product.unitsTaken)} />
          <DetailValue label="Expected revenue" value={formatCurrency(product.expectedRevenue)} />
          <DetailValue label="Gross profit" value={formatCurrency(product.grossProfit)} />
          <DetailValue label="Gross margin" value={formatPercent(product.grossMargin)} />
          <DetailValue label="Average per day" value={product.averageUnitsPerDay?.toFixed(1) ?? "Not enough data"} />
          <DetailValue label="Estimated remaining" value={String(product.estimatedRemaining ?? "Unknown")} />
        </SimpleGrid>
        <RecordList records={records} empty="No individually classified bottle records for this product in the selected range." />
      </Stack>
    );
  }

  const bottleFilters: Partial<Record<string, (entry: ReportsSnapshot["reportBottleRecords"][number]) => boolean>> = {
    bottlesTaken: () => true,
    disclosure: (entry) => entry.disclosureSource === "self_reported",
    owner_recorded: (entry) => entry.disclosureSource === "owner_recorded",
    inventory_discrepancy: (entry) => entry.disclosureSource === "inventory_discrepancy",
    complimentary: (entry) => entry.paymentExpectation === "complimentary",
    unclassified: (entry) => Boolean(entry.isUnclassifiedHistorical),
    knownUnpaid: (entry) => entry.paymentStatus === "unpaid" || entry.paymentStatus === "partially_paid",
    payLater: (entry) => entry.paymentExpectation === "pay_later",
  };
  const filter = bottleFilters[detailView];
  const records = filter ? snapshot.reportBottleRecords.filter(filter) : [];
  const cycleKeys = new Set(["immediateCollected", "totalPayments", "cashPayments", "onlinePayments", "bottlesTaken", "expectedRevenue", "disclosure", "unattributed", "collection", "paymentRequired", "payLater", "outstanding"]);
  const financialKeys = new Set(["salesRevenue", "capitalUsed", "grossProfit", "grossMargin"]);
  const setAsideKeys = new Set(["puresafeCapital", "electricityShare", "miscCapital", "totalCapital", "totalSetAside", "remainingEarnings", "cashAvailableAfterChangeFloat", "availableOnlinePayments", "totalAvailable", "shortfall"]);
  const cashFloatKeys = new Set(["cashCounted", "cashGenerated", "cashWithdrawn", "unknownOpeningFloats"]);

  return (
    <Stack spacing={4}>
      {cycleKeys.has(detailView) ? <CycleBreakdown cycles={snapshot.reportCycles} detailView={detailView} /> : null}
      {filter ? <RecordList records={records} empty="No matching individual bottle records in the selected range." /> : null}
      {detailView === "salesRevenue" ? <PaymentRecordList records={snapshot.reportPaymentRecords} /> : null}
      {detailView === "capitalUsed" ? <CapitalBreakdown products={snapshot.productPerformance} /> : null}
      {detailView === "grossProfit" || detailView === "grossMargin" ? <FinancialCalculation snapshot={snapshot} setAside={setAside} /> : null}
      {setAsideKeys.has(detailView) ? <SetAsideBreakdown cycles={setAside.cycles} detailView={detailView} /> : null}
      {cashFloatKeys.has(detailView) ? <CashFloatBreakdown cycles={snapshot.reportCashFloats} detailView={detailView} /> : null}
      {detailView === "totalPayments" || detailView === "cashPayments" || detailView === "onlinePayments" ? (
        <PaymentRecordList
          records={snapshot.reportPaymentRecords.filter((record) => detailView === "totalPayments" || record.channel === (detailView === "cashPayments" ? "cash" : "online"))}
        />
      ) : null}
      {detailView === "knownPayLater" || detailView === "payLater" ? (
        <Stack spacing={3}>
          {snapshot.reportPayLaterBalances.length ? snapshot.reportPayLaterBalances.map((balance) => (
            <Box key={balance.id} bg="canvas.50" borderRadius="20px" p={4}>
              <Text fontWeight="900">{balance.customerLabel ?? balance.cycleLabel}</Text>
              <Text color="canvas.700" mt={1}>{formatCurrency(balance.remainingAmount)} remaining of {formatCurrency(balance.originalAmount)} · {balance.status}</Text>
              {balance.itemsSummary ? <Text mt={2}>{balance.itemsSummary}</Text> : null}
            </Box>
          )) : <Text color="canvas.700">No pay-later balances in this reporting range.</Text>}
        </Stack>
      ) : null}
      {detailView === "immediateCollected" || detailView === "collection" ? (
        <Stack spacing={3}>
          {snapshot.reportPaymentReceipts.map((payment) => <Box key={payment.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{formatCurrency(payment.amount)} · {payment.method}</Text><Text color="canvas.700" mt={1}>{formatManilaDateTime(payment.receivedAt)} · {payment.paymentTiming}</Text></Box>)}
          {snapshot.reportOnlinePayments.map((payment) => <Box key={payment.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{formatCurrency(payment.amount)} · {payment.method}</Text><Text color="canvas.700" mt={1}>{payment.personLabel ?? payment.customerLabel ?? "Unknown payer"} · {formatManilaDateTime(payment.paidAt)}</Text></Box>)}
        </Stack>
      ) : null}
      {!cycleKeys.has(detailView) && !financialKeys.has(detailView) && !setAsideKeys.has(detailView) && !cashFloatKeys.has(detailView) && !filter && detailView !== "knownPayLater" ? <Text color="canvas.700">No additional details are available for this item.</Text> : null}
    </Stack>
  );
}

function CapitalBreakdown({ products }: { products: ReportsSnapshot["productPerformance"] }) {
  return products.length ? (
    <Stack spacing={3}>
      {products.map((product) => (
        <Box key={product.productId} bg="canvas.50" borderRadius="20px" p={4}>
          <Text fontWeight="900">{product.productName}</Text>
          <Text color="canvas.700" mt={1}>{product.unitsTaken} taken · {formatCurrency(product.cogs)} capital used</Text>
        </Box>
      ))}
    </Stack>
  ) : <Text color="canvas.700">No product cost recorded in this reporting range.</Text>;
}

function FinancialCalculation({ snapshot, setAside }: { snapshot: ReportsSnapshot; setAside: ReportSetAside }) {
  const grossSales = snapshot.summary.totalPayments;
  const capital = setAside.summary.puresafeCapital == null || setAside.summary.miscCapital == null
    ? null
    : setAside.summary.puresafeCapital + setAside.summary.miscCapital;
  const grossProfit = capital == null ? null : grossSales - capital;
  const grossMargin = grossSales > 0 && grossProfit != null ? (grossProfit / grossSales) * 100 : null;
  return (
    <Stack spacing={4}>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        <DetailValue label="Recorded gross sales" value={formatCurrency(grossSales)} />
        <DetailValue label="Less: total capital" value={capital == null ? "Unable to calculate" : formatCurrency(capital)} />
        <DetailValue label="Cash-basis gross profit" value={grossProfit == null ? "Unable to calculate" : formatCurrency(grossProfit)} />
        <DetailValue label="Cash-basis gross margin" value={grossMargin == null ? "Unable to calculate" : formatPercent(grossMargin)} />
      </SimpleGrid>
      <Text color="canvas.700">Payments cannot always be assigned to individual products, so actual profit is calculated for the selected period rather than estimated per product.</Text>
    </Stack>
  );
}

function SetAsideBreakdown({ cycles, detailView }: { cycles: ReportSetAside["cycles"]; detailView: string }) {
  return cycles.length ? (
    <Stack spacing={3}>
      {cycles.map((cycle) => {
        const totalCapital = cycle.puresafeCapital == null || cycle.miscCapital == null ? null : cycle.puresafeCapital + cycle.miscCapital;
        const cashOnlySetAside = calculateCashOnlySetAside(cycle);
        const values: Record<string, string> = {
          puresafeCapital: cycle.puresafeCapital == null ? "Unable to calculate" : `${cycle.puresafeBottlesToReplace} bottle(s) × ${formatCurrency(cycle.puresafeCostPerUnit)} = ${formatCurrency(cycle.puresafeCapital)}`,
          electricityShare: `${cycle.cycleHours.toFixed(2)} hours × ${formatCurrency(cycle.electricityCostPerHour)} = ${formatCurrency(cycle.electricityShare)}`,
          miscCapital: cycle.miscCapital == null ? "Unable to calculate" : formatCurrency(cycle.miscCapital),
          totalCapital: totalCapital == null ? "Unable to calculate" : formatCurrency(totalCapital),
          totalSetAside: cycle.totalSetAside == null ? "Unable to calculate" : formatCurrency(cycle.totalSetAside),
          remainingEarnings: cycle.remainingEarnings == null
            ? "Unable to calculate"
            : `${formatCurrency(cycle.availableOnlinePayments)} online untouched + ${formatCurrency(cashOnlySetAside.cashAfterSetAside)} cash after reserves = ${formatCurrency(cycle.remainingEarnings)}`,
          cashAvailableAfterChangeFloat: formatCurrency(cycle.cashAvailableAfterChangeFloat),
          availableOnlinePayments: formatCurrency(cycle.availableOnlinePayments),
          totalAvailable: formatCurrency(cycle.totalAvailable),
          shortfall: cycle.shortfall == null
            ? "Unable to calculate"
            : `${formatCurrency(cycle.totalSetAside)} reserves − ${formatCurrency(cycle.cashAvailableAfterChangeFloat)} available cash = ${formatCurrency(cycle.shortfall)}`,
        };
        return (
          <Box key={cycle.cycleId} bg="canvas.50" borderRadius="20px" p={4}>
            <HStack justify="space-between" align="start">
              <Box><Text fontWeight="900">Cycle #{cycle.cycleNumber}</Text><Text color="canvas.700" mt={1}>{values[detailView]}</Text></Box>
              <Button as={Link} to={`/history/${cycle.cycleId}`} size="sm" variant="outline">View cycle</Button>
            </HStack>
          </Box>
        );
      })}
    </Stack>
  ) : <Text color="canvas.700">No completed cycles in this reporting range.</Text>;
}

function CashFloatBreakdown({ cycles, detailView }: { cycles: ReportsSnapshot["reportCashFloats"]; detailView: string }) {
  const visible = detailView === "unknownOpeningFloats" ? cycles.filter((cycle) => cycle.openingChangeFloat == null) : cycles;
  return visible.length ? (
    <Stack spacing={3}>
      {visible.map((cycle) => {
        const values: Record<string, string> = {
          cashCounted: formatCurrency(cycle.cashCountedBeforeWithdrawal),
          cashGenerated: cycle.cashGenerated == null ? "Cannot be determined" : formatCurrency(cycle.cashGenerated),
          cashWithdrawn: formatCurrency(cycle.cashWithdrawn),
          unknownOpeningFloats: "Opening change float is unknown; generated cash is excluded from the total.",
        };
        return <Box key={cycle.cycleId} bg="canvas.50" borderRadius="20px" p={4}><HStack justify="space-between" align="start"><Box><Text fontWeight="900">{cycle.cycleLabel}</Text><Text color="canvas.700" mt={1}>{values[detailView]}</Text></Box><Button as={Link} to={`/history/${cycle.cycleId}`} size="sm" variant="outline">View cycle</Button></HStack></Box>;
      })}
    </Stack>
  ) : <Text color="canvas.700">No matching cycles in this reporting range.</Text>;
}

function PaymentRecordList({ records }: { records: ReportsSnapshot["reportPaymentRecords"] }) {
  return records.length ? (
    <Stack spacing={3}>
      {records.map((record) => (
        <Box key={record.id} bg="canvas.50" borderRadius="20px" p={4}>
          <Text fontWeight="900">{record.method} · {formatCurrency(record.amount)}</Text>
          <Text color="canvas.700" mt={1}>{record.cycleLabel} · {formatManilaDateTime(record.occurredAt)}</Text>
          {record.personLabel ? <Text mt={1}>Person: {record.personLabel}</Text> : null}
          {record.note ? <Text color="canvas.700" mt={2}>{record.note}</Text> : null}
        </Box>
      ))}
    </Stack>
  ) : <Text color="canvas.700">No matching payment records in this reporting range.</Text>;
}

function CycleBreakdown({ cycles, detailView }: { cycles: ReportsSnapshot["reportCycles"]; detailView: string }) {
  return (
    <Stack spacing={3}>
      {cycles.length ? cycles.map((cycle) => (
        <Box key={cycle.cycleId} bg="canvas.50" borderRadius="20px" p={4}>
          <HStack justify="space-between" align="start">
            <Box><Text fontWeight="900">{cycle.label}</Text><Text color="canvas.700" mt={1}>{cycleDetailValue(cycle, detailView)}</Text></Box>
            <Button as={Link} to={`/history/${cycle.cycleId}`} size="sm" variant="outline">View cycle</Button>
          </HStack>
        </Box>
      )) : <Text color="canvas.700">No completed cycles in this reporting range.</Text>}
    </Stack>
  );
}

function cycleDetailValue(cycle: ReportsSnapshot["reportCycles"][number], detailView: string) {
  if (detailView === "immediateCollected") return `${formatCurrency(cycle.immediateCollected)} collected`;
  if (detailView === "totalPayments") return `${formatCurrency(cycle.totalPayments)} total collected`;
  if (detailView === "cashPayments") return `${formatCurrency(cycle.physicalCashCollected)} cash`;
  if (detailView === "onlinePayments") return `${formatCurrency(cycle.onlinePayments)} online`;
  if (detailView === "bottlesTaken") return `${cycle.bottlesTaken} bottles taken`;
  if (detailView === "expectedRevenue") return `${formatCurrency(cycle.expectedRevenue)} expected`;
  if (detailView === "disclosure") return `${formatPercent(cycle.disclosureRate)} disclosed · ${cycle.selfReportedBottles} self-reported`;
  if (detailView === "unattributed") return `${cycle.unattributedMissingBottles} unattributed missing bottles`;
  if (detailView === "collection") return `${cycle.collectionRate == null ? "Payment not required" : `${formatPercent(cycle.collectionRate)} collected`} · ${formatCurrency(cycle.totalPayments)}`;
  if (detailView === "paymentRequired") return `${formatCurrency(cycle.paymentRequiredAmount)} required`;
  if (detailView === "payLater") return `${formatCurrency(cycle.payLaterAmount)} pay later`;
  if (detailView === "outstanding") return `${formatCurrency(cycle.outstandingRequiredAmount)} required payment gap`;
  return formatManilaDateTime(cycle.completedAt);
}

function RecordList({ records, empty }: { records: ReportsSnapshot["reportBottleRecords"]; empty: string }) {
  return records.length ? (
    <Stack spacing={3}>
      {records.map((entry) => (
        <Box key={entry.id} bg="canvas.50" borderRadius="20px" p={4}>
          <Text fontWeight="900">{entry.quantity} × {entry.productName}</Text>
          <Text color="canvas.700" mt={1}>{entry.personLabel ?? entry.customerLabel ?? "Unknown person"} · {formatCurrency(entry.confirmedAmount)}</Text>
          <Text color="canvas.700" mt={1}>{entry.cycleLabel} · {formatManilaDateTime(entry.takenAt)}</Text>
          {entry.note ? <Text mt={2}>{entry.note}</Text> : null}
        </Box>
      ))}
    </Stack>
  ) : <Text color="canvas.700">{empty}</Text>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <Box bg="canvas.50" borderRadius="18px" p={3}><Text color="canvas.700" fontSize="sm">{label}</Text><Text fontWeight="900" mt={1}>{value}</Text></Box>;
}
