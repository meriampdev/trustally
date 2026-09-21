import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { archiveExpense, fetchExpenses, fetchReportsSnapshot, fetchReportSetAside, saveExpense } from "../lib/api";
import { calculateBreakEven } from "../lib/breakEven";
import { formatCurrency, parseNumberInput } from "../lib/format";
import { getDefaultReportDateRange } from "../lib/reportRange";
import { useCurrentLocation } from "../lib/location";
import type { Expense, ExpenseCategory, ReportSetAside, ReportsSnapshot } from "../lib/types";

const categories: ExpenseCategory[] = ["Setup", "Equipment", "Repairs", "Supplies", "Transport", "Fees", "Other"];
const allTimeStart = "2000-01-01";

interface ExpenseDraft {
  id: string | null;
  incurredOn: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
}

function emptyDraft(): ExpenseDraft {
  return {
    id: null,
    incurredOn: getDefaultReportDateRange().endDate,
    category: "Other",
    description: "",
    amount: "",
  };
}

export default function ExpensesPage() {
  const { currentLocationId } = useCurrentLocation();
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [setAside, setSetAside] = useState<ReportSetAside | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Expense | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [detailView, setDetailView] = useState<"expenses" | "profit" | "gap" | "forecast" | null>(null);
  const today = getDefaultReportDateRange().endDate;

  useEffect(() => {
    if (currentLocationId) void load(currentLocationId);
  }, [currentLocationId]);

  async function load(locationId: string) {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [nextExpenses, nextSnapshot, nextSetAside] = await Promise.all([
        fetchExpenses(locationId),
        fetchReportsSnapshot("custom", allTimeStart, today),
        fetchReportSetAside("custom", allTimeStart, today),
      ]);
      setExpenses(nextExpenses);
      setSnapshot(nextSnapshot);
      setSetAside(nextSetAside);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load expenses and break-even data.");
    } finally {
      setIsLoading(false);
    }
  }

  const breakEven = useMemo(
    () => snapshot && setAside ? calculateBreakEven(expenses, snapshot, setAside, today) : null,
    [expenses, setAside, snapshot, today],
  );

  function openExpenseDraft(expense?: Expense) {
    setDraftError("");
    setDraft(expense ? toDraft(expense) : emptyDraft());
  }

  async function submitExpense() {
    if (!draft || !currentLocationId) return;
    if (!draft.incurredOn || parseNumberInput(draft.amount) <= 0) {
      setDraftError("Enter a valid date and an amount greater than zero.");
      return;
    }
    setIsSaving(true);
    setDraftError("");
    try {
      await saveExpense({
        id: draft.id,
        locationId: currentLocationId,
        incurredOn: draft.incurredOn,
        category: draft.category,
        description: draft.description,
        amount: draft.amount,
      });
      setDraft(null);
      await load(currentLocationId);
      toast({ title: draft.id ? "Expense updated" : "Expense added", status: "success", duration: 2200, position: "top" });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Could not save this expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget || !currentLocationId) return;
    setIsArchiving(true);
    try {
      await archiveExpense(archiveTarget.id);
      setArchiveTarget(null);
      await load(currentLocationId);
      toast({ title: "Expense removed", description: "It was archived and excluded from break-even calculations.", status: "success", duration: 2600, position: "top" });
    } catch (error) {
      toast({ title: "Could not remove expense", description: error instanceof Error ? error.message : "Please try again.", status: "error", duration: 4000, position: "top" });
    } finally {
      setIsArchiving(false);
    }
  }

  if (isLoading || !currentLocationId) return <Spinner color="brand.400" />;
  if (errorMessage || !breakEven) {
    return <SectionCard title="Couldn’t load break-even"><Text color="caution.600">{errorMessage}</Text><Button mt={4} onClick={() => void load(currentLocationId)}>Try again</Button></SectionCard>;
  }

  const hasExpenses = breakEven.totalExpenses > 0;
  const isBreakEven = hasExpenses && breakEven.balance != null && breakEven.balance >= 0;
  const statusTitle = !hasExpenses
    ? "Add your first expense"
    : isBreakEven
      ? breakEven.reachedBreakEvenDate ? `Broke even on ${formatDate(breakEven.reachedBreakEvenDate)}` : "Break-even reached"
      : breakEven.projectedBreakEvenDate
        ? `Projected ${formatDate(breakEven.projectedBreakEvenDate)}`
        : "Projection needs positive profit history";

  return (
    <Stack spacing={5} width="100%" minWidth={0}>
      <SectionCard eyebrow="Break-even" title={statusTitle}>
        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Other operating expenses" value={formatCurrency(breakEven.totalExpenses)} hint="Restock purchases are recognized through COGS" onClick={() => setDetailView("expenses")} />
          <MetricCard label="Net operating profit" value={breakEven.netOperatingProfit == null ? "Unable to calculate" : formatCurrency(breakEven.netOperatingProfit)} hint="Payments less target product capital and electricity" onClick={() => setDetailView("profit")} />
          <MetricCard label={isBreakEven ? "Ahead by" : "Remaining"} value={breakEven.balance == null ? "Unable to calculate" : formatCurrency(isBreakEven ? breakEven.balance : breakEven.remainingToBreakEven)} hint="View break-even calculation" onClick={() => setDetailView("gap")} />
          <MetricCard label="Average operating profit / day" value={breakEven.averageDailyOperatingProfit == null ? "Not enough data" : formatCurrency(breakEven.averageDailyOperatingProfit)} hint="View forecast method" onClick={() => setDetailView("forecast")} />
        </SimpleGrid>
        {hasExpenses && breakEven.progress != null ? (
          <Box mt={5}>
            <HStack justify="space-between" mb={2}><Text fontWeight="800">Break-even progress</Text><Text>{breakEven.progress.toFixed(1)}%</Text></HStack>
            <Progress value={breakEven.progress} colorScheme="cyan" borderRadius="full" bg="canvas.50" />
          </Box>
        ) : <Text color="canvas.700" mt={4}>Record startup, equipment, repair, supply, transport, fee, or other expenses to begin tracking break-even.</Text>}
      </SectionCard>

      <SectionCard eyebrow="Expenses" title="Recorded costs">
        <Button onClick={() => openExpenseDraft()}>Add expense</Button>
        {expenses.length ? (
          <Stack spacing={3} mt={4}>
            {expenses.map((expense) => (
              <Box key={expense.id} bg="canvas.50" borderRadius="20px" p={4}>
                <HStack justify="space-between" align="start" spacing={4}>
                  <Box minWidth={0}>
                    <Text fontWeight="900">{expense.description || expense.category}</Text>
                    <Text color="canvas.700" mt={1}>{expense.category} · {formatDate(expense.incurredOn)}{expense.affectsInventoryCost ? " · Automatic restock purchase" : ""}</Text>
                  </Box>
                  <Text fontWeight="900" flexShrink={0}>{formatCurrency(expense.amount)}</Text>
                </HStack>
                {!expense.affectsInventoryCost ? <HStack mt={3} spacing={2}>
                  <Button size="sm" variant="outline" onClick={() => openExpenseDraft(expense)}>Edit</Button>
                  <Button size="sm" variant="ghost" color="caution.400" onClick={() => setArchiveTarget(expense)}>Remove</Button>
                </HStack> : <Text mt={3} fontSize="sm" color="canvas.700">Edit this purchase from Restock history.</Text>}
              </Box>
            ))}
          </Stack>
        ) : null}
      </SectionCard>

      <Modal isOpen={draft !== null} onClose={() => !isSaving && setDraft(null)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{draft?.id ? "Edit expense" : "Add expense"}</ModalHeader><ModalCloseButton />
          <ModalBody><Stack spacing={4}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
              <FormControl isRequired><FormLabel>Date</FormLabel><Input type="date" value={draft?.incurredOn ?? ""} max={today} onChange={(event) => setDraft((value) => value ? { ...value, incurredOn: event.target.value } : value)} /></FormControl>
              <FormControl isRequired><FormLabel>Category</FormLabel><Select value={draft?.category ?? "Other"} onChange={(event) => setDraft((value) => value ? { ...value, category: event.target.value as ExpenseCategory } : value)}>{categories.map((category) => <option key={category}>{category}</option>)}</Select></FormControl>
            </SimpleGrid>
            <FormControl isRequired><FormLabel>Amount</FormLabel><Input value={draft?.amount ?? ""} inputMode="decimal" placeholder="0.00" onChange={(event) => setDraft((value) => value ? { ...value, amount: event.target.value } : value)} /></FormControl>
            <FormControl><FormLabel>Description</FormLabel><Textarea value={draft?.description ?? ""} placeholder="What was this expense for?" onChange={(event) => setDraft((value) => value ? { ...value, description: event.target.value } : value)} /></FormControl>
            {draftError ? <Text color="caution.600">{draftError}</Text> : null}
          </Stack></ModalBody>
          <ModalFooter gap={3}><Button variant="outline" onClick={() => setDraft(null)} isDisabled={isSaving}>Cancel</Button><Button onClick={() => void submitExpense()} isLoading={isSaving}>Save expense</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={archiveTarget !== null} onClose={() => !isArchiving && setArchiveTarget(null)} isCentered>
        <ModalOverlay bg="blackAlpha.700" /><ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>Remove expense?</ModalHeader><ModalCloseButton /><ModalBody><Text>This removes {formatCurrency(archiveTarget?.amount)} from break-even calculations. The record will be archived.</Text></ModalBody>
          <ModalFooter gap={3}><Button variant="outline" onClick={() => setArchiveTarget(null)} isDisabled={isArchiving}>Cancel</Button><Button colorScheme="red" onClick={() => void confirmArchive()} isLoading={isArchiving}>Remove</Button></ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={detailView !== null} onClose={() => setDetailView(null)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" /><ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>{detailTitle(detailView)}</ModalHeader><ModalCloseButton /><ModalBody><BreakEvenDetail view={detailView} result={breakEven} /></ModalBody>
          <ModalFooter><Button onClick={() => setDetailView(null)}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}

function BreakEvenDetail({ view, result }: { view: "expenses" | "profit" | "gap" | "forecast" | null; result: ReturnType<typeof calculateBreakEven> }) {
  if (view === "expenses") return <Stack spacing={3}>{result.categoryTotals.length ? result.categoryTotals.map((item) => <HStack key={item.category} justify="space-between"><Text>{item.category}</Text><Text fontWeight="900">{formatCurrency(item.amount)}</Text></HStack>) : <Text color="canvas.700">No expenses recorded yet.</Text>}</Stack>;
  if (view === "profit") return <Text color="canvas.700">Net operating profit is actual recorded payments minus target Puresafe capital, other-products capital, and electricity reserves: <strong>{result.netOperatingProfit == null ? "Unable to calculate" : formatCurrency(result.netOperatingProfit)}</strong>.</Text>;
  if (view === "gap") return <Stack spacing={2}><Text>Other operating expenses: {formatCurrency(result.totalExpenses)}</Text><Text>Net operating profit: {result.netOperatingProfit == null ? "Unable to calculate" : formatCurrency(result.netOperatingProfit)}</Text><Text fontWeight="900">Remaining: {result.remainingToBreakEven == null ? "Unable to calculate" : formatCurrency(result.remainingToBreakEven)}</Text></Stack>;
  return <Stack spacing={2}><Text>Average operating profit per day: {result.averageDailyOperatingProfit == null ? "Not enough positive history" : formatCurrency(result.averageDailyOperatingProfit)}</Text><Text color="canvas.700">The projection extends the observed average daily operating profit from all completed cycles. It updates whenever expenses, payments, or reserve costs change.</Text>{result.projectedBreakEvenDate ? <Text fontWeight="900">Projected break-even: {formatDate(result.projectedBreakEvenDate)}</Text> : null}</Stack>;
}

function detailTitle(view: string | null) {
  if (view === "expenses") return "Expense breakdown";
  if (view === "profit") return "Net operating profit";
  if (view === "gap") return "Break-even calculation";
  return "Break-even forecast";
}

function toDraft(expense: Expense): ExpenseDraft {
  return { id: expense.id, incurredOn: expense.incurredOn, category: expense.category, description: expense.description ?? "", amount: expense.amount.toFixed(2) };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${value.slice(0, 10)}T12:00:00+08:00`));
}
