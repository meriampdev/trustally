import { Box, BoxProps, Collapse, HStack, Text } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { ReactNode, useEffect, useId, useState } from "react";

interface SectionCardProps extends BoxProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  collapsible?: boolean;
  collapseKey?: string;
  defaultExpanded?: boolean;
}

export function SectionCard({ title, eyebrow, children, collapsible = false, collapseKey, defaultExpanded = true, ...boxProps }: SectionCardProps) {
  const contentId = useId();
  const storageKey = collapseKey ? `trustally:section:${collapseKey}` : null;
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!collapsible || !storageKey || typeof window === "undefined") return defaultExpanded;
    const saved = window.localStorage.getItem(storageKey);
    return saved == null ? defaultExpanded : saved === "expanded";
  });

  useEffect(() => {
    if (collapsible && storageKey) window.localStorage.setItem(storageKey, isExpanded ? "expanded" : "collapsed");
  }, [collapsible, isExpanded, storageKey]);

  const heading = <Box minW={0} textAlign="left">
    {eyebrow ? (
      <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700">
        {eyebrow}
      </Text>
    ) : null}
    {title ? (
      <Text mt={eyebrow ? 1 : 0} fontSize="xl" fontWeight="900" color="canvas.900">
        {title}
      </Text>
    ) : null}
  </Box>;

  return (
    <Box
      bg="linear-gradient(180deg, rgba(20, 43, 67, 0.9) 0%, rgba(13, 29, 46, 0.88) 100%)"
      borderRadius="30px"
      p={{ base: 4, md: 5, xl: 6 }}
      border="1px solid"
      borderColor="rgba(142, 182, 215, 0.18)"
      backdropFilter="blur(18px)"
      shadow="0 22px 50px rgba(1, 10, 20, 0.36)"
      {...boxProps}
    >
      {collapsible ? (
        <Box
          as="button"
          type="button"
          width="100%"
          borderRadius="16px"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "4px" }}
        >
          <HStack justify="space-between" align="center" spacing={4}>
            {heading}
            <Box
              flexShrink={0}
              color="canvas.700"
              transform={isExpanded ? "rotate(180deg)" : "rotate(0deg)"}
              transition="transform 180ms ease"
              aria-hidden="true"
            >
              <ChevronDown size={22} />
            </Box>
          </HStack>
        </Box>
      ) : heading}
      {collapsible ? (
        <Collapse in={isExpanded} animateOpacity>
          <Box id={contentId} mt={title || eyebrow ? 4 : 0}>{children}</Box>
        </Collapse>
      ) : <Box mt={title || eyebrow ? 4 : 0}>{children}</Box>}
    </Box>
  );
}
