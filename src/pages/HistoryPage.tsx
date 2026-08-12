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
import { fetchHistoryFeed } from "../lib/api";
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
      setItems(await fetchHistoryFeed(nextFilter));
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
                {item.honestyRate != null ? <Text>Honesty {formatPercent(item.honestyRate)}</Text> : null}
              </HStack>
              {item.cycleId ? (
                <Button as={Link} to={`/history/${item.cycleId}`} mt={4} variant="outline">
                  View details
                </Button>
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
