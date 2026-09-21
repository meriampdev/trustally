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
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { PaymentDetailsModal } from "../components/PaymentDetailsModal";
import { fetchCycleCashFloatDetail, fetchCycleDisclosureAndCollection, fetchCyclePaymentDetail, fetchHistoryFeed } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, formatPercent } from "../lib/format";
import { exportCsv, printReport } from "../lib/exportData";
import { CycleCashFloatDetail, CycleHonestyDetail, CyclePaymentDetail, HistoryFilter, HistoryItem } from "../lib/types";

interface EnrichedHistoryItem extends HistoryItem {
  paymentDetail?: CyclePaymentDetail;
  honestyDetail?: CycleHonestyDetail;
  cashFloat?: CycleCashFloatDetail | null;
}

const filters: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "box_checks", label: "Box checks" },
  { value: "stock_added", label: "Stock added" },
  { value: "adjustments", label: "Adjustments" },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("box_checks");
  const [items, setItems] = useState<EnrichedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<EnrichedHistoryItem | null>(null);
  const [paymentView, setPaymentView] = useState<{ item: EnrichedHistoryItem; channel: "cash" | "online" } | null>(null);

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
          paymentDetail: payments,
          honestyDetail: honesty,
        };
      }));
      setItems(currentItems);
    } finally {
      setIsLoading(false);
    }
  }

  const historyExportRows = items.map((item) => ({
    Date: formatDateTimeLabel(item.happenedAt), Type: item.eventType, Title: item.title, Details: item.subtitle,
    Quantity: item.quantity ?? "", "Bottles taken": item.bottlesTaken ?? "", "Expected revenue": item.expectedRevenue == null ? "" : formatCurrency(item.expectedRevenue),
    "Total collected": item.totalCollected == null ? "" : formatCurrency(item.totalCollected), "Collection rate": item.collectionRate == null ? "" : formatPercent(item.collectionRate),
  }));
  const historyColumns = Object.keys(historyExportRows[0] ?? {}).map((key) => ({ label: key, value: (row: typeof historyExportRows[number]) => row[key as keyof typeof row] }));

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
          <Button variant="outline" onClick={() => exportCsv("Trustally history", `trustally-history-${filter}.csv`, historyExportRows, historyColumns)}>Export CSV</Button>
          <Button variant="outline" onClick={() => printReport("Trustally history", historyExportRows, historyColumns)}>Print / PDF</Button>
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
                  {item.cashPayments != null ? <Button onClick={() => setPaymentView({ item, channel: "cash" })} size="sm" variant="outline">Cash {formatCurrency(item.cashPayments)}</Button> : null}
                  {item.onlinePayments != null ? <Button onClick={() => setPaymentView({ item, channel: "online" })} size="sm" variant="outline">Online {formatCurrency(item.onlinePayments)}</Button> : null}
                  <Button onClick={() => setSelectedItem(item)} size="sm" variant="outline">View details</Button>
                </HStack>
              ) : (
                <Button mt={4} size="sm" variant="outline" onClick={() => setSelectedItem(item)}>View details</Button>
              )}
            </SectionCard>
          ))}
        </Stack>
      ) : (
        <SectionCard eyebrow="History" title="Nothing here yet">
          <Text color="canvas.700">No matching history yet.</Text>
        </SectionCard>
      )}

      <Modal isOpen={selectedItem !== null} onClose={() => setSelectedItem(null)} isCentered size="xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{selectedItem?.title ?? "History details"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedItem ? (
              <Stack spacing={4}>
                <Text color="canvas.700">{formatDateTimeLabel(selectedItem.happenedAt)} · {selectedItem.subtitle}</Text>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  {selectedItem.bottlesTaken != null ? <HistoryValue label="Bottles taken" value={String(selectedItem.bottlesTaken)} /> : null}
                  {selectedItem.expectedRevenue != null ? <HistoryValue label="Expected revenue" value={formatCurrency(selectedItem.expectedRevenue)} /> : null}
                  {selectedItem.totalCollected != null ? <HistoryValue label="Total collected" value={formatCurrency(selectedItem.totalCollected)} /> : null}
                  {selectedItem.collectionRate != null ? <HistoryValue label="Collection rate" value={formatPercent(selectedItem.collectionRate)} /> : null}
                  {selectedItem.honestyDetail ? <HistoryValue label="Disclosure honesty" value={formatPercent(selectedItem.honestyDetail.summary.disclosureRate)} /> : null}
                  {selectedItem.honestyDetail ? <HistoryValue label="Payment required" value={formatCurrency(selectedItem.honestyDetail.summary.currentlyDueAmount)} /> : null}
                  {selectedItem.quantity != null ? <HistoryValue label="Quantity" value={String(selectedItem.quantity)} /> : null}
                </SimpleGrid>
                {selectedItem.cashFloat ? (
                  <Box bg="canvas.50" borderRadius="20px" p={4}>
                    <Text fontWeight="900">Cash box flow</Text>
                    <Text color="canvas.700" mt={2}>Opening {selectedItem.cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(selectedItem.cashFloat.openingChangeFloat)} · Counted {formatCurrency(selectedItem.cashFloat.cashCountedBeforeWithdrawal)} · Generated {selectedItem.cashFloat.cashGenerated == null ? "Unknown" : formatCurrency(selectedItem.cashFloat.cashGenerated)} · Left for Change {formatCurrency(selectedItem.cashFloat.closingChangeFloat)} · Withdrawn {formatCurrency(selectedItem.cashFloat.cashWithdrawn)}</Text>
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Close</Button>
            {selectedItem?.cycleId ? <Button as={Link} to={`/history/${selectedItem.cycleId}`}>Open full cycle</Button> : null}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <PaymentDetailsModal
        isOpen={paymentView !== null}
        onClose={() => setPaymentView(null)}
        title={paymentView?.channel === "cash" ? "Cash payment details" : "Online payment details"}
        records={paymentView?.item.paymentDetail?.records ?? []}
        channel={paymentView?.channel}
      />
    </Stack>
  );
}

function HistoryValue({ label, value }: { label: string; value: string }) {
  return <Box bg="canvas.50" borderRadius="18px" p={3}><Text color="canvas.700" fontSize="sm">{label}</Text><Text fontWeight="900" mt={1}>{value}</Text></Box>;
}
