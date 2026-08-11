import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  HStack,
  InputGroup,
  InputLeftElement,
  Input,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ActivityCard } from "../components/ActivityCard";
import { fetchActivityPage, getErrorMessage } from "../lib/api";
import { ActivityItem } from "../lib/types";
import { useOperationsRealtime } from "../lib/useOperationsRealtime";

const PAGE_SIZE = 10;

const filters = [
  { label: "All", value: "all" },
  { label: "Payments", value: "payment" },
  { label: "Restocks", value: "restock" },
  { label: "Counts", value: "inventory_count" },
  { label: "Recons", value: "reconciliation" },
];

export default function TransactionsPage() {
  const [kind, setKind] = useState<
    "all" | "payment" | "restock" | "inventory_count" | "reconciliation"
  >("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const deferredSearch = useDeferredValue(search);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(deferredSearch.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [deferredSearch]);

  useEffect(() => {
    void loadActivity(0, false);
  }, [kind, debouncedSearch]);

  useOperationsRealtime(() => {
    void loadActivity(0, false, Math.max(items.length, PAGE_SIZE));
  });

  async function loadActivity(offset: number, append: boolean, limit = PAGE_SIZE) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const page = await fetchActivityPage({
        offset,
        limit,
        kind,
        search: debouncedSearch || undefined,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
      setErrorMessage("");
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setErrorMessage(getErrorMessage(error));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }

  return (
    <Stack spacing={4}>
      <Box
        bg="whiteAlpha.900"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        border="1px solid"
        borderColor="blackAlpha.100"
      >
        <Stack spacing={4}>
          <HStack spacing={3} wrap="wrap">
            {filters.map((filter) => (
              <Button
                key={filter.value}
                variant={kind === filter.value ? "solid" : "ghost"}
                onClick={() => setKind(filter.value as typeof kind)}
              >
                {filter.label}
              </Button>
            ))}
          </HStack>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <Search size={18} />
            </InputLeftElement>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes, products, or activity"
              borderColor="black"
              color="black"
              _placeholder={{ color: "black", opacity: 1 }}
              _hover={{ borderColor: "black" }}
              _focusVisible={{
                borderColor: "black",
                boxShadow: "0 0 0 1px black",
              }}
            />
          </InputGroup>
        </Stack>
      </Box>

      {errorMessage ? (
        <Alert status="warning" borderRadius="24px">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Box
        bg="rgba(255,255,255,0.65)"
        borderRadius="28px"
        p={{ base: 4, md: 5 }}
        border="1px solid"
        borderColor="whiteAlpha.700"
      >
        <Text fontWeight="700" mb={4}>
          {totalCount} activity records
        </Text>
        <Stack spacing={3}>
          {isLoading && items.length === 0
            ? Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} height="112px" borderRadius="24px" />
              ))
            : items.map((item) => <ActivityCard key={item.id} item={item} />)}
        </Stack>

        {!isLoading && items.length === 0 ? (
          <Box mt={4} bg="whiteAlpha.900" borderRadius="24px" p={5} textAlign="center">
            <Text fontWeight="700">No activity matches these filters yet.</Text>
            <Text color="canvas.700" mt={1}>
              Record a payment, restock, or inventory count to build the audit trail.
            </Text>
          </Box>
        ) : null}

        {hasMore ? (
          <Button
            mt={4}
            w={{ base: "full", md: "auto" }}
            isLoading={isLoadingMore}
            onClick={() => void loadActivity(items.length, true)}
          >
            Load more
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
