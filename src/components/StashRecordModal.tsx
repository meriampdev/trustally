import {
  Box,
  Button,
  FormControl,
  FormLabel,
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
import { useEffect, useMemo, useState } from "react";
import { saveCycleSetAsideActual } from "../lib/api";
import { formatCurrency, formatDateTimeLabel, parseNumberInput } from "../lib/format";
import { calculateSetAsideShareComparison } from "../lib/setAside";
import type { CycleSetAside } from "../lib/types";

interface Props {
  isOpen: boolean;
  cycle: CycleSetAside;
  history: CycleSetAside[];
  onClose: () => void;
  onSaved: (cycle: CycleSetAside) => void;
}

export function StashRecordModal({ isOpen, cycle, history, onClose, onSaved }: Props) {
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCash(cycle.actualSetAside ? String(cycle.actualSetAside.toStashCash) : "");
    setNote(cycle.actualSetAside?.note ?? "");
    setError("");
  }, [cycle, isOpen]);

  const actual = cycle.actualSetAside;
  const target = calculateSetAsideShareComparison(cycle).toStash;
  const reservePhysical = useMemo(() => actual
    ? actual.puresafeCapital
      + actual.otherProductsCapital
      + actual.electricityShare
      + actual.contingency
      + (actual.clearedPuresafeCredit ?? 0)
      + (actual.clearedOtherProductsCredit ?? 0)
      + (actual.clearedElectricityCredit ?? 0)
      + (actual.clearedContingencyCredit ?? 0)
    : 0, [actual]);
  const onlineToStash = actual?.onlineToStash ?? cycle.onlineToStash ?? 0;
  const availableForStash = Math.max(cycle.cashAvailableAfterChangeFloat - reservePhysical, 0);
  const recordedHistory = [...history]
    .filter((item) => item.actualSetAside != null)
    .sort((left, right) => new Date(right.completedAt ?? right.startedAt).getTime() - new Date(left.completedAt ?? left.startedAt).getTime());

  async function save() {
    const amount = parseNumberInput(cash);
    if (!cash.trim() || amount < 0) {
      setError("Enter a cash amount of zero or greater.");
      return;
    }
    if (amount > availableForStash + 0.001) {
      setError(`Only ${formatCurrency(availableForStash)} remains after the recorded reserve allocations.`);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const saved = await saveCycleSetAsideActual({
        cycleId: cycle.cycleId,
        puresafeCapital: String(actual?.puresafeCapital ?? 0),
        otherProductsCapital: String(actual?.otherProductsCapital ?? 0),
        electricityShare: String(actual?.electricityShare ?? 0),
        contingency: String(actual?.contingency ?? 0),
        creditPuresafeCapital: String(actual?.creditPuresafeCapital ?? 0),
        creditOtherProductsCapital: String(actual?.creditOtherProductsCapital ?? 0),
        creditElectricityShare: String(actual?.creditElectricityShare ?? 0),
        creditContingency: String(actual?.creditContingency ?? 0),
        clearedPuresafeCredit: String(actual?.clearedPuresafeCredit ?? 0),
        clearedOtherProductsCredit: String(actual?.clearedOtherProductsCredit ?? 0),
        clearedElectricityCredit: String(actual?.clearedElectricityCredit ?? 0),
        clearedContingencyCredit: String(actual?.clearedContingencyCredit ?? 0),
        toStashCash: cash,
        note,
      });
      onSaved(saved);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record To Stash.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !isSaving && onClose()} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
        <ModalHeader>Record To Stash</ModalHeader>
        <ModalCloseButton isDisabled={isSaving} />
        <ModalBody>
          <Stack spacing={4}>
            <Box bg="canvas.50" borderRadius="20px" p={4}>
              <Text fontWeight="900">Cycle #{cycle.cycleNumber}</Text>
              <Text color="canvas.700" mt={1}>Cash target for this cycle: {target.cashAfterReserves == null ? "Unable to calculate" : formatCurrency(target.cashAfterReserves)}</Text>
              <Text color="canvas.700" mt={1}>Cash already recorded: {formatCurrency(actual?.toStashCash ?? 0)}</Text>
              <Text>Cash available: <strong>{formatCurrency(availableForStash)}</strong></Text>
              <Text color="canvas.700" mt={1}>Online going to Stash: {formatCurrency(onlineToStash)}</Text>
            </Box>
            <FormControl isRequired>
              <FormLabel>Cash set aside from this cycle</FormLabel>
              <Input value={cash} inputMode="decimal" placeholder="0.00" onChange={(event) => setCash(event.target.value)} />
              <Text color="canvas.700" fontSize="sm" mt={1}>Saving changes this cycle’s recorded cash from {formatCurrency(actual?.toStashCash ?? 0)} to {formatCurrency(parseNumberInput(cash))}.</Text>
            </FormControl>
            <FormControl>
              <FormLabel>Note</FormLabel>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Where the cash was placed" />
            </FormControl>
            <Text>Total To Stash: <strong>{formatCurrency(parseNumberInput(cash) + onlineToStash)}</strong></Text>
            {error ? <Text color="caution.500">{error}</Text> : null}
            <Box>
              <Text fontWeight="900">Recorded To Stash history</Text>
              {recordedHistory.length ? (
                <Stack spacing={2} mt={3}>
                  {recordedHistory.map((item) => (
                    <Box key={item.cycleId} bg="canvas.50" borderRadius="18px" p={3}>
                      <Text fontWeight="800">Cycle #{item.cycleNumber}</Text>
                      <Text color="canvas.700" fontSize="sm">{formatDateTimeLabel(item.completedAt)}</Text>
                      <Text color="canvas.700" fontSize="sm">Cash {formatCurrency(item.actualSetAside?.toStashCash ?? 0)} · Online {formatCurrency(item.actualSetAside?.onlineToStash ?? item.onlineToStash ?? 0)}</Text>
                      <Text fontWeight="900" mt={1}>{formatCurrency(item.actualSetAside?.toStashTotal ?? 0)} total</Text>
                    </Box>
                  ))}
                </Stack>
              ) : <Text color="canvas.700" mt={2}>No recorded To Stash amounts yet.</Text>}
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={onClose} isDisabled={isSaving}>Cancel</Button>
          <Button onClick={() => void save()} isLoading={isSaving}>Add to To Stash</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
