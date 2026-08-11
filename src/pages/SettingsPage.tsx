import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  HStack,
  Input,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { ReactNode, useEffect, useState } from "react";
import { fetchSettings, getErrorMessage, saveSettings } from "../lib/api";
import { Settings } from "../lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);

    try {
      const nextSettings = await fetchSettings();
      setSettings(nextSettings);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function savePatch(patch: Partial<Settings>) {
    try {
      const nextSettings = await saveSettings(patch);
      setSettings(nextSettings);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <Stack spacing={4}>
      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <Skeleton height="380px" borderRadius="28px" />
      ) : (
        <Box
          bg="rgba(255,255,255,0.76)"
          borderRadius="28px"
          p={{ base: 4, md: 5 }}
          border="1px solid"
          borderColor="whiteAlpha.700"
        >
          <Stack spacing={5}>
            <SettingRow
              title="Reduce motion"
              control={
                <Switch
                  colorScheme="green"
                  isChecked={settings?.reducedMotion}
                  onChange={(event) =>
                    void savePatch({ reducedMotion: event.target.checked })
                  }
                />
              }
            />
            <SettingRow
              title="Default payment method"
              control={
                <Select
                  value={settings?.defaultPaymentMethod ?? "cash"}
                  onChange={(event) =>
                    void savePatch({
                      defaultPaymentMethod:
                        event.target.value as Settings["defaultPaymentMethod"],
                    })
                  }
                  maxW="160px"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                  <option value="other">Other</option>
                </Select>
              }
            />
            <SettingRow
              title="Currency"
              control={
                <Select
                  value={settings?.currency ?? "PHP"}
                  onChange={(event) =>
                    void savePatch({ currency: event.target.value as "PHP" })
                  }
                  maxW="140px"
                >
                  <option value="PHP">PHP (PHP) ₱</option>
                </Select>
              }
            />
            <SettingRow
              title="Excellent threshold"
              control={
                <Input
                  value={settings?.honestyExcellentThreshold ?? 98}
                  onChange={(event) =>
                    void savePatch({
                      honestyExcellentThreshold: Number(event.target.value),
                    })
                  }
                  maxW="120px"
                  inputMode="decimal"
                />
              }
            />
            <SettingRow
              title="Good threshold"
              control={
                <Input
                  value={settings?.honestyGoodThreshold ?? 95}
                  onChange={(event) =>
                    void savePatch({
                      honestyGoodThreshold: Number(event.target.value),
                    })
                  }
                  maxW="120px"
                  inputMode="decimal"
                />
              }
            />
            <SettingRow
              title="Warning threshold"
              control={
                <Input
                  value={settings?.honestyWarningThreshold ?? 90}
                  onChange={(event) =>
                    void savePatch({
                      honestyWarningThreshold: Number(event.target.value),
                    })
                  }
                  maxW="120px"
                  inputMode="decimal"
                />
              }
            />
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function SettingRow({ title, control }: { title: string; control: ReactNode }) {
  return (
    <HStack
      align="start"
      justify="space-between"
      spacing={4}
      bg="whiteAlpha.900"
      borderRadius="24px"
      px={4}
      py={4}
    >
      <Box minW={0}>
        <Text fontWeight="700">{title}</Text>
      </Box>
      {control}
    </HStack>
  );
}
