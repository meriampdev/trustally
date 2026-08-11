import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  Boxes,
  ChartColumn,
  ClipboardCheck,
  House,
  LogOut,
  Settings2,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSyncQueue } from "../lib/offlineQueue";
import { supabase } from "../utils/supabase";

const navItems = [
  { label: "Home", to: "/", icon: House },
  { label: "Activity", to: "/activity", icon: Boxes },
  { label: "Capture", to: "/capture", icon: ClipboardCheck, prominent: true },
  { label: "Reports", to: "/reports", icon: ChartColumn },
  { label: "Settings", to: "/settings", icon: Settings2 },
];

const titles: Record<string, string> = {
  "/": "Honesty box dashboard",
  "/activity": "Operational activity",
  "/capture": "Capture operations",
  "/count": "Count inventory",
  "/reports": "Reports",
  "/settings": "Settings",
};

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const { pendingCount, isSyncing } = useSyncQueue();
  const title =
    location.pathname.startsWith("/reconciliations/")
      ? "Reconciliation"
      : titles[location.pathname] ?? "Trustally";

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
      return;
    }

    toast({
      title: "Signed out",
      description: "Your Trustally session has ended.",
      status: "success",
      duration: 2200,
      isClosable: true,
      position: "top",
    });
  }

  return (
    <Flex
      minH="100dvh"
      bg="linear-gradient(180deg, rgba(247, 239, 224, 0.98) 0%, rgba(243, 235, 220, 0.98) 100%)"
    >
      <Box
        display={{ base: "none", md: "flex" }}
        position="fixed"
        insetY="0"
        left="0"
        w="260px"
        px={5}
        py={6}
      >
        <VStack
          align="stretch"
          spacing={5}
          bg="rgba(255, 250, 240, 0.92)"
          backdropFilter="blur(24px)"
          borderRadius="28px"
          p={5}
          shadow="lg"
          border="1px solid"
          borderColor="whiteAlpha.600"
        >
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em">
              Trustally
            </Text>
            <Text fontSize="2xl" fontWeight="900">
              Honesty Box
            </Text>
          </Box>
          <VStack align="stretch" spacing={3}>
            {navItems.map((item) => {
              const active =
                item.to === "/" ? location.pathname === item.to : location.pathname.startsWith(item.to);

              return (
                <Button
                  as={Link}
                  to={item.to}
                  key={item.to}
                  justifyContent="start"
                  leftIcon={<item.icon size={18} />}
                  variant={active ? "solid" : "ghost"}
                  bg={active ? "brand.400" : "transparent"}
                  color={active ? "white" : "canvas.900"}
                  _hover={{
                    bg: active ? "brand.500" : "blackAlpha.50",
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </VStack>
          <Box bg="whiteAlpha.700" borderRadius="24px" p={4}>
            <Text fontWeight="700" wordBreak="break-word">
              {user?.email ?? "Unknown user"}
            </Text>
            <Button
              mt={3}
              w="full"
              variant="outline"
              leftIcon={<LogOut size={16} />}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </Box>
        </VStack>
      </Box>

      <Box flex="1" ml={{ base: 0, md: "260px" }} pb={{ base: "calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 12px)", md: 8 }}>
        {!isOnline ? (
          <Box
            position="sticky"
            top="0"
            zIndex="banner"
            bg="withdrawal.700"
            color="white"
            px={4}
            py={3}
          >
            <Text fontWeight="700">
              You&apos;re offline. Critical entries stay on this device until the connection returns.
            </Text>
          </Box>
        ) : null}
        {pendingCount > 0 ? (
          <Box
            position="sticky"
            top={isOnline ? "0" : "60px"}
            zIndex="banner"
            bg="brand.500"
            color="white"
            px={4}
            py={3}
          >
            <Text fontWeight="700">
              {pendingCount} offline {pendingCount === 1 ? "change" : "changes"} waiting to sync
              {isSyncing ? "..." : "."}
            </Text>
          </Box>
        ) : null}
        <Container maxW="7xl" px={{ base: 4, md: 6, xl: 8 }} pt={{ base: "calc(var(--safe-area-top) + 16px)", md: 6 }}>
          <HStack justify="space-between" align="end" mb={{ base: 4, md: 6 }}>
            <Box minW={0}>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700">
                Trustally
              </Text>
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="900" lineHeight="1" color="canvas.800">
                {title}
              </Text>
            </Box>
          </HStack>
          {children}
        </Container>
      </Box>

      <Box
        display={{ base: "block", md: "none" }}
        position="fixed"
        insetX="0"
        bottom="0"
        pb="var(--safe-area-bottom)"
        px={3}
        zIndex="docked"
      >
        <Flex
          bg="rgba(28, 24, 20, 0.96)"
          color="white"
          borderRadius="28px"
          px={2}
          py={2}
          align="end"
          justify="space-between"
          shadow="2xl"
        >
          {navItems.map((item) => {
            const active =
              item.to === "/" ? location.pathname === item.to : location.pathname.startsWith(item.to);

            return (
              <Box key={item.to} flex="1">
                <Button
                  as={Link}
                  to={item.to}
                  variant="ghost"
                  h={item.prominent ? "60px" : "56px"}
                  w="full"
                  color="white"
                  borderRadius="22px"
                  px={2}
                  bg={item.prominent ? "brand.400" : active ? "whiteAlpha.200" : "transparent"}
                  _hover={{ bg: item.prominent ? "brand.500" : "whiteAlpha.200" }}
                  _active={{ bg: item.prominent ? "brand.600" : "whiteAlpha.300" }}
                >
                  <VStack spacing={1}>
                    <item.icon size={item.prominent ? 22 : 18} />
                    <Text fontSize="xs" fontWeight="700">
                      {item.label}
                    </Text>
                  </VStack>
                </Button>
              </Box>
            );
          })}
        </Flex>
      </Box>
    </Flex>
  );
}
