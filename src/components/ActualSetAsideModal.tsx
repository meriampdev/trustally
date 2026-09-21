import {
  Box, Button, FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Stack, Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { saveCycleSetAsideActual } from "../lib/api";
import { formatCurrency, parseNumberInput } from "../lib/format";
import { calculateSetAsideShareComparison } from "../lib/setAside";
import type { CycleSetAside } from "../lib/types";

interface Props {
  isOpen: boolean;
  cycle: CycleSetAside;
  onClose: () => void;
  onSaved: (cycle: CycleSetAside) => void;
}

export function ActualSetAsideModal({ isOpen, cycle, onClose, onSaved }: Props) {
  const [puresafe, setPuresafe] = useState("");
  const [otherProducts, setOtherProducts] = useState("");
  const [electricity, setElectricity] = useState("");
  const [toStashCash, setToStashCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const targets = calculateSetAsideShareComparison(cycle);

  useEffect(() => {
    if (!isOpen) return;
    const actual = cycle.actualSetAside;
    setPuresafe(actual ? String(actual.puresafeCapital) : "");
    setOtherProducts(actual ? String(actual.otherProductsCapital) : "");
    setElectricity(actual ? String(actual.electricityShare) : "");
    setToStashCash(actual ? String(actual.toStashCash) : "");
    setNote(actual?.note ?? "");
    setError("");
  }, [cycle, isOpen]);

  const physicalTotal = useMemo(() => [puresafe, otherProducts, electricity, toStashCash]
    .reduce((sum, value) => sum + parseNumberInput(value), 0), [puresafe, otherProducts, electricity, toStashCash]);
  const remainingCash = cycle.cashAvailableAfterChangeFloat - physicalTotal;
  const allEntered = [puresafe, otherProducts, electricity, toStashCash].every((value) => value.trim() !== "");
  const allValid = [puresafe, otherProducts, electricity, toStashCash].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0);

  async function save() {
    if (!allEntered) { setError("Enter every physical-cash amount. Use 0 when no cash was placed in a share."); return; }
    if (!allValid) { setError("Enter valid amounts of zero or greater."); return; }
    if (physicalTotal > cycle.cashAvailableAfterChangeFloat + 0.001) { setError("The total cannot exceed the physical cash available after Change Float."); return; }
    setIsSaving(true); setError("");
    try {
      const saved = await saveCycleSetAsideActual({ cycleId: cycle.cycleId, puresafeCapital: puresafe, otherProductsCapital: otherProducts, electricityShare: electricity, toStashCash, note });
      onSaved(saved); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the actual set aside."); }
    finally { setIsSaving(false); }
  }

  return <Modal isOpen={isOpen} onClose={() => !isSaving && onClose()} isCentered size="xl" scrollBehavior="inside">
    <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)"/>
    <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
      <ModalHeader>{cycle.actualSetAside ? "Correct actual set aside" : "Record actual set aside"}</ModalHeader><ModalCloseButton isDisabled={isSaving}/>
      <ModalBody><Stack spacing={4}>
        <Box bg="canvas.50" borderRadius="20px" p={4}>
          <Text fontWeight="900">Cycle #{cycle.cycleNumber}</Text>
          <Text color="canvas.700" mt={1}>Physical cash available after Change Float: {formatCurrency(cycle.cashAvailableAfterChangeFloat)}</Text>
          <Text color="canvas.700" mt={1}>Online payments are not editable here. {formatCurrency(cycle.availableOnlinePayments)} goes entirely to Stash.</Text>
        </Box>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <AmountField label="Puresafe Capital" target={targets.puresafe.target} value={puresafe} onChange={setPuresafe}/>
          <AmountField label="Other Products Capital" target={targets.otherProducts.target} value={otherProducts} onChange={setOtherProducts}/>
          <AmountField label="Electricity Share" target={targets.electricity.target} value={electricity} onChange={setElectricity}/>
          <AmountField label="To Stash — physical cash" target={targets.toStash.cashAfterReserves} value={toStashCash} onChange={setToStashCash}/>
        </SimpleGrid>
        <Box bg="canvas.50" borderRadius="20px" p={4}>
          <Text>Physical cash recorded: <strong>{formatCurrency(physicalTotal)}</strong></Text>
          <Text color={remainingCash < 0 ? "caution.500" : "canvas.700"} mt={1}>Cash not allocated: {formatCurrency(Math.max(remainingCash, 0))}</Text>
          <Text color="canvas.700" mt={1}>Total going to Stash: {formatCurrency(parseNumberInput(toStashCash) + cycle.availableOnlinePayments)} ({formatCurrency(parseNumberInput(toStashCash))} cash + {formatCurrency(cycle.availableOnlinePayments)} online)</Text>
        </Box>
        <FormControl><FormLabel>Note (optional)</FormLabel><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Where the cash was placed or any correction details"/></FormControl>
        {error ? <Text color="caution.500">{error}</Text> : null}
      </Stack></ModalBody>
      <ModalFooter gap={3}><Button variant="outline" onClick={onClose} isDisabled={isSaving}>Cancel</Button><Button onClick={() => void save()} isLoading={isSaving}>Save actual set aside</Button></ModalFooter>
    </ModalContent>
  </Modal>;
}

function AmountField({ label, target, value, onChange }: { label: string; target: number | null; value: string; onChange: (value: string) => void }) {
  return <FormControl isRequired><FormLabel>{label}</FormLabel><Input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0.00"/><Text color="canvas.700" fontSize="sm" mt={1}>Target: {target == null ? "Unable to calculate" : formatCurrency(target)}</Text></FormControl>;
}
