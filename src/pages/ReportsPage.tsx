import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Grid,
  GridItem,
  HStack,
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  fetchPaymentMethodDistribution,
  fetchProductPerformance,
  fetchReportMonths,
  getErrorMessage,
} from "../lib/api";
import { formatCurrency, formatPercent } from "../lib/format";
import { PaymentMethodBreakdown, ProductPerformance, ReportMonth } from "../lib/types";
import { useOperationsRealtime } from "../lib/useOperationsRealtime";

export default function ReportsPage() {
  const [report, setReport] = useState<ReportMonth[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadReports();
  }, []);

  useOperationsRealtime(() => {
    void loadReports();
  });

  async function loadReports() {
    setIsLoading(true);

    try {
      const [nextReport, nextProductPerformance, nextPaymentMethods] = await Promise.all([
        fetchReportMonths(),
        fetchProductPerformance(),
        fetchPaymentMethodDistribution(),
      ]);
      setReport(nextReport);
      setProductPerformance(nextProductPerformance);
      setPaymentMethods(nextPaymentMethods);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const maxRevenue = Math.max(1, ...report.map((month) => month.expectedRevenue));

  return (
    <Stack spacing={4}>
      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Grid
        templateColumns={{ base: "1fr", xl: "1.15fr 0.85fr" }}
        gap={{ base: 4, xl: 6 }}
      >
        <GridItem>
          <Box
            bg="whiteAlpha.900"
            borderRadius="28px"
            p={{ base: 4, md: 5 }}
            shadow="sm"
            border="1px solid"
            borderColor="blackAlpha.100"
          >
            <Text fontWeight="800" fontSize="xl" mb={1}>
              Monthly reconciliation trend
            </Text>
            <Stack spacing={4}>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} height="60px" borderRadius="18px" />
                  ))
                : report.map((month) => (
                    <Box key={month.label}>
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="700">{month.label}</Text>
                        <Text
                          color={
                            month.shortageOrOverage >= 0
                              ? "deposit.700"
                              : "withdrawal.700"
                          }
                        >
                          {formatPercent(month.collectionRate)}
                        </Text>
                      </HStack>
                      <VStack align="stretch" spacing={2}>
                        <BarRow
                          label="Expected"
                          value={month.expectedRevenue}
                          color="brand.400"
                          maxValue={maxRevenue}
                        />
                        <BarRow
                          label="Collected"
                          value={month.paymentsReceived}
                          color="deposit.500"
                          maxValue={maxRevenue}
                        />
                      </VStack>
                    </Box>
                  ))}
            </Stack>
          </Box>
        </GridItem>

        <GridItem>
          <Stack spacing={4}>
            <Box
              bg="rgba(255,255,255,0.75)"
              borderRadius="28px"
              p={{ base: 4, md: 5 }}
              border="1px solid"
              borderColor="whiteAlpha.700"
            >
              <Text fontWeight="800" fontSize="xl" mb={4}>
                Payment methods
              </Text>
              {isLoading ? (
                <Skeleton height="140px" borderRadius="24px" />
              ) : (
                <VStack align="stretch" spacing={3}>
                  {paymentMethods.map((method) => (
                    <MiniMetric
                      key={method.method}
                      label={method.method.toUpperCase()}
                      value={`${formatCurrency(method.amount)} • ${formatPercent(method.share)}`}
                    />
                  ))}
                </VStack>
              )}
            </Box>

            <Box
              bg="whiteAlpha.900"
              borderRadius="28px"
              p={{ base: 4, md: 5 }}
              shadow="sm"
              border="1px solid"
              borderColor="blackAlpha.100"
            >
              <Text fontWeight="800" fontSize="xl" mb={4}>
                Product performance
              </Text>
              {isLoading ? (
                <Skeleton height="280px" borderRadius="24px" />
              ) : (
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Product</Th>
                        <Th isNumeric>Units</Th>
                        <Th isNumeric>Revenue</Th>
                        <Th isNumeric>Profit</Th>
                        <Th isNumeric>Days left</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {productPerformance.slice(0, 8).map((product) => (
                        <Tr key={product.productId}>
                          <Td>{product.productName}</Td>
                          <Td isNumeric>{product.unitsSold}</Td>
                          <Td isNumeric>{formatCurrency(product.revenue)}</Td>
                          <Td isNumeric>{formatCurrency(product.grossProfit)}</Td>
                          <Td isNumeric>
                            {product.daysOfStockRemaining === null
                              ? "-"
                              : product.daysOfStockRemaining.toFixed(1)}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Stack>
        </GridItem>
      </Grid>
    </Stack>
  );
}

function BarRow({
  label,
  value,
  color,
  maxValue,
}: {
  label: string;
  value: number;
  color: string;
  maxValue: number;
}) {
  const width = `${Math.max(12, (value / maxValue) * 100)}%`;

  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="sm" color="canvas.700">
          {label}
        </Text>
        <Text fontSize="sm" fontWeight="700">
          {formatCurrency(value)}
        </Text>
      </HStack>
      <Box h="12px" borderRadius="full" bg="blackAlpha.100" overflow="hidden">
        <Box h="full" borderRadius="full" bg={color} w={width} />
      </Box>
    </Box>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
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
