import {
  Box,
  Button,
  FormLabel,
  Input,
  Select,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { fetchCashMovements, recordCashMovement } from "../lib/api";
import { formatCurrency, formatDateTimeLabel } from "../lib/format";
import { CashMovement } from "../lib/types";

export default function CashMovementsPage() {
  const toast = useToast();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [type, setType] = useState("CASH_REMOVED");
  const [amount, setAmount] = useState("");
  const [person, setPerson] = useState("");
  const [occurredAt, setOccurredAt] = useState(defaultDateTimeLocal());
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setMovements(await fetchCashMovements());
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    setIsSaving(true);
    try {
      await recordCashMovement({
        type,
        amount,
        person,
        note,
        occurredAt: new Date(occurredAt).toISOString(),
      });

      setAmount("");
      setPerson("");
      setNote("");
      await load();

      toast({
        title: "Cash movement recorded",
        description: "Trustally kept the physical cash trail separate from revenue totals.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not record cash movement",
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

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Cash movement" title="Record cash removed or corrected">
        <Text color="canvas.700" mb={4}>Left for Change is recorded during Check Box so there is only one closing-float value.</Text>
        <Stack spacing={4}>
          <FormField label="Movement type">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="CASH_REMOVED">Cash removed</option>
              <option value="CASH_CORRECTION">Cash correction</option>
            </Select>
          </FormField>
          <FormField label="Amount">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="1000" />
          </FormField>
          <FormField label="Removed by / person">
            <Input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Coach John" />
          </FormField>
          <FormField label="Date and time">
            <Input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
          </FormField>
          <FormField label="Note">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Collected from honesty box" />
          </FormField>
        </Stack>
        <Button mt={5} onClick={() => void handleSubmit()} isLoading={isSaving}>
          Record cash movement
        </Button>
      </SectionCard>

      <SectionCard eyebrow="Recent cash movements" title="Physical cash trail">
        {isLoading ? (
          <Spinner color="brand.400" />
        ) : movements.length ? (
          <Stack spacing={3}>
            {movements.map((movement) => (
              <Box key={movement.id} borderRadius="24px" bg="canvas.50" p={4}>
                <Text fontWeight="800">{formatMovementType(movement.type)}</Text>
                <Text color="canvas.700" mt={1}>
                  {formatCurrency(movement.amount)}
                  {movement.person ? ` • ${movement.person}` : ""}
                </Text>
                <Text mt={2}>{movement.note || "No note recorded."}</Text>
                <Text mt={2} fontSize="sm" color="canvas.700">
                  {formatDateTimeLabel(movement.occurredAt)}
                </Text>
              </Box>
            ))}
          </Stack>
        ) : (
          <Text color="canvas.700">No cash movements recorded yet.</Text>
        )}
      </SectionCard>
    </Stack>
  );
}

function defaultDateTimeLocal() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatMovementType(value: string) {
  if (value === "CASH_RETURNED") return "Left for Change (legacy)";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
