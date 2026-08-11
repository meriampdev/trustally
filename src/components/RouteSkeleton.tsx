import { Box, Skeleton, SkeletonText, Stack } from "@chakra-ui/react";

export function RouteSkeleton() {
  return (
    <Stack spacing={4}>
      <Skeleton height="120px" borderRadius="28px" />
      <Stack spacing={3}>
        <Skeleton height="20px" width="40%" />
        <SkeletonText noOfLines={4} spacing={3} skeletonHeight={4} />
      </Stack>
      <Box bg="white" borderRadius="24px" p={4} shadow="sm">
        <SkeletonText noOfLines={5} spacing={4} skeletonHeight={4} />
      </Box>
    </Stack>
  );
}
