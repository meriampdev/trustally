import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Select,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  ChartColumn,
  ClipboardCheck,
  History,
  House,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCurrentLocation } from "../lib/location";
import { supabase } from "../utils/supabase";
import { BrandMark } from "./BrandMark";

const navItems = [
  { label: "Home", to: "/", icon: House },
  { label: "History", to: "/history", icon: History },
  { label: "Check Box", to: "/check-box", icon: ClipboardCheck, prominent: true },
  { label: "Reports", to: "/reports", icon: ChartColumn },
  { label: "More", to: "/more", icon: MoreHorizontal },
];

const titles: Record<string, string> = {
  "/": "Current cycle",
  "/setup": "Set up your box",
  "/history": "Box history",
  "/check-box": "Check box",
  "/reports": "Reports",
  "/reports/business": "Business reports",
  "/more": "More",
  "/products": "Products",
  "/payments": "Outstanding payments",
  "/pay-later": "Record pay-later",
  "/cash-movements": "Cash movements",
  "/expenses": "Expenses & break-even",
  "/stock": "Add stock",
  "/settings": "Settings",
};

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const {
    locations,
    currentLocationId,
    isLoadingLocations,
    isSwitchingLocation,
    changeLocation,
  } = useCurrentLocation();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const title = titles[location.pathname] ?? "Trustally";

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

  async function handleLocationChange(nextLocationId: string) {
    if (!nextLocationId || nextLocationId === currentLocationId) {
      return;
    }

    try {
      await changeLocation(nextLocationId);
      navigate("/", { replace: false });
      toast({
        title: "Location updated",
        description: "Trustally will keep using this location until you switch again.",
        status: "success",
        duration: 2200,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Could not switch location",
        description: error instanceof Error ? error.message : "Please try again.",
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    }
  }

  return (
    <Flex minH="100dvh" width="100%" maxWidth="100%" minWidth={0} overflowX="hidden">
      <Box display={{ base: "none", lg: "flex" }} position="fixed" insetY="0" left="0" w="280px" p={6}>
        <VStack
          align="stretch"
          spacing={5}
          bg="linear-gradient(180deg, rgba(9, 28, 45, 0.98) 0%, rgba(15, 40, 62, 0.94) 48%, rgba(19, 66, 101, 0.9) 100%)"
          color="white"
          borderRadius="30px"
          p={5}
          border="1px solid"
          borderColor="whiteAlpha.120"
          boxShadow="0 24px 60px rgba(1, 10, 20, 0.55)"
        >
          <HStack spacing={3} align="center">
            <BrandMark size={58} />
            <Box>
              <Text fontSize="xl" fontWeight="900" lineHeight="1">
                Trustally
              </Text>
              <Text fontSize="sm" mt={1} opacity={0.82}>
                Trust, tallied.
              </Text>
            </Box>
          </HStack>
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
                  color="white"
                  _hover={{ bg: active ? "brand.500" : "whiteAlpha.200" }}
                >
                  {item.label}
                </Button>
              );
            })}
          </VStack>
          <Box
            mt="auto"
            bg="linear-gradient(180deg, rgba(20, 54, 84, 0.82) 0%, rgba(11, 30, 48, 0.92) 100%)"
            borderRadius="24px"
            p={4}
            border="1px solid"
            borderColor="whiteAlpha.120"
          >
            <Text fontWeight="700" wordBreak="break-word">
              {user?.email ?? "Unknown user"}
            </Text>
            <Button
              mt={3}
              w="full"
              variant="outline"
              color="white"
              borderColor="whiteAlpha.400"
              leftIcon={<LogOut size={16} />}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </Box>
        </VStack>
      </Box>

      <Box
        flex="1"
        width="100%"
        maxWidth="100%"
        minWidth={0}
        overflowX="hidden"
        ml={{ base: 0, lg: "280px" }}
        pb={{ base: "calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 16px)", lg: 10 }}
      >
        {!isOnline ? (
          <Box
            position="sticky"
            top="0"
            zIndex="banner"
            bg="rgba(12, 31, 49, 0.94)"
            color="white"
            px={4}
            py={3}
            backdropFilter="blur(14px)"
            borderBottom="1px solid"
            borderColor="whiteAlpha.120"
          >
            <Text fontWeight="700">Offline mode is on. Drafts stay on this device and will sync later.</Text>
          </Box>
        ) : null}
        <Container maxW="none" minW={0} px={{ base: 4, md: 6, xl: 8 }} pt={{ base: "calc(var(--safe-area-top) + 16px)", lg: 8 }}>
          <Box maxW="1160px" w="full" minW={0}>
            <HStack justify="space-between" align="end" mb={{ base: 4, md: 6 }}>
              <HStack minW={0} spacing={3} align="center">
                <BrandMark size={44} />
                <Box minW={0}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700">
                    Trustally
                  </Text>
                  <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="900" color="canvas.900" noOfLines={1}>
                    {title}
                  </Text>
                </Box>
              </HStack>
              {locations.length > 1 ? (
                <Box minW={{ base: "170px", md: "240px" }}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700" mb={2}>
                    Location
                  </Text>
                  <Select
                    value={currentLocationId ?? ""}
                    onChange={(event) => void handleLocationChange(event.target.value)}
                    isDisabled={isLoadingLocations || isSwitchingLocation}
                    bg="rgba(19, 40, 63, 0.9)"
                    borderColor="rgba(142, 182, 215, 0.22)"
                    fontWeight="700"
                  >
                    {locations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </Box>
              ) : null}
            </HStack>
            <Box key={currentLocationId ?? "default-location"} width="100%" minWidth={0}>{children}</Box>
          </Box>
        </Container>
      </Box>

      <Box
        display={{ base: "block", lg: "none" }}
        position="fixed"
        insetX="0"
        bottom="0"
        pb="var(--safe-area-bottom)"
        px={3}
        zIndex="docked"
      >
        <Flex
          bg="linear-gradient(180deg, rgba(9, 28, 45, 0.98) 0%, rgba(16, 49, 76, 0.92) 100%)"
          color="white"
          borderRadius="30px"
          px={2}
          py={2}
          align="end"
          justify="space-between"
          border="1px solid"
          borderColor="whiteAlpha.120"
          boxShadow="0 20px 48px rgba(1, 10, 20, 0.52)"
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
                  h={item.prominent ? "62px" : "56px"}
                  w="full"
                  color="white"
                  borderRadius="24px"
                  px={2}
                  bg={active ? "brand.400" : "transparent"}
                  _hover={{ bg: active ? "brand.500" : "whiteAlpha.200" }}
                  _active={{ bg: active ? "brand.600" : "whiteAlpha.300" }}
                >
                  <VStack spacing={1}>
                    <item.icon size={item.prominent ? 22 : 18} />
                    <Text fontSize="xs" fontWeight="800">
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
