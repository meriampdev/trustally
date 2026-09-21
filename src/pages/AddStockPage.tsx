import {
  Box, Button, FormControl, FormLabel, HStack, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, SimpleGrid, Spinner, Stack, Text,
  Textarea, useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import {
  archiveInventoryRestock, createInventoryRestock, fetchInventoryRestocks, fetchProducts,
  fetchPuresafeCostSettings, updateInventoryRestock,
} from "../lib/api";
import { exportCsv, printReport } from "../lib/exportData";
import { formatCurrency, formatManilaDateTime, manilaDateTimeInputToIso, parseNumberInput, toManilaDateTimeInput } from "../lib/format";
import type { InventoryRestock, Product, PuresafeCostSettings } from "../lib/types";

interface RestockDraft {
  id: string | null; productId: string; quantity: string; occurredAt: string; totalAmountPaid: string;
  unitCostOverride: string; sellingPrice: string; supplier: string; receiptReference: string; notes: string;
  packCount: string; waterContainers: string; actualBottlesFilled: string;
}

function newDraft(product?: Product): RestockDraft {
  return { id: null, productId: product?.id ?? "", quantity: "", occurredAt: toManilaDateTimeInput(), totalAmountPaid: "",
    unitCostOverride: "", sellingPrice: String(product?.currentSellingPrice ?? ""), supplier: "", receiptReference: "", notes: "",
    packCount: "2", waterContainers: "1", actualBottlesFilled: "16" };
}

export default function AddStockPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [restocks, setRestocks] = useState<InventoryRestock[]>([]);
  const [draft, setDraft] = useState<RestockDraft | null>(null);
  const [puresafe, setPuresafe] = useState<PuresafeCostSettings | null>(null);
  const [removeTarget, setRemoveTarget] = useState<InventoryRestock | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const [nextProducts, nextRestocks] = await Promise.all([fetchProducts(), fetchInventoryRestocks()]);
      setProducts(nextProducts.filter((item) => item.active)); setRestocks(nextRestocks); setErrorMessage("");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Could not load restocks."); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const selectedProduct = useMemo(() => products.find((item) => item.id === draft?.productId) ?? null, [draft?.productId, products]);
  const isPuresafe = Boolean(selectedProduct?.displayName.toLowerCase().includes("puresafe"));

  useEffect(() => {
    if (!draft?.productId || !isPuresafe) { setPuresafe(null); return; }
    void fetchPuresafeCostSettings(draft.productId).then(setPuresafe).catch(() => setPuresafe(null));
  }, [draft?.productId, isPuresafe]);

  const puresafeCalculation = useMemo(() => {
    if (!draft || !puresafe || !isPuresafe) return null;
    const quantity = parseNumberInput(draft.quantity), packs = parseNumberInput(draft.packCount);
    const containers = parseNumberInput(draft.waterContainers), filled = parseNumberInput(draft.actualBottlesFilled) || quantity;
    const packaging = puresafe.capSealPerUnit + puresafe.stickerPerUnit + puresafe.printingPerUnit + puresafe.otherPackagingPerUnit;
    const bottleCost = puresafe.bottlePackCost / puresafe.bottlePackUnits;
    const waterCost = filled > 0 ? (puresafe.waterContainerCost * Math.max(containers, 1)) / filled : 0;
    return { bottleCost, waterCost, packaging, basicUnitCost: bottleCost + waterCost + packaging,
      purchaseTotal: packs * puresafe.bottlePackCost + containers * puresafe.waterContainerCost + packaging * quantity };
  }, [draft, isPuresafe, puresafe]);
  const restockExportRows = restocks.map((item) => ({
    Date: formatManilaDateTime(item.occurredAt), Product: item.productName, Quantity: item.quantity,
    "Previous stock": item.previousQuantity ?? "Unknown", "New stock": item.newQuantity ?? "Unknown",
    "Previous average cost": item.previousAverageCost == null ? "Missing cost data" : formatCurrency(item.previousAverageCost),
    "Restock unit cost": formatCurrency(item.unitCost), "Total paid": formatCurrency(item.totalAmountPaid),
    "New weighted average": item.newWeightedAverageCost == null ? "Missing cost data" : formatCurrency(item.newWeightedAverageCost),
    Supplier: item.supplier ?? "", Reference: item.receiptReference ?? "", Notes: item.notes ?? "",
    "Recorded by": item.createdBy, Quality: item.costQuality,
  }));
  const restockExportColumns = Object.keys(restockExportRows[0] ?? {}).map((key) => ({ label: key, value: (row: typeof restockExportRows[number]) => row[key as keyof typeof row] }));
  const restockTotals: Array<[string, string | number]> = [["Restocks", restocks.length], ["Units added", restocks.reduce((total, item) => total + item.quantity, 0)], ["Capital invested", formatCurrency(restocks.reduce((total, item) => total + item.totalAmountPaid, 0))]];

  function openNew(product?: Product) { setErrorMessage(""); setPuresafe(null); setDraft(newDraft(product ?? products[0])); }
  function openEdit(restock: InventoryRestock) {
    setErrorMessage(""); setDraft({ id: restock.id, productId: restock.productId, quantity: String(restock.quantity),
      occurredAt: toManilaDateTimeInput(restock.occurredAt), totalAmountPaid: String(restock.totalAmountPaid), unitCostOverride: String(restock.unitCost),
      sellingPrice: "", supplier: restock.supplier ?? "", receiptReference: restock.receiptReference ?? "", notes: restock.notes ?? "",
      packCount: "", waterContainers: "", actualBottlesFilled: "" });
  }
  function updateDraft(patch: Partial<RestockDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.productId) { const product = products.find((item) => item.id === patch.productId); next.sellingPrice = String(product?.currentSellingPrice ?? ""); next.totalAmountPaid = ""; }
      if (patch.quantity !== undefined && !current.id && !isPuresafe) {
        const product = products.find((item) => item.id === next.productId), quantity = parseNumberInput(next.quantity);
        next.totalAmountPaid = quantity > 0 ? (quantity * (product?.defaultUnitCost ?? 0)).toFixed(2) : "";
      }
      return next;
    });
  }
  function applyPuresafeCalculation() {
    if (puresafeCalculation) updateDraft({ totalAmountPaid: puresafeCalculation.purchaseTotal.toFixed(2), unitCostOverride: puresafeCalculation.basicUnitCost.toFixed(4) });
  }

  async function save() {
    if (!draft) return;
    if (!draft.productId || parseNumberInput(draft.quantity) <= 0 || !draft.totalAmountPaid.trim() || parseNumberInput(draft.totalAmountPaid) < 0) {
      setErrorMessage("Choose a product and enter a valid quantity and total amount paid."); return;
    }
    setIsSaving(true); setErrorMessage("");
    try {
      const common = { quantity: Math.trunc(parseNumberInput(draft.quantity)), occurredAt: manilaDateTimeInputToIso(draft.occurredAt),
        totalAmountPaid: draft.totalAmountPaid, unitCostOverride: draft.unitCostOverride, supplier: draft.supplier,
        receiptReference: draft.receiptReference, notes: draft.notes };
      if (draft.id) await updateInventoryRestock({ ...common, restockId: draft.id });
      else await createInventoryRestock({ ...common, productId: draft.productId, sellingPrice: draft.sellingPrice,
        puresafeDetail: isPuresafe ? { packCount: parseNumberInput(draft.packCount), waterContainers: parseNumberInput(draft.waterContainers), actualBottlesFilled: parseNumberInput(draft.actualBottlesFilled) } : {},
        idempotencyKey: crypto.randomUUID() });
      setDraft(null); await load();
      toast({ title: draft.id ? "Restock corrected" : "Restock recorded", description: "Inventory capital and the linked purchase expense were updated automatically.", status: "success", position: "top", duration: 3000 });
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Could not save this restock."); }
    finally { setIsSaving(false); }
  }

  async function remove() {
    if (!removeTarget || !removeReason.trim()) return;
    setIsSaving(true);
    try { await archiveInventoryRestock(removeTarget.id, removeReason); setRemoveTarget(null); setRemoveReason(""); await load();
      toast({ title: "Restock removed", description: "Its stock, capital, linked expense, and movement entry were reversed.", status: "success", position: "top" }); }
    catch (error) { toast({ title: "Could not remove restock", description: error instanceof Error ? error.message : "Please try again.", status: "error", position: "top", duration: 4500 }); }
    finally { setIsSaving(false); }
  }

  if (isLoading) return <Spinner color="brand.400" />;
  return <Stack spacing={5} minW={0}>
    <SectionCard eyebrow="Restock" title="Add inventory without resetting its capital">
      <Text color="canvas.700">Trustally combines remaining inventory value with the purchase to calculate the new weighted-average cost. Its inventory expense is created automatically.</Text>
      <Button mt={4} onClick={() => openNew()}>Record restock</Button>
    </SectionCard>
    <SectionCard eyebrow="Products" title="Restock a product"><SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
      {products.map((product) => <Box key={product.id} bg="canvas.50" borderRadius="20px" p={4}><Text fontWeight="900">{product.displayName}</Text><Text color="canvas.700" mt={1}>Saved cost {formatCurrency(product.defaultUnitCost)} · Stock {product.lastKnownQuantity ?? 0}</Text><Button size="sm" mt={3} variant="outline" onClick={() => openNew(product)}>Restock</Button></Box>)}
    </SimpleGrid></SectionCard>
    <SectionCard eyebrow="History" title="Restock purchases">
      <HStack mb={4} spacing={2} flexWrap="wrap"><Button size="sm" variant="outline" isDisabled={!restocks.length} onClick={() => exportCsv("Trustally restock history", "trustally-restock-history-all-time.csv", restockExportRows, restockExportColumns, restockTotals)}>Export CSV</Button><Button size="sm" variant="outline" isDisabled={!restocks.length} onClick={() => printReport("Trustally restock history", restockExportRows, restockExportColumns, restockTotals)}>Print / PDF</Button></HStack>
      {restocks.length ? <Stack spacing={3}>{restocks.map((item) => <Box key={item.id} bg="canvas.50" p={4} borderRadius="20px">
        <HStack justify="space-between" align="start"><Box minW={0}><Text fontWeight="900">{item.productName}</Text><Text color="canvas.700">{formatManilaDateTime(item.occurredAt)} · {item.quantity} units</Text></Box><Text fontWeight="900">{formatCurrency(item.totalAmountPaid)}</Text></HStack>
        <Text mt={2} fontSize="sm">{item.previousAverageCost == null ? "Missing cost data" : formatCurrency(item.previousAverageCost)} → {item.newWeightedAverageCost == null ? "Missing cost data" : formatCurrency(item.newWeightedAverageCost)} weighted cost{item.costQuality !== "VERIFIED" ? ` · ${item.costQuality}` : ""}</Text>
        <HStack mt={3}>{item.editable ? <><Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button><Button size="sm" variant="ghost" color="caution.400" onClick={() => setRemoveTarget(item)}>Remove</Button></> : <Text fontSize="sm" color="canvas.700">Locked: completed sales use this cost basis.</Text>}</HStack>
      </Box>)}</Stack> : <Text color="canvas.700">No restocks recorded yet.</Text>}
    </SectionCard>
    <Modal isOpen={draft !== null} onClose={() => !isSaving && setDraft(null)} size="xl" isCentered scrollBehavior="inside"><ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)"/><ModalContent bg="canvas.100" borderRadius="28px" mx={4}>
      <ModalHeader>{draft?.id ? "Correct restock" : "Record restock"}</ModalHeader><ModalCloseButton isDisabled={isSaving}/><ModalBody><Stack spacing={4}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Field label="Product"><Box as="select" width="100%" value={draft?.productId ?? ""} disabled={Boolean(draft?.id)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft({ productId: e.target.value })} bg="canvas.50" borderRadius="12px" p={3}>{products.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</Box></Field>
          <Field label="Restock date and time"><Input type="datetime-local" value={draft?.occurredAt ?? ""} onChange={(e) => updateDraft({ occurredAt: e.target.value })}/></Field>
          <Field label="Quantity added"><Input inputMode="numeric" value={draft?.quantity ?? ""} onChange={(e) => updateDraft({ quantity: e.target.value })}/></Field>
          <Field label="Total amount paid"><Input inputMode="decimal" value={draft?.totalAmountPaid ?? ""} onChange={(e) => updateDraft({ totalAmountPaid: e.target.value })}/></Field>
          <Field label="Actual unit cost override (optional)"><Input inputMode="decimal" value={draft?.unitCostOverride ?? ""} onChange={(e) => updateDraft({ unitCostOverride: e.target.value })}/></Field>
          {!draft?.id ? <Field label="Selling price"><Input inputMode="decimal" value={draft?.sellingPrice ?? ""} onChange={(e) => updateDraft({ sellingPrice: e.target.value })}/></Field> : null}
          <Field label="Supplier (optional)"><Input value={draft?.supplier ?? ""} onChange={(e) => updateDraft({ supplier: e.target.value })}/></Field>
          <Field label="Receipt/reference (optional)"><Input value={draft?.receiptReference ?? ""} onChange={(e) => updateDraft({ receiptReference: e.target.value })}/></Field>
        </SimpleGrid>
        {isPuresafe && puresafe && !draft?.id ? <Box bg="canvas.50" p={4} borderRadius="20px"><Text fontWeight="900">Puresafe cost calculator</Text><SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mt={3}>
          <Field label="Bottle packs bought"><Input value={draft?.packCount ?? ""} onChange={(e) => updateDraft({ packCount: e.target.value })}/></Field><Field label="Water containers"><Input value={draft?.waterContainers ?? ""} onChange={(e) => updateDraft({ waterContainers: e.target.value })}/></Field><Field label="Actual bottles filled"><Input value={draft?.actualBottlesFilled ?? ""} onChange={(e) => updateDraft({ actualBottlesFilled: e.target.value })}/></Field>
        </SimpleGrid>{puresafeCalculation ? <Text mt={3} fontSize="sm">Bottle {formatCurrency(puresafeCalculation.bottleCost)} + water {formatCurrency(puresafeCalculation.waterCost)} + packaging {formatCurrency(puresafeCalculation.packaging)} = {formatCurrency(puresafeCalculation.basicUnitCost)} basic unit cost</Text> : null}<Button size="sm" mt={3} variant="outline" onClick={applyPuresafeCalculation}>Use calculated purchase cost</Button></Box> : null}
        <Field label="Notes (optional)"><Textarea value={draft?.notes ?? ""} onChange={(e) => updateDraft({ notes: e.target.value })}/></Field>{errorMessage ? <Text color="caution.500">{errorMessage}</Text> : null}
      </Stack></ModalBody><ModalFooter gap={3}><Button variant="outline" onClick={() => setDraft(null)} isDisabled={isSaving}>Cancel</Button><Button onClick={() => void save()} isLoading={isSaving}>Save restock</Button></ModalFooter>
    </ModalContent></Modal>
    <Modal isOpen={removeTarget !== null} onClose={() => !isSaving && setRemoveTarget(null)} isCentered><ModalOverlay bg="blackAlpha.700"/><ModalContent bg="canvas.100" borderRadius="28px" mx={4}><ModalHeader>Remove restock?</ModalHeader><ModalCloseButton/><ModalBody><Text>This reverses its inventory, capital, linked expense, and movement record.</Text><FormControl mt={4} isRequired><FormLabel>Reason</FormLabel><Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)}/></FormControl></ModalBody><ModalFooter gap={3}><Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button><Button colorScheme="red" onClick={() => void remove()} isLoading={isSaving} isDisabled={!removeReason.trim()}>Remove</Button></ModalFooter></ModalContent></Modal>
  </Stack>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormControl><FormLabel fontSize="sm" color="canvas.700">{label}</FormLabel>{children}</FormControl>; }
