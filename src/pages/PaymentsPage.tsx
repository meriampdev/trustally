import {
  Box,
  Button,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { fetchOutstandingBalances, recordPaymentReceipt } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, parseNumberInput } from "../lib/format";
import { PayLaterBalance } from "../lib/types";

type PaymentFor = "CURRENT" | "PREVIOUS" | "MULTIPLE" | "NOT_SURE";

export default function PaymentsPage() {
  const toast = useToast();
  const [balances, setBalances] = useState<PayLaterBalance[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("GCASH");
  const [paymentFor, setPaymentFor] = useState<PaymentFor>("PREVIOUS");
  const [receivedAt, setReceivedAt] = useState(defaultDateTimeLocal());
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selectedBalanceId, setSelectedBalanceId] = useState<string | null>(null);
  const [useAutoAllocate, setUseAutoAllocate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((sum, value) => sum + parseNumberInput(value), 0),
    [allocations],
  );

  async function load() {
    setIsLoading(true);
    try {
      setBalances(await fetchOutstandingBalances());
    } finally {
      setIsLoading(false);
    }
  }

  function handleAutoAllocate() {
    const remainingByBalance: Record<string, string> = {};
    let remainingAmount = parseNumberInput(amount);

    balances.forEach((balance) => {
      if (remainingAmount <= 0) {
        remainingByBalance[balance.id] = "";
        return;
      }

      const allocation = Math.min(balance.remainingAmount, remainingAmount);
      remainingByBalance[balance.id] = allocation > 0 ? allocation.toFixed(2) : "";
      remainingAmount -= allocation;
    });

    setAllocations(remainingByBalance);
    setUseAutoAllocate(true);
  }

  function focusBalancePayment(balance: PayLaterBalance) {
    setPaymentFor("PREVIOUS");
    setAmount(balance.remainingAmount.toFixed(2));
    setAllocations({ [balance.id]: balance.remainingAmount.toFixed(2) });
    setSelectedBalanceId(balance.id);
    setUseAutoAllocate(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setAllocationForBalance(balance: PayLaterBalance, nextAmount: string) {
    setAllocations({ [balance.id]: nextAmount });
    setSelectedBalanceId(balance.id);
    setPaymentFor("PREVIOUS");
    setUseAutoAllocate(false);
  }

  async function handleSubmit() {
    setIsSaving(true);
    try {
      await recordPaymentReceipt({
        amount,
        method,
        receivedAt: new Date(receivedAt).toISOString(),
        paymentTiming:
          paymentFor === "NOT_SURE"
            ? "UNASSIGNED"
            : paymentFor === "CURRENT"
              ? "CURRENT"
              : "DELAYED",
        note,
        allocations:
          paymentFor === "PREVIOUS" || paymentFor === "MULTIPLE"
            ? balances
                .map((balance) => ({
                  payLaterBalanceId: balance.id,
                  amount: allocations[balance.id] ?? "",
                }))
                .filter((allocation) => parseNumberInput(allocation.amount) > 0)
            : [],
        autoAllocateOldest:
          (paymentFor === "PREVIOUS" || paymentFor === "MULTIPLE") && useAutoAllocate,
      });

      setAmount("");
      setNote("");
      setAllocations({});
      setSelectedBalanceId(null);
      setUseAutoAllocate(false);
      await load();

      toast({
        title: "Payment recorded",
        description: "Trustally updated the late-payment balances and settlement totals.",
        status: "success",
        duration: 2800,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not record payment",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Record payment" title="Add a delayed, bulk, or unassigned payment">
        <Box ref={formRef} />
        <Text color="canvas.700">
          Use this for late GCash, Maya, or cash payments that arrive after the bottles were taken.
        </Text>
        {selectedBalanceId ? (
          <Box mt={4} borderRadius="24px" bg="canvas.50" p={4}>
            <Text fontWeight="800">Paying a specific balance</Text>
            <Text color="canvas.700" mt={1}>
              This payment is currently targeted to one open pay-later record. You can still edit the amount before saving.
            </Text>
          </Box>
        ) : null}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
          <FormField label="Amount">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="500" />
          </FormField>
          <FormField label="Method">
            <Select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
              <option value="BANK">Bank</option>
              <option value="OTHER">Other</option>
            </Select>
          </FormField>
          <FormField label="Payment for">
            <Select
              value={paymentFor}
              onChange={(event) => {
                setPaymentFor(event.target.value as PaymentFor);
                setUseAutoAllocate(false);
              }}
            >
              <option value="CURRENT">Current box cycle</option>
              <option value="PREVIOUS">Previous pay-later balance</option>
              <option value="MULTIPLE">Multiple balances</option>
              <option value="NOT_SURE">Not sure</option>
            </Select>
          </FormField>
          <FormField label="Received at">
            <Input type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
          </FormField>
        </SimpleGrid>
        <Box mt={4}>
          <FormField label="Note">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="late honesty box payment" />
          </FormField>
        </Box>

        {paymentFor === "PREVIOUS" || paymentFor === "MULTIPLE" ? (
          <SectionCard mt={5} bg="canvas.50" borderColor="transparent" shadow="none" title="Open pay-later balances">
            <HStack mb={4} spacing={3} flexWrap="wrap">
              <Button variant="outline" onClick={handleAutoAllocate}>
                Auto-allocate oldest first
              </Button>
              <Text color="canvas.700">
                Total allocated {formatCurrency(totalAllocated)}
              </Text>
            </HStack>
            <Stack spacing={3}>
              {balances.length ? (
                balances.map((balance) => (
                  <Box key={balance.id} borderRadius="24px" bg="white" p={4}>
                    <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} alignItems="center">
                      <Box>
                        <Text fontWeight="800">
                          {balance.customerLabel?.trim() || balance.cycleLabel}
                        </Text>
                        <Text color="canvas.700" mt={1}>
                          Remaining {formatCurrency(balance.remainingAmount)}
                        </Text>
                        {balance.itemsSummary?.trim() ? (
                          <Text color="canvas.700" mt={1}>
                            Items: {balance.itemsSummary}
                          </Text>
                        ) : null}
                      </Box>
                      <Text color="canvas.700">
                        {balance.dueDate ? `Due ${formatDateTimeLabel(balance.dueDate)}` : balance.cycleLabel}
                      </Text>
                      <Text color="canvas.700">Paid so far {formatCurrency(balance.amountPaid)}</Text>
                      <Input
                        value={allocations[balance.id] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (selectedBalanceId === balance.id) {
                            setAmount(nextValue);
                            setAllocationForBalance(balance, nextValue);
                            return;
                          }

                          setAllocations((current) => ({
                            ...current,
                            [balance.id]: nextValue,
                          }));
                          setSelectedBalanceId(null);
                          setUseAutoAllocate(false);
                        }}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </SimpleGrid>
                  </Box>
                ))
              ) : (
                <Text color="canvas.700">No open balances right now.</Text>
              )}
            </Stack>
          </SectionCard>
        ) : null}

        <Button mt={5} onClick={() => void handleSubmit()} isLoading={isSaving}>
          Record payment
        </Button>
      </SectionCard>

      <SectionCard eyebrow="Outstanding" title="Current open balances">
        {isLoading ? (
          <Spinner color="brand.400" />
        ) : balances.length ? (
          <Stack spacing={3}>
            {balances.map((balance) => (
              <Box key={balance.id} borderRadius="24px" bg="canvas.50" p={4}>
                <Text fontWeight="800">{balance.customerLabel?.trim() || balance.cycleLabel}</Text>
                <Text color="canvas.700" mt={1}>
                  Remaining {formatCurrency(balance.remainingAmount)} of {formatCurrency(balance.originalAmount)}
                </Text>
                {balance.itemsSummary?.trim() ? (
                  <Text color="canvas.700" mt={2}>
                    Items: {balance.itemsSummary}
                  </Text>
                ) : null}
                <Text mt={2}>
                  {balance.note || balance.cycleLabel}
                </Text>
                <HStack mt={4} spacing={3} flexWrap="wrap">
                  <Button size="sm" onClick={() => focusBalancePayment(balance)}>
                    Record payment for this
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      focusBalancePayment(balance);
                      setNote(
                        balance.customerLabel?.trim()
                          ? `Payment for ${balance.customerLabel}`
                          : note,
                      );
                    }}
                  >
                    Mark paid in full
                  </Button>
                </HStack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text color="canvas.700">No outstanding pay-later balances right now.</Text>
        )}
      </SectionCard>
    </Stack>
  );
}

function defaultDateTimeLocal() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <FormLabel mb={2} fontSize="sm" fontWeight="700" color="canvas.700">
        {label}
      </FormLabel>
      {children}
    </Box>
  );
}
