import {
  Box,
  Button,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { addStockToActiveCycle, fetchProducts } from "../lib/api";
import { Product, StockAdditionLineInput } from "../lib/types";

function createLine(product?: Product): StockAdditionLineInput {
  return {
    productId: product?.id ?? "",
    quantity: "",
    unitCost: product ? String(product.defaultUnitCost) : "",
    sellingPrice: product ? String(product.currentSellingPrice) : "",
  };
}

export default function AddStockPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<StockAdditionLineInput[]>([]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetchProducts().then((result) => {
      const activeProducts = result.filter((item) => item.active);
      setProducts(activeProducts);
      setLines([createLine(activeProducts[0])]);
    });
  }, []);

  if (!products.length) {
    return <Spinner color="brand.400" />;
  }

  function updateLine(index: number, patch: Partial<StockAdditionLineInput>) {
    setLines((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (patch.productId) {
          const product = products.find((candidate) => candidate.id === patch.productId);
          return {
            ...item,
            ...patch,
            unitCost: product ? String(product.defaultUnitCost) : item.unitCost,
            sellingPrice: product ? String(product.currentSellingPrice) : item.sellingPrice,
          };
        }

        return { ...item, ...patch };
      }),
    );
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await addStockToActiveCycle({
        lines: lines.filter((line) => line.productId && Number(line.quantity) > 0),
        note,
        idempotencyKey: crypto.randomUUID(),
      });
      toast({
        title: "Stock added",
        description: "Your active cycle now includes the new stock.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Could not add stock",
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
      <SectionCard eyebrow="Add stock" title="What are you putting in the box?">
        <Stack spacing={4}>
          {lines.map((line, index) => (
            <Box key={index} bg="canvas.50" borderRadius="24px" p={4}>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                <FormField label="Product">
                  <Select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.displayName}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Quantity">
                  <Input value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} placeholder="20" inputMode="numeric" />
                </FormField>
                <FormField label="Unit cost">
                  <Input value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} placeholder="16" inputMode="decimal" />
                </FormField>
                <FormField label="Selling price">
                  <Input value={line.sellingPrice} onChange={(event) => updateLine(index, { sellingPrice: event.target.value })} placeholder="30" inputMode="decimal" />
                </FormField>
              </SimpleGrid>
            </Box>
          ))}
          <Button variant="outline" onClick={() => setLines((current) => [...current, createLine(products[0])])}>
            Add another product
          </Button>
          <Box maxW="720px">
            <FormField label="Notes">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Notes about this restock" />
            </FormField>
          </Box>
        </Stack>
        <Button mt={5} onClick={() => void handleSubmit()} isLoading={isSubmitting}>
          Add to box
        </Button>
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
      <FormLabel mb={2} fontSize="sm" fontWeight="700" color="canvas.700">
        {label}
      </FormLabel>
      {children}
    </Box>
  );
}
