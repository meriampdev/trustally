import {
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { SetAsideSummary } from "../components/SetAsideSummary";
import { clearCheckBoxDraft, loadCheckBoxDraft, saveCheckBoxDraft } from "../lib/checkBoxDraft";
import {
  completeBoxCheck,
  fetchCashMovements,
  fetchCheckBoxDraft,
  fetchOutstandingBalances,
  fetchProducts,
  fetchCyclePaymentDetail,
  fetchSettings,
  previewBoxCheck,
  recordCycleDifference,
  updateCycleChangeFloat,
} from "../lib/api";
import {
  formatCurrency,
  formatDateTimeLabel,
  formatPercent,
  parseNumberInput,
} from "../lib/format";
import { calculateCashOnlySetAside } from "../lib/setAside";
import {
  CashMovement,
  CheckBoxDraft,
  CheckBoxDraftPayload,
    CheckBoxPreview,
    CyclePaymentDetail,
    CycleSetAside,
    DifferenceResolutionInput,
    DifferenceResolutionType,
    NonSaleReason,
    PayLaterBalance,
    Product,
    Settings,
  } from "../lib/types";

const steps = ["Money", "Count", "Results", "Refill", "Done"];

const nonSaleReasonOptions: NonSaleReason[] = [
  "OWNER_USE",
  "STAFF_USE",
  "FREE",
  "DAMAGED",
  "EXPIRED",
  "EVENT_USE",
  "OTHER",
];

const differenceResolutionOptions: Array<{
  value: DifferenceResolutionType;
  label: string;
  description: string;
}> = [
  {
    value: "PAY_LATER",
    label: "Someone will pay later",
    description: "Creates an outstanding balance instead of treating the gap as dishonesty.",
  },
  {
    value: "FREE_OWNER_STAFF",
    label: "Free / owner / staff bottle",
    description: "Documents the reason while you review whether this should be a non-sale adjustment.",
  },
  {
    value: "MISSING_PAYMENT",
    label: "Missing payment",
    description: "Keeps the unresolved amount visible as truly unaccounted.",
  },
  {
    value: "WRONG_COUNT",
    label: "Wrong count",
    description: "Notes that the bottle count may need another look before you trust the result.",
  },
  {
    value: "WRONG_MONEY_TOTAL",
    label: "Wrong money total",
    description: "Notes that the cash or wallet total may need another look.",
  },
  {
    value: "OTHER",
    label: "Other",
    description: "Stores a note without creating a receivable.",
  },
];

export default function CheckBoxPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [serverDraft, setServerDraft] = useState<CheckBoxDraftPayload | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [payLaterBalances, setPayLaterBalances] = useState<PayLaterBalance[]>([]);
  const [activeCyclePayments, setActiveCyclePayments] = useState<CyclePaymentDetail | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<CheckBoxDraft | null>(null);
  const [preview, setPreview] = useState<CheckBoxPreview | null>(null);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFloatAdjustmentOpen, setIsFloatAdjustmentOpen] = useState(false);
  const [openingFloatAdjustment, setOpeningFloatAdjustment] = useState("");
  const [floatAdjustmentReason, setFloatAdjustmentReason] = useState("");
  const [isSavingFloatAdjustment, setIsSavingFloatAdjustment] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (draft) {
      saveCheckBoxDraft(draft);
    }
  }, [draft]);

  async function load() {
    setIsLoading(true);
    try {
      const [nextDraft, nextProducts, nextCashMovements, nextPayLaterBalances, nextSettings] = await Promise.all([
        fetchCheckBoxDraft(),
        fetchProducts(),
        fetchCashMovements(),
        fetchOutstandingBalances(),
        fetchSettings(),
      ]);
      setServerDraft(nextDraft);
      setProducts(nextProducts);
      setCashMovements(nextCashMovements);
      setPayLaterBalances(nextPayLaterBalances);
      setSettings(nextSettings);
      setActiveCyclePayments(nextDraft ? await fetchCyclePaymentDetail(nextDraft.cycleId) : null);

      if (nextDraft) {
        const latestLegacyClosing = nextCashMovements
          .filter((movement) => movement.type === "CASH_RETURNED" && new Date(movement.occurredAt).getTime() >= new Date(nextDraft.startedAt).getTime())
          .reduce<(typeof nextCashMovements)[number] | null>((latest, movement) => (
            !latest || new Date(movement.occurredAt).getTime() > new Date(latest.occurredAt).getTime()
              ? movement
              : latest
          ), null);
        setDraft(normalizeDraft(loadCheckBoxDraft(nextDraft.cycleId) ?? createInitialDraft(nextDraft, latestLegacyClosing?.amount ?? 0)));
      }
    } finally {
      setIsLoading(false);
    }
  }

  const cycleCashMovements = useMemo(() => {
    if (!serverDraft) {
      return [];
    }

    const cycleStartedAt = new Date(serverDraft.startedAt).getTime();
    return cashMovements.filter(
      (movement) => new Date(movement.occurredAt).getTime() >= cycleStartedAt,
    );
  }, [cashMovements, serverDraft]);

  const cashRemovedSinceLastVisit = useMemo(
    () =>
      cycleCashMovements
        .filter((movement) => movement.type === "CASH_REMOVED")
        .reduce((sum, movement) => sum + movement.amount, 0),
    [cycleCashMovements],
  );

  const cashReturnedSinceLastVisit = useMemo(
    () =>
      cycleCashMovements
        .filter((movement) => movement.type === "CASH_RETURNED")
        .reduce<(typeof cycleCashMovements)[number] | null>((latest, movement) => (
          !latest || new Date(movement.occurredAt).getTime() > new Date(latest.occurredAt).getTime()
            ? movement
            : latest
        ), null)?.amount ?? 0,
    [cycleCashMovements],
  );

  const openingChangeFloat = serverDraft?.openingChangeFloat ?? null;
  const cashCountedBeforeWithdrawal = parseNumberInput(draft?.cashCountedBeforeWithdrawal ?? "0");
  const closingChangeFloat = parseNumberInput(draft?.closingChangeFloat ?? "0");
  const cashAddedForChange = parseNumberInput(draft?.cashAddedForChange ?? "0");
  const cashGenerated = openingChangeFloat == null
    ? null
    : cashCountedBeforeWithdrawal + cashRemovedSinceLastVisit - openingChangeFloat - cashAddedForChange;
  const cashWithdrawn = cashCountedBeforeWithdrawal - closingChangeFloat;
  const moneyTotal = (cashGenerated ?? 0)
    + parseNumberInput(draft?.gcashCollected ?? "0")
    + parseNumberInput(draft?.mayaCollected ?? "0");

  const shortfallAmount = preview
    ? Math.max(preview.totals.expectedRevenue - preview.totals.totalCollected, 0)
    : 0;

  const recordedPayLaterAmount = useMemo(() => {
    if (!serverDraft) {
      return 0;
    }

    return payLaterBalances
      .filter((balance) => balance.sourceCycleId === serverDraft.cycleId)
      .reduce((sum, balance) => sum + balance.originalAmount, 0);
  }, [payLaterBalances, serverDraft]);

  const recordedOutstandingAmount = useMemo(() => {
    if (!serverDraft) {
      return 0;
    }

    return payLaterBalances
      .filter((balance) => balance.sourceCycleId === serverDraft.cycleId)
      .reduce((sum, balance) => sum + balance.remainingAmount, 0);
  }, [payLaterBalances, serverDraft]);

  const pendingPayLaterAmount = useMemo(() => {
    if (!draft || draft.differenceResolution.type !== "PAY_LATER") {
      return 0;
    }

    const requestedAmount =
      draft.differenceResolution.amount.trim() === ""
        ? shortfallAmount
        : parseNumberInput(draft.differenceResolution.amount);

    const remainingShortfallAfterRecorded = Math.max(shortfallAmount - recordedPayLaterAmount, 0);

    return Math.min(remainingShortfallAfterRecorded, Math.max(requestedAmount, 0));
  }, [draft, recordedPayLaterAmount, shortfallAmount]);

  const resolvedPreview = useMemo(() => {
    if (!preview) {
      return null;
    }

    const immediatePayments = preview.totals.totalCollected;
    const totalKnownPayLater = recordedPayLaterAmount + pendingPayLaterAmount;
    const totalOutstanding = recordedOutstandingAmount + pendingPayLaterAmount;
    const accountedAmount = Math.min(
      preview.totals.expectedRevenue,
      immediatePayments + totalKnownPayLater,
    );
    const unaccountedAmount = Math.max(preview.totals.expectedRevenue - accountedAmount, 0);
    const estimatedPhysicalCash = preview.totals.closingChangeFloat ?? closingChangeFloat;

    return {
      ...preview,
      totals: {
        ...preview.totals,
        immediatePayments,
        collectionMatchRate: preview.totals.honestyRate,
        knownPayLater: totalKnownPayLater,
        accountedAmount,
        accountedRate:
          preview.totals.expectedRevenue > 0
            ? (accountedAmount / preview.totals.expectedRevenue) * 100
            : null,
        settledAmount: immediatePayments,
        settledRate:
          preview.totals.expectedRevenue > 0
            ? (immediatePayments / preview.totals.expectedRevenue) * 100
            : null,
        outstandingAmount: totalOutstanding,
        unaccountedAmount,
        cashRemoved: cashRemovedSinceLastVisit,
        cashReturned: preview.totals.closingChangeFloat ?? closingChangeFloat,
        estimatedPhysicalCash,
      },
    };
  }, [
    cashRemovedSinceLastVisit,
    cashReturnedSinceLastVisit,
    closingChangeFloat,
    pendingPayLaterAmount,
    preview,
    recordedOutstandingAmount,
    recordedPayLaterAmount,
  ]);

  const liveSetAside = useMemo<CycleSetAside | null>(() => {
    if (!resolvedPreview || !serverDraft || !settings) return null;
    const isPuresafe1L = (product: Product) => {
      const identity = `${product.brand ?? ""} ${product.name} ${product.displayName}`.toLowerCase();
      const volume = (product.volume ?? "").toLowerCase().replace(/\s/g, "");
      return identity.includes("puresafe") && (volume === "1l" || volume === "1000ml" || /(^|\D)1\s*l(\D|$)/i.test(product.displayName));
    };
    const puresafeProducts = products.filter(isPuresafe1L);
    const otherProducts = products.filter((product) => !isPuresafe1L(product));
    const replacementReasons = new Set<NonSaleReason>(["DAMAGED", "FREE", "OWNER_USE", "STAFF_USE", "EVENT_USE"]);
    const replacementUnitsFor = (product: Product) => {
      const taken = resolvedPreview.productBreakdown.find((item) => item.productId === product.id)?.unitsTaken ?? 0;
      const replaceableNonSales = draft?.nonSaleRemovals
        .filter((item) => item.productId === product.id && replacementReasons.has(item.reason))
        .reduce((total, item) => total + parseNumberInput(item.quantity), 0) ?? 0;
      return taken + replaceableNonSales;
    };
    const puresafeUnits = puresafeProducts.reduce((sum, product) => sum + replacementUnitsFor(product), 0);
    const missingPuresafeCost = puresafeProducts.some((product) => replacementUnitsFor(product) > 0 && product.defaultUnitCost <= 0);
    const puresafeCapital = missingPuresafeCost
      ? null
      : puresafeProducts.reduce((sum, product) => sum + replacementUnitsFor(product) * product.defaultUnitCost, 0);
    const miscellaneousProductBreakdown = otherProducts
      .map((product) => {
        const unitsToReplace = replacementUnitsFor(product);
        const hasCost = product.defaultUnitCost > 0 || unitsToReplace === 0;
        return {
          productId: product.id,
          productName: product.displayName,
          unitsToReplace,
          unitCost: product.defaultUnitCost > 0 ? product.defaultUnitCost : null,
          capital: hasCost ? unitsToReplace * product.defaultUnitCost : null,
        };
      })
      .filter((product) => product.unitsToReplace > 0);
    const miscellaneousUnits = miscellaneousProductBreakdown.reduce((sum, product) => sum + product.unitsToReplace, 0);
    const missingMiscellaneousCost = miscellaneousProductBreakdown.some((product) => product.capital == null);
    const cashAvailableAfterChangeFloat = Math.max(cashCountedBeforeWithdrawal - closingChangeFloat, 0);
    const previouslyRecordedOnline = activeCyclePayments?.records
      .filter((record) => record.channel === "online" && record.source !== "cycle_check_total")
      .reduce((sum, record) => sum + record.amount, 0) ?? 0;
    const availableOnlinePayments = previouslyRecordedOnline
      + parseNumberInput(draft?.gcashCollected ?? "0")
      + parseNumberInput(draft?.mayaCollected ?? "0");
    const totalAvailable = cashAvailableAfterChangeFloat + availableOnlinePayments;
    const cycleHours = Math.max((Date.now() - new Date(serverDraft.startedAt).getTime()) / 3_600_000, 0);
    const electricityShare = cycleHours * settings.electricityCostPerHour;
    const miscCapital = missingMiscellaneousCost
      ? null
      : miscellaneousProductBreakdown.reduce((sum, product) => sum + (product.capital ?? 0), 0);
    const totalSetAside = puresafeCapital == null || miscCapital == null
      ? null
      : puresafeCapital + electricityShare + miscCapital;
    const cashOnlySetAside = calculateCashOnlySetAside({
      cashAvailableAfterChangeFloat,
      availableOnlinePayments,
      totalSetAside,
    });

    return {
      cycleId: serverDraft.cycleId,
      cycleNumber: serverDraft.cycleNumber,
      startedAt: serverDraft.startedAt,
      completedAt: null,
      isEstimate: true,
      cashCounted: cashCountedBeforeWithdrawal,
      closingChangeFloat,
      cashAvailableAfterChangeFloat,
      availableOnlinePayments,
      totalAvailable,
      puresafeBottlesToReplace: puresafeUnits,
      puresafeCostPerUnit: puresafeProducts[0]?.defaultUnitCost ?? null,
      puresafeCapital,
      puresafeProductId: puresafeProducts[0]?.id ?? null,
      missingPuresafeCost,
      cycleHours,
      electricityCostPerHour: settings.electricityCostPerHour,
      electricityShare,
      miscCapitalType: "automatic",
      fixedMiscCapital: 0,
      miscCapitalPercentage: 0,
      miscCapital,
      miscellaneousBottlesToReplace: miscellaneousUnits,
      missingMiscellaneousCost,
      miscellaneousProductBreakdown,
      totalSetAside,
      remainingEarnings: cashOnlySetAside.remainingEarnings,
      shortfall: cashOnlySetAside.shortfall,
      settingsSnapshottedAt: null,
    };
  }, [activeCyclePayments, cashCountedBeforeWithdrawal, closingChangeFloat, draft, products, resolvedPreview, serverDraft, settings]);

  if (isLoading) {
    return <Spinner color="brand.400" />;
  }

  if (!serverDraft || !draft) {
    return (
      <SectionCard title="No active cycle yet">
        <Text color="canvas.700">
          Set up your box first, or complete any pending setup before checking the box.
        </Text>
        <Button mt={4} onClick={() => navigate("/setup")}>
          Set up box
        </Button>
      </SectionCard>
    );
  }

  const activeServerDraft = serverDraft;
  const activeDraft = draft;

  async function handleOpeningFloatAdjustment() {
    if (!floatAdjustmentReason.trim()) {
      toast({ title: "Reason required", description: "Explain why the opening float is being corrected.", status: "warning", position: "top" });
      return;
    }
    setIsSavingFloatAdjustment(true);
    try {
      await updateCycleChangeFloat({
        cycleId: activeServerDraft.cycleId,
        openingChangeFloat: openingFloatAdjustment,
        reason: floatAdjustmentReason,
      });
      setIsFloatAdjustmentOpen(false);
      setFloatAdjustmentReason("");
      await load();
      toast({ title: "Opening float updated", description: "The reason was saved in the cash audit trail.", status: "success", position: "top" });
    } catch (error) {
      toast({ title: "Could not update opening float", description: error instanceof Error ? error.message : "Please try again.", status: "error", position: "top" });
    } finally {
      setIsSavingFloatAdjustment(false);
    }
  }

  async function handlePreview() {
    setIsPreviewLoading(true);
    try {
      const nextPreview = await previewBoxCheck({
        cashCollected: String(cashGenerated ?? 0),
        cashCountedBeforeWithdrawal: activeDraft.cashCountedBeforeWithdrawal,
        closingChangeFloat: activeDraft.closingChangeFloat,
        cashAddedForChange: activeDraft.cashAddedForChange,
        cashAddedForChangeNote: activeDraft.cashAddedForChangeNote,
        gcashCollected: activeDraft.gcashCollected,
        mayaCollected: activeDraft.mayaCollected,
        counts: activeServerDraft.items.map((item) => ({
          productId: item.productId,
          endingQuantity: activeDraft.counts[item.productId] ?? "0",
        })),
        nonSaleRemovals: activeDraft.nonSaleRemovals,
      });
      setPreview(nextPreview);
      setStep(2);
    } catch (error) {
      toast({
        title: "Could not preview this box check",
        description: error instanceof Error ? error.message : "Please review your counts.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleComplete() {
    setIsSubmitting(true);

    try {
      const cycleNote = buildCycleNote(activeDraft.note, activeDraft.differenceResolution);

      const result = await completeBoxCheck({
        cashCollected: String(cashGenerated ?? 0),
        cashCountedBeforeWithdrawal: activeDraft.cashCountedBeforeWithdrawal,
        closingChangeFloat: activeDraft.closingChangeFloat,
        cashAddedForChange: activeDraft.cashAddedForChange,
        cashAddedForChangeNote: activeDraft.cashAddedForChangeNote,
        gcashCollected: activeDraft.gcashCollected,
        mayaCollected: activeDraft.mayaCollected,
        counts: activeServerDraft.items.map((item) => ({
          productId: item.productId,
          endingQuantity: activeDraft.counts[item.productId] ?? "0",
        })),
        nonSaleRemovals: activeDraft.nonSaleRemovals,
        refillItems: activeDraft.refillItems,
        note: cycleNote,
        idempotencyKey: crypto.randomUUID(),
      });

      if (activeDraft.differenceResolution.type) {
        const resolutionAmount =
          activeDraft.differenceResolution.type === "PAY_LATER"
            ? String(pendingPayLaterAmount)
            : activeDraft.differenceResolution.amount || "0";

        await recordCycleDifference({
          cycleId: result.completedCycleId,
          resolutionType: activeDraft.differenceResolution.type,
          amount: resolutionAmount,
          customerLabel: activeDraft.differenceResolution.customerLabel,
          itemsSummary: activeDraft.differenceResolution.itemsSummary,
          dueDate: activeDraft.differenceResolution.dueDate,
          note: activeDraft.differenceResolution.note,
        });
      }

      clearCheckBoxDraft(activeDraft.cycleId);
      setPreview(result.preview);
      setStep(4);
      toast({
        title: "Box check complete",
        description:
          activeDraft.differenceResolution.type === "PAY_LATER" && pendingPayLaterAmount > 0
            ? `Next cycle starts with ${result.nextCycleStartingStock} bottles, and ${formatCurrency(pendingPayLaterAmount)} was recorded as pay-later.`
            : `Next cycle starts with ${result.nextCycleStartingStock} bottles.`,
        status: "success",
        duration: 3200,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not complete the box check",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setDraft(createInitialDraft(activeServerDraft));
    setStep(0);
    toast({
      title: "Box check reset",
      description: "The current check draft was cleared and restarted from the money step.",
      status: "info",
      duration: 2600,
      isClosable: true,
      position: "top",
    });
  }

  function goToStep(nextStep: number) {
    if (nextStep < 0 || nextStep > step) {
      return;
    }

    if (nextStep === 2 && !resolvedPreview) {
      return;
    }

    setStep(nextStep);
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Progress" title={`Step ${step + 1} of ${steps.length}`}>
        <HStack spacing={2} flexWrap="wrap">
          {steps.map((label, index) => (
            <Button
              key={label}
              onClick={() => goToStep(index)}
              isDisabled={index > step || (index === 2 && !resolvedPreview)}
              variant={index <= step ? "solid" : "ghost"}
              px={4}
              py={2}
              borderRadius="full"
              bg={index <= step ? "brand.400" : "canvas.200"}
              color={index <= step ? "white" : "canvas.700"}
              fontWeight="800"
              _hover={{
                bg: index <= step ? "brand.500" : "canvas.300",
              }}
            >
              {label}
            </Button>
          ))}
        </HStack>
        <HStack mt={4} spacing={3} flexWrap="wrap">
          {step > 0 ? (
            <Button variant="outline" onClick={() => goToStep(step - 1)}>
              Back one step
            </Button>
          ) : null}
          <Button variant="ghost" onClick={handleReset}>
            Reset this check
          </Button>
        </HStack>
      </SectionCard>

      {step === 0 ? (
        <SectionCard eyebrow="Money" title="Count the cash and record online payments.">
          <Text color="canvas.700">Last checked {formatDateTimeLabel(serverDraft.startedAt)}</Text>
          {(cashRemovedSinceLastVisit > 0 || cashReturnedSinceLastVisit > 0) ? (
            <Box mt={4} borderRadius="24px" bg="canvas.50" p={4}>
              <Text fontWeight="800">Recorded cash movements since your last visit</Text>
              <Text color="canvas.700" mt={2}>
                Cash removed: {formatCurrency(cashRemovedSinceLastVisit)}
              </Text>
              <Text color="canvas.700" mt={1}>
                Latest legacy Left for Change: {formatCurrency(cashReturnedSinceLastVisit)}
              </Text>
              <Text color="canvas.700" mt={2}>
                Previously recorded as “Cash Returned.” Enter today’s final Left for Change below.
              </Text>
            </Box>
          ) : null}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
            <Box bg="canvas.50" borderRadius="22px" p={4}>
              <Text color="canvas.700" fontSize="sm">Opening change float</Text>
              <Text fontWeight="900" fontSize="xl" mt={1}>{openingChangeFloat == null ? "Unknown" : formatCurrency(openingChangeFloat)}</Text>
              <Text color="canvas.700" fontSize="sm" mt={1}>Carried from the previous check’s Left for Change.</Text>
              <Button size="sm" variant="outline" mt={3} onClick={() => {
                setOpeningFloatAdjustment(openingChangeFloat == null ? "" : String(openingChangeFloat));
                setIsFloatAdjustmentOpen(true);
              }}>{openingChangeFloat == null ? "Set opening float" : "Correct opening float"}</Button>
            </Box>
            <MoneyInput
              label="Total cash counted"
              value={draft.cashCountedBeforeWithdrawal}
              onChange={(value) =>
                updateDraft(setDraft, setPreview, { cashCountedBeforeWithdrawal: value })
              }
            />
            <MoneyInput
              label="Left for Change"
              value={draft.closingChangeFloat}
              onChange={(value) =>
                updateDraft(setDraft, setPreview, { closingChangeFloat: value })
              }
            />
            <MoneyInput
              label="Cash added for change (optional)"
              value={draft.cashAddedForChange}
              onChange={(value) => updateDraft(setDraft, setPreview, { cashAddedForChange: value })}
            />
            {cashAddedForChange > 0 ? (
              <Box>
                <Text fontWeight="800" mb={2}>Why was cash added?</Text>
                <Textarea value={draft.cashAddedForChangeNote} onChange={(event) => updateDraft(setDraft, setPreview, { cashAddedForChangeNote: event.target.value })} placeholder="Required audit note; this money is not revenue" />
              </Box>
            ) : null}
            <MoneyInput
              label="GCash"
              value={draft.gcashCollected}
              onChange={(value) =>
                updateDraft(setDraft, setPreview, { gcashCollected: value })
              }
            />
            <MoneyInput
              label="Maya"
              value={draft.mayaCollected}
              onChange={(value) =>
                updateDraft(setDraft, setPreview, { mayaCollected: value })
              }
            />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mt={4}>
            <MetricCard
              label="Cash generated"
              value={cashGenerated == null ? "Cannot be determined" : formatCurrency(cashGenerated)}
              hint={cashGenerated == null ? "Set the opening change float first" : "Customer cash, separate from the change float"}
            />
            <MetricCard label="Cash withdrawn" value={formatCurrency(cashWithdrawn)} hint="Total counted less Left for Change" />
            <MetricCard label="Total customer payments" value={formatCurrency(moneyTotal)} hint="Cash generated + GCash + Maya" />
          </SimpleGrid>
          <Button mt={5} onClick={() => setStep(1)}>
            Next: count bottles
          </Button>
        </SectionCard>
      ) : null}

      {step === 1 ? (
        <Stack spacing={5}>
          <SectionCard eyebrow="Count what’s left" title="Count the bottles currently in the box.">
            <Stack spacing={4}>
              {serverDraft.items.map((item) => (
                <Box key={item.productId} bg="canvas.50" borderRadius="24px" p={4}>
                  <Text fontWeight="800">{item.productName}</Text>
                  <Text color="canvas.700" mt={1}>
                    Before {item.beforeQuantity}
                  </Text>
                  <Input
                    mt={3}
                    value={draft.counts[item.productId] ?? "0"}
                    onChange={(event) =>
                      updateDraft(setDraft, setPreview, {
                        counts: {
                          ...draft.counts,
                          [item.productId]: event.target.value,
                        },
                      })
                    }
                    inputMode="numeric"
                    placeholder="Now"
                  />
                </Box>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard
            eyebrow="Something doesn’t look right?"
            title="Record non-sale removals before you preview the results."
          >
            <Stack spacing={4}>
              {draft.nonSaleRemovals.map((item) => (
                <Box key={item.id} bg="canvas.50" borderRadius="24px" p={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    <Select
                      value={item.productId}
                      onChange={(event) =>
                        replaceRemoval(setDraft, setPreview, draft, item.id, {
                          productId: event.target.value,
                        })
                      }
                    >
                      {serverDraft.items.map((product) => (
                        <option key={product.productId} value={product.productId}>
                          {product.productName}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={item.reason}
                      onChange={(event) =>
                        replaceRemoval(setDraft, setPreview, draft, item.id, {
                          reason: event.target.value as NonSaleReason,
                        })
                      }
                    >
                      {nonSaleReasonOptions.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={item.quantity}
                      onChange={(event) =>
                        replaceRemoval(setDraft, setPreview, draft, item.id, {
                          quantity: event.target.value,
                        })
                      }
                      placeholder="Quantity"
                      inputMode="numeric"
                    />
                    <Input
                      value={item.note}
                      onChange={(event) =>
                        replaceRemoval(setDraft, setPreview, draft, item.id, {
                          note: event.target.value,
                        })
                      }
                      placeholder="Note"
                    />
                  </SimpleGrid>
                </Box>
              ))}
              <Button
                variant="outline"
                onClick={() => addRemoval(setDraft, serverDraft.items[0]?.productId ?? "")}
              >
                Add non-sale removal
              </Button>
            </Stack>
          </SectionCard>

          <Button onClick={() => void handlePreview()} isLoading={isPreviewLoading}>
            See results
          </Button>
        </Stack>
      ) : null}

      {step === 2 && resolvedPreview ? (
        <Stack spacing={5}>
          <SectionCard eyebrow="Box check" title={resolvedPreview.dateLabel}>
            <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4}>
              <MetricCard
                label="Expected from bottles taken"
                value={formatCurrency(resolvedPreview.totals.expectedRevenue)}
              />
              <MetricCard
                label="Money received this period"
                value={formatCurrency(resolvedPreview.totals.immediatePayments)}
              />
              <MetricCard
                label="Current difference"
                value={formatCurrency(resolvedPreview.totals.differenceAmount)}
              />
              <MetricCard
                label="Known pay-later"
                value={formatCurrency(resolvedPreview.totals.knownPayLater)}
                hint={
                  pendingPayLaterAmount > 0
                    ? `${formatCurrency(recordedPayLaterAmount)} already recorded + ${formatCurrency(pendingPayLaterAmount)} to add`
                    : recordedPayLaterAmount > 0
                      ? "From recorded pay-later balances"
                      : "No pay-later recorded yet"
                }
              />
              <MetricCard
                label="Unaccounted"
                value={formatCurrency(resolvedPreview.totals.unaccountedAmount)}
              />
              <MetricCard
                label="Accounted rate"
                value={formatPercent(resolvedPreview.totals.accountedRate)}
                hint="After known pay-later amounts"
              />
            </SimpleGrid>
          </SectionCard>

          <SectionCard eyebrow="Settlement" title="What is already settled vs still outstanding?">
            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
              <MetricCard
                label="Settled now"
                value={formatCurrency(resolvedPreview.totals.settledAmount)}
              />
              <MetricCard
                label="Settled rate"
                value={formatPercent(resolvedPreview.totals.settledRate)}
              />
              <MetricCard
                label="Outstanding"
                value={formatCurrency(resolvedPreview.totals.outstandingAmount)}
                hint={
                  pendingPayLaterAmount > 0
                    ? `${formatCurrency(recordedOutstandingAmount)} currently open + ${formatCurrency(pendingPayLaterAmount)} pending`
                    : undefined
                }
              />
              <MetricCard
                label="Physical cash"
                value={formatCurrency(resolvedPreview.totals.estimatedPhysicalCash)}
                hint="The closing float left in the box after this check"
              />
            </SimpleGrid>
          </SectionCard>

          <SectionCard eyebrow="Payment breakdown" title="Money collected">
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Text>Cash generated {formatCurrency(resolvedPreview.totals.cashGenerated)}</Text>
              <Text>GCash {formatCurrency(resolvedPreview.totals.gcashCollected)}</Text>
              <Text>Maya {formatCurrency(resolvedPreview.totals.mayaCollected)}</Text>
              <Text>Opening change float {formatCurrency(resolvedPreview.totals.openingChangeFloat)}</Text>
              <Text>Total cash counted {formatCurrency(resolvedPreview.totals.cashCountedBeforeWithdrawal)}</Text>
              <Text>Left for Change {formatCurrency(resolvedPreview.totals.closingChangeFloat)}</Text>
              <Text>Cash withdrawn {formatCurrency(resolvedPreview.totals.cashWithdrawn)}</Text>
              <Text>Interim withdrawals {formatCurrency(resolvedPreview.totals.interimOwnerWithdrawals)}</Text>
              <Text>Non-sales cash added {formatCurrency(resolvedPreview.totals.trackedNonSalesCashAdded)}</Text>
            </SimpleGrid>
          </SectionCard>

          {liveSetAside ? (
            <SectionCard eyebrow="Set Aside" title="Automatic reserve estimate">
              <SetAsideSummary value={liveSetAside} />
            </SectionCard>
          ) : null}

          {shortfallAmount > 0 ? (
            <SectionCard eyebrow="Account for difference" title="Tell Trustally what explains the gap.">
              <Stack spacing={4}>
                <Box>
                  <Text fontWeight="800">How should this difference be treated?</Text>
                  <Select
                    mt={3}
                    value={draft.differenceResolution.type}
                    onChange={(event) =>
                      updateDraft(
                        setDraft,
                        setPreview,
                        {
                          differenceResolution: updateDifferenceResolution(
                            draft.differenceResolution,
                            event.target.value as DifferenceResolutionType,
                            shortfallAmount,
                          ),
                        },
                        false,
                      )
                    }
                  >
                    <option value="">Select one</option>
                    {differenceResolutionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {draft.differenceResolution.type ? (
                    <Text color="canvas.700" mt={2}>
                      {
                        differenceResolutionOptions.find(
                          (option) => option.value === draft.differenceResolution.type,
                        )?.description
                      }
                    </Text>
                  ) : null}
                </Box>

                {draft.differenceResolution.type === "PAY_LATER" ? (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Field
                      label={`Amount to mark as pay-later (up to ${formatCurrency(shortfallAmount)})`}
                    >
                      <Input
                        value={draft.differenceResolution.amount}
                        onChange={(event) =>
                          updateDraft(
                            setDraft,
                            setPreview,
                            {
                              differenceResolution: {
                                ...draft.differenceResolution,
                                amount: event.target.value,
                              },
                            },
                            false,
                          )
                        }
                        inputMode="decimal"
                        placeholder={shortfallAmount.toFixed(2)}
                      />
                    </Field>
                    <Field label="Person / label">
                      <Input
                        value={draft.differenceResolution.customerLabel}
                        onChange={(event) =>
                          updateDraft(
                            setDraft,
                            setPreview,
                            {
                              differenceResolution: {
                                ...draft.differenceResolution,
                                customerLabel: event.target.value,
                              },
                            },
                            false,
                          )
                        }
                        placeholder="Anonymous / Unknown"
                      />
                    </Field>
                    <Field label="Items taken">
                      <Textarea
                        value={draft.differenceResolution.itemsSummary}
                        onChange={(event) =>
                          updateDraft(
                            setDraft,
                            setPreview,
                            {
                              differenceResolution: {
                                ...draft.differenceResolution,
                                itemsSummary: event.target.value,
                              },
                            },
                            false,
                          )
                        }
                        placeholder="Example: 2 Coke 500mL, 1 water"
                      />
                    </Field>
                    <Field label="Due date">
                      <Input
                        type="date"
                        value={draft.differenceResolution.dueDate}
                        onChange={(event) =>
                          updateDraft(
                            setDraft,
                            setPreview,
                            {
                              differenceResolution: {
                                ...draft.differenceResolution,
                                dueDate: event.target.value,
                              },
                            },
                            false,
                          )
                        }
                      />
                    </Field>
                    <Field label="Note">
                      <Input
                        value={draft.differenceResolution.note}
                        onChange={(event) =>
                          updateDraft(
                            setDraft,
                            setPreview,
                            {
                              differenceResolution: {
                                ...draft.differenceResolution,
                                note: event.target.value,
                              },
                            },
                            false,
                          )
                        }
                        placeholder="Payday group, Mark, late wallet check..."
                      />
                    </Field>
                  </SimpleGrid>
                ) : draft.differenceResolution.type ? (
                  <Field label="Note">
                    <Textarea
                      value={draft.differenceResolution.note}
                      onChange={(event) =>
                        updateDraft(
                          setDraft,
                          setPreview,
                          {
                            differenceResolution: {
                              ...draft.differenceResolution,
                              note: event.target.value,
                            },
                          },
                          false,
                        )
                      }
                      placeholder="Add context for this mismatch"
                    />
                  </Field>
                ) : null}
              </Stack>
            </SectionCard>
          ) : null}

          <SectionCard eyebrow="Product breakdown" title="What happened this cycle">
            <Stack spacing={3}>
              {resolvedPreview.productBreakdown.map((item) => (
                <Box key={item.productId} bg="canvas.50" borderRadius="24px" p={4}>
                  <Text fontWeight="800">{item.productName}</Text>
                  <Text color="canvas.700" mt={1}>
                    {item.unitsTaken} taken • Expected {formatCurrency(item.expectedRevenue)}
                  </Text>
                </Box>
              ))}
            </Stack>
          </SectionCard>

          <HStack spacing={3} flexWrap="wrap">
            <Button onClick={() => setStep(3)}>Continue</Button>
            <Button variant="outline" onClick={() => setStep(1)}>
              Something doesn’t look right
            </Button>
          </HStack>
        </Stack>
      ) : null}

      {step === 3 ? (
        <Stack spacing={5}>
          <SectionCard
            eyebrow="Refill the box?"
            title="Add anything you’re putting back before the next cycle starts."
          >
            <Stack spacing={4}>
              {draft.refillItems.map((item, index) => (
                <Box key={`${item.productId}-${index}`} bg="canvas.50" borderRadius="24px" p={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    <Select
                      value={item.productId}
                      onChange={(event) =>
                        replaceRefill(setDraft, draft, index, {
                          productId: event.target.value,
                        })
                      }
                    >
                      {products
                        .filter((product) => product.active)
                        .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.displayName}
                          </option>
                        ))}
                    </Select>
                    <Input
                      value={item.quantity}
                      onChange={(event) =>
                        replaceRefill(setDraft, draft, index, { quantity: event.target.value })
                      }
                      placeholder="Quantity"
                      inputMode="numeric"
                    />
                    <Input
                      value={item.unitCost}
                      onChange={(event) =>
                        replaceRefill(setDraft, draft, index, { unitCost: event.target.value })
                      }
                      placeholder="Unit cost"
                      inputMode="decimal"
                    />
                    <Input
                      value={item.sellingPrice}
                      onChange={(event) =>
                        replaceRefill(setDraft, draft, index, {
                          sellingPrice: event.target.value,
                        })
                      }
                      placeholder="Selling price"
                      inputMode="decimal"
                    />
                  </SimpleGrid>
                </Box>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          refillItems: [
                            ...current.refillItems,
                            {
                              productId: products.find((product) => product.active)?.id ?? "",
                              quantity: "",
                              unitCost: "",
                              sellingPrice: "",
                            },
                          ],
                        }
                      : current,
                  )
                }
              >
                + Add stock
              </Button>
              <Textarea
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Notes for this box check"
              />
            </Stack>
          </SectionCard>
          <Button onClick={() => void handleComplete()} isLoading={isSubmitting}>
            Complete box check
          </Button>
        </Stack>
      ) : null}

      {step === 4 && resolvedPreview ? (
        <SectionCard eyebrow="Box check complete" title="Next cycle is ready.">
          <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={4}>
            <MetricCard
              label="Expected"
              value={formatCurrency(resolvedPreview.totals.expectedRevenue)}
            />
            <MetricCard
              label="Received"
              value={formatCurrency(resolvedPreview.totals.immediatePayments)}
            />
              <MetricCard
                label="Known pay-later"
                value={formatCurrency(resolvedPreview.totals.knownPayLater)}
                hint={
                  pendingPayLaterAmount > 0
                    ? `${formatCurrency(recordedPayLaterAmount)} already recorded + ${formatCurrency(pendingPayLaterAmount)} added here`
                    : undefined
                }
              />
            <MetricCard
              label="Outstanding"
              value={formatCurrency(resolvedPreview.totals.outstandingAmount)}
            />
            <MetricCard
              label="Accounted"
              value={formatPercent(resolvedPreview.totals.accountedRate)}
            />
            <MetricCard
              label="Settled"
              value={formatPercent(resolvedPreview.totals.settledRate)}
            />
          </SimpleGrid>
          <Button mt={5} onClick={() => navigate("/")}>
            Done
          </Button>
        </SectionCard>
      ) : null}

      <Modal isOpen={isFloatAdjustmentOpen} onClose={() => setIsFloatAdjustmentOpen(false)} isCentered>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
          <ModalHeader>{openingChangeFloat == null ? "Set opening change float" : "Correct opening change float"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color="canvas.700">This is an explicit adjustment and will remain in the cash audit history.</Text>
            <Box mt={4}>
              <MoneyInput label="Opening change float" value={openingFloatAdjustment} onChange={setOpeningFloatAdjustment} />
            </Box>
            <Box mt={4}>
              <Text fontWeight="800" mb={2}>Reason for adjustment</Text>
              <Textarea value={floatAdjustmentReason} onChange={(event) => setFloatAdjustmentReason(event.target.value)} placeholder="Why is the carried amount being corrected?" />
            </Box>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={() => setIsFloatAdjustmentOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleOpeningFloatAdjustment()} isLoading={isSavingFloatAdjustment}>Save adjustment</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}

function createInitialDraft(payload: CheckBoxDraftPayload, legacyClosingChangeFloat = 0): CheckBoxDraft {
  return {
    cycleId: payload.cycleId,
    cashCollected: "0",
    cashCountedBeforeWithdrawal: "0",
    closingChangeFloat: String(legacyClosingChangeFloat),
    cashAddedForChange: "0",
    cashAddedForChangeNote: "",
    gcashCollected: "0",
    mayaCollected: "0",
    counts: Object.fromEntries(
      payload.items.map((item) => [item.productId, String(item.beforeQuantity)]),
    ),
    nonSaleRemovals: [],
    refillItems: [],
    differenceResolution: createEmptyDifferenceResolution(),
    note: "",
  };
}

function normalizeDraft(draft: CheckBoxDraft): CheckBoxDraft {
  return {
    ...draft,
    cashCountedBeforeWithdrawal: draft.cashCountedBeforeWithdrawal ?? draft.cashCollected ?? "0",
    closingChangeFloat: draft.closingChangeFloat ?? "0",
    cashAddedForChange: draft.cashAddedForChange ?? "0",
    cashAddedForChangeNote: draft.cashAddedForChangeNote ?? "",
    differenceResolution: {
      ...createEmptyDifferenceResolution(),
      ...draft.differenceResolution,
    },
  };
}

function createEmptyDifferenceResolution(): DifferenceResolutionInput {
  return {
    type: "",
    amount: "",
    customerLabel: "",
    itemsSummary: "",
    dueDate: "",
    note: "",
  };
}

function updateDraft(
  setDraft: React.Dispatch<React.SetStateAction<CheckBoxDraft | null>>,
  setPreview: React.Dispatch<React.SetStateAction<CheckBoxPreview | null>>,
  patch: Partial<CheckBoxDraft>,
  invalidatePreview = true,
) {
  if (invalidatePreview) {
    setPreview(null);
  }
  setDraft((current) => (current ? { ...current, ...patch } : current));
}

function addRemoval(
  setDraft: React.Dispatch<React.SetStateAction<CheckBoxDraft | null>>,
  defaultProductId: string,
) {
  setDraft((current) =>
    current
      ? {
          ...current,
          nonSaleRemovals: [
            ...current.nonSaleRemovals,
            {
              id: crypto.randomUUID(),
              productId: defaultProductId,
              reason: "FREE",
              quantity: "",
              note: "",
            },
          ],
        }
      : current,
  );
}

function replaceRemoval(
  setDraft: React.Dispatch<React.SetStateAction<CheckBoxDraft | null>>,
  setPreview: React.Dispatch<React.SetStateAction<CheckBoxPreview | null>>,
  draft: CheckBoxDraft,
  removalId: string,
  patch: Partial<CheckBoxDraft["nonSaleRemovals"][number]>,
) {
  setPreview(null);
  setDraft({
    ...draft,
    nonSaleRemovals: draft.nonSaleRemovals.map((item) =>
      item.id === removalId ? { ...item, ...patch } : item,
    ),
  });
}

function replaceRefill(
  setDraft: React.Dispatch<React.SetStateAction<CheckBoxDraft | null>>,
  draft: CheckBoxDraft,
  index: number,
  patch: Partial<CheckBoxDraft["refillItems"][number]>,
) {
  setDraft({
    ...draft,
    refillItems: draft.refillItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  });
}

function updateDifferenceResolution(
  current: DifferenceResolutionInput,
  type: DifferenceResolutionType,
  shortfallAmount: number,
): DifferenceResolutionInput {
  return {
    ...current,
    type,
    amount:
      type === "PAY_LATER" && !current.amount
        ? shortfallAmount > 0
          ? shortfallAmount.toFixed(2)
          : ""
        : current.amount,
  };
}

function buildCycleNote(note: string, resolution: DifferenceResolutionInput) {
  const parts = [note.trim()];

  if (resolution.type && resolution.type !== "PAY_LATER") {
    parts.push(`Difference noted: ${resolution.type.replace(/_/g, " ")}`);
  }

  if (resolution.type && resolution.note.trim()) {
    parts.push(`Difference note: ${resolution.note.trim()}`);
  }

  if (resolution.type === "PAY_LATER" && resolution.itemsSummary.trim()) {
    parts.push(`Pay-later items: ${resolution.itemsSummary.trim()}`);
  }

  return parts.filter(Boolean).join("\n\n");
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontWeight="800" mb={2}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Box>
      <Text fontWeight="800" mb={2}>
        {label}
      </Text>
      <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" />
    </Box>
  );
}
