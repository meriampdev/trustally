import { Box, Image } from "@chakra-ui/react";
import trustallyIcon from "../assets/trustally-icon-master.png";

interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 48 }: BrandMarkProps) {
  return (
    <Box
      aria-label="Trustally"
      flexShrink={0}
      h={`${size}px`}
      overflow="hidden"
      position="relative"
      role="img"
      w={`${size}px`}
    >
      <Image
        alt=""
        h="auto"
        left="0"
        maxW="none"
        pointerEvents="none"
        position="absolute"
        src={trustallyIcon}
        top="0"
        userSelect="none"
        w="126%"
      />
    </Box>
  );
}
