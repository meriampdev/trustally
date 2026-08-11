import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createCashMovement,
  createInventoryAdjustment,
  createPayment,
  createRestockEvent,
  fetchProducts,
  fetchSettings,
  fetchTodayCollectedTotal,
  getErrorMessage,
  isProbablyOfflineError,
  saveSettings,
} from "../lib/api";
import { enqueuePendingOperation } from "../lib/offlineQueue";
import { formatCurrency, getTodayInputValue, titleCase } from "../lib/format";
import {
  CashMovementType,
  InventoryAdjustmentType,
  PaymentMethod,
  Product,
  Settings,
} from "../lib/types";

interface RestockDraftLine {
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
  supplier: string;
}

const fieldStyles = {
  borderColor: "black",
  color: "black",
  _hover: {
    borderColor: "black",
  },
  _focusVisible: {
    borderColor: "black",
    boxShadow: "0 0 0 1px black",
  },
} as const;

const placeholderStyles = {
  _placeholder: {
    color: "black",
    opacity: 1,
  },
} as const;

export default function AddTransactionPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [todayCollected, setTodayCollected] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(getTodayInputValue());
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [restockDate, setRestockDate] = useState(getTodayInputValue());
  const [restockNotes, setRestockNotes] = useState("");
  const [restockItems, setRestockItems] = useState<RestockDraftLine[]>([
    {
      productId: "",
      quantity: "",
      unitCost: "",
      sellingPrice: "",
      supplier: "",
    },
  ]);
  const [isSavingRestock, setIsSavingRestock] = useState(false);

  const [cashMovementType, setCashMovementType] =
    useState<CashMovementType>("collection");
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [cashMovementDate, setCashMovementDate] = useState(getTodayInputValue());
  const [cashMovementNotes, setCashMovementNotes] = useState("");
  const [isSavingCashMovement, setIsSavingCashMovement] = useState(false);

  const [adjustmentProductId, setAdjustmentProductId] = useState("");
  const [adjustmentType, setAdjustmentType] =
    useState<InventoryAdjustmentType>("damaged");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("-1");
  const [adjustmentDate, setAdjustmentDate] = useState(getTodayInputValue());
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  useEffect(() => {
    void loadCaptureData();
  }, []);

  async function loadCaptureData() {
    setIsLoading(true);

    try {
      const [nextProducts, nextSettings, nextTodayCollected] = await Promise.all([
        fetchProducts(),
        fetchSettings(),
        fetchTodayCollectedTotal(),
      ]);

      setProducts(nextProducts);
      setSettings(nextSettings);
      setPaymentMethod(nextSettings.defaultPaymentMethod);
      setAdjustmentProductId(nextProducts[0]?.id ?? "");
      setRestockItems((current) => [
        {
          ...current[0],
          productId: current[0]?.productId || nextProducts[0]?.id || "",
        },
      ]);
      setTodayCollected(nextTodayCollected);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const restockTotals = useMemo(() => {
    return restockItems.reduce(
      (totals, line) => {
        const quantity = Number(line.quantity) || 0;
        const unitCost = Number(line.unitCost) || 0;
        const sellingPrice = Number(line.sellingPrice) || 0;

        return {
          quantity: totals.quantity + quantity,
          capital: totals.capital + quantity * unitCost,
          revenue: totals.revenue + quantity * sellingPrice,
        };
      },
      { quantity: 0, capital: 0, revenue: 0 },
    );
  }, [restockItems]);

  async function handleSavePayment() {
    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      setErrorMessage("Enter a payment amount greater than zero.");
      return;
    }

    setIsSavingPayment(true);

    try {
      await createPayment({
        amount,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes || undefined,
      });
      startTransition(() => {
        setPaymentAmount("");
        setPaymentNotes("");
      });
      setTodayCollected((current) => current + amount);
      void saveSettings({ defaultPaymentMethod: paymentMethod })
        .then(setSettings)
        .catch(() => {});
      toast({
        title: "Payment recorded",
        description: `Today's collected total is now ${formatCurrency(todayCollected + amount)}.`,
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      setErrorMessage("");
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        enqueuePendingOperation({
          type: "payment",
          payload: {
            amount,
            method: paymentMethod,
            date: paymentDate,
            notes: paymentNotes || undefined,
          },
        });
        setTodayCollected((current) => current + amount);
        setPaymentAmount("");
        setPaymentNotes("");
        toast({
          title: "Payment saved offline",
          description: "It will sync automatically when the connection returns.",
          status: "info",
          duration: 3200,
          isClosable: true,
          position: "top",
        });
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleSaveRestock() {
    const items = restockItems
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        sellingPrice: Number(line.sellingPrice),
        supplier: line.supplier || undefined,
      }))
      .filter(
        (item) =>
          item.productId &&
          item.quantity > 0 &&
          item.unitCost > 0 &&
          item.sellingPrice > 0,
      );

    if (items.length === 0) {
      setErrorMessage("Add at least one valid restock line.");
      return;
    }

    setIsSavingRestock(true);

    try {
      await createRestockEvent({
        date: restockDate,
        notes: restockNotes || undefined,
        items,
      });
      setRestockNotes("");
      setRestockItems([
        {
          productId: products[0]?.id ?? "",
          quantity: "",
          unitCost: "",
          sellingPrice: "",
          supplier: "",
        },
      ]);
      toast({
        title: "Restock saved",
        description: `${restockTotals.quantity} bottles were added to stock.`,
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      setErrorMessage("");
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        enqueuePendingOperation({
          type: "restock",
          payload: {
            date: restockDate,
            notes: restockNotes || undefined,
            items,
          },
        });
        toast({
          title: "Restock saved offline",
          description: "It will sync automatically when you're online again.",
          status: "info",
          duration: 3200,
          isClosable: true,
          position: "top",
        });
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsSavingRestock(false);
    }
  }

  async function handleSaveCashMovement() {
    const amount = Number(cashMovementAmount);

    if (!amount || amount <= 0) {
      setErrorMessage("Enter a cash movement amount greater than zero.");
      return;
    }

    setIsSavingCashMovement(true);

    try {
      await createCashMovement({
        type: cashMovementType,
        amount,
        date: cashMovementDate,
        notes: cashMovementNotes || undefined,
      });
      setCashMovementAmount("");
      setCashMovementNotes("");
      toast({
        title: "Cash movement saved",
        description: `${titleCase(cashMovementType)} has been recorded.`,
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      setErrorMessage("");
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        enqueuePendingOperation({
          type: "cash_movement",
          payload: {
            type: cashMovementType,
            amount,
            date: cashMovementDate,
            notes: cashMovementNotes || undefined,
          },
        });
        toast({
          title: "Cash movement saved offline",
          description: "It will sync automatically when you're online again.",
          status: "info",
          duration: 3200,
          isClosable: true,
          position: "top",
        });
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsSavingCashMovement(false);
    }
  }

  async function handleSaveAdjustment() {
    const quantityDelta = Number(adjustmentQuantity);

    if (!adjustmentProductId || !quantityDelta) {
      setErrorMessage("Choose a product and enter a non-zero quantity adjustment.");
      return;
    }

    setIsSavingAdjustment(true);

    try {
      await createInventoryAdjustment({
        productId: adjustmentProductId,
        quantityDelta,
        adjustmentType,
        date: adjustmentDate,
        reason: adjustmentReason || undefined,
      });
      setAdjustmentQuantity("-1");
      setAdjustmentReason("");
      toast({
        title: "Adjustment saved",
        description: "Inventory was updated without affecting revenue.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      setErrorMessage("");
    } catch (error) {
      if (isProbablyOfflineError(error)) {
        enqueuePendingOperation({
          type: "inventory_adjustment",
          payload: {
            productId: adjustmentProductId,
            quantityDelta,
            adjustmentType,
            date: adjustmentDate,
            reason: adjustmentReason || undefined,
          },
        });
        toast({
          title: "Adjustment saved offline",
          description: "It will sync automatically when you're online again.",
          status: "info",
          duration: 3200,
          isClosable: true,
          position: "top",
        });
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsSavingAdjustment(false);
    }
  }

  return (
    <Stack spacing={4}>
      <Alert status="info" borderRadius="24px">
        <AlertIcon />
        <AlertDescription>
          Payments, restocks, and counts can be captured offline and synced later.
        </AlertDescription>
      </Alert>

      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Box
        bg="rgba(255,255,255,0.8)"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        border="1px solid"
        borderColor="whiteAlpha.700"
      >
        <HStack justify="space-between" mb={4} align="start">
          <Box>
            <Text fontWeight="800" fontSize="xl">
              Quick capture
            </Text>
            <Text color="canvas.700">
              Today collected: {isLoading ? "..." : formatCurrency(todayCollected)}
            </Text>
          </Box>
          <Button as={Link} to="/count" variant="outline">
            Count inventory
          </Button>
        </HStack>

        <Tabs variant="soft-rounded" colorScheme="orange">
          <TabList flexWrap="wrap" gap={2}>
            <Tab>Payment</Tab>
            <Tab>Restock</Tab>
            <Tab>Cash</Tab>
            <Tab>Adjustment</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              <Stack spacing={4}>
                <SimpleGrid columns={{ base: 3, md: 5 }} gap={3}>
                  {[20, 25, 30, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      onClick={() =>
                        setPaymentAmount(String((Number(paymentAmount) || 0) + amount))
                      }
                    >
                      + {formatCurrency(amount)}
                    </Button>
                  ))}
                </SimpleGrid>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <FormControl>
                    <FormLabel>Amount</FormLabel>
                    <Input
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      {...fieldStyles}
                      {...placeholderStyles}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      {...fieldStyles}
                    />
                  </FormControl>
                </Grid>
                <HStack spacing={3} wrap="wrap">
                  {(["cash", "gcash", "maya"] as PaymentMethod[]).map((method) => (
                    <Button
                      key={method}
                      variant={paymentMethod === method ? "solid" : "outline"}
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method.toUpperCase()}
                    </Button>
                  ))}
                </HStack>
                <Textarea
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Optional note"
                  {...fieldStyles}
                  {...placeholderStyles}
                />
                <Button onClick={() => void handleSavePayment()} isLoading={isSavingPayment}>
                  Save payment
                </Button>
              </Stack>
            </TabPanel>

            <TabPanel px={0}>
              <Stack spacing={4}>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <FormControl>
                    <FormLabel>Restock date</FormLabel>
                    <Input
                      type="date"
                      value={restockDate}
                      onChange={(event) => setRestockDate(event.target.value)}
                      {...fieldStyles}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Notes</FormLabel>
                    <Input
                      value={restockNotes}
                      onChange={(event) => setRestockNotes(event.target.value)}
                      placeholder="Supplier or route notes"
                      {...fieldStyles}
                      {...placeholderStyles}
                    />
                  </FormControl>
                </Grid>
                <Stack spacing={4}>
                  {restockItems.map((line, index) => (
                    <Box
                      key={index}
                      bg="whiteAlpha.900"
                      borderRadius="24px"
                      p={4}
                      border="1px solid"
                      borderColor="blackAlpha.100"
                    >
                      <Stack spacing={3}>
                        <HStack justify="space-between">
                          <Text fontWeight="700">Item {index + 1}</Text>
                          {restockItems.length > 1 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Trash2 size={16} />}
                              onClick={() =>
                                setRestockItems((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </HStack>
                        <Select
                          value={line.productId}
                          onChange={(event) =>
                            updateRestockLine(index, "productId", event.target.value)
                          }
                          {...fieldStyles}
                        >
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </Select>
                        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
                          <Input
                            value={line.quantity}
                            onChange={(event) =>
                              updateRestockLine(index, "quantity", event.target.value)
                            }
                            placeholder="Qty"
                            inputMode="numeric"
                            {...fieldStyles}
                            {...placeholderStyles}
                          />
                          <Input
                            value={line.unitCost}
                            onChange={(event) =>
                              updateRestockLine(index, "unitCost", event.target.value)
                            }
                            placeholder="Unit cost"
                            inputMode="decimal"
                            {...fieldStyles}
                            {...placeholderStyles}
                          />
                          <Input
                            value={line.sellingPrice}
                            onChange={(event) =>
                              updateRestockLine(index, "sellingPrice", event.target.value)
                            }
                            placeholder="Selling price"
                            inputMode="decimal"
                            {...fieldStyles}
                            {...placeholderStyles}
                          />
                          <Input
                            value={line.supplier}
                            onChange={(event) =>
                              updateRestockLine(index, "supplier", event.target.value)
                            }
                            placeholder="Supplier"
                            {...fieldStyles}
                            {...placeholderStyles}
                          />
                        </SimpleGrid>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Button
                  variant="outline"
                  leftIcon={<Plus size={18} />}
                  onClick={() =>
                    setRestockItems((current) => [
                      ...current,
                      {
                        productId: products[0]?.id ?? "",
                        quantity: "",
                        unitCost: "",
                        sellingPrice: "",
                        supplier: "",
                      },
                    ])
                  }
                >
                  Add product
                </Button>
                <Divider />
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                  <SummaryBox label="Bottles" value={String(restockTotals.quantity)} />
                  <SummaryBox label="Capital" value={formatCurrency(restockTotals.capital)} />
                  <SummaryBox label="Retail value" value={formatCurrency(restockTotals.revenue)} />
                </SimpleGrid>
                <Button onClick={() => void handleSaveRestock()} isLoading={isSavingRestock}>
                  Save restock
                </Button>
              </Stack>
            </TabPanel>

            <TabPanel px={0}>
              <Stack spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                  <FormControl>
                    <FormLabel>Movement type</FormLabel>
                    <Select
                      value={cashMovementType}
                      onChange={(event) =>
                        setCashMovementType(event.target.value as CashMovementType)
                      }
                      {...fieldStyles}
                    >
                      {[
                        "collection",
                        "capital_withdrawal",
                        "cash_float_add",
                        "cash_float_remove",
                        "expense",
                        "adjustment",
                      ].map((type) => (
                        <option key={type} value={type}>
                          {titleCase(type)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Amount</FormLabel>
                    <Input
                      value={cashMovementAmount}
                      onChange={(event) => setCashMovementAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      {...fieldStyles}
                      {...placeholderStyles}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={cashMovementDate}
                      onChange={(event) => setCashMovementDate(event.target.value)}
                      {...fieldStyles}
                    />
                  </FormControl>
                </SimpleGrid>
                <Textarea
                  value={cashMovementNotes}
                  onChange={(event) => setCashMovementNotes(event.target.value)}
                  placeholder="Why was cash moved?"
                  {...fieldStyles}
                  {...placeholderStyles}
                />
                <Button
                  onClick={() => void handleSaveCashMovement()}
                  isLoading={isSavingCashMovement}
                >
                  Save cash movement
                </Button>
              </Stack>
            </TabPanel>

            <TabPanel px={0}>
              <Stack spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                  <FormControl>
                    <FormLabel>Product</FormLabel>
                    <Select
                      value={adjustmentProductId}
                      onChange={(event) => setAdjustmentProductId(event.target.value)}
                      {...fieldStyles}
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={adjustmentType}
                      onChange={(event) =>
                        setAdjustmentType(event.target.value as InventoryAdjustmentType)
                      }
                      {...fieldStyles}
                    >
                      {[
                        "damaged",
                        "expired",
                        "free",
                        "owner_use",
                        "staff_use",
                        "event_use",
                        "missing",
                        "count_correction",
                        "other",
                      ].map((type) => (
                        <option key={type} value={type}>
                          {titleCase(type)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                  <FormControl>
                    <FormLabel>Quantity delta</FormLabel>
                    <Input
                      value={adjustmentQuantity}
                      onChange={(event) => setAdjustmentQuantity(event.target.value)}
                      placeholder="-1"
                      inputMode="numeric"
                      {...fieldStyles}
                      {...placeholderStyles}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={adjustmentDate}
                      onChange={(event) => setAdjustmentDate(event.target.value)}
                      {...fieldStyles}
                    />
                  </FormControl>
                </SimpleGrid>
                <Textarea
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  placeholder="Reason for this adjustment"
                  {...fieldStyles}
                  {...placeholderStyles}
                />
                <Button onClick={() => void handleSaveAdjustment()} isLoading={isSavingAdjustment}>
                  Save adjustment
                </Button>
              </Stack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Stack>
  );

  function updateRestockLine(
    index: number,
    key: keyof RestockDraftLine,
    value: string,
  ) {
    setRestockItems((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  }
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="whiteAlpha.900" borderRadius="20px" px={4} py={3}>
      <Text fontSize="sm" color="canvas.700">
        {label}
      </Text>
      <Text fontSize="xl" fontWeight="800">
        {value}
      </Text>
    </Box>
  );
}
