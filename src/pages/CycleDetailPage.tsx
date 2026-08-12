import {
  Box,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { fetchCycleDetail } from "../lib/api";
import {
  formatCurrency,
  formatDateRange,
  formatDateTimeLabel,
  formatPercent,
} from "../lib/format";
import { CycleDetail } from "../lib/types";

export default function CycleDetailPage() {
  const { cycleId = "" } = useParams();
  const [detail, setDetail] = useState<CycleDetail | null>(null);

  useEffect(() => {
    void fetchCycleDetail(cycleId).then(setDetail);
  }, [cycleId]);

  if (!detail) {
    return <Spinner color="brand.400" />;
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow={`Cycle #${detail.cycleNumber}`} title={formatDateRange(detail.startedAt, detail.completedAt)}>
        <SimpleGrid columns={{ base: 2, xl: 6 }} spacing={4}>
          <MetricCard label="Bottles taken" value={String(detail.totals.bottlesTaken)} />
          <MetricCard label="Expected sales" value={formatCurrency(detail.totals.expectedRevenue)} />
          <MetricCard label="Received this period" value={formatCurrency(detail.totals.immediatePayments)} />
          <MetricCard label="Known pay-later" value={formatCurrency(detail.totals.knownPayLater)} />
          <MetricCard label="Unaccounted" value={formatCurrency(detail.totals.unaccountedAmount)} />
          <MetricCard label="Accounted rate" value={formatPercent(detail.totals.accountedRate)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Settlement" title="How this cycle was settled over time">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Settled amount" value={formatCurrency(detail.totals.settledAmount)} />
          <MetricCard label="Settled rate" value={formatPercent(detail.totals.settledRate)} />
          <MetricCard label="Outstanding" value={formatCurrency(detail.totals.outstandingAmount)} />
          <MetricCard label="Collection match" value={formatPercent(detail.totals.collectionMatchRate)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Cash and profit" title="Cycle totals">
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <Text>Cash: {formatCurrency(detail.totals.cashCollected)}</Text>
          <Text>GCash: {formatCurrency(detail.totals.gcashCollected)}</Text>
          <Text>Maya: {formatCurrency(detail.totals.mayaCollected)}</Text>
          <Text>Cash removed: {formatCurrency(detail.totals.cashRemoved)}</Text>
          <Text>Cash returned: {formatCurrency(detail.totals.cashReturned)}</Text>
          <Text>Estimated physical cash: {formatCurrency(detail.totals.estimatedPhysicalCash)}</Text>
          <Text>COGS: {formatCurrency(detail.totals.cogs)}</Text>
          <Text>Gross profit: {formatCurrency(detail.totals.grossProfit)}</Text>
          <Text>Gross margin: {formatPercent(detail.totals.grossMargin)}</Text>
          <Text>Started: {formatDateTimeLabel(detail.startedAt)}</Text>
          <Text>Completed: {formatDateTimeLabel(detail.completedAt)}</Text>
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Products" title="Product breakdown">
        <Stack spacing={3}>
          {detail.productBreakdown.map((item) => (
            <Box key={item.productId} borderRadius="24px" bg="canvas.50" p={4}>
              <Text fontWeight="800">{item.productName}</Text>
              <Text color="canvas.700" mt={1}>
                Start {item.startingQuantity} • Added {item.stockAddedQuantity} • Non-sale {item.nonSaleQuantity} • Left {item.endingQuantity}
              </Text>
              <Text mt={2}>
                Taken {item.unitsTaken} • Expected {formatCurrency(item.expectedRevenue)} • Profit {formatCurrency(item.grossProfit)}
              </Text>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Timeline" title="Activity">
        <Stack spacing={3}>
          {detail.timeline.map((item) => (
            <Box key={item.id} borderRadius="24px" bg="canvas.50" p={4}>
              <Text fontWeight="800">{item.label}</Text>
              <Text color="canvas.700">{item.detail}</Text>
              <Text mt={2} fontSize="sm" color="canvas.700">
                {formatDateTimeLabel(item.happenedAt)}
              </Text>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
