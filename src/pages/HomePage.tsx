import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ArrowRight, BanknoteArrowDown, Boxes, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ActivityCard } from "../components/ActivityCard";
import { MetricCard } from "../components/MetricCard";
import {
  fetchDashboardSummary,
  fetchLatestOpenReconciliation,
  fetchRecentActivity,
  fetchSettings,
  getErrorMessage,
} from "../lib/api";
import { formatCurrency, formatPercent } from "../lib/format";
import {
  ActivityItem,
  DashboardSummary,
  ReconciliationSummary,
  Settings,
} from "../lib/types";
import { useOperationsRealtime } from "../lib/useOperationsRealtime";

export default function HomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [latestReconciliation, setLatestReconciliation] =
    useState<ReconciliationSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadHomeData();
  }, []);

  useOperationsRealtime(() => {
    void loadHomeData();
  });

  async function loadHomeData() {
    setIsLoading(true);

    try {
      const [nextSummary, nextActivity, nextReconciliation, nextSettings] =
        await Promise.all([
          fetchDashboardSummary(),
          fetchRecentActivity(5),
          fetchLatestOpenReconciliation(),
          fetchSettings(),
        ]);
      setSummary(nextSummary);
      setRecentActivity(nextActivity);
      setLatestReconciliation(nextReconciliation);
      setSettings(nextSettings);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const collectionRate = summary?.collectionRate ?? 0;
  const tone = getCollectionTone(collectionRate, settings);
  const toneLabel = getCollectionLabel(collectionRate, settings);

  return (
    <Stack spacing={{ base: 4, md: 6 }}>
      <Grid
        templateColumns={{ base: "1fr", lg: "1.25fr 0.95fr" }}
        gap={{ base: 4, lg: 6 }}
      >
        <GridItem>
          <Box
            borderRadius="32px"
            p={{ base: 5, md: 6 }}
            color="white"
            bg="linear-gradient(135deg, #143224 0%, #2c6548 45%, #d1a03f 100%)"
            shadow="xl"
          >
            <Text fontSize="sm" textTransform="uppercase" letterSpacing="0.16em" opacity={0.8}>
              Honesty rate
            </Text>
            {isLoading ? (
              <Skeleton mt={3} height="54px" borderRadius="16px" />
            ) : (
              <>
                <Text mt={3} fontSize={{ base: "4xl", md: "5xl" }} fontWeight="900" lineHeight="0.95">
                  {formatPercent(collectionRate)}
                </Text>
                <Text mt={2} fontWeight="700">
                  {toneLabel}: collected {formatCurrency(summary?.collectedThisMonth ?? 0)} of{" "}
                  {formatCurrency(summary?.expectedThisMonth ?? 0)} expected this month
                </Text>
              </>
            )}
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} mt={6}>
              <Button as={Link} to="/capture" leftIcon={<BanknoteArrowDown size={18} />} h="52px">
                Record payment
              </Button>
              <Button
                as={Link}
                to="/count"
                leftIcon={<ClipboardCheck size={18} />}
                h="52px"
                bg="whiteAlpha.200"
                _hover={{ bg: "whiteAlpha.300" }}
              >
                Count inventory
              </Button>
              <Button
                as={Link}
                to="/activity"
                leftIcon={<Boxes size={18} />}
                h="52px"
                variant="ghost"
                bg="whiteAlpha.100"
                _hover={{ bg: "whiteAlpha.200" }}
              >
                Review activity
              </Button>
            </SimpleGrid>
          </Box>
        </GridItem>
        <GridItem>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 1 }} gap={4}>
            <MetricCard
              label="Current inventory"
              value={summary?.currentInventoryUnits ?? 0}
              hint="Book quantity since the last confirmed count"
              color="canvas.900"
              loading={isLoading}
              valueType="number"
            />
            <MetricCard
              label="Inventory value"
              value={summary?.inventoryValue ?? 0}
              hint="Capital tied up in stock"
              color="brand.600"
              loading={isLoading}
            />
            <MetricCard
              label="Shortage this month"
              value={summary?.shortageThisMonth ?? 0}
              hint={toneLabel}
              color={tone}
              loading={isLoading}
            />
          </SimpleGrid>
        </GridItem>
      </Grid>

      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={4}>
        <MetricCard
          label="Expected stock value"
          value={summary?.expectedSalesValue ?? 0}
          hint="Retail value on the shelf"
          loading={isLoading}
        />
        <MetricCard
          label="Sales this month"
          value={summary?.salesThisMonth ?? 0}
          hint="Expected from reconciled units"
          loading={isLoading}
        />
        <MetricCard
          label="Gross profit"
          value={summary?.grossProfitThisMonth ?? 0}
          hint="This month"
          color="deposit.700"
          loading={isLoading}
        />
        <MetricCard
          label="Cash in box"
          value={summary?.currentCashInBox ?? 0}
          hint="Payments less cash movements"
          loading={isLoading}
        />
      </SimpleGrid>

      {latestReconciliation ? (
        <Box
          bg="rgba(255,255,255,0.76)"
          borderRadius="28px"
          p={{ base: 4, md: 5 }}
          border="1px solid"
          borderColor="whiteAlpha.700"
        >
          <HStack justify="space-between" align="start" spacing={4}>
            <VStack align="start" spacing={1}>
              <Text fontWeight="800" fontSize="xl">
                Open reconciliation
              </Text>
              <Text color="canvas.700">
                {latestReconciliation.startDate} to {latestReconciliation.endDate}
              </Text>
              <Text color="canvas.700">
                {latestReconciliation.unitsSold} bottles taken, expected{" "}
                {formatCurrency(latestReconciliation.expectedRevenue)}, collected{" "}
                {formatCurrency(latestReconciliation.paymentsReceived)}
              </Text>
            </VStack>
            <Button
              as={Link}
              to={`/reconciliations/${latestReconciliation.id}`}
              rightIcon={<ArrowRight size={16} />}
            >
              Review
            </Button>
          </HStack>
        </Box>
      ) : null}

      <Box
        bg="whiteAlpha.900"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        shadow="sm"
        border="1px solid"
        borderColor="blackAlpha.100"
      >
        <HStack justify="space-between" mb={4}>
          <Box>
            <Text fontWeight="800" fontSize="xl">
              Recent activity
            </Text>
          </Box>
          <Button as={Link} to="/activity" variant="ghost" rightIcon={<ArrowRight size={16} />}>
            See all
          </Button>
        </HStack>
        <Stack spacing={3}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} height="112px" borderRadius="24px" />
              ))
            : recentActivity.map((item) => <ActivityCard key={item.id} item={item} />)}
        </Stack>
      </Box>
    </Stack>
  );
}

function getCollectionLabel(rate: number, settings: Settings | null) {
  if (!settings) {
    return "Collection rate";
  }

  if (rate >= settings.honestyExcellentThreshold) {
    return "Excellent";
  }

  if (rate >= settings.honestyGoodThreshold) {
    return "Good";
  }

  if (rate >= settings.honestyWarningThreshold) {
    return "Warning";
  }

  return "Critical";
}

function getCollectionTone(rate: number, settings: Settings | null) {
  if (!settings) {
    return "canvas.900";
  }

  if (rate >= settings.honestyExcellentThreshold) {
    return "deposit.700";
  }

  if (rate >= settings.honestyGoodThreshold) {
    return "brand.600";
  }

  if (rate >= settings.honestyWarningThreshold) {
    return "orange.500";
  }

  return "withdrawal.700";
}
