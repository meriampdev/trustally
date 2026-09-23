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
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { SetAsideShareCard, StashBreakdown } from "../components/SetAsideSummary";
import { fetchReportsSnapshot, fetchReportSetAside } from "../lib/api";
import { formatCurrency, formatManilaDateTime, formatPercent } from "../lib/format";
import { exportCsv, printReport } from "../lib/exportData";
import { formatReportDateRange, ReportRangeKey, reportRangeOptions } from "../lib/reportRange";
import { calculateReportSetAsideShareComparison, calculateSetAsideShareComparison, summarizeOnlinePayments } from "../lib/setAside";
import { ReportsSnapshot, ReportSetAside } from "../lib/types";

type ReportViewMode = "tiles" | "table";

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<ReportViewMode>("tiles");
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [setAside, setSetAside] = useState<ReportSetAside | null>(null);
  const [detailView, setDetailView] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const productPerformance = Array.isArray(snapshot?.productPerformance)
    ? snapshot.productPerformance
    : [];

    
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
  const setAsideShares = calculateReportSetAsideShareComparison(setAside);
  const actualSetAsideComplete = (setAside.summary.actualRecordedCycles ?? 0) > 0 && (setAside.summary.actualUnrecordedCycles ?? 0) === 0;
  const actualToStashTotal = setAside.summary.actualToStashCash == null ? null : setAside.summary.actualToStashCash + (setAside.summary.onlineToStash ?? 0);
  const onlineBreakdown = summarizeOnlinePayments(snapshot.reportPaymentRecords);
  const summaryExportRows = [
    { Metric: "Total payments", Value: formatCurrency(snapshot.summary.totalPayments) },
    { Metric: "Cash payments", Value: formatCurrency(snapshot.summary.cashPayments) },
    { Metric: "Online payments", Value: formatCurrency(snapshot.summary.onlinePayments) },
    { Metric: "Bottles taken", Value: snapshot.summary.bottlesTaken },
    { Metric: "Expected revenue", Value: formatCurrency(snapshot.summary.expectedRevenue) },
    { Metric: "Known pay-later", Value: formatCurrency(snapshot.summary.knownPayLater) },
    { Metric: "Unaccounted", Value: formatCurrency(snapshot.summary.unaccountedAmount) },
    { Metric: "Actual physical set aside", Value: setAside.summary.actualPhysicalTotal == null ? "Not recorded" : formatCurrency(setAside.summary.actualPhysicalTotal) },
    { Metric: "Other Products used for restocks", Value: setAside.summary.usedForOtherProductRestocks == null ? "Not tracked" : formatCurrency(setAside.summary.usedForOtherProductRestocks) },
    { Metric: "Other Products net set aside", Value: setAside.summary.netOtherProductsSetAside == null ? "Not tracked" : formatCurrency(setAside.summary.netOtherProductsSetAside) },
    { Metric: "Opening Other Products reserve", Value: setAside.summary.openingOtherProductsReserve == null ? "Not tracked" : formatCurrency(setAside.summary.openingOtherProductsReserve) },
    { Metric: "Closing Other Products reserve", Value: setAside.summary.closingOtherProductsReserve == null ? "Not tracked" : formatCurrency(setAside.summary.closingOtherProductsReserve) },
  ];
  const summaryExportColumns = [{ label: "Metric", value: (row: typeof summaryExportRows[number]) => row.Metric }, { label: "Value", value: (row: typeof summaryExportRows[number]) => row.Value }];
  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Business accounting" title="Capital recovery, profitability, restocks, expenses, and stock movements">
        <Text color="canvas.700">Open the detailed report workspace for itemized data, filters, CSV, printable reports, and a complete ZIP export.</Text>
        <Button as={Link} to="/reports/business" mt={4}>Open business reports</Button>
      </SectionCard>
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
        <HStack mt={4} spacing={2}>
          <Text color="canvas.700" fontSize="sm" mr={1}>View</Text>
          <Button size="sm" variant={viewMode === "tiles" ? "solid" : "outline"} onClick={() => setViewMode("tiles")}>Tiles</Button>
          <Button size="sm" variant={viewMode === "table" ? "solid" : "outline"} onClick={() => setViewMode("table")}>Table</Button>
        </HStack>
        <Text color="canvas.700" fontSize="sm" mt={3}>
          Showing completed cycles from {rangeKey === "custom"
            ? formatReportDateRange(customStartDate, customEndDate)
            : reportRangeOptions.find((option) => option.value === rangeKey)?.label.toLowerCase()}.
        </Text>
        <HStack mt={4} spacing={2}><Button size="sm" variant="outline" onClick={() => exportCsv("Trustally operational report", "trustally-operational-report.csv", summaryExportRows, summaryExportColumns)}>Export CSV</Button><Button size="sm" variant="outline" onClick={() => printReport("Trustally operational report", summaryExportRows, summaryExportColumns)}>Print / PDF</Button></HStack>
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
          <MetricCard label="Gross Profit" value={grossProfit == null ? "Unable to calculate" : formatCurrency(grossProfit)} hint="View the full calculation" onClick={() => setDetailView("grossProfit")} />
          <MetricCard label="Total Capital" value={totalCapital == null ? "Unable to calculate" : formatCurrency(totalCapital)} hint="View capital components by cycle" onClick={() => setDetailView("totalCapital")} />
        </SimpleGrid>
        <Text color="canvas.700" fontSize="sm" mt={3}>Gross sales use actual recorded payments. Change float stays in the box and is excluded from Set Aside and earnings.</Text>
      </SectionCard>

      <SectionCard eyebrow="Set Aside" title="Targets, actual cash, and reserve by cycle">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Cash available for reserves" value={formatCurrency(setAside.summary.cashAvailableAfterChangeFloat)} hint="After preserving change float" onClick={() => setDetailView("cashAvailableAfterChangeFloat")} />
          <SetAsideShareCard label="Puresafe Capital" target={setAsideShares.puresafe.target} canSetAside={setAsideShares.puresafe.canSetAside} showActual actual={setAside.summary.actualPuresafeCapital ?? null} actualComparisonAvailable={actualSetAsideComplete} hint="View target and actual by cycle" onClick={() => setDetailView("puresafeCapital")} />
          <SetAsideShareCard label="Other Products Capital" target={setAsideShares.otherProducts.target} canSetAside={setAsideShares.otherProducts.canSetAside} showActual actual={setAside.summary.actualOtherProductsCapital ?? null} actualComparisonAvailable={actualSetAsideComplete} hint="View target, actual, and reserve by cycle" onClick={() => setDetailView("miscCapital")}><Text>Used for restocks: {setAside.summary.usedForOtherProductRestocks == null ? "Not tracked" : formatCurrency(setAside.summary.usedForOtherProductRestocks)}</Text><Text>Net set aside: {setAside.summary.netOtherProductsSetAside == null ? "Not tracked" : formatCurrency(setAside.summary.netOtherProductsSetAside)}</Text><Text>Reserve: {setAside.summary.openingOtherProductsReserve == null ? "Not tracked" : formatCurrency(setAside.summary.openingOtherProductsReserve)} opening · {setAside.summary.closingOtherProductsReserve == null ? "Not tracked" : formatCurrency(setAside.summary.closingOtherProductsReserve)} closing</Text></SetAsideShareCard>
          <SetAsideShareCard label="Electricity Share" target={setAsideShares.electricity.target} canSetAside={setAsideShares.electricity.canSetAside} showActual actual={setAside.summary.actualElectricityShare ?? null} actualComparisonAvailable={actualSetAsideComplete} hint="View target and actual by cycle" onClick={() => setDetailView("electricityShare")} />
          <MetricCard label="Cash shortfall" value={setAside.summary.shortfall == null ? "Unable to calculate" : formatCurrency(setAside.summary.shortfall)} hint="Reserves not covered by cash" onClick={() => setDetailView("shortfall")} />
          <SetAsideShareCard label="To Stash" target={setAsideShares.toStash.target} canSetAside={setAsideShares.toStash.canSetAside} showActual actual={actualToStashTotal} actualLabel="Actual total to Stash" actualComparisonAvailable={actualSetAsideComplete} hint="Online payments plus recorded physical cash" onClick={() => setDetailView("remainingEarnings")}>
            <StashBreakdown availableOnlinePayments={setAside.summary.onlineToStash ?? setAsideShares.toStash.onlinePayments} gcashPayments={onlineBreakdown.gcashPayments} mayaPayments={onlineBreakdown.mayaPayments} otherOnlinePayments={onlineBreakdown.otherOnlinePayments} cashAfterSetAside={setAsideShares.toStash.cashAfterReserves} />
          </SetAsideShareCard>
        </SimpleGrid>
        {(setAside.summary.actualUnrecordedCycles ?? 0) > 0 ? <Text color="canvas.700" mt={3}>{setAside.summary.actualUnrecordedCycles} completed cycle{setAside.summary.actualUnrecordedCycles === 1 ? " is" : "s are"} Not recorded.</Text> : null}
        {viewMode === "table" ? <Box overflowX="auto" mt={4} borderRadius="20px" border="1px solid" borderColor="whiteAlpha.200">
          <Table size="sm" minW="980px">
            <Thead bg="canvas.50"><Tr><Th>Cycle</Th><Th isNumeric>Cash available</Th><Th isNumeric>Target</Th><Th isNumeric>Actual</Th><Th isNumeric>Restocks used</Th><Th isNumeric>Closing reserve</Th><Th isNumeric>Shortfall</Th><Th isNumeric>To Stash</Th><Th>Details</Th></Tr></Thead>
            <Tbody>
              {setAside.cycles.map((cycle) => (
                <Tr key={cycle.cycleId}>
                  <Td fontWeight="800">#{cycle.cycleNumber}</Td>
                  <Td isNumeric>{formatCurrency(cycle.cashAvailableAfterChangeFloat)}</Td>
                  <Td isNumeric>{cycle.totalSetAside == null ? "Unavailable" : formatCurrency(cycle.totalSetAside)}</Td>
                  <Td isNumeric>{cycle.actualSetAside ? formatCurrency(cycle.actualSetAside.physicalCashTotal) : "Not recorded"}</Td>
                  <Td isNumeric>{cycle.otherProductsReserve?.usedForRestocks == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.usedForRestocks)}</Td>
                  <Td isNumeric>{cycle.otherProductsReserve?.closingBalance == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.closingBalance)}</Td>
                  <Td isNumeric>{cycle.shortfall == null ? "Unavailable" : formatCurrency(cycle.shortfall)}</Td>
                  <Td isNumeric>{cycle.remainingEarnings == null ? "Unavailable" : formatCurrency(cycle.remainingEarnings)}</Td>
                  <Td><Button size="xs" variant="outline" onClick={() => setDetailView(`cycle:${cycle.cycleId}`)}>View</Button></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {!setAside.cycles.length ? <Text p={4} color="canvas.700">No completed cycles in this reporting range.</Text> : null}
        </Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
          {setAside.cycles.map((cycle) => (
            <Box key={cycle.cycleId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${cycle.cycleId}`)}>
              <Text fontWeight="900">Cycle #{cycle.cycleNumber}</Text>
              <Text color="canvas.700" mt={1}>Cash for reserves {formatCurrency(cycle.cashAvailableAfterChangeFloat)}</Text>
              <Text color="canvas.700" mt={1}>Actual Set Aside: {cycle.actualSetAside ? formatCurrency(cycle.actualSetAside.physicalCashTotal) : "Not recorded"}</Text>
              <Text color="canvas.700" mt={1}>Restocks used {cycle.otherProductsReserve?.usedForRestocks == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.usedForRestocks)} · Closing reserve {cycle.otherProductsReserve?.closingBalance == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.closingBalance)}</Text>
              <Text color="canvas.700" mt={1}>Shortfall {cycle.shortfall == null ? "Unavailable" : formatCurrency(cycle.shortfall)} · To Stash {cycle.remainingEarnings == null ? "Unavailable" : formatCurrency(cycle.remainingEarnings)}</Text>
            </Box>
          ))}
        </SimpleGrid>}
      </SectionCard>

      <SectionCard eyebrow="Cash box flow" title="Change float by cycle">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Cash counted" value={formatCurrency(snapshot.cashFloatSummary.cashCounted)} hint="View cash checks by cycle" onClick={() => setDetailView("cashCounted")} />
          <MetricCard label="Customer cash generated" value={formatCurrency(snapshot.cashFloatSummary.cashGenerated)} hint="View generated cash by cycle" onClick={() => setDetailView("cashGenerated")} />
          <MetricCard label="Cash withdrawn" value={formatCurrency(snapshot.cashFloatSummary.cashWithdrawn)} hint="View withdrawals by cycle" onClick={() => setDetailView("cashWithdrawn")} />
          <MetricCard label="Unknown opening floats" value={String(snapshot.cashFloatSummary.unknownOpeningFloatCycles)} hint="View excluded cycles" onClick={() => setDetailView("unknownOpeningFloats")} />
        </SimpleGrid>
        {viewMode === "table" ? <Box overflowX="auto" mt={4} borderRadius="20px" border="1px solid" borderColor="whiteAlpha.200">
          <Table size="sm" minW="760px">
            <Thead bg="canvas.50"><Tr><Th>Cycle</Th><Th isNumeric>Opening float</Th><Th isNumeric>Cash counted</Th><Th isNumeric>Cash generated</Th><Th isNumeric>Left for Change</Th><Th isNumeric>Withdrawn</Th><Th>Details</Th></Tr></Thead>
            <Tbody>{snapshot.reportCashFloats.map((cashFloat) => (
              <Tr key={cashFloat.cycleId}>
                <Td fontWeight="800">{cashFloat.cycleLabel}</Td>
                <Td isNumeric>{cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(cashFloat.openingChangeFloat)}</Td>
                <Td isNumeric>{formatCurrency(cashFloat.cashCountedBeforeWithdrawal)}</Td>
                <Td isNumeric>{cashFloat.cashGenerated == null ? "Unknown" : formatCurrency(cashFloat.cashGenerated)}</Td>
                <Td isNumeric>{formatCurrency(cashFloat.closingChangeFloat)}</Td>
                <Td isNumeric>{formatCurrency(cashFloat.cashWithdrawn)}</Td>
                <Td><Button size="xs" variant="outline" onClick={() => setDetailView(`cycle:${cashFloat.cycleId}`)}>View</Button></Td>
              </Tr>
            ))}</Tbody>
          </Table>
          {!snapshot.reportCashFloats.length ? <Text p={4} color="canvas.700">No completed cash checks in this range.</Text> : null}
        </Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
          {snapshot.reportCashFloats.map((cashFloat) => (
            <Box key={cashFloat.cycleId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${cashFloat.cycleId}`)}>
              <Text fontWeight="900">{cashFloat.cycleLabel}</Text>
              <Text color="canvas.700" mt={1}>Opening {cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(cashFloat.openingChangeFloat)} · Counted {formatCurrency(cashFloat.cashCountedBeforeWithdrawal)} · Left for Change {formatCurrency(cashFloat.closingChangeFloat)}</Text>
              <Text color="canvas.700" mt={1}>Cash generated {cashFloat.cashGenerated == null ? "Unknown" : formatCurrency(cashFloat.cashGenerated)} · Withdrawn {formatCurrency(cashFloat.cashWithdrawn)}</Text>
            </Box>
          ))}
        </SimpleGrid>}
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

      <SectionCard eyebrow="Cycles" title="Cycle-by-cycle report">
        {viewMode === "table" ? <Box overflowX="auto" borderRadius="20px" border="1px solid" borderColor="whiteAlpha.200">
          <Table size="sm" minW="1180px">
            <Thead bg="canvas.50"><Tr><Th>Cycle</Th><Th>Completed</Th><Th isNumeric>Bottles</Th><Th isNumeric>Expected</Th><Th isNumeric>Collected</Th><Th isNumeric>Cash</Th><Th isNumeric>Online</Th><Th isNumeric>Disclosure</Th><Th isNumeric>Collection</Th><Th isNumeric>Pay later</Th><Th isNumeric>Unaccounted</Th><Th>Details</Th></Tr></Thead>
            <Tbody>{snapshot.reportCycles.map((cycle) => (
              <Tr key={cycle.cycleId}>
                <Td fontWeight="800">{cycle.label}</Td>
                <Td whiteSpace="nowrap">{formatManilaDateTime(cycle.completedAt)}</Td>
                <Td isNumeric>{cycle.bottlesTaken}</Td>
                <Td isNumeric>{formatCurrency(cycle.expectedRevenue)}</Td>
                <Td isNumeric>{formatCurrency(cycle.totalPayments)}</Td>
                <Td isNumeric>{formatCurrency(cycle.physicalCashCollected)}</Td>
                <Td isNumeric>{formatCurrency(cycle.onlinePayments)}</Td>
                <Td isNumeric>{formatPercent(cycle.disclosureRate)}</Td>
                <Td isNumeric>{cycle.collectionRate == null ? "N/A" : formatPercent(cycle.collectionRate)}</Td>
                <Td isNumeric>{formatCurrency(cycle.payLaterAmount)}</Td>
                <Td isNumeric>{formatCurrency(cycle.unaccountedAmount)}</Td>
                <Td><Button size="xs" variant="outline" onClick={() => setDetailView(`cycle:${cycle.cycleId}`)}>View</Button></Td>
              </Tr>
            ))}</Tbody>
          </Table>
          {!snapshot.reportCycles.length ? <Text p={4} color="canvas.700">No completed cycles in this range yet.</Text> : null}
        </Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {snapshot.reportCycles.map((cycle) => (
            <Box key={cycle.cycleId} as="button" width="100%" textAlign="left" cursor="pointer" borderRadius="24px" bg="canvas.50" p={4} _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`cycle:${cycle.cycleId}`)}>
              <HStack justify="space-between" align="start"><Text fontWeight="900">{cycle.label}</Text><Text color="canvas.700" fontSize="sm">{formatManilaDateTime(cycle.completedAt)}</Text></HStack>
              <Text color="canvas.700" mt={2}>{cycle.bottlesTaken} bottles · {formatCurrency(cycle.totalPayments)} collected of {formatCurrency(cycle.expectedRevenue)}</Text>
              <Text color="canvas.700" mt={1}>Cash {formatCurrency(cycle.physicalCashCollected)} · Online {formatCurrency(cycle.onlinePayments)}</Text>
              <Text color="canvas.700" mt={1}>Disclosure {formatPercent(cycle.disclosureRate)} · Collection {cycle.collectionRate == null ? "N/A" : formatPercent(cycle.collectionRate)}</Text>
              <Text color="canvas.700" mt={1}>Pay later {formatCurrency(cycle.payLaterAmount)} · Unaccounted {formatCurrency(cycle.unaccountedAmount)}</Text>
            </Box>
          ))}
          {!snapshot.reportCycles.length ? <Text color="canvas.700">No completed cycles in this range yet.</Text> : null}
        </SimpleGrid>}
      </SectionCard>

      <SectionCard eyebrow="Products" title="Product performance">
        {viewMode === "table" ? <Box overflowX="auto" borderRadius="20px" border="1px solid" borderColor="whiteAlpha.200">
          <Table size="sm" minW="800px">
            <Thead bg="canvas.50"><Tr><Th>Product</Th><Th isNumeric>Units taken</Th><Th isNumeric>Revenue</Th><Th isNumeric>Capital</Th><Th isNumeric>Gross profit</Th><Th isNumeric>Avg/day</Th><Th isNumeric>Est. remaining</Th><Th>Details</Th></Tr></Thead>
            <Tbody>{productPerformance.map((item) => (
              <Tr key={item.productId}>
                <Td fontWeight="800">{item.productName}</Td>
                <Td isNumeric>{item.unitsTaken}</Td>
                <Td isNumeric>{formatCurrency(item.expectedRevenue)}</Td>
                <Td isNumeric>{formatCurrency(item.cogs)}</Td>
                <Td isNumeric>{formatCurrency(item.grossProfit)}</Td>
                <Td isNumeric>{item.averageUnitsPerDay?.toFixed(1) ?? "—"}</Td>
                <Td isNumeric>{item.estimatedRemaining ?? "—"}</Td>
                <Td><Button size="xs" variant="outline" onClick={() => setDetailView(`product:${item.productId}`)}>View</Button></Td>
              </Tr>
            ))}</Tbody>
          </Table>
          {!productPerformance.length ? <Text p={4} color="canvas.700">No product history in this range yet.</Text> : null}
        </Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {productPerformance.map((item) => (
            <Box key={item.productId} as="button" width="100%" textAlign="left" borderRadius="24px" bg="canvas.50" p={4} cursor="pointer" _hover={{ bg: "whiteAlpha.100" }} onClick={() => setDetailView(`product:${item.productId}`)}>
              <Text fontWeight="900">{item.productName}</Text>
              <Text color="canvas.700" mt={1}>{item.unitsTaken} taken · {formatCurrency(item.expectedRevenue)} revenue · {formatCurrency(item.grossProfit)} gross profit</Text>
              <Text color="canvas.700" mt={1}>Capital {formatCurrency(item.cogs)} · Avg/day {item.averageUnitsPerDay?.toFixed(1) ?? "—"} · Est. remaining {item.estimatedRemaining ?? "—"}</Text>
            </Box>
          ))}
          {!productPerformance.length ? <Text color="canvas.700">No product history in this range yet.</Text> : null}
        </SimpleGrid>}
      </SectionCard>

      <Modal isOpen={Boolean(detailView)} onClose={() => setDetailView(null)} isCentered size="xl">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{getDetailTitle(detailView)}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {detailView ? <ReportDetailContent detailView={detailView} snapshot={snapshot} setAside={setAside} viewMode={viewMode} /> : null}
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
  totalSetAside: "Target set aside by cycle",
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

function ReportDetailContent({ detailView, snapshot, setAside, viewMode }: { detailView: string; snapshot: ReportsSnapshot; setAside: ReportSetAside; viewMode: ReportViewMode }) {
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
        <PaymentRecordList records={snapshot.reportPaymentRecords.filter((record) => record.cycleId === cycle.cycleId)} viewMode={viewMode} />
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
        <RecordList records={records} empty="No individually classified bottle records for this product in the selected range." viewMode={viewMode} />
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
      {cycleKeys.has(detailView) ? <CycleBreakdown cycles={snapshot.reportCycles} detailView={detailView} viewMode={viewMode} /> : null}
      {filter ? <RecordList records={records} empty="No matching individual bottle records in the selected range." viewMode={viewMode} /> : null}
      {detailView === "salesRevenue" ? <PaymentRecordList records={snapshot.reportPaymentRecords} viewMode={viewMode} /> : null}
      {detailView === "capitalUsed" ? <CapitalBreakdown products={snapshot.productPerformance} /> : null}
      {detailView === "grossProfit" || detailView === "grossMargin" ? <FinancialCalculation snapshot={snapshot} setAside={setAside} /> : null}
      {setAsideKeys.has(detailView) ? <SetAsideBreakdown cycles={setAside.cycles} cyclePaymentRecords={snapshot.reportPaymentRecords} detailView={detailView} viewMode={viewMode} /> : null}
      {cashFloatKeys.has(detailView) ? <CashFloatBreakdown cycles={snapshot.reportCashFloats} detailView={detailView} viewMode={viewMode} /> : null}
      {detailView === "totalPayments" || detailView === "cashPayments" || detailView === "onlinePayments" ? (
        <PaymentRecordList
          records={snapshot.reportPaymentRecords.filter((record) => detailView === "totalPayments" || record.channel === (detailView === "cashPayments" ? "cash" : "online"))}
          viewMode={viewMode}
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

function SetAsideBreakdown({ cycles, cyclePaymentRecords, detailView, viewMode }: { cycles: ReportSetAside["cycles"]; cyclePaymentRecords: ReportsSnapshot["reportPaymentRecords"]; detailView: string; viewMode: ReportViewMode }) {
  const rows = cycles.map((cycle) => {
        const totalCapital = cycle.puresafeCapital == null || cycle.miscCapital == null ? null : cycle.puresafeCapital + cycle.miscCapital;
        const shareComparison = calculateSetAsideShareComparison(cycle);
        const cycleOnlineBreakdown = summarizeOnlinePayments(cyclePaymentRecords.filter((record) => record.cycleId === cycle.cycleId));
        const values: Record<string, string> = {
          puresafeCapital: `${shareComparison.puresafe.target == null ? "Unable to calculate" : formatCurrency(shareComparison.puresafe.target)} target · ${cycle.actualSetAside ? formatCurrency(cycle.actualSetAside.puresafeCapital) : "Not recorded"} actual`,
          electricityShare: `${formatCurrency(shareComparison.electricity.target)} target · ${cycle.actualSetAside ? formatCurrency(cycle.actualSetAside.electricityShare) : "Not recorded"} actual`,
          miscCapital: `${shareComparison.otherProducts.target == null ? "Unable to calculate" : formatCurrency(shareComparison.otherProducts.target)} target · ${cycle.actualSetAside ? formatCurrency(cycle.actualSetAside.otherProductsCapital) : "Not recorded"} actual · ${cycle.otherProductsReserve?.usedForRestocks == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.usedForRestocks)} used · ${cycle.otherProductsReserve?.closingBalance == null ? "Not tracked" : formatCurrency(cycle.otherProductsReserve.closingBalance)} closing reserve`,
          totalCapital: totalCapital == null ? "Unable to calculate" : formatCurrency(totalCapital),
          totalSetAside: cycle.totalSetAside == null ? "Unable to calculate" : formatCurrency(cycle.totalSetAside),
          remainingEarnings: `${shareComparison.toStash.target == null ? "Unable to calculate" : formatCurrency(shareComparison.toStash.target)} target · ${cycle.actualSetAside ? `${formatCurrency(cycle.actualSetAside.toStashCash)} actual cash + ${formatCurrency(cycleOnlineBreakdown.gcashPayments)} GCash + ${formatCurrency(cycleOnlineBreakdown.mayaPayments)} Maya${cycleOnlineBreakdown.otherOnlinePayments > 0 ? ` + ${formatCurrency(cycleOnlineBreakdown.otherOnlinePayments)} other online` : ""}` : "Not recorded"}`,
          cashAvailableAfterChangeFloat: formatCurrency(cycle.cashAvailableAfterChangeFloat),
          availableOnlinePayments: formatCurrency(cycle.availableOnlinePayments),
          totalAvailable: formatCurrency(cycle.totalAvailable),
          shortfall: cycle.shortfall == null
            ? "Unable to calculate"
            : `${formatCurrency(cycle.totalSetAside)} reserves − ${formatCurrency(cycle.cashAvailableAfterChangeFloat)} available cash = ${formatCurrency(cycle.shortfall)}`,
        };
        return { id: cycle.cycleId, label: `Cycle #${cycle.cycleNumber}`, value: values[detailView] };
      });
  return <DetailRows rows={rows} empty="No completed cycles in this reporting range." viewMode={viewMode} />;
}

function CashFloatBreakdown({ cycles, detailView, viewMode }: { cycles: ReportsSnapshot["reportCashFloats"]; detailView: string; viewMode: ReportViewMode }) {
  const visible = detailView === "unknownOpeningFloats" ? cycles.filter((cycle) => cycle.openingChangeFloat == null) : cycles;
  const rows = visible.map((cycle) => {
        const values: Record<string, string> = {
          cashCounted: formatCurrency(cycle.cashCountedBeforeWithdrawal),
          cashGenerated: cycle.cashGenerated == null ? "Cannot be determined" : formatCurrency(cycle.cashGenerated),
          cashWithdrawn: formatCurrency(cycle.cashWithdrawn),
          unknownOpeningFloats: "Opening change float is unknown; generated cash is excluded from the total.",
        };
        return { id: cycle.cycleId, label: cycle.cycleLabel, value: values[detailView] };
      });
  return <DetailRows rows={rows} empty="No matching cycles in this reporting range." viewMode={viewMode} />;
}

function PaymentRecordList({ records, viewMode }: { records: ReportsSnapshot["reportPaymentRecords"]; viewMode: ReportViewMode }) {
  return records.length ? (
    viewMode === "table" ? <Box overflowX="auto"><Table size="sm" minW="760px"><Thead><Tr><Th>Method</Th><Th isNumeric>Amount</Th><Th>Cycle</Th><Th>Received</Th><Th>Person</Th><Th>Note</Th></Tr></Thead><Tbody>
      {records.map((record) => (
        <Tr key={record.id}><Td fontWeight="800">{record.method}</Td><Td isNumeric>{formatCurrency(record.amount)}</Td><Td>{record.cycleLabel}</Td><Td whiteSpace="nowrap">{formatManilaDateTime(record.occurredAt)}</Td><Td>{record.personLabel ?? "—"}</Td><Td>{record.note ?? "—"}</Td></Tr>
      ))}
    </Tbody></Table></Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>{records.map((record) => <Box key={record.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{record.method} · {formatCurrency(record.amount)}</Text><Text color="canvas.700" mt={1}>{record.cycleLabel} · {formatManilaDateTime(record.occurredAt)}</Text>{record.personLabel ? <Text mt={1}>{record.personLabel}</Text> : null}{record.note ? <Text color="canvas.700" mt={2}>{record.note}</Text> : null}</Box>)}</SimpleGrid>
  ) : <Text color="canvas.700">No matching payment records in this reporting range.</Text>;
}

function CycleBreakdown({ cycles, detailView, viewMode }: { cycles: ReportsSnapshot["reportCycles"]; detailView: string; viewMode: ReportViewMode }) {
  return <DetailRows rows={cycles.map((cycle) => ({ id: cycle.cycleId, label: cycle.label, value: cycleDetailValue(cycle, detailView) }))} empty="No completed cycles in this reporting range." viewMode={viewMode} />;
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

function RecordList({ records, empty, viewMode }: { records: ReportsSnapshot["reportBottleRecords"]; empty: string; viewMode: ReportViewMode }) {
  return records.length ? (
    viewMode === "table" ? <Box overflowX="auto"><Table size="sm" minW="860px"><Thead><Tr><Th>Product</Th><Th isNumeric>Quantity</Th><Th>Person</Th><Th isNumeric>Amount</Th><Th>Cycle</Th><Th>Taken</Th><Th>Note</Th></Tr></Thead><Tbody>
      {records.map((entry) => (
        <Tr key={entry.id}><Td fontWeight="800">{entry.productName}</Td><Td isNumeric>{entry.quantity}</Td><Td>{entry.personLabel ?? entry.customerLabel ?? "Unknown"}</Td><Td isNumeric>{formatCurrency(entry.confirmedAmount)}</Td><Td>{entry.cycleLabel}</Td><Td whiteSpace="nowrap">{formatManilaDateTime(entry.takenAt)}</Td><Td>{entry.note ?? "—"}</Td></Tr>
      ))}
    </Tbody></Table></Box> : <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>{records.map((entry) => <Box key={entry.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{entry.quantity} × {entry.productName}</Text><Text color="canvas.700" mt={1}>{entry.personLabel ?? entry.customerLabel ?? "Unknown"} · {formatCurrency(entry.confirmedAmount)}</Text><Text color="canvas.700" mt={1}>{entry.cycleLabel} · {formatManilaDateTime(entry.takenAt)}</Text>{entry.note ? <Text mt={2}>{entry.note}</Text> : null}</Box>)}</SimpleGrid>
  ) : <Text color="canvas.700">{empty}</Text>;
}

function DetailRows({ rows, empty, viewMode }: { rows: Array<{ id: string; label: string; value: string }>; empty: string; viewMode: ReportViewMode }) {
  if (!rows.length) return <Text color="canvas.700">{empty}</Text>;
  if (viewMode === "tiles") return <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>{rows.map((row) => <Box key={row.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{row.label}</Text><Text color="canvas.700" mt={1}>{row.value}</Text><Button as={Link} to={`/history/${row.id}`} size="sm" variant="outline" mt={3}>View cycle</Button></Box>)}</SimpleGrid>;
  return <Box overflowX="auto"><Table size="sm" minW="620px"><Thead><Tr><Th>Cycle</Th><Th>Value</Th><Th>Details</Th></Tr></Thead><Tbody>{rows.map((row) => <Tr key={row.id}><Td fontWeight="800">{row.label}</Td><Td>{row.value}</Td><Td><Button as={Link} to={`/history/${row.id}`} size="xs" variant="outline">View</Button></Td></Tr>)}</Tbody></Table></Box>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <Box bg="canvas.50" borderRadius="18px" p={3}><Text color="canvas.700" fontSize="sm">{label}</Text><Text fontWeight="900" mt={1}>{value}</Text></Box>;
}
