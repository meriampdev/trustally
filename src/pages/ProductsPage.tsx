import {
  Box,
  Button,
  Checkbox,
  FormLabel,
  HStack,
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
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { fetchProducts, upsertProduct } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { Product, ProductUpsertInput } from "../lib/types";

const emptyForm: ProductUpsertInput = {
  name: "",
  brand: "",
  variant: "",
  volume: "",
  unit: "mL",
  category: "Drinks",
  sku: "",
  defaultUnitCost: "",
  currentSellingPrice: "",
  active: true,
};

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductUpsertInput>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const editingProduct = useMemo(
    () => products.find((product) => product.id === form.id) ?? null,
    [form.id, products],
  );

  async function load() {
    setIsLoading(true);
    try {
      setProducts(await fetchProducts());
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await upsertProduct(form);
      await load();
      setIsProductModalOpen(false);
      setForm(emptyForm);
      toast({
        title: editingProduct ? "Product updated" : "Product created",
        description: "Trustally kept your historical cycle pricing intact.",
        status: "success",
        duration: 2400,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not save product",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle(product: Product) {
    setIsSaving(true);
    try {
      await upsertProduct(toProductForm(product, !product.active));
      await load();
      if (form.id === product.id) {
        setForm(emptyForm);
      }
      toast({
        title: product.active ? "Product archived" : "Product restored",
        description: "Historical cycles still keep the original selling price and cost snapshots.",
        status: "success",
        duration: 2400,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not update this product",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function openProductModal(product?: Product) {
    setForm(product ? toProductForm(product, product.active) : { ...emptyForm });
    setIsProductModalOpen(true);
  }

  function closeProductModal() {
    if (isSaving) return;
    setIsProductModalOpen(false);
    setForm(emptyForm);
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Products" title="Manage the products in your box">
        <Text color="canvas.700">
          Changing today’s price or cost updates new stock going forward. Completed cycles keep the original snapshots.
        </Text>
        <Button mt={4} onClick={() => openProductModal()}>Add product</Button>
      </SectionCard>

      <Modal isOpen={isProductModalOpen} onClose={closeProductModal} isCentered size="xl" scrollBehavior="inside" closeOnOverlayClick={!isSaving}>
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
        <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
          <ModalHeader>{editingProduct ? `Edit ${editingProduct.displayName}` : "Add product"}</ModalHeader>
          <ModalCloseButton isDisabled={isSaving} />
          <ModalBody>
            <Text color="canvas.700">Prices and costs apply going forward; completed-cycle snapshots stay unchanged.</Text>
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} mt={4}>
          <FormField label="Product name">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Product name"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Brand">
            <Input
              value={form.brand}
              onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
              placeholder="Brand"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Variant">
            <Input
              value={form.variant}
              onChange={(event) => setForm((current) => ({ ...current, variant: event.target.value }))}
              placeholder="Variant"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Category">
            <Input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Volume">
            <Input
              value={form.volume}
              onChange={(event) => setForm((current) => ({ ...current, volume: event.target.value }))}
              placeholder="500"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Unit">
            <Input
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              placeholder="mL"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Default unit cost">
            <Input
              value={form.defaultUnitCost}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultUnitCost: event.target.value }))
              }
              placeholder="16"
              inputMode="decimal"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="Current selling price">
            <Input
              value={form.currentSellingPrice}
              onChange={(event) =>
                setForm((current) => ({ ...current, currentSellingPrice: event.target.value }))
              }
              placeholder="30"
              inputMode="decimal"
              borderColor="blackAlpha.500"
            />
          </FormField>
          <FormField label="SKU">
            <Input
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
              placeholder="SKU"
              borderColor="blackAlpha.500"
            />
          </FormField>
        </SimpleGrid>
        <Checkbox
          mt={4}
          isChecked={form.active}
          onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
        >
          Active product
        </Checkbox>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" onClick={closeProductModal} isDisabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleSave()} isLoading={isSaving}>{editingProduct ? "Save changes" : "Create product"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <SectionCard eyebrow="Catalog" title="Current products">
        {isLoading ? (
          <Spinner color="brand.400" />
        ) : (
          <Stack spacing={3}>
            {products.map((product) => (
              <Box key={product.id} bg="canvas.50" borderRadius="24px" p={4}>
                <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap">
                  <Box>
                    <Text fontWeight="800">{product.displayName}</Text>
                    <Text color="canvas.700" mt={1}>
                      Cost {formatCurrency(product.defaultUnitCost)} • Sell {formatCurrency(product.currentSellingPrice)}
                    </Text>
                    <Text mt={2}>
                      Last known {product.lastKnownQuantity ?? 0} • Estimated remaining {product.estimatedRemaining ?? "?"}
                    </Text>
                    <Text mt={2} color={product.active ? "honesty.500" : "canvas.700"} fontWeight="700">
                      {product.active ? "Active" : "Archived"}
                    </Text>
                  </Box>
                  <HStack spacing={3} flexWrap="wrap">
                    <Button variant="outline" onClick={() => openProductModal(product)}>
                      Edit product
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void handleArchiveToggle(product)}
                      isLoading={isSaving}
                    >
                      {product.active ? "Archive product" : "Restore product"}
                    </Button>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

function toProductForm(product: Product, active: boolean): ProductUpsertInput {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand ?? "",
    variant: product.variant ?? "",
    volume: product.volume ?? "",
    unit: product.unit ?? "mL",
    category: product.category ?? "Drinks",
    sku: product.sku ?? "",
    defaultUnitCost: String(product.defaultUnitCost),
    currentSellingPrice: String(product.currentSellingPrice),
    active,
  };
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
