import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  deleteRetroactiveOnlinePayment,
  deleteRetroactiveUnpaidEntry,
  detectCycleForTransaction,
  fetchCycleDisclosureAndCollection,
  fetchCyclePaymentDetail,
  fetchPersonHonesty,
  saveBottleTakenRecord,
  saveRetroactiveOnlinePayment,
} from "../lib/api";
import {
  formatCurrency,
  formatManilaDateTime,
  formatPercent,
  manilaDateTimeInputToIso,
  parseNumberInput,
  toManilaDateTimeInput,
} from "../lib/format";
import {
  CycleDetail,
  CycleHonestyDetail,
  CyclePaymentDetail,
  DetectedCycle,
  DisclosureSource,
  PaymentExpectation,
  PersonHonestySummary,
  RetroactiveOnlinePayment,
  RetroactiveUnpaidEntry,
} from "../lib/types";
import { MetricCard } from "./MetricCard";
import { SectionCard } from "./SectionCard";

interface CycleHonestyPanelProps {
  cycle: CycleDetail;
  paymentDetail?: CyclePaymentDetail | null;
  onDetailsChange?: (honesty: CycleHonestyDetail, payments: CyclePaymentDetail) => void;
}

interface BottleFormState {
  id: string | null;
  occurredAt: string;
  productId: string;
  quantity: string;
  personLabel: string;
  disclosureSource: Exclude<DisclosureSource, "unknown"> | "";
  paymentExpectation: PaymentExpectation | "";
  note: string;
  idempotencyKey: string;
}

interface PaymentFormState {
  id: string | null;
  occurredAt: string;
  amount: string;
  method: "GCASH" | "MAYA" | "BANK" | "OTHER";
  personLabel: string;
  referenceNumber: string;
  note: string;
  idempotencyKey: string;
}

const disclosureLabels: Record<DisclosureSource, string> = {
  unknown: "Unclassified",
  self_reported: "Self-reported",
  owner_recorded: "Observed or recorded",
  inventory_discrepancy: "Discovered during inventory count",
};

const expectationLabels: Record<PaymentExpectation, string> = {
  unknown: "Payment expectation unresolved",
  required: "Payment required",
  pay_later: "Pay later",
  complimentary: "Complimentary",
};

export function CycleHonestyPanel({ cycle, paymentDetail, onDetailsChange }: CycleHonestyPanelProps) {
  const toast = useToast();
  const [detail, setDetail] = useState<CycleHonestyDetail | null>(null);
  const [livePaymentDetail, setLivePaymentDetail] = useState<CyclePaymentDetail | null>(paymentDetail ?? null);
  const [people, setPeople] = useState<PersonHonestySummary[]>([]);
  const [personStartDate, setPersonStartDate] = useState("");
  const [personEndDate, setPersonEndDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBottle, setIsSavingBottle] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isFilteringPeople, setIsFilteringPeople] = useState(false);
  const [isKnownUnpaidOpen, setIsKnownUnpaidOpen] = useState(false);
  const [isBottleModalOpen, setIsBottleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [bottleForm, setBottleForm] = useState(() => createBottleForm(cycle));
  const [paymentForm, setPaymentForm] = useState(() => createPaymentForm());
  const bottleDetection = useCycleDetection(bottleForm.occurredAt);
  const paymentDetection = useCycleDetection(paymentForm.occurredAt);

  useEffect(() => {
    setBottleForm(createBottleForm(cycle));
    void load();
  }, [cycle.cycleId, cycle.totals.bottlesTaken, cycle.totals.expectedRevenue]);

  async function load() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [nextDetail, nextPaymentDetail] = await Promise.all([
        fetchCycleDisclosureAndCollection(cycle.cycleId),
        fetchCyclePaymentDetail(cycle.cycleId),
      ]);
      setDetail(nextDetail);
      setLivePaymentDetail(nextPaymentDetail);
      setPeople(nextDetail.personSummaries ?? []);
      onDetailsChange?.(nextDetail, nextPaymentDetail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load disclosure and payment details.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveBottle() {
    if (!bottleDetection.cycle || bottleDetection.error) {
      setErrorMessage(bottleDetection.error || "Choose a date inside an inventory cycle.");
      return;
    }
    if (!bottleForm.productId || parseNumberInput(bottleForm.quantity) <= 0) {
      setErrorMessage("Choose a product and enter a quantity greater than zero.");
      return;
    }
    if (!bottleForm.disclosureSource || !bottleForm.paymentExpectation) {
      setErrorMessage("Choose both a disclosure source and a payment expectation.");
      return;
    }

    setIsSavingBottle(true);
    setErrorMessage("");
    try {
      await saveBottleTakenRecord({
        id: bottleForm.id,
        takenAt: manilaDateTimeInputToIso(bottleForm.occurredAt),
        productId: bottleForm.productId,
        quantity: Math.trunc(parseNumberInput(bottleForm.quantity)),
        personLabel: bottleForm.personLabel,
        disclosureSource: bottleForm.disclosureSource,
        paymentExpectation: bottleForm.paymentExpectation,
        note: bottleForm.note,
        idempotencyKey: bottleForm.idempotencyKey,
      });
      const assignedCycle = bottleDetection.cycle.cycleNumber;
      const wasEditing = Boolean(bottleForm.id);
      setBottleForm(createBottleForm(cycle));
      await load();
      setIsBottleModalOpen(false);
      toast({
        title: wasEditing ? "Bottle record updated" : "Bottle taken recorded",
        description: `Assigned to Cycle #${assignedCycle}. Existing inventory and revenue were not counted again.`,
        status: "success", duration: 3600, isClosable: true, position: "top",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the bottle record.");
    } finally {
      setIsSavingBottle(false);
    }
  }

  async function handleSavePayment() {
    if (!paymentDetection.cycle || paymentDetection.error) {
      setErrorMessage(paymentDetection.error || "Choose a payment date inside an inventory cycle.");
      return;
    }
    if (parseNumberInput(paymentForm.amount) <= 0) {
      setErrorMessage("Enter a payment amount greater than zero.");
      return;
    }
    setIsSavingPayment(true);
    setErrorMessage("");
    try {
      await saveRetroactiveOnlinePayment({
        id: paymentForm.id,
        paidAt: manilaDateTimeInputToIso(paymentForm.occurredAt),
        amount: paymentForm.amount,
        method: paymentForm.method,
        customerLabel: paymentForm.personLabel,
        referenceNumber: paymentForm.referenceNumber,
        note: paymentForm.note,
        idempotencyKey: paymentForm.idempotencyKey,
      });
      const assignedCycle = paymentDetection.cycle.cycleNumber;
      const wasEditing = Boolean(paymentForm.id);
      setPaymentForm(createPaymentForm());
      await load();
      setIsPaymentModalOpen(false);
      toast({
        title: wasEditing ? "Online payment updated" : "Online payment recorded",
        description: `Assigned to Cycle #${assignedCycle} and kept separate from physical cash.`,
        status: "success", duration: 3400, isClosable: true, position: "top",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the online payment.");
    } finally {
      setIsSavingPayment(false);
    }
  }

  function openBottleModal(entry?: RetroactiveUnpaidEntry) {
    setBottleForm(entry ? toBottleEditForm(entry) : createBottleForm(cycle));
    setErrorMessage("");
    setIsBottleModalOpen(true);
  }

  function closeBottleModal() {
    if (isSavingBottle) return;
    setIsBottleModalOpen(false);
    setBottleForm(createBottleForm(cycle));
    setErrorMessage("");
  }

  function openPaymentModal(payment?: RetroactiveOnlinePayment) {
    setPaymentForm(payment ? toPaymentEditForm(payment) : createPaymentForm());
    setErrorMessage("");
    setIsPaymentModalOpen(true);
  }

  function closePaymentModal() {
    if (isSavingPayment) return;
    setIsPaymentModalOpen(false);
    setPaymentForm(createPaymentForm());
    setErrorMessage("");
  }

  async function handleDeleteBottle(entry: RetroactiveUnpaidEntry) {
    if (!window.confirm(`Delete the bottle record for ${entry.quantity} × ${entry.productName}?`)) return;
    try {
      await deleteRetroactiveUnpaidEntry(entry.id);
      await load();
      toast({ title: "Bottle record deleted", status: "success", duration: 2200, position: "top" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the bottle record.");
    }
  }

  async function handleDeletePayment(payment: RetroactiveOnlinePayment) {
    if (!window.confirm(`Delete the ${formatCurrency(payment.amount)} ${payment.method} payment?`)) return;
    try {
      await deleteRetroactiveOnlinePayment(payment.id);
      await load();
      toast({ title: "Online payment deleted", status: "success", duration: 2200, position: "top" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete the online payment.");
    }
  }

  async function filterPeople() {
    setIsFilteringPeople(true);
    setErrorMessage("");
    try {
      setPeople(await fetchPersonHonesty({
        cycleId: cycle.cycleId,
        startAt: personStartDate ? manilaDateTimeInputToIso(`${personStartDate}T00:00`) : null,
        endAt: personEndDate ? manilaDateTimeInputToIso(`${personEndDate}T23:59`) : null,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not filter person summaries.");
    } finally {
      setIsFilteringPeople(false);
    }
  }

  if (isLoading && !detail) return <Spinner color="brand.400" />;
  if (!detail) {
    return (
      <SectionCard eyebrow="Disclosure and collection" title="Could not load cycle details">
        <Text color="caution.600">{errorMessage}</Text>
        <Button mt={4} onClick={() => void load()}>Try again</Button>
      </SectionCard>
    );
  }

  const rawSummary = detail.summary;
  const totalPayments = livePaymentDetail?.summary.totalPayments ?? rawSummary.totalPayments;
  const summary = livePaymentDetail ? {
    ...rawSummary,
    physicalCashCollected: livePaymentDetail.summary.cashPayments,
    onlinePayments: livePaymentDetail.summary.onlinePayments,
    totalPayments,
    outstandingRequiredAmount: Math.max(rawSummary.currentlyDueAmount - totalPayments, 0),
    outstandingAmount: Math.max(rawSummary.currentlyDueAmount - totalPayments, 0),
    collectionRate: rawSummary.currentlyDueAmount > 0
      ? Math.min((totalPayments / rawSummary.currentlyDueAmount) * 100, 100)
      : null,
  } : rawSummary;
  const bottleRecords = detail.bottleTakenRecords ?? detail.unpaidEntries;
  const knownUnpaidRecords = bottleRecords.filter((entry) => entry.paymentStatus === "unpaid" || entry.paymentStatus === "partially_paid");
  const knownUnpaidBottles = knownUnpaidRecords.reduce((total, entry) => total + entry.quantity, 0);

  return (
    <Stack spacing={5}>
      {errorMessage ? <Alert status="error" borderRadius="22px"><AlertIcon /><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

      <SectionCard eyebrow="Disclosure honesty" title={summary.disclosureRate == null ? "Not enough data" : `${formatPercent(summary.disclosureRate)} disclosed`}>
        <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing={4}>
          <MetricCard label="Known bottles taken" value={String(summary.totalBottlesTaken)} />
          <MetricCard label="Self-reported" value={String(summary.selfReportedBottles)} />
          <MetricCard label="Observed / recorded" value={String(summary.ownerRecordedBottles)} />
          <MetricCard label="Inventory discrepancy" value={String(summary.inventoryDiscrepancyBottles)} />
          <MetricCard label="Unattributed missing" value={String(summary.unattributedMissingBottles)} />
          <MetricCard label="Complimentary + disclosed" value={String(summary.complimentaryHonestlyDisclosed)} />
          <MetricCard label="Disclosure coverage" value={formatPercent(summary.disclosureCoverage)} />
          <MetricCard label="Unclassified historical records" value={String(summary.unclassifiedHistoricalRecords)} hint={`${summary.unclassifiedHistoricalBottles} bottle(s) excluded from disclosure rates`} />
        </SimpleGrid>
        <Text color="canvas.700" mt={4}>Disclosure rate uses bottle quantities attributed to a known person. Only self-reported quantities are in the numerator; unattributed discrepancies and unclassified history are excluded.</Text>
        {summary.unclassifiedHistoricalRecords > 0 ? <Alert status="warning" borderRadius="20px" mt={4}><AlertIcon /><AlertDescription>Edit the historical records below to classify them. Trustally did not guess that they were self-reported.</AlertDescription></Alert> : null}
      </SectionCard>

      <SectionCard eyebrow="Payment collection" title={summary.collectionRate == null ? "Payment not required" : `${formatPercent(summary.collectionRate)} collected`}>
        <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} spacing={4}>
          <MetricCard label="Payment required" value={formatCurrency(summary.paymentRequiredAmount)} />
          <MetricCard label="Pay later" value={formatCurrency(summary.payLaterAmount)} />
          <MetricCard label="Known unpaid" value={`${knownUnpaidBottles} bottle${knownUnpaidBottles === 1 ? "" : "s"}`} hint="Click to view records" onClick={() => setIsKnownUnpaidOpen(true)} />
          <MetricCard label="Complimentary value" value={formatCurrency(summary.complimentaryValue)} />
          <MetricCard label="Physical cash" value={formatCurrency(summary.physicalCashCollected)} />
          <MetricCard label="Online payments" value={formatCurrency(summary.onlinePayments)} />
          <MetricCard label="Total collected" value={formatCurrency(summary.totalPayments)} />
          <MetricCard label="Required payment gap" value={formatCurrency(summary.outstandingRequiredAmount)} />
          <MetricCard label="Overpayment" value={formatCurrency(summary.overpaymentAmount)} />
          <MetricCard label="Unresolved value" value={formatCurrency(summary.unknownPaymentValue)} />
        </SimpleGrid>
        <Text color="canvas.700" mt={4}>Complimentary and unresolved records are not treated as unpaid. {summary.allocationRule}</Text>
      </SectionCard>

      <SectionCard eyebrow="Bottle-taken record" title="Record disclosed or discovered bottles">
        <Text color="canvas.700">Trustally detects the cycle from the date in Asia/Manila time. The record documents an existing inventory result and does not deduct stock or add revenue again.</Text>
        <Button mt={4} onClick={() => openBottleModal()}>Record bottles</Button>
        <EntryListEmpty visible={!bottleRecords.length} label="No bottle-taken records for this cycle." />
        <Stack spacing={3} mt={5}>
          {bottleRecords.map((entry) => {
            const source = entry.disclosureSource ?? "unknown";
            const expectation = entry.paymentExpectation ?? "unknown";
            return (
              <Box key={entry.id} bg="canvas.50" borderRadius="24px" p={4}>
                <HStack justify="space-between" align="start" flexWrap="wrap">
                  <Box><Text fontWeight="800">{entry.quantity} × {entry.productName} · {entry.personLabel ?? entry.customerLabel ?? "Unknown person"}</Text><Text color="canvas.700" mt={1}>Taken {formatManilaDateTime(entry.takenAt)} · Cycle #{entry.cycleNumber}</Text></Box>
                  <HStack flexWrap="wrap"><Badge colorScheme={source === "self_reported" ? "green" : source === "unknown" ? "orange" : "blue"}>{disclosureLabels[source]}</Badge><Badge>{expectationLabels[expectation]}</Badge></HStack>
                </HStack>
                {entry.isUnclassifiedHistorical ? <Text color="orange.300" mt={2}>Unclassified historical record — excluded from disclosure-rate calculations.</Text> : null}
                <Text color="canvas.700" mt={1}>Value {formatCurrency(entry.confirmedAmount)} · Status: {formatStatus(entry.paymentStatus)}</Text>
                {entry.note ? <Text mt={2}>{entry.note}</Text> : null}
                <HStack mt={3} spacing={3}><Button size="sm" variant="outline" onClick={() => openBottleModal(entry)}>{entry.isUnclassifiedHistorical ? "Classify" : "Edit"}</Button><Button size="sm" variant="ghost" colorScheme="red" onClick={() => void handleDeleteBottle(entry)}>Delete</Button></HStack>
              </Box>
            );
          })}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Retroactive online payment" title="Record a payment by its actual date">
        <Text color="canvas.700">Known-person payments are allocated within that cycle to required records oldest-first, then pay-later records. Unknown payers stay out of individual compliance calculations.</Text>
        <Button mt={4} onClick={() => openPaymentModal()}>Record online payment</Button>
        <EntryListEmpty visible={!detail.onlinePayments.length} label="No retroactive online payments for this cycle." />
        <Stack spacing={3} mt={5}>
          {detail.onlinePayments.map((payment) => (
            <Box key={payment.id} bg="canvas.50" borderRadius="24px" p={4}>
              <Text fontWeight="800">{payment.method} · {formatCurrency(payment.amount)} · {payment.personLabel ?? payment.customerLabel ?? "Unknown payer"}</Text>
              <Text color="canvas.700" mt={1}>Paid {formatManilaDateTime(payment.paidAt)} · Cycle #{payment.cycleNumber}</Text>
              <Text color="canvas.700" mt={1}>Recorded {formatManilaDateTime(payment.createdAt)}{payment.referenceNumber ? ` · Ref ${payment.referenceNumber}` : ""}</Text>
              {payment.note ? <Text mt={1}>{payment.note}</Text> : null}
              <HStack mt={3} spacing={3}><Button size="sm" variant="outline" onClick={() => openPaymentModal(payment)}>Edit</Button><Button size="sm" variant="ghost" colorScheme="red" onClick={() => void handleDeletePayment(payment)}>Delete</Button></HStack>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Per-person view" title="Disclosure and payment stay separate">
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <Field label="From date (optional)"><Input type="date" value={personStartDate} onChange={(event) => setPersonStartDate(event.target.value)} /></Field>
          <Field label="Through date (optional)"><Input type="date" value={personEndDate} onChange={(event) => setPersonEndDate(event.target.value)} /></Field>
          <Box alignSelf="end"><Button onClick={() => void filterPeople()} isLoading={isFilteringPeople}>Filter this cycle</Button></Box>
        </SimpleGrid>
        <EntryListEmpty visible={!people.length} label="No attributed people in this cycle or date range." />
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} mt={5}>
          {people.map((person) => (
            <Box key={person.personLabel.toLowerCase()} bg="canvas.50" borderRadius="24px" p={4}>
              <Text fontSize="lg" fontWeight="900">{person.personLabel}</Text>
              <SimpleGrid columns={2} spacing={2} mt={3}>
                <Text><b>Disclosure:</b> {formatPercent(person.disclosureRate)} · {person.selfReportedBottles} of {person.totalKnownBottles}</Text><Text><b>Collection:</b> {person.collectionRate == null ? "Payment not required" : formatPercent(person.collectionRate)}</Text>
                <Text>Observed: {person.ownerRecordedBottles}</Text><Text>Inventory discrepancy: {person.inventoryDiscrepancyBottles}</Text>
                <Text>Complimentary: {person.complimentaryBottles}</Text><Text>Pay later: {person.payLaterBottles}</Text>
                <Text>Required: {formatCurrency(person.amountRequired)}</Text><Text>Paid: {formatCurrency(person.amountPaid)}</Text>
                <Text>Payment gap: {formatCurrency(person.outstandingAmount)}</Text><Text>Historical unclassified: {person.unclassifiedHistoricalRecords}</Text>
              </SimpleGrid>
              {person.recentHistory.slice(0, 3).map((item) => <Text key={`${item.type}-${item.id}`} color="canvas.700" mt={2}>{formatManilaDateTime(item.happenedAt)} · {item.type === "bottle" ? `${item.quantity} bottle(s)` : `${formatCurrency(item.amount)} ${item.method ?? "payment"}`}</Text>)}
            </Box>
          ))}
        </SimpleGrid>
      </SectionCard>

      <Modal isOpen={isBottleModalOpen} onClose={closeBottleModal} isCentered size="xl" closeOnOverlayClick={!isSavingBottle} scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{bottleForm.id ? "Correct bottle record" : "Record bottles"}</ModalHeader>
          <ModalCloseButton isDisabled={isSavingBottle} />
          <ModalBody>
            <Stack spacing={4}>
              {errorMessage ? <Alert status="error" borderRadius="18px"><AlertIcon /><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
              <Text color="canvas.700">The date assigns this record to its matching cycle. This documents the existing inventory result without deducting stock again.</Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Field label="Date and time taken"><Input type="datetime-local" value={bottleForm.occurredAt} onChange={(event) => setBottleForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <DetectedCycleField detection={bottleDetection} />
                <Field label="Person"><Input value={bottleForm.personLabel} onChange={(event) => setBottleForm((current) => ({ ...current, personLabel: event.target.value }))} placeholder="Unknown person" /></Field>
                <Field label="Product"><Select value={bottleForm.productId} onChange={(event) => setBottleForm((current) => ({ ...current, productId: event.target.value }))}>{cycle.productBreakdown.map((product) => <option key={product.productId} value={product.productId}>{product.productName}</option>)}</Select></Field>
                <Field label="Quantity"><Input inputMode="numeric" value={bottleForm.quantity} onChange={(event) => setBottleForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
                <Field label="Disclosure source"><Select placeholder="Choose a disclosure source" value={bottleForm.disclosureSource} onChange={(event) => setBottleForm((current) => ({ ...current, disclosureSource: event.target.value as BottleFormState["disclosureSource"] }))}><option value="self_reported">Self-reported — the person disclosed it</option><option value="owner_recorded">Observed or recorded by owner / coach</option><option value="inventory_discrepancy">Discovered during inventory count</option></Select></Field>
                <Field label="Payment expectation"><Select placeholder="Choose a payment expectation" value={bottleForm.paymentExpectation} onChange={(event) => setBottleForm((current) => ({ ...current, paymentExpectation: event.target.value as BottleFormState["paymentExpectation"] }))}><option value="required">Required — due now</option><option value="pay_later">Pay later — expected, not currently due</option><option value="complimentary">Complimentary — payment waived</option><option value="unknown">Unknown — resolve later</option></Select></Field>
                <Field label="Notes"><Textarea value={bottleForm.note} onChange={(event) => setBottleForm((current) => ({ ...current, note: event.target.value }))} /></Field>
              </SimpleGrid>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={closeBottleModal} isDisabled={isSavingBottle}>Cancel</Button>
            <Button onClick={() => void handleSaveBottle()} isLoading={isSavingBottle}>{bottleForm.id ? "Save correction" : "Record bottles"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={closePaymentModal} isCentered size="xl" closeOnOverlayClick={!isSavingPayment} scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{paymentForm.id ? "Correct online payment" : "Record online payment"}</ModalHeader>
          <ModalCloseButton isDisabled={isSavingPayment} />
          <ModalBody>
            <Stack spacing={4}>
              {errorMessage ? <Alert status="error" borderRadius="18px"><AlertIcon /><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
              <Text color="canvas.700">Use the actual payment date. Trustally assigns the payment to the cycle covering that date and keeps it separate from physical cash.</Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Field label="Actual payment date and time"><Input type="datetime-local" value={paymentForm.occurredAt} onChange={(event) => setPaymentForm((current) => ({ ...current, occurredAt: event.target.value }))} /></Field>
                <DetectedCycleField detection={paymentDetection} />
                <Field label="Amount"><Input inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} /></Field>
                <Field label="Method"><Select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as PaymentFormState["method"] }))}><option value="GCASH">GCash</option><option value="MAYA">Maya</option><option value="BANK">Bank transfer</option><option value="OTHER">Other online</option></Select></Field>
                <Field label="Person (optional)"><Input value={paymentForm.personLabel} onChange={(event) => setPaymentForm((current) => ({ ...current, personLabel: event.target.value }))} /></Field>
                <Field label="Reference number (optional)"><Input value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, referenceNumber: event.target.value }))} /></Field>
                <Field label="Notes (optional)"><Textarea value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} /></Field>
              </SimpleGrid>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={closePaymentModal} isDisabled={isSavingPayment}>Cancel</Button>
            <Button onClick={() => void handleSavePayment()} isLoading={isSavingPayment}>{paymentForm.id ? "Save correction" : "Record payment"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isKnownUnpaidOpen} onClose={() => setIsKnownUnpaidOpen(false)} isCentered size="lg">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>Known unpaid bottles</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {knownUnpaidRecords.length ? (
              <Stack spacing={3}>
                {knownUnpaidRecords.map((entry) => (
                  <Box key={entry.id} bg="canvas.50" borderRadius="20px" p={4}>
                    <Text fontWeight="900">{entry.quantity} × {entry.productName}</Text>
                    <Text color="canvas.700" mt={1}>{entry.personLabel ?? entry.customerLabel ?? "Unknown person"} · {formatCurrency(entry.confirmedAmount)}</Text>
                    <Text color="canvas.700" mt={1}>Taken {formatManilaDateTime(entry.takenAt)} · {formatStatus(entry.paymentStatus)}</Text>
                    {entry.note ? <Text mt={2}>{entry.note}</Text> : null}
                  </Box>
                ))}
              </Stack>
            ) : <Text color="canvas.700">There are no classified unpaid bottle records in this cycle.</Text>}
          </ModalBody>
          <ModalFooter><Button onClick={() => setIsKnownUnpaidOpen(false)}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}

function useCycleDetection(value: string) {
  const [cycle, setCycle] = useState<DetectedCycle | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setCycle(null); setError("");
    if (!value) return;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try { setCycle(await detectCycleForTransaction(manilaDateTimeInputToIso(value))); }
      catch (nextError) { setError(nextError instanceof Error ? nextError.message : "No cycle covers that date and time."); }
      finally { setIsLoading(false); }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return { cycle, error, isLoading };
}

function DetectedCycleField({ detection }: { detection: ReturnType<typeof useCycleDetection> }) {
  return <Field label="Automatically detected cycle"><Box bg="canvas.50" borderRadius="18px" minH="48px" px={4} py={3}>{detection.isLoading ? <Spinner size="sm" /> : detection.cycle ? <Text fontWeight="800">Cycle #{detection.cycle.cycleNumber} · {detection.cycle.status}</Text> : <Text color={detection.error ? "caution.600" : "canvas.700"}>{detection.error || "Enter a date and time"}</Text>}</Box></Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <Box><Text fontWeight="800" mb={2}>{label}</Text>{children}</Box>; }
function EntryListEmpty({ visible, label }: { visible: boolean; label: string }) { return visible ? <Text color="canvas.700" mt={5}>{label}</Text> : null; }

function createBottleForm(cycle: CycleDetail): BottleFormState {
  const defaultOccurredAt = cycle.completedAt ? new Date(new Date(cycle.completedAt).getTime() - 60_000) : new Date();
  return { id: null, occurredAt: toManilaDateTimeInput(defaultOccurredAt), productId: cycle.productBreakdown[0]?.productId ?? "", quantity: "", personLabel: "", disclosureSource: "", paymentExpectation: "", note: "", idempotencyKey: crypto.randomUUID() };
}

function toBottleEditForm(entry: RetroactiveUnpaidEntry): BottleFormState {
  return { id: entry.id, occurredAt: toManilaDateTimeInput(entry.takenAt), productId: entry.productId, quantity: String(entry.quantity), personLabel: entry.personLabel ?? entry.customerLabel ?? "", disclosureSource: entry.disclosureSource === "unknown" ? "" : entry.disclosureSource ?? "", paymentExpectation: entry.paymentExpectation === "unknown" && entry.isUnclassifiedHistorical ? "" : entry.paymentExpectation ?? "", note: entry.note ?? "", idempotencyKey: crypto.randomUUID() };
}

function createPaymentForm(): PaymentFormState { return { id: null, occurredAt: toManilaDateTimeInput(), amount: "", method: "GCASH", personLabel: "", referenceNumber: "", note: "", idempotencyKey: crypto.randomUUID() }; }
function toPaymentEditForm(payment: RetroactiveOnlinePayment): PaymentFormState { return { id: payment.id, occurredAt: toManilaDateTimeInput(payment.paidAt), amount: String(payment.amount), method: payment.method, personLabel: payment.personLabel ?? payment.customerLabel ?? "", referenceNumber: payment.referenceNumber ?? "", note: payment.note ?? "", idempotencyKey: crypto.randomUUID() }; }
function formatStatus(status: RetroactiveUnpaidEntry["paymentStatus"]) { return ({ paid: "Paid", partially_paid: "Partially paid", unpaid: "Unpaid", pay_later: "Pay later", complimentary: "Complimentary", unresolved: "Payment expectation unresolved" } as const)[status ?? "unresolved"]; }
