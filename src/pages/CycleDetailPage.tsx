import {
  Box,
  Button,
  Input,
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
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { PaymentDetailsModal } from "../components/PaymentDetailsModal";
import { CycleHonestyPanel } from "../components/CycleHonestyPanel";
import { SectionCard } from "../components/SectionCard";
import { SetAsideSummary } from "../components/SetAsideSummary";
import { fetchCycleCashFloatDetail, fetchCycleDetail, fetchCycleDisclosureAndCollection, fetchCyclePaymentDetail, fetchCycleSetAside, updateCycleChangeFloat } from "../lib/api";
import {
  formatCurrency,
  formatDateRange,
  formatDateTimeLabel,
  formatPercent,
} from "../lib/format";
import { CycleCashFloatDetail, CycleDetail, CycleHonestyDetail, CyclePaymentDetail, CyclePaymentRecord, CycleSetAside } from "../lib/types";

export default function CycleDetailPage() {
  const { cycleId = "" } = useParams();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<CycleDetail | null>(null);
  const [honesty, setHonesty] = useState<CycleHonestyDetail | null>(null);
  const [payments, setPayments] = useState<CyclePaymentDetail | null>(null);
  const [cashFloat, setCashFloat] = useState<CycleCashFloatDetail | null>(null);
  const [setAside, setSetAside] = useState<CycleSetAside | null>(null);
  const [floatAdjustmentField, setFloatAdjustmentField] = useState<"opening" | "closing" | null>(null);
  const [floatAdjustmentAmount, setFloatAdjustmentAmount] = useState("");
  const [floatAdjustmentReason, setFloatAdjustmentReason] = useState("");
  const [isSavingFloat, setIsSavingFloat] = useState(false);
  const paymentDetailView = searchParams.get("payments") as CyclePaymentRecord["channel"] | null;

  useEffect(() => {
    void Promise.all([
      fetchCycleDetail(cycleId),
      fetchCycleDisclosureAndCollection(cycleId),
      fetchCyclePaymentDetail(cycleId),
      fetchCycleCashFloatDetail(cycleId),
      fetchCycleSetAside(cycleId),
    ]).then(([nextDetail, nextHonesty, nextPayments, nextCashFloat, nextSetAside]) => {
      setDetail(nextDetail);
      setHonesty(nextHonesty);
      setPayments(nextPayments);
      setCashFloat(nextCashFloat);
      setSetAside(nextSetAside);
    });
  }, [cycleId]);

  if (!detail || !honesty || !payments || !cashFloat || !setAside) {
    return <Spinner color="brand.400" />;
  }

  const paymentGap = Math.max(honesty.summary.currentlyDueAmount - payments.summary.totalPayments, 0);
  const collectionRate = honesty.summary.currentlyDueAmount > 0
    ? Math.min((payments.summary.totalPayments / honesty.summary.currentlyDueAmount) * 100, 100)
    : null;
  const totalCapital = setAside.puresafeCapital == null || setAside.miscCapital == null
    ? null
    : setAside.puresafeCapital + setAside.miscCapital;
  const grossProfit = totalCapital == null
    ? null
    : payments.summary.totalPayments - totalCapital;
  function openPaymentDetails(channel: CyclePaymentRecord["channel"]) {
    setSearchParams({ payments: channel });
  }

  function openFloatAdjustment(field: "opening" | "closing") {
    if (!cashFloat) return;
    setFloatAdjustmentField(field);
    setFloatAdjustmentAmount(String(field === "opening" ? cashFloat.openingChangeFloat ?? "" : cashFloat.closingChangeFloat));
    setFloatAdjustmentReason("");
  }

  async function saveFloatAdjustment() {
    if (!floatAdjustmentField) return;
    setIsSavingFloat(true);
    try {
      await updateCycleChangeFloat({
        cycleId,
        openingChangeFloat: floatAdjustmentField === "opening" ? floatAdjustmentAmount : undefined,
        closingChangeFloat: floatAdjustmentField === "closing" ? floatAdjustmentAmount : undefined,
        reason: floatAdjustmentReason,
      });
      const [nextFloat, nextPayments] = await Promise.all([
        fetchCycleCashFloatDetail(cycleId),
        fetchCyclePaymentDetail(cycleId),
      ]);
      setCashFloat(nextFloat);
      setPayments(nextPayments);
      setFloatAdjustmentField(null);
      toast({ title: "Change float updated", description: "Affected derived cash totals were recalculated and the reason was saved.", status: "success", position: "top" });
    } catch (error) {
      toast({ title: "Could not update change float", description: error instanceof Error ? error.message : "Please try again.", status: "error", position: "top" });
    } finally {
      setIsSavingFloat(false);
    }
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow={`Cycle #${detail.cycleNumber}`} title={formatDateRange(detail.startedAt, detail.completedAt)}>
        <SimpleGrid columns={{ base: 2, xl: 6 }} spacing={4}>
          <MetricCard label="Bottles taken" value={String(detail.totals.bottlesTaken)} />
          <MetricCard label="Expected sales" value={formatCurrency(detail.totals.expectedRevenue)} />
          <MetricCard label="Total collected" value={formatCurrency(payments.summary.totalPayments)} />
          <MetricCard label="Cash payments" value={formatCurrency(payments.summary.cashPayments)} hint="Click to view details" onClick={() => openPaymentDetails("cash")} />
          <MetricCard label="Online payments" value={formatCurrency(payments.summary.onlinePayments)} hint="Click to view details" onClick={() => openPaymentDetails("online")} />
          <MetricCard label="Known pay-later" value={formatCurrency(detail.totals.knownPayLater)} />
          <MetricCard label="Unaccounted" value={formatCurrency(paymentGap)} />
          <MetricCard label="Accounted rate" value={formatPercent(detail.totals.accountedRate)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Settlement" title="How this cycle was settled over time">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Settled amount" value={formatCurrency(detail.totals.settledAmount)} />
          <MetricCard label="Settled rate" value={formatPercent(detail.totals.settledRate)} />
          {detail.totals.outstandingAmount > 0 ? <MetricCard label="Pay-later outstanding" value={formatCurrency(detail.totals.outstandingAmount)} /> : null}
          <MetricCard label="Collection rate" value={collectionRate == null ? "Payment not required" : formatPercent(collectionRate)} />
        </SimpleGrid>
      </SectionCard>

      <SectionCard eyebrow="Cash box flow" title="Change float and withdrawal">
        <SimpleGrid columns={{ base: 2, xl: 5 }} spacing={4}>
          <MetricCard label="Opening change float" value={cashFloat.openingChangeFloat == null ? "Unknown" : formatCurrency(cashFloat.openingChangeFloat)} hint={cashFloat.openingChangeFloatSource === "explicit" ? "Explicitly adjusted" : "From previous Left for Change"} />
          <MetricCard label="Cash counted" value={formatCurrency(cashFloat.cashCountedBeforeWithdrawal)} />
          <MetricCard label="Cash generated" value={cashFloat.cashGenerated == null ? "Cannot be determined" : formatCurrency(cashFloat.cashGenerated)} hint={cashFloat.cashGenerated == null ? "Opening float required" : "Customer cash during this cycle"} />
          <MetricCard label="Left for Change" value={formatCurrency(cashFloat.closingChangeFloat)} hint="Previously recorded as Cash Returned" />
          <MetricCard label="Cash withdrawn" value={formatCurrency(cashFloat.cashWithdrawn)} />
        </SimpleGrid>
        <Stack direction={{ base: "column", md: "row" }} mt={4} spacing={3}>
          <Button variant="outline" onClick={() => openFloatAdjustment("opening")}>{cashFloat.openingChangeFloat == null ? "Set opening float" : "Correct opening float"}</Button>
          <Button variant="outline" onClick={() => openFloatAdjustment("closing")}>Correct Left for Change</Button>
        </Stack>
        <Text color="canvas.700" mt={3}>Correcting an older value can update later derived opening floats and cash-generated totals until an explicit reset. Bottle counts, online payments, and inventory are not changed.</Text>
        {cashFloat.adjustments.length ? (
          <Stack spacing={2} mt={4}>
            <Text fontWeight="900">Adjustment history</Text>
            {cashFloat.adjustments.map((adjustment) => (
              <Box key={adjustment.id} bg="canvas.50" borderRadius="18px" p={3}>
                <Text>{adjustment.reason}</Text>
                <Text color="canvas.700" fontSize="sm" mt={1}>{formatDateTimeLabel(adjustment.createdAt)}</Text>
              </Box>
            ))}
          </Stack>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Sales and profit" title="Actual recorded money">
        <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={4}>
          <MetricCard label="Gross sales" value={formatCurrency(payments.summary.totalPayments)} />
          <MetricCard label="Puresafe Capital" value={setAside.missingPuresafeCost ? "Unable to calculate" : formatCurrency(setAside.puresafeCapital)} />
          <MetricCard label="Gross Profit" value={grossProfit == null ? "Unable to calculate" : formatCurrency(grossProfit)} hint="Gross sales less all product capital" />
          <MetricCard label="Electricity Share" value={formatCurrency(setAside.electricityShare)} />
          <MetricCard label="Other Products Capital" value={setAside.miscCapital == null ? "Unable to calculate" : formatCurrency(setAside.miscCapital)} hint="Replacement cost for every depleted non-Puresafe product" />
          <MetricCard label="Total Capital" value={totalCapital == null ? "Unable to calculate" : formatCurrency(totalCapital)} />
          <MetricCard label="Total Set Aside" value={setAside.totalSetAside == null ? "Unable to calculate" : formatCurrency(setAside.totalSetAside)} />
          <MetricCard label="Remaining After Set Aside" value={setAside.remainingEarnings == null ? "Unable to calculate" : formatCurrency(setAside.remainingEarnings)} hint="Net profit available after change float and all reserves" />
        </SimpleGrid>
        <Text color="canvas.700" mt={3}>Started {formatDateTimeLabel(detail.startedAt)} · Completed {formatDateTimeLabel(detail.completedAt)}</Text>
      </SectionCard>

      <SectionCard eyebrow="Set Aside" title="Money reserved from this cycle">
        <SetAsideSummary value={setAside} />
      </SectionCard>

      <SectionCard eyebrow="Products" title="Product breakdown">
        <Stack spacing={3}>
          {detail.productBreakdown.map((item) => (
            <Box key={item.productId} borderRadius="24px" bg="canvas.50" p={4}>
              <Text fontWeight="800">{item.productName}</Text>
              <Text color="canvas.700" mt={1}>
                Start {item.startingQuantity} • Added {item.stockAddedQuantity} • Non-sale {item.nonSaleQuantity} • Left {item.endingQuantity}
              </Text>
              <Text mt={2}>
                Taken {item.unitsTaken} • Expected {formatCurrency(item.expectedRevenue)} • Profit {formatCurrency(item.grossProfit)}
              </Text>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard eyebrow="Timeline" title="Activity">
        <Stack spacing={3}>
          {detail.timeline.map((item) => (
            <Box key={item.id} borderRadius="24px" bg="canvas.50" p={4}>
              <Text fontWeight="800">{item.label}</Text>
              <Text color="canvas.700">{item.detail}</Text>
              <Text mt={2} fontSize="sm" color="canvas.700">
                {formatDateTimeLabel(item.happenedAt)}
              </Text>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      <CycleHonestyPanel
        cycle={detail}
        paymentDetail={payments}
        onDetailsChange={(nextHonesty, nextPayments) => {
          setHonesty(nextHonesty);
          setPayments(nextPayments);
        }}
      />

      <PaymentDetailsModal
        isOpen={paymentDetailView === "cash" || paymentDetailView === "online"}
        onClose={() => setSearchParams({})}
        title={paymentDetailView === "cash" ? "Cash payment details" : "Online payment details"}
        records={payments.records}
        channel={paymentDetailView === "cash" || paymentDetailView === "online" ? paymentDetailView : undefined}
      />

      <Modal isOpen={floatAdjustmentField !== null} onClose={() => setFloatAdjustmentField(null)} isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>{floatAdjustmentField === "opening" ? "Correct opening change float" : "Correct Left for Change"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color="canvas.700">This audited correction may recalculate later derived cash-flow totals. It will not alter inventory, bottle counts, or online payments.</Text>
            <Input mt={4} value={floatAdjustmentAmount} onChange={(event) => setFloatAdjustmentAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
            <Textarea mt={4} value={floatAdjustmentReason} onChange={(event) => setFloatAdjustmentReason(event.target.value)} placeholder="Reason for this correction" />
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={() => setFloatAdjustmentField(null)}>Cancel</Button>
            <Button onClick={() => void saveFloatAdjustment()} isLoading={isSavingFloat}>Save correction</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}
