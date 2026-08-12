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
  "/more": "More",
  "/products": "Products",
  "/payments": "Outstanding payments",
  "/pay-later": "Record pay-later",
  "/cash-movements": "Cash movements",
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
    <Flex minH="100dvh">
      <Box display={{ base: "none", lg: "flex" }} position="fixed" insetY="0" left="0" w="280px" p={6}>
        <VStack
          align="stretch"
          spacing={5}
          bg="rgba(24, 20, 16, 0.94)"
          color="white"
          borderRadius="30px"
          p={5}
          shadow="2xl"
        >
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" opacity={0.8}>
              Trustally
            </Text>
            <Text fontSize="3xl" fontWeight="900" mt={2}>
              Trust, tallied.
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
                  color="white"
                  _hover={{ bg: active ? "brand.500" : "whiteAlpha.200" }}
                >
                  {item.label}
                </Button>
              );
            })}
          </VStack>
          <Box mt="auto" bg="whiteAlpha.160" borderRadius="24px" p={4}>
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
        ml={{ base: 0, lg: "280px" }}
        pb={{ base: "calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 16px)", lg: 10 }}
      >
        {!isOnline ? (
          <Box position="sticky" top="0" zIndex="banner" bg="canvas.900" color="white" px={4} py={3}>
            <Text fontWeight="700">Offline mode is on. Drafts stay on this device and will sync later.</Text>
          </Box>
        ) : null}
        <Container maxW="none" px={{ base: 4, md: 6, xl: 8 }} pt={{ base: "calc(var(--safe-area-top) + 16px)", lg: 8 }}>
          <Box maxW="1160px" w="full">
            <HStack justify="space-between" align="end" mb={{ base: 4, md: 6 }}>
              <Box minW={0}>
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700">
                  Trustally
                </Text>
                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="900" color="canvas.900">
                  {title}
                </Text>
              </Box>
              {locations.length > 1 ? (
                <Box minW={{ base: "170px", md: "240px" }}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="canvas.700" mb={2}>
                    Location
                  </Text>
                  <Select
                    value={currentLocationId ?? ""}
                    onChange={(event) => void handleLocationChange(event.target.value)}
                    isDisabled={isLoadingLocations || isSwitchingLocation}
                    bg="white"
                    borderColor="canvas.300"
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
            <Box key={currentLocationId ?? "default-location"}>{children}</Box>
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
          bg="rgba(24, 20, 16, 0.96)"
          color="white"
          borderRadius="30px"
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
                  h={item.prominent ? "62px" : "56px"}
                  w="full"
                  color="white"
                  borderRadius="24px"
                  px={2}
                  bg={item.prominent ? "brand.400" : active ? "whiteAlpha.200" : "transparent"}
                  _hover={{ bg: item.prominent ? "brand.500" : "whiteAlpha.200" }}
                  _active={{ bg: item.prominent ? "brand.600" : "whiteAlpha.300" }}
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
