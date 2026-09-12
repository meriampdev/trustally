import {
  Box,
  Button,
  HStack,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { fetchCycleCashFloatDetail, fetchCycleDisclosureAndCollection, fetchCyclePaymentDetail, fetchHistoryFeed } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, formatPercent } from "../lib/format";
import { HistoryFilter, HistoryItem } from "../lib/types";

const filters: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "box_checks", label: "Box checks" },
  { value: "stock_added", label: "Stock added" },
  { value: "adjustments", label: "Adjustments" },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("box_checks");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void load(filter);
  }, [filter]);

  async function load(nextFilter: HistoryFilter) {
    setIsLoading(true);
    try {
      const historyItems = await fetchHistoryFeed(nextFilter);
      const currentItems = await Promise.all(historyItems.map(async (item) => {
        if (item.eventType !== "box_check" || !item.cycleId) return item;
        const [payments, honesty, cashFloat] = await Promise.all([
          fetchCyclePaymentDetail(item.cycleId),
          fetchCycleDisclosureAndCollection(item.cycleId),
          fetchCycleCashFloatDetail(item.cycleId),
        ]);
        const required = honesty.summary.currentlyDueAmount;
        const collectionRate = required > 0
          ? Math.min((payments.summary.totalPayments / required) * 100, 100)
          : null;
        return {
          ...item,
          subtitle: `${formatCurrency(payments.summary.totalPayments)} total payments`,
          totalCollected: payments.summary.totalPayments,
          differenceAmount: payments.summary.totalPayments - required,
          collectionRate,
          cashPayments: payments.summary.cashPayments,
          onlinePayments: payments.summary.onlinePayments,
          cashFloat,
        };
      }));
      setItems(currentItems);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Filters" title="Browse box activity">
        <HStack spacing={3} flexWrap="wrap">
          {filters.map((item) => (
            <Button
              key={item.value}
              variant={filter === item.value ? "solid" : "subtle"}
              borderColor={'canvas.900'}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </HStack>
      </SectionCard>

      {isLoading ? (
        <Spinner color="brand.400" />
      ) : items.length ? (
        <Stack spacing={4}>
          {items.map((item) => (
            <SectionCard key={item.id} title={item.title} eyebrow={formatDateTimeLabel(item.happenedAt)}>
              <Text color="canvas.700">{item.subtitle}</Text>
              <HStack mt={4} spacing={4} flexWrap="wrap">
                {item.bottlesTaken != null ? <Text>{item.bottlesTaken} bottles taken</Text> : null}
                {item.expectedRevenue != null ? <Text>Expected {formatCurrency(item.expectedRevenue)}</Text> : null}
                {item.totalCollected != null ? <Text>Collected {formatCurrency(item.totalCollected)}</Text> : null}
                {item.collectionRate != null || item.honestyRate != null ? <Text>Collection match {formatPercent(item.collectionRate ?? item.honestyRate)}</Text> : null}
              </HStack>
              {item.cashFloat ? (
                <Text color="canvas.700" mt={3}>
                  Opening float {item.cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(item.cashFloat.openingChangeFloat)} · Counted {formatCurrency(item.cashFloat.cashCountedBeforeWithdrawal)} · Cash generated {item.cashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(item.cashFloat.cashGenerated)} · Left for Change {formatCurrency(item.cashFloat.closingChangeFloat)} · Withdrawn {formatCurrency(item.cashFloat.cashWithdrawn)}
                </Text>
              ) : null}
              {item.cycleId ? (
                <HStack mt={4} spacing={3} flexWrap="wrap">
                  {item.cashPayments != null ? <Button as={Link} to={`/history/${item.cycleId}?payments=cash`} size="sm" variant="outline">Cash {formatCurrency(item.cashPayments)}</Button> : null}
                  {item.onlinePayments != null ? <Button as={Link} to={`/history/${item.cycleId}?payments=online`} size="sm" variant="outline">Online {formatCurrency(item.onlinePayments)}</Button> : null}
                  <Button as={Link} to={`/history/${item.cycleId}`} size="sm" variant="outline">View all details</Button>
                </HStack>
              ) : null}
            </SectionCard>
          ))}
        </Stack>
      ) : (
        <SectionCard eyebrow="History" title="Nothing here yet">
          <Text color="canvas.700">No matching history yet.</Text>
        </SectionCard>
      )}
    </Stack>
  );
}
