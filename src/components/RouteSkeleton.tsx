import { Skeleton, Stack } from "@chakra-ui/react";

export function RouteSkeleton() {
  return (
    <Stack spacing={4} p={6}>
      <Skeleton h="140px" borderRadius="28px" />
      <Skeleton h="120px" borderRadius="28px" />
      <Skeleton h="220px" borderRadius="28px" />
    </Stack>
  );
}
