import { Box, Button, FormControl, FormLabel, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { DateRangeModal } from "../components/DateRangeModal";
import { SectionCard } from "../components/SectionCard";
import { fetchBusinessAccountingReport, fetchReportsSnapshot } from "../lib/api";
import { BusinessRangeKey, resolveBusinessRange } from "../lib/businessRange";
import { buildCsv, exportCsv, exportZip, printReport, type ExportColumn } from "../lib/exportData";
import { formatCurrency, formatManilaDateTime, formatPercent } from "../lib/format";
import type { BusinessAccountingReport, ReportsSnapshot } from "../lib/types";

type ReportKey = "sales" | "profitability" | "restocks" | "capital" | "expenses" | "cycles" | "movements";
type ExportRow = Record<string, unknown>;
const reportOptions: Array<{ key: ReportKey; label: string }> = [
  { key: "sales", label: "Sales" }, { key: "profitability", label: "Product profitability" },
  { key: "restocks", label: "Restock history" }, { key: "capital", label: "Capital recovery" },
  { key: "expenses", label: "Expenses" }, { key: "cycles", label: "Cycle summary" }, { key: "movements", label: "Stock movements" },
];
const rangeOptions: Array<{ key: BusinessRangeKey; label: string }> = [
  { key: "today", label: "Today" }, { key: "week", label: "This week" }, { key: "month", label: "This month" },
  { key: "custom", label: "Custom" }, { key: "all", label: "All time" },
];

interface Filters { productId: string; category: string; cycleId: string; movementType: string; paymentMethod: string; status: string }
const emptyFilters: Filters = { productId: "", category: "", cycleId: "", movementType: "", paymentMethod: "", status: "" };

export default function BusinessReportsPage() {
  const [reportKey, setReportKey] = useState<ReportKey>("sales"); const [rangeKey, setRangeKey] = useState<BusinessRangeKey>("month");
  const [customStart, setCustomStart] = useState(""); const [customEnd, setCustomEnd] = useState("");
  const [dateOpen, setDateOpen] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters); const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [report, setReport] = useState<BusinessAccountingReport | null>(null); const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState("");
  const range = useMemo(() => resolveBusinessRange(rangeKey, null, customStart, customEnd), [rangeKey, customStart, customEnd]);

  useEffect(() => {
    if (rangeKey === "custom" && (!customStart || !customEnd)) { setDateOpen(true); return; }
    let cancelled = false; setIsLoading(true); setError("");
    void Promise.all([fetchBusinessAccountingReport(range.startAt, range.endAt), fetchReportsSnapshot("custom", range.startDate, range.endDate)])
      .then(([business, existing]) => { if (!cancelled) { setReport(business); setSnapshot(existing); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load business reports."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.startAt, range.endAt, range.startDate, range.endDate, rangeKey, customStart, customEnd]);

  const categories = useMemo(() => [...new Set(report?.products.map((item) => item.category).filter(Boolean) ?? [])].sort(), [report]);
  const view = useMemo(() => report ? buildView(reportKey, report, filters) : null, [reportKey, report, filters]);
  const filenameRange = rangeKey === "all" ? "all-time" : `${range.startDate}-to-${range.endDate}`;

  function openFilters() { setDraftFilters(filters); setFiltersOpen(true); }
  function exportCurrent(kind: "csv" | "print") {
    if (!view) return; const filename = `trustally-${reportKey}-${filenameRange}.csv`;
    if (kind === "csv") exportCsv(view.title, filename, view.rows, view.columns, view.totals);
    else printReport(view.title, view.rows, view.columns, view.totals);
  }
  function exportAll() {
    if (!report || !snapshot) return;
    const files = completeExportFiles(report, snapshot, filenameRange);
    exportZip(`trustally-complete-report-${new Date().toISOString().slice(0, 10)}.zip`, files);
  }

  return <Stack spacing={5} minW={0}>
    <SectionCard eyebrow="Business reports" title="Sales, capital, profit, expenses, and stock history">
      <Box overflowX="auto" maxW="100%" pb={2}><HStack width="max-content">{reportOptions.map((item) => <Button key={item.key} size="sm" flexShrink={0} variant={reportKey === item.key ? "solid" : "outline"} onClick={() => setReportKey(item.key)}>{item.label}</Button>)}</HStack></Box>
      <Box overflowX="auto" maxW="100%" mt={3} pb={2}><HStack width="max-content">{rangeOptions.map((item) => <Button key={item.key} size="sm" flexShrink={0} variant={rangeKey === item.key ? "solid" : "outline"} onClick={() => { setRangeKey(item.key); if (item.key === "custom") setDateOpen(true); }}>{item.label}</Button>)}</HStack></Box>
      <HStack mt={4} spacing={2} flexWrap="wrap"><Button size="sm" variant="outline" onClick={openFilters}>Filters{Object.values(filters).some(Boolean) ? " · Active" : ""}</Button><Button size="sm" onClick={() => exportCurrent("csv")}>Export CSV</Button><Button size="sm" variant="outline" onClick={() => exportCurrent("print")}>Print / PDF</Button><Button size="sm" variant="outline" onClick={exportAll}>Export all data</Button></HStack>
    </SectionCard>
    {isLoading ? <Spinner color="brand.400"/> : error ? <SectionCard title="Couldn’t load reports"><Text color="caution.500">{error}</Text></SectionCard> : view ? <>
      <SectionCard eyebrow="Filtered totals" title={view.title}><SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={3}>{view.totals.map(([label, value]) => <Box key={label} bg="canvas.50" borderRadius="18px" p={4}><Text color="canvas.700" fontSize="sm">{label}</Text><Text fontWeight="900" mt={1}>{String(value)}</Text></Box>)}</SimpleGrid></SectionCard>
      <SectionCard eyebrow="Itemized records" title={`${view.rows.length} records`}>
        {view.rows.length ? <Stack spacing={3}>{view.rows.map((row, index) => <Box key={String(row.id ?? index)} bg="canvas.50" borderRadius="20px" p={4}><SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={3}>{view.columns.map((column) => <Box key={column.label}><Text color="canvas.700" fontSize="xs" textTransform="uppercase" letterSpacing="wide">{column.label}</Text><Text mt={1} fontWeight={column.label === view.columns[0].label ? "900" : "600"}>{String(column.value(row) ?? "Missing cost data")}</Text></Box>)}</SimpleGrid></Box>)}</Stack> : <Text color="canvas.700">No records match the selected date range and filters.</Text>}
      </SectionCard>
    </> : null}
    <DateRangeModal isOpen={dateOpen} onClose={() => setDateOpen(false)} startDate={customStart || range.startDate} endDate={customEnd || range.endDate} onApply={(start, end) => { setCustomStart(start); setCustomEnd(end); setRangeKey("custom"); }}/>
    <Modal isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} isCentered size="lg"><ModalOverlay bg="blackAlpha.700"/><ModalContent bg="canvas.100" borderRadius="28px" mx={4}><ModalHeader>Report filters</ModalHeader><ModalCloseButton/><ModalBody><SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
      <Filter label="Product" value={draftFilters.productId} onChange={(value) => setDraftFilters({ ...draftFilters, productId: value })}><option value="">All products</option>{report?.products.map((item) => <option key={item.productId} value={item.productId}>{item.productName}</option>)}</Filter>
      <Filter label="Category" value={draftFilters.category} onChange={(value) => setDraftFilters({ ...draftFilters, category: value })}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</Filter>
      <Filter label="Cycle" value={draftFilters.cycleId} onChange={(value) => setDraftFilters({ ...draftFilters, cycleId: value })}><option value="">All cycles</option>{report?.cycles.map((item) => <option key={item.cycleId} value={item.cycleId}>Cycle #{item.cycleNumber}</option>)}</Filter>
      <Filter label="Movement type" value={draftFilters.movementType} onChange={(value) => setDraftFilters({ ...draftFilters, movementType: value })}><option value="">All movement types</option>{["OPENING","RESTOCK","SALE","ADJUSTMENT","DAMAGED","MISSING","COACH_DEDUCTION","OTHER"].map((item) => <option key={item}>{item}</option>)}</Filter>
      <Filter label="Payment method" value={draftFilters.paymentMethod} onChange={(value) => setDraftFilters({ ...draftFilters, paymentMethod: value })}><option value="">All methods</option>{["CASH","GCASH","MAYA","BANK","OTHER"].map((item) => <option key={item}>{item}</option>)}</Filter>
      <Filter label="Break-even status" value={draftFilters.status} onChange={(value) => setDraftFilters({ ...draftFilters, status: value })}><option value="">All statuses</option><option value="recovering">Recovering capital</option><option value="recovered">Capital recovered</option><option value="no-stock">No stock</option><option value="missing">No cost data</option></Filter>
    </SimpleGrid></ModalBody><ModalFooter gap={3}><Button variant="ghost" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setFiltersOpen(false); }}>Clear</Button><Button variant="outline" onClick={() => setFiltersOpen(false)}>Cancel</Button><Button onClick={() => { setFilters(draftFilters); setFiltersOpen(false); }}>Apply filters</Button></ModalFooter></ModalContent></Modal>
  </Stack>;
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <FormControl><FormLabel>{label}</FormLabel><Select value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></FormControl>; }

function buildView(key: ReportKey, report: BusinessAccountingReport, filters: Filters) {
  const productMatches = (item: { productId?: string; productCategory?: string; category?: string }) => (!filters.productId || item.productId === filters.productId) && (!filters.category || (item.productCategory ?? item.category) === filters.category);
  if (key === "sales") {
    const source = report.sales.filter((item) => productMatches(item) && (!filters.cycleId || item.cycleId === filters.cycleId) && (!filters.paymentMethod || item.paymentMethod === filters.paymentMethod));
    const rows = source.map((item) => ({ id:item.id, Date:formatManilaDateTime(item.soldAt), Cycle:`#${item.cycleNumber}`, Product:item.productName, Quantity:item.quantitySold, "Selling price":formatCurrency(item.sellingPrice), Revenue:formatCurrency(item.revenue), "Unit cost used":item.unitCostUsed == null ? "Missing cost data" : formatCurrency(item.unitCostUsed), "Capital recovered / COGS":item.capitalRecovered == null ? "Missing cost data" : formatCurrency(item.capitalRecovered), "Gross profit":item.grossProfit == null ? "Missing cost data" : formatCurrency(item.grossProfit), "Payment method":item.paymentMethod ?? "Not attributable", Quality:item.costQuality }));
    return view("Sales report", rows, [["Revenue",formatCurrency(sum(source.map((item)=>item.revenue)))],["Units sold",sum(source.map((item)=>item.quantitySold))],["Capital recovered",nullableMoney(source.map((item)=>item.capitalRecovered))],["Gross profit",nullableMoney(source.map((item)=>item.grossProfit))]]);
  }
  if (key === "profitability" || key === "capital") {
    const source = report.products.filter((item) => productMatches(item) && (!filters.status || productStatus(item) === filters.status));
    if (key === "capital") {
      const rows = source.map((item) => ({ id:item.productId, Product:item.productName, "Total capital invested":formatCurrency(item.capitalInvested), "Capital recovered":formatCurrency(item.capitalRecovered), "Capital remaining in inventory":item.capitalRemaining==null?"Missing cost data":formatCurrency(item.capitalRemaining), "Recovery percentage":formatPercent(item.recoveryPercentage), Revenue:formatCurrency(item.revenue), "Gross profit":formatCurrency(item.grossProfit), "Inventory capital status":statusLabel(item), "Capital recovery date":item.capitalRecoveredAt?formatManilaDateTime(item.capitalRecoveredAt):"Not reached", "Cash break-even status":item.cashBreakEvenAt?"Reached":"Not reached", "Cash break-even date":item.cashBreakEvenAt?formatManilaDateTime(item.cashBreakEvenAt):"Not reached", "First restock":item.firstRestockAt?formatManilaDateTime(item.firstRestockAt):"Unknown", "Latest restock":item.lastRestockAt?formatManilaDateTime(item.lastRestockAt):"None", Quality:item.dataQuality }));
      return view("Capital-recovery report",rows,[["Total capital invested",formatCurrency(sum(source.map(i=>i.capitalInvested)))],["Capital recovered",formatCurrency(sum(source.map(i=>i.capitalRecovered)))],["Capital remaining",nullableMoney(source.map(i=>i.capitalRemaining))],["Revenue",formatCurrency(sum(source.map(i=>i.revenue)))] ]);
    }
    const rows = source.map((item) => ({ id:item.productId, Product:item.productName, "Opening stock":item.periodOpeningStock, Restocked:item.periodRestocked, Sold:item.periodUnitsSold, "Closing stock":item.periodClosingStock, "Average unit cost":item.weightedAverageUnitCost == null ? "Missing cost data" : formatCurrency(item.weightedAverageUnitCost), Revenue:formatCurrency(item.periodRevenue), "Capital recovered / COGS":item.periodCapitalRecovered == null ? "Missing cost data" : formatCurrency(item.periodCapitalRecovered), "Gross profit":item.periodGrossProfit == null ? "Missing cost data" : formatCurrency(item.periodGrossProfit), "Gross margin":item.periodRevenue>0&&item.periodGrossProfit!=null?formatPercent(item.periodGrossProfit/item.periodRevenue*100):"Not enough data", "Current inventory value":item.inventoryValue==null?"Missing cost data":formatCurrency(item.inventoryValue), Status:statusLabel(item), Quality:item.dataQuality }));
    return view("Product profitability report", rows, [["Revenue",formatCurrency(sum(source.map((item)=>item.periodRevenue)))],["Capital recovered",nullableMoney(source.map((item)=>item.periodCapitalRecovered))],["Gross profit",nullableMoney(source.map((item)=>item.periodGrossProfit))],["Current inventory value",nullableMoney(source.map((item)=>item.inventoryValue))]]);
  }
  if (key === "restocks") {
    const source=report.restocks.filter(productMatches); const rows=source.map((item)=>({id:item.id,Date:formatManilaDateTime(item.occurredAt),Product:item.productName,Quantity:item.quantity,"Previous stock":item.previousQuantity??"Unknown","New stock":item.newQuantity??"Unknown","Previous average cost":item.previousAverageCost==null?"Unknown":formatCurrency(item.previousAverageCost),"Restock unit cost":formatCurrency(item.unitCost),"Total paid":formatCurrency(item.totalAmountPaid),"New weighted average":item.newWeightedAverageCost==null?"Missing cost data":formatCurrency(item.newWeightedAverageCost),Supplier:item.supplier??"",Reference:item.receiptReference??"",Notes:item.notes??"","Recorded by":item.createdBy,Quality:item.costQuality}));
    return view("Restock history report",rows,[["Restocks",source.length],["Units added",sum(source.map(i=>i.quantity))],["Capital invested",formatCurrency(sum(source.map(i=>i.totalAmountPaid)))],["Linked expenses",source.length]]);
  }
  if (key === "expenses") {
    const productNames=new Map(report.products.map((item)=>[item.productId,item.productName]));
    const source=report.expenses.filter((item)=>(!filters.productId||item.productId===filters.productId)); const rows=source.map((item)=>({id:item.id,Date:item.incurredOn,Type:item.expenseType??"OPERATING",Category:item.category,Description:item.description??"",Amount:formatCurrency(item.amount),Product:item.productId?productNames.get(item.productId)??item.productId:"",Restock:item.restockId??"",Treatment:item.affectsInventoryCost?"Inventory cost / COGS":"Operating expense / net profit"}));
    return view("Expense report",rows,[["All expenses",formatCurrency(sum(source.map(i=>i.amount)))],["Inventory purchases",formatCurrency(sum(source.filter(i=>i.affectsInventoryCost).map(i=>i.amount)))],["Operating expenses",formatCurrency(sum(source.filter(i=>!i.affectsInventoryCost).map(i=>i.amount)))],["Records",source.length]]);
  }
  if (key === "cycles") {
    const source=report.cycles.filter((item)=>(!filters.cycleId||item.cycleId===filters.cycleId)); const rows=source.map((item)=>({id:item.cycleId,Cycle:`#${item.cycleNumber}`,Dates:`${formatManilaDateTime(item.startedAt)} – ${formatManilaDateTime(item.completedAt)}`,"Expected sales":formatCurrency(item.expectedSales),Collections:formatCurrency(item.actualCollections),Cash:formatCurrency(item.cashCollected),Digital:formatCurrency(item.digitalPayments),"Change Float":formatCurrency(item.changeFloat),Difference:formatCurrency(item.difference),"Capital recovered":item.capitalRecovered==null?"Missing cost data":formatCurrency(item.capitalRecovered),"Gross profit":item.grossProfit==null?"Missing cost data":formatCurrency(item.grossProfit),"Other expenses":formatCurrency(item.otherExpenses),"Net profit":item.netProfit==null?"Missing cost data":formatCurrency(item.netProfit)}));
    return view("Cycle summary report",rows,[["Expected sales",formatCurrency(sum(source.map(i=>i.expectedSales)))],["Collections",formatCurrency(sum(source.map(i=>i.actualCollections)))],["Gross profit",nullableMoney(source.map(i=>i.grossProfit))],["Net profit",nullableMoney(source.map(i=>i.netProfit))]]);
  }
  const source=report.movements.filter((item)=>productMatches(item)&&(!filters.movementType||item.movementType===filters.movementType)); const rows=source.map((item)=>({id:item.id,Date:formatManilaDateTime(item.occurredAt),Product:item.productName,Type:item.movementType,"Quantity in":item.quantityIn,"Quantity out":item.quantityOut,"Running stock":item.runningStockBalance??"Unknown","Unit cost":item.unitCost==null?"Missing cost data":formatCurrency(item.unitCost),"Inventory value change":item.inventoryValueChange==null?"Missing cost data":formatCurrency(item.inventoryValueChange),Reference:item.reference??"",Notes:item.notes??"",Quality:item.dataQuality}));
  return view("Stock movement report",rows,[["Movements",source.length],["Quantity in",sum(source.map(i=>i.quantityIn))],["Quantity out",sum(source.map(i=>i.quantityOut))],["Value change",nullableMoney(source.map(i=>i.inventoryValueChange))]]);
}

function view(title:string,rows:ExportRow[],totals:Array<[string,string|number]>) { const keys=rows.length?Object.keys(rows[0]).filter(k=>k!=="id"):[]; const columns:ExportColumn<ExportRow>[]=keys.map(key=>({label:key,value:(row)=>row[key]})); return {title,rows,columns,totals}; }
function sum(values:number[]){return values.reduce((total,value)=>total+(value||0),0)}
function nullableMoney(values:Array<number|null>){return values.some(v=>v==null)?"Missing cost data":formatCurrency(sum(values as number[]))}
function productStatus(item:BusinessAccountingReport["products"][number]){if(item.dataQuality==="MISSING")return"missing";if(item.currentStock<=0)return"no-stock";if(item.capitalRecoveredAt)return"recovered";return"recovering"}
function statusLabel(item:BusinessAccountingReport["products"][number]){return({missing:"No cost data","no-stock":"No stock",recovered:"Capital recovered",recovering:"Recovering capital"})[productStatus(item)]}

function completeExportFiles(report:BusinessAccountingReport,snapshot:ReportsSnapshot,range:string){
  const definitions:Array<[string,ReturnType<typeof buildView>]>=[["sales",buildView("sales",report,emptyFilters)],["product-profitability",buildView("profitability",report,emptyFilters)],["restocks",buildView("restocks",report,emptyFilters)],["capital-recovery",buildView("capital",report,emptyFilters)],["expenses",buildView("expenses",report,emptyFilters)],["cycles",buildView("cycles",report,emptyFilters)],["stock-movements",buildView("movements",report,emptyFilters)]];
  const files=definitions.map(([name,data])=>({name:`trustally-${name}-${range}.csv`,content:buildCsv(data.title,data.rows,data.columns,data.totals)}));
  const productRows=report.products.map(p=>({Product:p.productName,Category:p.category,"First restock":p.firstRestockAt??"Unknown","Latest restock":p.lastRestockAt??"None",Quality:p.dataQuality}));
  files.push({name:`trustally-products-${range}.csv`,content:buildCsv("Products",productRows,Object.keys(productRows[0]??{}).map(key=>({label:key,value:(row)=>row[key as keyof typeof row]})))});
  const inventoryRows=report.products.map(p=>({Product:p.productName,"Current stock":p.currentStock,"Average cost":p.weightedAverageUnitCost==null?"Missing cost data":formatCurrency(p.weightedAverageUnitCost),"Inventory value":p.inventoryValue==null?"Missing cost data":formatCurrency(p.inventoryValue)}));
  files.push({name:`trustally-current-inventory-${range}.csv`,content:buildCsv("Current inventory",inventoryRows,Object.keys(inventoryRows[0]??{}).map(key=>({label:key,value:(row)=>row[key as keyof typeof row]})))});
  const paymentRows=snapshot.reportPaymentRecords.map(p=>({Date:formatManilaDateTime(p.occurredAt),Method:p.method,Channel:p.channel,Amount:formatCurrency(p.amount),Source:p.source,Cycle:p.cycleLabel??""}));
  files.push({name:`trustally-payment-records-${range}.csv`,content:buildCsv("Payment records",paymentRows,Object.keys(paymentRows[0]??{}).map(key=>({label:key,value:(row)=>row[key as keyof typeof row]})))});
  const coach=report.movements.filter(m=>m.movementType==="COACH_DEDUCTION"), adjustments=report.movements.filter(m=>["ADJUSTMENT","DAMAGED","MISSING","OTHER"].includes(m.movementType));
  for(const [name,records] of [["coach-deductions",coach],["adjustments",adjustments]] as const){const rows=records.map(m=>({Date:formatManilaDateTime(m.occurredAt),Product:m.productName,Type:m.movementType,Quantity:m.quantityOut,Notes:m.notes??""}));files.push({name:`trustally-${name}-${range}.csv`,content:buildCsv(name.replace("-"," "),rows,Object.keys(rows[0]??{}).map(key=>({label:key,value:(row)=>row[key as keyof typeof row]})))})}
  const moneyMetrics=new Set(["revenue","capitalInvested","capitalRecovered","capitalStillInStock","grossProfit","operatingExpenses","inventoryValue"]);
  const summaryRows=Object.entries(report.summary).map(([Metric,Value])=>({Metric,Value:Value==null?"Missing cost data":moneyMetrics.has(Metric)?formatCurrency(Value):Value}));files.push({name:`trustally-summary-${range}.csv`,content:buildCsv("Summary totals",summaryRows,[{label:"Metric",value:r=>r.Metric},{label:"Value",value:r=>r.Value}])});return files;
}
