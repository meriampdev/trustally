import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchReconciliationById,
  getErrorMessage,
  updateReconciliationStatus,
} from "../lib/api";
import { formatCurrency, formatPercent } from "../lib/format";
import { ReconciliationSummary } from "../lib/types";

export default function ReconciliationPage() {
  const { reconciliationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!reconciliationId) {
      return;
    }

    void loadReconciliation(reconciliationId);
  }, [reconciliationId]);

  async function loadReconciliation(id: string) {
    setIsLoading(true);

    try {
      const nextReconciliation = await fetchReconciliationById(id);
      setReconciliation(nextReconciliation);
      setNotes(nextReconciliation.notes ?? "");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(status: ReconciliationSummary["status"]) {
    if (!reconciliation) {
      return;
    }

    setIsSaving(true);

    try {
      await updateReconciliationStatus(reconciliation.id, status, notes || undefined);
      setReconciliation((current) =>
        current
          ? {
              ...current,
              status,
              notes,
            }
          : current,
      );
      toast({
        title: status === "reconciled" ? "Reconciliation confirmed" : "Marked for investigation",
        description:
          status === "reconciled"
            ? "This period is now closed."
            : "The difference remains visible until you resolve it.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      if (status === "reconciled") {
        navigate("/");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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

      {isLoading || !reconciliation ? (
        <Skeleton height="400px" borderRadius="28px" />
      ) : (
        <>
          <Box
            bg="rgba(255,255,255,0.8)"
            borderRadius="28px"
            p={{ base: 4, md: 5 }}
            border="1px solid"
            borderColor="whiteAlpha.700"
          >
            <Stack spacing={4}>
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={1}>
                  <Text fontWeight="800" fontSize="2xl">
                    {reconciliation.startDate} to {reconciliation.endDate}
                  </Text>
                  <Badge colorScheme={statusColorScheme[reconciliation.status]}>
                    {reconciliation.status.toUpperCase()}
                  </Badge>
                </VStack>
                <VStack align="end" spacing={1}>
                  <Text fontWeight="800" fontSize="3xl">
                    {formatPercent(reconciliation.collectionRate)}
                  </Text>
                  <Text color="canvas.700">Collection rate</Text>
                </VStack>
              </HStack>
              <HStack justify="space-between">
                <Text color="canvas.700">Bottles taken</Text>
                <Text fontWeight="800">{reconciliation.unitsSold}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="canvas.700">Expected</Text>
                <Text fontWeight="800">{formatCurrency(reconciliation.expectedRevenue)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="canvas.700">Collected</Text>
                <Text fontWeight="800">{formatCurrency(reconciliation.paymentsReceived)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="canvas.700">Difference</Text>
                <Text
                  fontWeight="800"
                  color={
                    reconciliation.shortageOrOverage >= 0
                      ? "deposit.700"
                      : "withdrawal.700"
                  }
                >
                  {formatCurrency(reconciliation.shortageOrOverage)}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="canvas.700">Gross profit</Text>
                <Text fontWeight="800">{formatCurrency(reconciliation.grossProfit)}</Text>
              </HStack>
            </Stack>
          </Box>

          <Box
            bg="whiteAlpha.900"
            borderRadius="28px"
            p={{ base: 4, md: 5 }}
            border="1px solid"
            borderColor="blackAlpha.100"
          >
            <Text fontWeight="800" fontSize="xl" mb={4}>
              Product breakdown
            </Text>
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Product</Th>
                    <Th isNumeric>Taken</Th>
                    <Th isNumeric>Expected</Th>
                    <Th isNumeric>Capital</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {reconciliation.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.productName}</Td>
                      <Td isNumeric>{item.unitsSold}</Td>
                      <Td isNumeric>{formatCurrency(item.expectedRevenue)}</Td>
                      <Td isNumeric>{formatCurrency(item.capitalUsed)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>

          <Box
            bg="whiteAlpha.900"
            borderRadius="28px"
            p={{ base: 4, md: 5 }}
            border="1px solid"
            borderColor="blackAlpha.100"
          >
            <Text fontWeight="800" fontSize="xl" mb={4}>
              Payment breakdown
            </Text>
            <Stack spacing={3}>
              {reconciliation.paymentBreakdown.map((item) => (
                <HStack key={item.method} justify="space-between">
                  <Text color="canvas.700">{item.method.toUpperCase()}</Text>
                  <Text fontWeight="800">
                    {formatCurrency(item.amount)} • {formatPercent(item.share)}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </Box>

          <Box
            bg="rgba(255,255,255,0.8)"
            borderRadius="28px"
            p={{ base: 4, md: 5 }}
            border="1px solid"
            borderColor="whiteAlpha.700"
          >
            <Stack spacing={4}>
              <Text fontWeight="800" fontSize="xl">
                Investigation notes
              </Text>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Document unpaid bottles, double entries, owner use, or other findings."
                borderColor="black"
                color="black"
                _placeholder={{ color: "black", opacity: 1 }}
              />
              <HStack spacing={3} wrap="wrap">
                <Button
                  onClick={() => void handleStatusChange("reconciled")}
                  isLoading={isSaving}
                >
                  Confirm reconciliation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleStatusChange("flagged")}
                  isLoading={isSaving}
                >
                  Investigate difference
                </Button>
              </HStack>
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
}

const statusColorScheme: Record<ReconciliationSummary["status"], string> = {
  open: "orange",
  reconciled: "green",
  flagged: "red",
};
