import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Skeleton,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createInventoryCount,
  fetchInventorySnapshot,
  getErrorMessage,
  isProbablyOfflineError,
} from "../lib/api";
import { enqueuePendingOperation } from "../lib/offlineQueue";
import { formatCurrency, getTodayInputValue } from "../lib/format";
import { InventorySnapshotItem } from "../lib/types";
import { ProductCountRow } from "../components/ProductCountRow";

export default function CountInventoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<InventorySnapshotItem[]>([]);
  const [date, setDate] = useState(getTodayInputValue());
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function loadSnapshot() {
    setIsLoading(true);

    try {
      const nextSnapshot = await fetchInventorySnapshot();
      setSnapshot(nextSnapshot);
      setCounts(
        Object.fromEntries(
          nextSnapshot.map((item) => [item.productId, item.bookQuantity]),
        ),
      );
      setIsPreviewVisible(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const totals = useMemo(() => {
    return snapshot.reduce(
      (summary, item) => {
        const actualQuantity = counts[item.productId] ?? 0;
        return {
          expectedQuantity: summary.expectedQuantity + item.bookQuantity,
          actualQuantity: summary.actualQuantity + actualQuantity,
          expectedValue: summary.expectedValue + item.bookQuantity * item.sellingPrice,
          actualValue: summary.actualValue + actualQuantity * item.sellingPrice,
        };
      },
      {
        expectedQuantity: 0,
        actualQuantity: 0,
        expectedValue: 0,
        actualValue: 0,
      },
    );
  }, [counts, snapshot]);

  const reconciliationPreview = useMemo(() => {
    const items = snapshot
      .map((item) => {
        const actualQuantity = counts[item.productId] ?? 0;
        const unitsTaken = Math.max(item.bookQuantity - actualQuantity, 0);
        const expectedRevenue = unitsTaken * item.sellingPrice;
        const capitalUsed = unitsTaken * item.averageUnitCost;

        return {
          productId: item.productId,
          productName: item.productName,
          expectedQuantity: item.bookQuantity,
          actualQuantity,
          unitsTaken,
          expectedRevenue,
          capitalUsed,
        };
      })
      .filter(
        (item) => item.unitsTaken > 0 || item.actualQuantity !== item.expectedQuantity,
      )
      .sort((left, right) => right.expectedRevenue - left.expectedRevenue);

    const unitsTaken = items.reduce((sum, item) => sum + item.unitsTaken, 0);
    const expectedRevenue = items.reduce((sum, item) => sum + item.expectedRevenue, 0);
    const capitalUsed = items.reduce((sum, item) => sum + item.capitalUsed, 0);

    return {
      items,
      unitsTaken,
      expectedRevenue,
      capitalUsed,
      grossProfit: expectedRevenue - capitalUsed,
    };
  }, [counts, snapshot]);

  function handlePreviewReconciliation() {
    setIsPreviewVisible(true);
  }

  async function handleSaveCount() {
    setIsSaving(true);

    const payload = {
      date,
      notes: notes || undefined,
      items: snapshot.map((item) => ({
        productId: item.productId,
        expectedQuantity: item.bookQuantity,
        actualQuantity: counts[item.productId] ?? 0,
      })),
    };

    try {
      const result = await createInventoryCount(payload);
      toast({
        title: "Count saved",
        description: "Review the generated reconciliation before confirming it.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      navigate(`/reconciliations/${result.reconciliationId}`);
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        enqueuePendingOperation({
          type: "inventory_count",
          payload,
        });
        toast({
          title: "Count saved offline",
          description: "It will sync and generate a reconciliation when you're back online.",
          status: "info",
          duration: 3200,
          isClosable: true,
          position: "top",
        });
        navigate("/activity");
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Stack spacing={4}>
      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Box
        bg="rgba(255,255,255,0.8)"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        border="1px solid"
        borderColor="whiteAlpha.700"
      >
        <Stack spacing={4}>
          <HStack justify="space-between" align="start">
            <Box>
              <Text fontWeight="800" fontSize="xl">
                Count inventory
              </Text>
              <Text color="canvas.700">
                Optimized for fast physical counting beside the honesty box.
              </Text>
            </Box>
          </HStack>
          <HStack spacing={4} align="start" flexWrap="wrap">
            <Box minW={{ base: "full", md: "200px" }}>
              <Text mb={2} fontWeight="700">
                Count date
              </Text>
              <Input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setIsPreviewVisible(false);
                }}
                borderColor="black"
                color="black"
              />
            </Box>
            <Box flex="1" minW={{ base: "full", md: "320px" }}>
              <Text mb={2} fontWeight="700">
                Notes
              </Text>
              <Textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setIsPreviewVisible(false);
                }}
                placeholder="Optional count notes"
                borderColor="black"
                color="black"
                _placeholder={{ color: "black", opacity: 1 }}
              />
            </Box>
          </HStack>
        </Stack>
      </Box>

      <Stack spacing={3}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} height="124px" borderRadius="24px" />
            ))
          : snapshot.map((item) => (
              <ProductCountRow
                key={item.productId}
                name={item.productName}
                expectedQuantity={item.bookQuantity}
                actualQuantity={counts[item.productId] ?? 0}
                onChange={(value) => {
                  setCounts((current) => ({
                    ...current,
                    [item.productId]: value,
                  }));
                  setIsPreviewVisible(false);
                }}
              />
            ))}
      </Stack>

      <Box
        bg="whiteAlpha.900"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        border="1px solid"
        borderColor="blackAlpha.100"
      >
        <Stack spacing={3}>
          <Text fontWeight="800" fontSize="xl">
            Count summary
          </Text>
          <HStack justify="space-between">
            <Text color="canvas.700">Expected bottles</Text>
            <Text fontWeight="800">{totals.expectedQuantity}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="canvas.700">Actual bottles</Text>
            <Text fontWeight="800">{totals.actualQuantity}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="canvas.700">Expected retail value</Text>
            <Text fontWeight="800">{formatCurrency(totals.expectedValue)}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="canvas.700">Counted retail value</Text>
            <Text fontWeight="800">{formatCurrency(totals.actualValue)}</Text>
          </HStack>
          <Button onClick={handlePreviewReconciliation} isDisabled={isLoading || snapshot.length === 0}>
            Preview reconciliation
          </Button>
        </Stack>
      </Box>

      {isPreviewVisible ? (
        <Box
          bg="rgba(255,255,255,0.8)"
          borderRadius="28px"
          p={{ base: 4, md: 5 }}
          border="1px solid"
          borderColor="whiteAlpha.700"
        >
          <Stack spacing={4}>
            <HStack justify="space-between" align="start" flexWrap="wrap">
              <Box>
                <Text fontWeight="800" fontSize="xl">
                  Reconciliation preview
                </Text>
                <Text color="canvas.700">
                  This preview has not saved anything yet.
                </Text>
              </Box>
              <Badge colorScheme="orange" px={3} py={1} borderRadius="full">
                Pending confirmation
              </Badge>
            </HStack>
            <HStack justify="space-between">
              <Text color="canvas.700">Bottles taken</Text>
              <Text fontWeight="800">{reconciliationPreview.unitsTaken}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="canvas.700">Expected revenue</Text>
              <Text fontWeight="800">
                {formatCurrency(reconciliationPreview.expectedRevenue)}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="canvas.700">Capital of sold goods</Text>
              <Text fontWeight="800">
                {formatCurrency(reconciliationPreview.capitalUsed)}
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="canvas.700">Gross profit</Text>
              <Text fontWeight="800">
                {formatCurrency(reconciliationPreview.grossProfit)}
              </Text>
            </HStack>

            <Box
              bg="whiteAlpha.900"
              borderRadius="24px"
              p={4}
              border="1px solid"
              borderColor="blackAlpha.100"
            >
              <Stack spacing={3}>
                <Text fontWeight="700">Product breakdown</Text>
                {reconciliationPreview.items.length === 0 ? (
                  <Text color="canvas.700">
                    No unit movement was detected from this count.
                  </Text>
                ) : (
                  reconciliationPreview.items.map((item) => (
                    <HStack key={item.productId} justify="space-between" align="start">
                      <Box minW={0}>
                        <Text fontWeight="700">{item.productName}</Text>
                        <Text fontSize="sm" color="canvas.700">
                          {item.expectedQuantity} expected, {item.actualQuantity} counted
                        </Text>
                      </Box>
                      <Box textAlign="right" flexShrink={0}>
                        <Text fontWeight="800">{item.unitsTaken} taken</Text>
                        <Text fontSize="sm" color="canvas.700">
                          {formatCurrency(item.expectedRevenue)}
                        </Text>
                      </Box>
                    </HStack>
                  ))
                )}
              </Stack>
            </Box>

            <Alert status="info" borderRadius="24px">
              <AlertIcon />
              <AlertDescription>
                Confirming will create one inventory count and one reconciliation record.
              </AlertDescription>
            </Alert>

            <HStack spacing={3} flexWrap="wrap">
              <Button onClick={() => void handleSaveCount()} isLoading={isSaving}>
                Confirm and save reconciliation
              </Button>
              <Button variant="outline" onClick={() => setIsPreviewVisible(false)}>
                Back to count
              </Button>
            </HStack>
        </Stack>
      </Box>
      ) : null}
    </Stack>
  );
}
