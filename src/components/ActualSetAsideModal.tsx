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
  const [contingency, setContingency] = useState("");
  const [creditPuresafe, setCreditPuresafe] = useState("");
  const [creditOther, setCreditOther] = useState("");
  const [creditElectricity, setCreditElectricity] = useState("");
  const [creditContingency, setCreditContingency] = useState("");
  const [clearPuresafe, setClearPuresafe] = useState("");
  const [clearOther, setClearOther] = useState("");
  const [clearElectricity, setClearElectricity] = useState("");
  const [clearContingency, setClearContingency] = useState("");
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
    setContingency(actual ? String(actual.contingency ?? 0) : "");
    setCreditPuresafe(actual ? String(actual.creditPuresafeCapital ?? 0) : "0");
    setCreditOther(actual ? String(actual.creditOtherProductsCapital ?? 0) : "0");
    setCreditElectricity(actual ? String(actual.creditElectricityShare ?? 0) : "0");
    setCreditContingency(actual ? String(actual.creditContingency ?? 0) : "0");
    setClearPuresafe(actual ? String(actual.clearedPuresafeCredit ?? 0) : "0");
    setClearOther(actual ? String(actual.clearedOtherProductsCredit ?? 0) : "0");
    setClearElectricity(actual ? String(actual.clearedElectricityCredit ?? 0) : "0");
    setClearContingency(actual ? String(actual.clearedContingencyCredit ?? 0) : "0");
    setToStashCash(actual ? String(actual.toStashCash) : "");
    setNote(actual?.note ?? "");
    setError("");
  }, [cycle, isOpen]);

  const physicalTotal = useMemo(() => [puresafe, otherProducts, electricity, contingency, clearPuresafe, clearOther, clearElectricity, clearContingency, toStashCash]
    .reduce((sum, value) => sum + parseNumberInput(value), 0), [puresafe, otherProducts, electricity, contingency, clearPuresafe, clearOther, clearElectricity, clearContingency, toStashCash]);
  const creditTotal = useMemo(() => [creditPuresafe, creditOther, creditElectricity, creditContingency].reduce((sum, value) => sum + parseNumberInput(value), 0), [creditPuresafe, creditOther, creditElectricity, creditContingency]);
  const actualOnlineToStash = (cycle.gcashPayments ?? 0) + (cycle.otherOnlinePayments ?? 0) + Math.max((cycle.eligibleOnlineReservePayments ?? 0) - creditTotal, 0);
  const remainingCash = cycle.cashAvailableAfterChangeFloat - physicalTotal;
  const allAmounts = [puresafe, otherProducts, electricity, contingency, creditPuresafe, creditOther, creditElectricity, creditContingency, clearPuresafe, clearOther, clearElectricity, clearContingency, toStashCash];
  const allEntered = allAmounts.every((value) => value.trim() !== "");
  const allValid = allAmounts.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0);

  async function save() {
    if (!allEntered) { setError("Enter every physical-cash amount. Use 0 when no cash was placed in a share."); return; }
    if (!allValid) { setError("Enter valid amounts of zero or greater."); return; }
    if (physicalTotal > cycle.cashAvailableAfterChangeFloat + 0.001) { setError("The total cannot exceed the physical cash available after Change Float."); return; }
    if (creditTotal > (cycle.eligibleOnlineReservePayments ?? 0) + 0.001) { setError("Reserve credit cannot exceed eligible Maya, UnionBank, BPI, and bank payments."); return; }
    setIsSaving(true); setError("");
    try {
      const saved = await saveCycleSetAsideActual({ cycleId: cycle.cycleId, puresafeCapital: puresafe, otherProductsCapital: otherProducts, electricityShare: electricity, contingency, creditPuresafeCapital: creditPuresafe, creditOtherProductsCapital: creditOther, creditElectricityShare: creditElectricity, creditContingency, clearedPuresafeCredit: clearPuresafe, clearedOtherProductsCredit: clearOther, clearedElectricityCredit: clearElectricity, clearedContingencyCredit: clearContingency, toStashCash, note });
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
          <Text color="canvas.700" mt={1}>GCash always goes to Stash. Maya, UnionBank, and BPI may be earmarked as reserve credit until matching cash is retained.</Text>
          <Text color="canvas.700" mt={1}>GCash: {formatCurrency(cycle.gcashPayments ?? 0)} · Maya: {formatCurrency(cycle.mayaPayments ?? 0)} · UnionBank: {formatCurrency(cycle.unionbankPayments ?? 0)} · BPI: {formatCurrency(cycle.bpiPayments ?? 0)}</Text>
        </Box>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <AmountField label="Puresafe Capital" target={targets.puresafe.target} value={puresafe} onChange={setPuresafe}/>
          <AmountField label="Other Products Capital" target={targets.otherProducts.target} value={otherProducts} onChange={setOtherProducts}/>
          <AmountField label="Electricity Share" target={targets.electricity.target} value={electricity} onChange={setElectricity}/>
          <AmountField label="Contingency Savings" target={targets.contingency.target} value={contingency} onChange={setContingency}/>
          <AmountField label="To Stash — physical cash" target={targets.toStash.cashAfterReserves} value={toStashCash} onChange={setToStashCash}/>
        </SimpleGrid>
        <Box><Text fontWeight="900" mb={2}>Online payment earmarked as reserve credit</Text><Text color="canvas.700" fontSize="sm" mb={3}>Eligible online payments: {formatCurrency(cycle.eligibleOnlineReservePayments ?? 0)} · Suggested credit: {formatCurrency(cycle.recommendedReserveCredit ?? 0)}</Text><SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <AmountField label="Puresafe credit" target={targets.puresafe.target} value={creditPuresafe} onChange={setCreditPuresafe}/><AmountField label="Other Products credit" target={targets.otherProducts.target} value={creditOther} onChange={setCreditOther}/><AmountField label="Electricity credit" target={targets.electricity.target} value={creditElectricity} onChange={setCreditElectricity}/><AmountField label="Contingency credit" target={targets.contingency.target} value={creditContingency} onChange={setCreditContingency}/>
        </SimpleGrid></Box>
        <Box><Text fontWeight="900" mb={2}>Physical cash retained to clear earlier credit</Text><Text color="canvas.700" fontSize="sm" mb={3}>This converts existing credit into physical reserve cash and does not increase the funded balance twice.</Text><SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <AmountField label="Clear Puresafe credit" target={cycle.fundBalances?.puresafe.creditAwaitingCash ?? 0} value={clearPuresafe} onChange={setClearPuresafe}/><AmountField label="Clear Other Products credit" target={cycle.fundBalances?.otherProducts.creditAwaitingCash ?? 0} value={clearOther} onChange={setClearOther}/><AmountField label="Clear Electricity credit" target={cycle.fundBalances?.electricity.creditAwaitingCash ?? 0} value={clearElectricity} onChange={setClearElectricity}/><AmountField label="Clear Contingency credit" target={cycle.fundBalances?.contingency.creditAwaitingCash ?? 0} value={clearContingency} onChange={setClearContingency}/>
        </SimpleGrid></Box>
        <Box bg="canvas.50" borderRadius="20px" p={4}>
          <Text>Physical cash recorded: <strong>{formatCurrency(physicalTotal)}</strong></Text>
          <Text>Reserve credit recorded: <strong>{formatCurrency(creditTotal)}</strong></Text>
          <Text color={remainingCash < 0 ? "caution.500" : "canvas.700"} mt={1}>Cash not allocated: {formatCurrency(Math.max(remainingCash, 0))}</Text>
          <Text color="canvas.700" mt={1}>Online going to Stash: {formatCurrency(actualOnlineToStash)}</Text>
          <Text color="canvas.700" mt={1}>Total going to Stash: {formatCurrency(parseNumberInput(toStashCash) + actualOnlineToStash)}</Text>
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
