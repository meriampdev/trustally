import {
  Box,
  Button,
  HStack,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { fetchReportsSnapshot } from "../lib/api";
import { formatCurrency, formatPercent } from "../lib/format";
import { ReportsSnapshot } from "../lib/types";

const rangeOptions = ["7d", "30d", "month", "3m", "6m", "1y"];

export default function ReportsPage() {
  const [rangeKey, setRangeKey] = useState("30d");
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const expectedVsCollected = Array.isArray(snapshot?.expectedVsCollected)
    ? snapshot.expectedVsCollected
    : [];

  const accountedTrend = Array.isArray(snapshot?.accountedTrend) ? snapshot.accountedTrend : [];
  const productPerformance = Array.isArray(snapshot?.productPerformance)
    ? snapshot.productPerformance
    : [];

    
  useEffect(() => {
    void fetchReportsSnapshot(rangeKey).then(setSnapshot);
  }, [rangeKey]);

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

  if (!snapshot) {
    return <Spinner color="brand.400" />;
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Range" title="Choose a reporting window">
        <HStack spacing={3} flexWrap="wrap">
          {rangeOptions.map((item) => (
            <Button
              key={item}
              variant={rangeKey === item ? "solid" : "subtle"}
              onClick={() => setRangeKey(item)}
            >
              {item}
            </Button>
          ))}
        </HStack>
      </SectionCard>

      <SectionCard eyebrow="Operational totals" title="What happened during these cycles">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Immediate collected" value={formatCurrency(snapshot.summary.totalCollected)} />
          <MetricCard label="Known pay-later" value={formatCurrency(snapshot.summary.knownPayLater)} />
          <MetricCard label="Bottles taken" value={String(snapshot.summary.bottlesTaken)} />
          <MetricCard label="Revenue per cycle" value={formatCurrency(snapshot.summary.averageRevenuePerCycle)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Expected vs immediate money" title="Cycle trend">
        <Stack spacing={4}>
          {expectedVsCollected.length ? (
            expectedVsCollected.map((item) => (
            <Box key={item.label}>
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
            accountedTrend.map((item) => (
              <Box key={item.label} borderRadius="24px" bg="canvas.50" p={4}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="800">{item.label}</Text>
                  <Text color="canvas.700">
                    Accounted {formatPercent(item.accountedRate)} • Settled {formatPercent(item.settledRate)}
                  </Text>
                </HStack>
                <Text color="canvas.700">
                  Outstanding {formatCurrency(item.outstandingAmount)} • Unaccounted {formatCurrency(item.unaccountedAmount)}
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
              <Box key={item.productId} borderRadius="24px" bg="canvas.50" p={4}>
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
    </Stack>
  );
}
