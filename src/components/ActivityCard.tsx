import { Badge, Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import { ActivityItem } from "../lib/types";
import { formatCompactDate, formatCurrency, titleCase } from "../lib/format";

interface ActivityCardProps {
  item: ActivityItem;
}

const colorSchemes: Record<ActivityItem["kind"], string> = {
  payment: "green",
  restock: "orange",
  cash_movement: "blue",
  inventory_count: "purple",
  adjustment: "red",
  reconciliation: "yellow",
};

export function ActivityCard({ item }: ActivityCardProps) {
  return (
    <Box
      bg="whiteAlpha.900"
      borderRadius="24px"
      p={4}
      shadow="sm"
      border="1px solid"
      borderColor="blackAlpha.100"
    >
      <Flex align="start" gap={3}>
        <VStack align="start" spacing={1} minW={0} flex="1">
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="sm" color="canvas.700">
              {formatCompactDate(item.date)}
            </Text>
            <Badge borderRadius="full" px={2.5} py={1} colorScheme={colorSchemes[item.kind]}>
              {titleCase(item.kind)}
            </Badge>
          </HStack>
          <Text fontWeight="700" minW={0} wordBreak="break-word">
            {item.title}
          </Text>
          <Text fontSize="sm" color="canvas.700">
            {item.subtitle}
          </Text>
          {item.notes ? (
            <Text fontSize="sm" color="canvas.700">
              {item.notes}
            </Text>
          ) : null}
        </VStack>
        <VStack align="end" spacing={1} flexShrink={0}>
          {item.amount !== null ? (
            <Text fontWeight="800" color="canvas.900" whiteSpace="nowrap">
              {formatCurrency(item.amount)}
            </Text>
          ) : null}
          {item.secondaryAmount !== null ? (
            <Text fontSize="sm" color="canvas.700" whiteSpace="nowrap">
              {formatCurrency(item.secondaryAmount)}
            </Text>
          ) : null}
        </VStack>
      </Flex>
    </Box>
  );
}
