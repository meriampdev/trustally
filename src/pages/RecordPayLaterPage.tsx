import {
  Box,
  Button,
  Input,
  Spinner,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { fetchHomeDashboard, recordCycleDifference } from "../lib/api";
import { formatDateTimeLabel } from "../lib/format";
import { useCurrentLocation } from "../lib/location";
import { HomeDashboard } from "../lib/types";

export default function RecordPayLaterPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentLocationId } = useCurrentLocation();
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [person, setPerson] = useState("");
  const [itemsTaken, setItemsTaken] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void load(currentLocationId);
  }, [currentLocationId]);

  async function load(selectedLocationId?: string | null) {
    setIsLoading(true);
    try {
      setDashboard(await fetchHomeDashboard(selectedLocationId));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!dashboard?.currentCycle?.id) {
      toast({
        title: "No active cycle",
        description: "Start tracking your box first before recording pay-later bottles.",
        status: "warning",
        duration: 3200,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setIsSaving(true);
    try {
      await recordCycleDifference({
        cycleId: dashboard.currentCycle.id,
        resolutionType: "PAY_LATER",
        amount,
        customerLabel: person,
        itemsSummary: itemsTaken,
        dueDate,
        note,
      });

      toast({
        title: "Pay-later recorded",
        description: "Trustally saved the bottles and amount against the current cycle.",
        status: "success",
        duration: 2800,
        isClosable: true,
        position: "top",
      });

      navigate("/payments");
    } catch (error) {
      toast({
        title: "Could not record pay-later bottles",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4600,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Spinner color="brand.400" />;
  }

  if (!dashboard?.hasSetup) {
    return (
      <SectionCard eyebrow="Set up your box" title="Start tracking before recording pay-later bottles">
        <Text color="canvas.700">
          Trustally needs an active box cycle before it can attach a pay-later note to what was taken.
        </Text>
        <Button as={Link} to="/setup" mt={5}>
          Set up box
        </Button>
      </SectionCard>
    );
  }

  if (!dashboard.currentCycle?.id) {
    return (
      <SectionCard eyebrow="No active cycle" title="There isn’t an active box cycle right now">
        <Text color="canvas.700">
          Record a box setup or finish starting the next cycle before logging new pay-later bottles.
        </Text>
        <Button as={Link} to="/" mt={5}>
          Back to Home
        </Button>
      </SectionCard>
    );
  }

  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="Record pay-later" title="Someone messaged that they took bottles and will pay later">
        <Text color="canvas.700">
          This records the delayed payment against your current active cycle instead of waiting for the next box check.
        </Text>
        <Box mt={4} borderRadius="24px" bg="canvas.50" p={4}>
          <Text fontWeight="800">{dashboard.locationName ?? "Your box"}</Text>
          <Text color="canvas.700" mt={1}>
            Current cycle started {formatDateTimeLabel(dashboard.currentCycle.startedAt)}
          </Text>
        </Box>

        <Stack spacing={4} mt={5}>
          <Field label="Amount expected">
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="120"
            />
          </Field>
          <Field label="Person / label">
            <Input
              value={person}
              onChange={(event) => setPerson(event.target.value)}
              placeholder="Mark / Anonymous / Payday group"
            />
          </Field>
          <Field label="Items taken">
            <Textarea
              value={itemsTaken}
              onChange={(event) => setItemsTaken(event.target.value)}
              placeholder="Example: 2 Coke 500mL, 1 Nature's Spring 1L"
            />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Optional note">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sent a message saying they’ll pay on payday"
            />
          </Field>
        </Stack>

        <Button mt={5} onClick={() => void handleSubmit()} isLoading={isSaving}>
          Record pay-later
        </Button>
      </SectionCard>
    </Stack>
  );
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
