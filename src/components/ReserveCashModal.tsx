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
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { fetchCycleSetAside, reconcileReserveCash, saveCycleSetAsideActual, saveExpense } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, parseNumberInput } from "../lib/format";
import { getDefaultReportDateRange } from "../lib/reportRange";
import { calculateSetAsideShareComparison } from "../lib/setAside";
import type { CycleSetAside, ExpenseCategory, ReserveKind } from "../lib/types";

interface Props {
  isOpen: boolean;
  reserveKind: ReserveKind;
  label: string;
  currentCash: number;
  cycle: CycleSetAside;
  cycleTarget: number | null;
  history: CycleSetAside[];
  locationId: string;
  onClose: () => void;
  onSaved: (cycle?: CycleSetAside, fundBalances?: CycleSetAside["fundBalances"], correctedCashOnHand?: number) => void | Promise<void>;
}

export function ReserveCashModal({ isOpen, reserveKind, label, currentCash, cycle, cycleTarget, history, locationId, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"cycle" | "balance" | "use">("cycle");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(getDefaultReportDateRange().endDate);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("cycle");
    setAmount(String(cyclePhysicalAmount(cycle, reserveKind)));
    setOccurredOn(getDefaultReportDateRange().endDate);
    setNote("");
    setError("");
  }, [currentCash, cycle, isOpen, reserveKind]);

  async function save() {
    const numericAmount = parseNumberInput(amount);
    if (!amount.trim() || numericAmount < 0 || (mode === "use" && numericAmount <= 0)) {
      setError(mode === "use" ? "Enter an amount greater than zero." : "Enter an amount of zero or greater.");
      return;
    }
    if (mode === "use" && !note.trim()) {
      setError("Add a short reason or note.");
      return;
    }
    if (mode === "use" && numericAmount > currentCash) {
      setError(`Only ${formatCurrency(currentCash)} is currently available.`);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      if (mode === "cycle") {
        // Re-read before writing because this endpoint updates the complete
        // actual record. This prevents an old modal snapshot from changing a
        // different reserve when only one reserve is being edited.
        const latestCycle = await fetchCycleSetAside(cycle.cycleId);
        const saved = await saveCycleSetAsideActual(cycleActualInput(latestCycle, reserveKind, amount, note));
        await onSaved(saved);
      } else if (mode === "balance") {
        const funds = await reconcileReserveCash({
          reserveKind,
          cashOnHand: amount,
          note: note.trim() || "Manual physical cash count correction",
        });
        await onSaved(undefined, funds, numericAmount);
      } else {
        await saveExpense({
          locationId,
          incurredOn: occurredOn,
          category: categoryForReserve(reserveKind),
          description: note,
          amount,
          reservePaidFrom: reserveKind,
        });
        await onSaved();
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this reserve.");
    } finally {
      setIsSaving(false);
    }
  }

  const recordedForCycle = cyclePhysicalAmount(cycle, reserveKind);
  const recordedHistory = [...history]
    .filter((item) => item.actualSetAside != null)
    .sort((left, right) => new Date(right.completedAt ?? right.startedAt).getTime() - new Date(left.completedAt ?? left.startedAt).getTime());
  const projectedCash = mode === "cycle"
    ? Math.max(currentCash - recordedForCycle + parseNumberInput(amount), 0)
    : mode === "balance"
      ? parseNumberInput(amount)
      : Math.max(currentCash - parseNumberInput(amount), 0);

  return (
    <Modal isOpen={isOpen} onClose={() => !isSaving && onClose()} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
        <ModalHeader>{label} cash</ModalHeader>
        <ModalCloseButton isDisabled={isSaving} />
        <ModalBody>
          <Stack spacing={4}>
            <Box bg="canvas.50" borderRadius="20px" p={4}>
              <Text color="canvas.700" fontSize="sm">Current cash on hand</Text>
              <Text fontSize="2xl" fontWeight="900" mt={1}>{formatCurrency(currentCash)}</Text>
              <Text color="canvas.700" mt={2}>Cycle #{cycle.cycleNumber} target: {cycleTarget == null ? "Unable to calculate" : formatCurrency(cycleTarget)}</Text>
              <Text color="canvas.700" mt={1}>Recorded from this cycle: {formatCurrency(recordedForCycle)}</Text>
            </Box>
            <HStack spacing={2} overflowX="auto" pb={1}>
              <Button flexShrink={0} variant={mode === "cycle" ? "solid" : "outline"} onClick={() => { setMode("cycle"); setAmount(String(recordedForCycle)); setError(""); }}>This cycle</Button>
              <Button flexShrink={0} variant={mode === "balance" ? "solid" : "outline"} onClick={() => { setMode("balance"); setAmount(currentCash.toFixed(2)); setError(""); }}>Correct cash</Button>
              <Button flexShrink={0} variant={mode === "use" ? "solid" : "outline"} onClick={() => { setMode("use"); setAmount(""); setError(""); }}>Record use</Button>
            </HStack>
            {mode === "use" ? (
              <FormControl isRequired>
                <FormLabel>Date used</FormLabel>
                <Input type="date" value={occurredOn} max={getDefaultReportDateRange().endDate} onChange={(event) => setOccurredOn(event.target.value)} />
              </FormControl>
            ) : null}
            <FormControl isRequired>
              <FormLabel>{mode === "cycle" ? "Cash set aside from this cycle" : mode === "balance" ? "New cash on hand" : "Cash used"}</FormLabel>
              <Input value={amount} inputMode="decimal" placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
              {mode === "cycle" ? <Text color="canvas.700" fontSize="sm" mt={1}>Saving changes this cycle’s recorded amount from {formatCurrency(recordedForCycle)} to {formatCurrency(parseNumberInput(amount))}.</Text> : null}
            </FormControl>
            <FormControl isRequired={mode === "use"}>
              <FormLabel>Reason or note</FormLabel>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={mode === "cycle" ? "Optional note for this cycle" : mode === "balance" ? "Example: Physical cash count correction" : "What was the cash used for?"} />
            </FormControl>
            <Text color="canvas.700">Cash after saving: <strong>{formatCurrency(projectedCash)}</strong></Text>
            {error ? <Text color="caution.500">{error}</Text> : null}
            <Box>
              <Text fontWeight="900">Recorded set-aside history</Text>
              {recordedHistory.length ? (
                <Stack spacing={2} mt={3}>
                  {recordedHistory.map((item) => {
                    const itemTarget = cycleTargetFor(item, reserveKind);
                    return (
                      <HStack key={item.cycleId} justify="space-between" align="start" bg="canvas.50" borderRadius="18px" p={3}>
                        <Box minW={0}>
                          <Text fontWeight="800">Cycle #{item.cycleNumber}</Text>
                          <Text color="canvas.700" fontSize="sm">{formatDateTimeLabel(item.completedAt)}</Text>
                          <Text color="canvas.700" fontSize="sm">Target {itemTarget == null ? "unavailable" : formatCurrency(itemTarget)}</Text>
                        </Box>
                        <Text fontWeight="900" flexShrink={0}>{formatCurrency(cyclePhysicalAmount(item, reserveKind))}</Text>
                      </HStack>
                    );
                  })}
                </Stack>
              ) : <Text color="canvas.700" mt={2}>No recorded set-aside amounts yet.</Text>}
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={onClose} isDisabled={isSaving}>Cancel</Button>
          <Button onClick={() => void save()} isLoading={isSaving}>{mode === "cycle" ? "Add to cash on hand" : mode === "balance" ? "Save cash on hand" : "Record cash used"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function cycleTargetFor(cycle: CycleSetAside, reserveKind: ReserveKind) {
  const targets = calculateSetAsideShareComparison(cycle);
  if (reserveKind === "PURESAFE") return targets.puresafe.target;
  if (reserveKind === "OTHER_PRODUCTS") return targets.otherProducts.target;
  if (reserveKind === "ELECTRICITY") return targets.electricity.target;
  return targets.contingency.target;
}

function cyclePhysicalAmount(cycle: CycleSetAside, reserveKind: ReserveKind) {
  const actual = cycle.actualSetAside;
  if (!actual) return 0;
  if (reserveKind === "PURESAFE") return actual.puresafeCapital;
  if (reserveKind === "OTHER_PRODUCTS") return actual.otherProductsCapital;
  if (reserveKind === "ELECTRICITY") return actual.electricityShare;
  return actual.contingency;
}

function cycleActualInput(cycle: CycleSetAside, reserveKind: ReserveKind, amount: string, note: string) {
  const actual = cycle.actualSetAside;
  return {
    cycleId: cycle.cycleId,
    puresafeCapital: reserveKind === "PURESAFE" ? amount : String(actual?.puresafeCapital ?? 0),
    otherProductsCapital: reserveKind === "OTHER_PRODUCTS" ? amount : String(actual?.otherProductsCapital ?? 0),
    electricityShare: reserveKind === "ELECTRICITY" ? amount : String(actual?.electricityShare ?? 0),
    contingency: reserveKind === "CONTINGENCY" ? amount : String(actual?.contingency ?? 0),
    creditPuresafeCapital: String(actual?.creditPuresafeCapital ?? 0),
    creditOtherProductsCapital: String(actual?.creditOtherProductsCapital ?? 0),
    creditElectricityShare: String(actual?.creditElectricityShare ?? 0),
    creditContingency: String(actual?.creditContingency ?? 0),
    clearedPuresafeCredit: String(actual?.clearedPuresafeCredit ?? 0),
    clearedOtherProductsCredit: String(actual?.clearedOtherProductsCredit ?? 0),
    clearedElectricityCredit: String(actual?.clearedElectricityCredit ?? 0),
    clearedContingencyCredit: String(actual?.clearedContingencyCredit ?? 0),
    toStashCash: String(actual?.toStashCash ?? 0),
    note: note.trim() || actual?.note || undefined,
  };
}

function categoryForReserve(reserveKind: ReserveKind): ExpenseCategory {
  if (reserveKind === "ELECTRICITY") return "Fees";
  if (reserveKind === "PURESAFE" || reserveKind === "OTHER_PRODUCTS") return "Supplies";
  return "Other";
}
