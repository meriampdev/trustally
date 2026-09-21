import { Box, Button, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchBusinessAccountingReport } from "../lib/api";
import { BusinessRangeKey, resolveBusinessRange } from "../lib/businessRange";
import { formatCurrency, formatPercent } from "../lib/format";
import type { BusinessAccountingReport } from "../lib/types";
import { DateRangeModal } from "./DateRangeModal";
import { MetricCard } from "./MetricCard";
import { SectionCard } from "./SectionCard";

const ranges: Array<{ key: BusinessRangeKey; label: string }> = [
  { key: "today", label: "Today" }, { key: "cycle", label: "Current cycle" }, { key: "week", label: "This week" },
  { key: "month", label: "This month" }, { key: "custom", label: "Custom" }, { key: "all", label: "All time" },
];

export function BusinessPerformance({ cycleStartedAt }: { cycleStartedAt?: string | null }) {
  const [rangeKey, setRangeKey] = useState<BusinessRangeKey>("cycle");
  const [customStart, setCustomStart] = useState(""); const [customEnd, setCustomEnd] = useState("");
  const [isDateOpen, setIsDateOpen] = useState(false); const [report, setReport] = useState<BusinessAccountingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(""); const [detail, setDetail] = useState<string | null>(null);
  const range = useMemo(() => resolveBusinessRange(rangeKey, cycleStartedAt, customStart, customEnd), [rangeKey, cycleStartedAt, customStart, customEnd]);

  useEffect(() => {
    if (rangeKey === "custom" && (!customStart || !customEnd)) { setIsDateOpen(true); return; }
    let cancelled = false; setIsLoading(true); setError("");
    void fetchBusinessAccountingReport(range.startAt, range.endAt).then((value) => { if (!cancelled) setReport(value); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load business performance."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.startAt, range.endAt, rangeKey, customStart, customEnd]);

  const netProfit = report?.summary.grossProfit == null ? null : report.summary.grossProfit - report.summary.operatingExpenses;
  const grossMargin = report?.summary.grossProfit != null && report.summary.revenue > 0 ? report.summary.grossProfit / report.summary.revenue * 100 : null;

  return <SectionCard eyebrow="Business performance" title="Capital recovery and profit" collapsible collapseKey="dashboard-business-performance">
    <Box overflowX="auto" maxW="100%" pb={2}><HStack width="max-content" minW="100%">{ranges.map((item) => <Button key={item.key} size="sm" flexShrink={0} variant={rangeKey === item.key ? "solid" : "outline"} onClick={() => { setRangeKey(item.key); if (item.key === "custom") setIsDateOpen(true); }}>{item.label}</Button>)}</HStack></Box>
    {isLoading ? <Spinner mt={5} color="brand.400"/> : error ? <Text mt={4} color="caution.500">{error}</Text> : report ? <Stack spacing={5} mt={5}>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
        <MetricCard label="Sales / revenue" value={formatCurrency(report.summary.revenue)} hint="Money earned before costs" onClick={() => setDetail("Revenue is the selling value of units recorded as sold. It is not the same as profit.")}/>
        <MetricCard label="Restock capital invested" value={formatCurrency(report.summary.capitalInvested)} hint={`${report.summary.restockCount} restocks`} onClick={() => setDetail("Capital invested is the amount paid for restocks in this period. Restocks also create inventory-purchase expenses automatically.")}/>
        <MetricCard label="Capital recovered" value={report.summary.capitalRecovered == null ? "Missing cost data" : formatCurrency(report.summary.capitalRecovered)} hint="COGS from sold units" onClick={() => setDetail("Capital recovered is the weighted-average cost basis of sold units, stored when each cycle is completed.")}/>
        <MetricCard label="Capital still in stock" value={report.summary.capitalStillInStock == null ? "Missing cost data" : formatCurrency(report.summary.capitalStillInStock)} hint="Current inventory value" onClick={() => setDetail("Capital still in stock is current quantity multiplied by the product’s weighted-average unit cost.")}/>
        <MetricCard label="Gross profit" value={report.summary.grossProfit == null ? "Missing cost data" : formatCurrency(report.summary.grossProfit)} hint={formatPercent(grossMargin)} onClick={() => setDetail("Gross profit is revenue minus the stored cost basis of units sold.")}/>
        <MetricCard label="Gross margin" value={formatPercent(grossMargin)} hint="Gross profit as a share of revenue" onClick={() => setDetail("Gross margin is gross profit divided by revenue for the selected period. It excludes operating expenses.")}/>
        <MetricCard label="Operating expenses" value={formatCurrency(report.summary.operatingExpenses)} hint="Excludes restock purchases" onClick={() => setDetail("Operating expenses reduce net profit. Inventory purchases are excluded because their cost is recognized as units are sold.")}/>
        <MetricCard label="Net profit" value={netProfit == null ? "Missing cost data" : formatCurrency(netProfit)} hint="Gross profit less operating expenses" onClick={() => setDetail("Net profit equals gross profit minus non-inventory operating expenses for the selected period.")}/>
        <MetricCard label="Units sold" value={String(report.summary.unitsSold)} hint="From completed box checks" onClick={() => setDetail("Units sold are inferred from completed box checks in the selected period.")}/>
        <MetricCard label="Restocks" value={String(report.summary.restockCount)} hint="Purchases in the selected period" onClick={() => setDetail("This counts restock transactions in the selected period. Each valid restock has one linked inventory-purchase expense.")}/>
        <MetricCard label="Current inventory value" value={report.summary.inventoryValue == null ? "Missing cost data" : formatCurrency(report.summary.inventoryValue)} hint="Stock on hand at weighted-average cost" onClick={() => setDetail("Current inventory value is the quantity now on hand multiplied by each product’s current weighted-average cost. It is a current balance, not limited to the selected date range.")}/>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <MiniChart title="Revenue versus gross profit" labels={report.trend.map((item) => item.label)} first={report.trend.map((item) => item.revenue)} second={report.trend.map((item) => item.grossProfit ?? 0)} firstLabel="Revenue" secondLabel="Gross profit"/>
        <MiniChart title="Capital invested versus recovered" labels={report.trend.map((item) => item.label)} first={report.trend.map((item) => item.capitalInvested)} second={report.trend.map((item) => item.capitalRecovered ?? 0)} firstLabel="Invested" secondLabel="Recovered"/>
        <MiniChart title="Profit by product" labels={report.products.map((item) => item.productName)} first={report.products.map((item) => Math.max(item.periodGrossProfit ?? 0, 0))} firstLabel="Gross profit"/>
        <MiniChart title="Restock spending over time" labels={report.trend.map((item) => item.label)} first={report.trend.map((item) => item.capitalInvested)} firstLabel="Restock spending"/>
      </SimpleGrid>
      <Box><Text fontWeight="900" mb={3}>Product capital recovery</Text><SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>{report.products.slice(0, 4).map((product) => <Box key={product.productId} bg="canvas.50" p={4} borderRadius="20px"><HStack justify="space-between" align="start"><Text fontWeight="900">{product.productName}</Text><Text fontSize="sm">{status(product)}</Text></HStack><Text mt={2}>{product.currentStock} in stock · {product.weightedAverageUnitCost == null ? "No cost data" : `${formatCurrency(product.weightedAverageUnitCost)} average cost`}</Text><Text color="canvas.700" fontSize="sm" mt={1}>Inventory value {product.inventoryValue == null ? "unknown" : formatCurrency(product.inventoryValue)} · Restock capital {formatCurrency(product.totalRestockCapital)}</Text><Text color="canvas.700" fontSize="sm" mt={1}>{formatCurrency(product.capitalRecovered)} recovered · {product.capitalRemaining == null ? "Missing cost data" : `${formatCurrency(product.capitalRemaining)} still in stock`}</Text><Text color="canvas.700" fontSize="sm" mt={1}>Revenue {formatCurrency(product.revenue)} · Gross profit {formatCurrency(product.grossProfit)}</Text><Text fontSize="sm" mt={1}>{product.recoveryPercentage == null ? "Recovery unavailable" : `${formatPercent(product.recoveryPercentage)} recovered`}{product.lastRestockAt ? ` · Last restock ${new Date(product.lastRestockAt).toLocaleDateString("en-PH")}` : " · No restock date"}{product.dataQuality !== "VERIFIED" ? ` · ${product.dataQuality}` : ""}</Text></Box>)}</SimpleGrid></Box>
      <Button as={Link} to="/reports/business" variant="outline" alignSelf="start">Open detailed business reports</Button>
    </Stack> : null}
    <DateRangeModal isOpen={isDateOpen} onClose={() => setIsDateOpen(false)} startDate={customStart || range.startDate} endDate={customEnd || range.endDate} onApply={(start, end) => { setCustomStart(start); setCustomEnd(end); setRangeKey("custom"); setIsDateOpen(false); }}/>
    <Modal isOpen={detail !== null} onClose={() => setDetail(null)} isCentered><ModalOverlay bg="blackAlpha.700"/><ModalContent bg="canvas.100" borderRadius="28px" mx={4}><ModalHeader>How this is calculated</ModalHeader><ModalCloseButton/><ModalBody><Text color="canvas.700">{detail}</Text></ModalBody><ModalFooter><Button onClick={() => setDetail(null)}>Close</Button></ModalFooter></ModalContent></Modal>
  </SectionCard>;
}

function status(product: BusinessAccountingReport["products"][number]) {
  if (product.dataQuality === "MISSING") return "No cost data";
  if (product.currentStock <= 0) return "No stock";
  if (product.capitalRecoveredAt) return "Capital recovered";
  return "Recovering capital";
}

function MiniChart({ title, labels, first, second, firstLabel, secondLabel }: { title: string; labels: string[]; first: number[]; second?: number[]; firstLabel: string; secondLabel?: string }) {
  const entries = labels.map((label, index) => ({ label, first: first[index] ?? 0, second: second?.[index] ?? 0 })).filter((item) => item.first || item.second).slice(-10);
  const maximum = Math.max(...entries.flatMap((item) => [item.first, item.second]), 1);
  return <Box bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{title}</Text>{entries.length ? <Stack spacing={2} mt={3}>{entries.map((item) => <Box key={item.label}><Text fontSize="xs" color="canvas.700" noOfLines={1}>{formatChartLabel(item.label)}</Text><HStack h="10px" spacing={1}><Box h="100%" bg="brand.400" borderRadius="full" width={`${Math.max(item.first, 0) / maximum * 100}%`}/>{second ? <Box h="100%" bg="honesty.500" borderRadius="full" width={`${Math.max(item.second, 0) / maximum * 100}%`}/> : null}</HStack></Box>)}</Stack> : <Text mt={3} color="canvas.700" fontSize="sm">No activity in this period.</Text>}<Text fontSize="xs" color="canvas.700" mt={3}>Blue {firstLabel}{secondLabel ? ` · Green ${secondLabel}` : ""}</Text></Box>;
}

function formatChartLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }); }
