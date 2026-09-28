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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DateRangeModal } from "../components/DateRangeModal";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { fetchReportsSnapshot, fetchReportSetAside } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, formatPercent } from "../lib/format";
import { formatReportDateRange } from "../lib/reportRange";
import type { ReportRangeKey } from "../lib/reportRange";
import type { ReportsSnapshot, ReportSetAside } from "../lib/types";

const simpleRangeOptions: Array<{ value: ReportRangeKey; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom dates" },
];

export default function ReportsPage() {
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [setAside, setSetAside] = useState<ReportSetAside | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (rangeKey === "custom" && (!customStartDate || !customEndDate)) return;
    let cancelled = false;
    setSnapshot(null);
    setSetAside(null);
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

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Date range" title="Report period">
        <Box overflowX="auto" maxW="100%" pb={1}>
          <HStack spacing={2} width="max-content">
            {simpleRangeOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                flexShrink={0}
                variant={rangeKey === option.value ? "solid" : "outline"}
                onClick={() => {
                  if (option.value === "custom") setIsDateRangeOpen(true);
                  else setRangeKey(option.value);
                }}
              >
                {option.value === "custom" && rangeKey === "custom"
                  ? formatReportDateRange(customStartDate, customEndDate)
                  : option.label}
              </Button>
            ))}
          </HStack>
        </Box>
      </SectionCard>

      {errorMessage ? (
        <SectionCard title="Couldn’t load this report"><Text color="caution.600">{errorMessage}</Text></SectionCard>
      ) : !snapshot || !setAside ? (
        <VStack py={10}><Spinner color="brand.400" /></VStack>
      ) : (
        <ReportContent snapshot={snapshot} setAside={setAside} />
      )}

      <DateRangeModal
        isOpen={isDateRangeOpen}
        startDate={customStartDate}
        endDate={customEndDate}
        onClose={() => setIsDateRangeOpen(false)}
        onApply={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setRangeKey("custom");
          setIsDateRangeOpen(false);
        }}
      />
    </Stack>
  );
}

function ReportContent({ snapshot, setAside }: { snapshot: ReportsSnapshot; setAside: ReportSetAside }) {
  const actualSetAside = setAside.summary.actualPhysicalTotal;
  const fundBalances = setAside.summary.closingFundBalances ?? setAside.summary.fundBalances;
  const goalHits = setAside.summary.goalHits;

  return (
    <>
      <SectionCard eyebrow="Summary" title="At a glance">
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} spacing={3}>
          <MetricCard label="Sales" value={formatCurrency(snapshot.summary.expectedRevenue)} />
          <MetricCard label="Payments collected" value={formatCurrency(snapshot.summary.totalPayments)} />
          <MetricCard label="Unexplained gap" value={formatCurrency(snapshot.summary.unaccountedAmount)} />
          <MetricCard label="Profit" value={formatCurrency(snapshot.summary.grossProfit)} />
          <MetricCard label="Actual set aside" value={actualSetAside == null ? "Not recorded" : formatCurrency(actualSetAside)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard title="Sales and payments" collapsible collapseKey="reports-sales-payments" defaultExpanded={false}>
        <DetailRows rows={[
          ["Completed checks", String(snapshot.summary.completedCycles)],
          ["Bottles taken", String(snapshot.summary.bottlesTaken)],
          ["Cash payments", formatCurrency(snapshot.summary.cashPayments)],
          ["Online payments", formatCurrency(snapshot.summary.onlinePayments)],
          ["Known pay-later", formatCurrency(snapshot.summary.knownPayLater)],
          ["Collection rate", formatPercent(snapshot.summary.collectionRate)],
        ]} />
      </SectionCard>

      <SectionCard title="Profit details" collapsible collapseKey="reports-profit" defaultExpanded={false}>
        <DetailRows rows={[
          ["Sales", formatCurrency(snapshot.summary.expectedRevenue)],
          ["Product cost", formatCurrency(snapshot.summary.cogs)],
          ["Gross profit", formatCurrency(snapshot.summary.grossProfit)],
          ["Gross margin", formatPercent(snapshot.summary.grossMargin)],
        ]} />
      </SectionCard>

      <SectionCard title="Set-aside details" collapsible collapseKey="reports-set-aside" defaultExpanded={false}>
        <DetailRows rows={[
          ["Cash available", formatCurrency(setAside.summary.cashAvailableAfterChangeFloat)],
          ["Puresafe actual", nullableMoney(setAside.summary.actualPuresafeCapital)],
          ["Other Products actual", nullableMoney(setAside.summary.actualOtherProductsCapital)],
          ["Electricity actual", nullableMoney(setAside.summary.actualElectricityShare)],
          ["Savings actual", nullableMoney(setAside.summary.actualContingency)],
          ["Credit awaiting cash", nullableMoney(setAside.summary.actualCreditTotal)],
          ["Puresafe balance", nullableMoney(fundBalances?.puresafe.fundedBalance)],
          ["Other Products balance", nullableMoney(fundBalances?.otherProducts.fundedBalance)],
          ["Electricity balance", nullableMoney(fundBalances?.electricity.fundedBalance)],
          ["Puresafe goal hits", String(goalHits?.puresafe.count ?? 0)],
          ["Puresafe hit dates", formatHitDates(goalHits?.puresafe.dates)],
          ["Other Products goal hits", String(goalHits?.otherProducts.count ?? 0)],
          ["Other Products hit dates", formatHitDates(goalHits?.otherProducts.dates)],
          ["Electricity goal hits", String(goalHits?.electricity.count ?? 0)],
          ["Electricity hit dates", formatHitDates(goalHits?.electricity.dates)],
        ]} />
      </SectionCard>

      <SectionCard title="More detail" collapsible collapseKey="reports-more" defaultExpanded={false}>
        <Text color="canvas.700">The full cycle, product, cash-flow, disclosure, restock, expense, and export views are still available.</Text>
        <HStack mt={4} spacing={3} overflowX="auto" pb={1}>
          <Button as={Link} to="/reports/business" flexShrink={0}>Full reports and exports</Button>
          <Button as={Link} to="/history" variant="outline" flexShrink={0}>Completed checks</Button>
        </HStack>
      </SectionCard>
    </>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <Stack spacing={3}>
      {rows.map(([label, value]) => (
        <HStack key={label} justify="space-between" align="start">
          <Text color="canvas.700">{label}</Text>
          <Text fontWeight="800" textAlign="right">{value}</Text>
        </HStack>
      ))}
    </Stack>
  );
}

function nullableMoney(value?: number | null) {
  return value == null ? "Not recorded" : formatCurrency(value);
}

function formatHitDates(dates?: string[]) {
  return dates?.length ? dates.map(formatDateTimeLabel).join(", ") : "None in this period";
}
