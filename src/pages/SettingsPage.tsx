import {
  Button,
  Checkbox,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { SectionCard } from "../components/SectionCard";
import { fetchSettings, updateSettings } from "../lib/api";
import { Settings } from "../lib/types";

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void fetchSettings().then(setSettings);
  }, []);

  if (!settings) {
    return <Spinner color="brand.400" />;
  }

  async function handleSave() {
    if (!settings) {
      return;
    }

    setIsSaving(true);
    try {
      const nextSettings = await updateSettings(settings);
      setSettings(nextSettings);
      toast({
        title: "Settings saved",
        description: "Trustally updated your workflow preferences.",
        status: "success",
        duration: 2600,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not save settings",
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
      <SectionCard eyebrow="Operations" title="What should Trustally optimize for?">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <Field label="Target coverage days">
            <Input
              value={String(settings.targetCoverageDays)}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, targetCoverageDays: Number(event.target.value) || 0 } : current,
                )
              }
              inputMode="numeric"
            />
          </Field>
          <Field label="Reminder after how many days">
            <Input
              value={String(settings.checkReminderDays)}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, checkReminderDays: Number(event.target.value) || 0 } : current,
                )
              }
              inputMode="numeric"
            />
          </Field>
          <Field label="Excellent collection match from">
            <Input
              value={String(settings.honestyExcellentMin)}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, honestyExcellentMin: Number(event.target.value) || 0 } : current,
                )
              }
              inputMode="decimal"
            />
          </Field>
          <Field label="Good collection match from">
            <Input
              value={String(settings.honestyGoodMin)}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, honestyGoodMin: Number(event.target.value) || 0 } : current,
                )
              }
              inputMode="decimal"
            />
          </Field>
          <Field label="Needs attention from">
            <Input
              value={String(settings.honestyAttentionMin)}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, honestyAttentionMin: Number(event.target.value) || 0 } : current,
                )
              }
              inputMode="decimal"
            />
          </Field>
        </SimpleGrid>
        <Checkbox
          mt={4}
          isChecked={settings.lowStockReminders}
          onChange={(event) =>
            setSettings((current) =>
              current ? { ...current, lowStockReminders: event.target.checked } : current,
            )
          }
        >
          Low-stock reminders
        </Checkbox>
        <Checkbox
          mt={4}
          isChecked={settings.reducedMotion}
          onChange={(event) =>
            setSettings((current) =>
              current ? { ...current, reducedMotion: event.target.checked } : current,
            )
          }
        >
          Reduced motion
        </Checkbox>
        <Button mt={5} onClick={() => void handleSave()} isLoading={isSaving}>
          Save settings
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
    <Stack spacing={2}>
      <Text fontWeight="800">{label}</Text>
      {children}
    </Stack>
  );
}
