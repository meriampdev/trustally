import {
  Box,
  Button,
  FormLabel,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { formatCount, formatCurrency, parseNumberInput } from "../lib/format";
import { SetupProductInput } from "../lib/types";
import { startInitialTracking } from "../lib/api";

function createEmptyLine(): SetupProductInput {
  return {
    name: "",
    brand: "",
    variant: "",
    volume: "",
    unit: "mL",
    category: "Drinks",
    sku: "",
    quantity: "",
    unitCost: "",
    sellingPrice: "",
  };
}

export default function SetupPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [locationName, setLocationName] = useState("Main box");
  const [products, setProducts] = useState<SetupProductInput[]>([
    createEmptyLine(),
    createEmptyLine(),
    createEmptyLine(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totals = useMemo(() => {
    return products.reduce(
      (acc, item) => {
        const quantity = parseNumberInput(item.quantity);
        const unitCost = parseNumberInput(item.unitCost);
        const sellingPrice = parseNumberInput(item.sellingPrice);
        acc.quantity += quantity;
        acc.capital += quantity * unitCost;
        acc.retail += quantity * sellingPrice;
        return acc;
      },
      { quantity: 0, capital: 0, retail: 0 },
    );
  }, [products]);

  function updateLine(index: number, patch: Partial<SetupProductInput>) {
    setProducts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function handleSubmit() {
    const cleanProducts = products.filter((item) => item.name.trim() && parseNumberInput(item.quantity) > 0);

    if (!cleanProducts.length) {
      toast({
        title: "Add at least one product",
        description: "Trustally needs your current box contents to begin.",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await startInitialTracking({
        locationName,
        products: cleanProducts,
        idempotencyKey: crypto.randomUUID(),
      });

      toast({
        title: "Cycle #1 started",
        description: "Your initial box stock is now tracked.",
        status: "success",
        duration: 2800,
        isClosable: true,
        position: "top",
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Setup failed",
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

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Set up your box" title="Tell Trustally what’s in the honesty box right now.">
        <Text color="canvas.700">
          This only creates your starting inventory snapshot and Cycle #1. It does not create sales, revenue, or reconciliation.
        </Text>
        <Box mt={4} maxW="360px">
          <FormField label="Location name">
            <Input
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Location name"
            />
          </FormField>
        </Box>
      </SectionCard>

      <SectionCard eyebrow="Products" title="What’s in the box?">
        <Stack spacing={4}>
          {products.map((item, index) => (
            <Box key={index} bg="canvas.50" borderRadius="24px" p={4}>
              <Text fontSize="sm" fontWeight="800" color="canvas.700" mb={4}>
                Product {index + 1}
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                <FormField label="Product name">
                  <Input value={item.name} onChange={(event) => updateLine(index, { name: event.target.value })} placeholder="Nature's Spring" borderColor={'blackAlpha.500'} />
                </FormField>
                <FormField label="Brand">
                  <Input value={item.brand} onChange={(event) => updateLine(index, { brand: event.target.value })} placeholder="Brand" borderColor={'blackAlpha.500'} />
                </FormField>
                <FormField label="Variant">
                  <Input value={item.variant} onChange={(event) => updateLine(index, { variant: event.target.value })} placeholder="500mL / 1L / regular" borderColor={'blackAlpha.500'}     />
                </FormField>
                <FormField label="Volume and unit">
                  <HStack>
                    <Input value={item.volume} onChange={(event) => updateLine(index, { volume: event.target.value })} placeholder="500" inputMode="decimal" borderColor={'blackAlpha.500'} />
                    <Input value={item.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} placeholder="mL" borderColor={'blackAlpha.500'} />
                  </HStack>
                </FormField>
                <FormField label="Category">
                  <Input value={item.category} onChange={(event) => updateLine(index, { category: event.target.value })} placeholder="Drinks" borderColor={'blackAlpha.500'} />
                </FormField>
                <FormField label="SKU">
                  <Input value={item.sku} onChange={(event) => updateLine(index, { sku: event.target.value })} placeholder="Optional" borderColor={'blackAlpha.500'} />
                </FormField>
                <FormField label="Quantity in the box">
                  <Input value={item.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} placeholder="10" inputMode="numeric" borderColor={'blackAlpha.500'}  />
                </FormField>
                <FormField label="Unit cost">
                  <Input value={item.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} placeholder="16" inputMode="decimal" borderColor={'blackAlpha.500'} />
                </FormField>
                <FormField label="Selling price">
                  <Input value={item.sellingPrice} onChange={(event) => updateLine(index, { sellingPrice: event.target.value })} placeholder="30" inputMode="decimal" borderColor={'blackAlpha.500'} />
                </FormField>
              </SimpleGrid>
            </Box>
          ))}
        </Stack>

        <HStack mt={4} spacing={3}>
          <Button variant="outline" color={'blackAlpha.800'} border={'1px solid'} borderColor={'blackAlpha.500'} onClick={() => setProducts((current) => [...current, createEmptyLine()])}>
            Add another product
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Start tracking
          </Button>
        </HStack>
      </SectionCard>

      <SectionCard eyebrow="Summary" title={formatCount(totals.quantity)}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Text>Retail value: {formatCurrency(totals.retail)}</Text>
          <Text>Capital value: {formatCurrency(totals.capital)}</Text>
        </SimpleGrid>
      </SectionCard>
    </Stack>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <FormLabel mb={2} fontSize="sm" fontWeight="700" color="black.100">
        {label}
      </FormLabel>
      {children}
    </Box>
  );
}
