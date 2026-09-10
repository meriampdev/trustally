import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { FormEvent, FormEventHandler, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../lib/auth";
import { supabase } from "../utils/supabase";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const toast = useToast();
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(
    () => (mode === "sign-in" ? "Welcome back" : "Set up your Trustally account"),
    [mode],
  );

  if (!isLoading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      const message = "Email and password are required.";
      setErrorMessage(message);
      return;
    }

    if (mode === "sign-up" && password !== confirmPassword) {
      const message = "Passwords do not match.";
      setErrorMessage(message);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Signed in",
          description: "Your box is ready to check.",
          status: "success",
          duration: 2200,
          isClosable: true,
          position: "top",
        });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }

        toast({
          title: data.session ? "Account created" : "Check your email",
          description: data.session
            ? "You are signed in and ready to start."
            : "Your account was created. Confirm your email, then sign in.",
          status: "success",
          duration: 3600,
          isClosable: true,
          position: "top",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setErrorMessage(message);
      toast({
        title: mode === "sign-in" ? "Sign in failed" : "Sign up failed",
        description: message,
        status: "error",
        duration: 4200,
        isClosable: true,
        position: "top",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      minH="100dvh"
      pt="calc(var(--safe-area-top) + 20px)"
      pb="calc(var(--safe-area-bottom) + 24px)"
      px={4}
    >
      <VStack spacing={6} maxW="440px" mx="auto" align="stretch">
        <Box
          borderRadius="32px"
          p={6}
          color="white"
          bg="linear-gradient(135deg, rgba(3, 25, 42, 0.98) 0%, rgba(10, 74, 122, 0.94) 42%, rgba(78, 198, 255, 0.92) 100%)"
          border="1px solid"
          borderColor="whiteAlpha.160"
          boxShadow="0 24px 58px rgba(1, 10, 20, 0.4)"
        >
          <HStack spacing={3}>
            <BrandMark size={64} />
            <Box>
              <Text fontSize="2xl" fontWeight="900" lineHeight="1">
                Trustally
              </Text>
              <Text fontSize="sm" mt={1} opacity={0.85}>
                Trust, tallied.
              </Text>
            </Box>
          </HStack>
          <Text fontSize="3xl" fontWeight="900" mt={2}>
            {title}
          </Text>
          <Text mt={3} color="whiteAlpha.900">
            Track your honesty box the simple way: stock it, wait, check it, refill it.
          </Text>
        </Box>

        <Box
          bg="linear-gradient(180deg, rgba(12, 25, 40, 0.92) 0%, rgba(8, 18, 29, 0.9) 100%)"
          borderRadius="30px"
          p={5}
          border="1px solid"
          borderColor="rgba(142, 182, 215, 0.18)"
          boxShadow="0 18px 44px rgba(1, 10, 20, 0.3)"
        >
          <HStack spacing={3} mb={5}>
            <ModeButton active={mode === "sign-in"} label="Sign in" onClick={() => setMode("sign-in")} />
            <ModeButton active={mode === "sign-up"} label="Create account" onClick={() => setMode("sign-up")} />
          </HStack>

          {errorMessage ? (
            <Alert status="error" borderRadius="22px" mb={4}>
              <AlertIcon />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Stack
            as="form"
            spacing={4}
            onSubmit={handleSubmit as unknown as FormEventHandler<HTMLDivElement>}
          >
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              size="lg"
            />
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              size="lg"
            />
            {mode === "sign-up" ? (
              <Input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                type="password"
                autoComplete="new-password"
                size="lg"
              />
            ) : null}
            <Button type="submit" size="lg" isLoading={isSubmitting}>
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </Stack>
        </Box>
      </VStack>
    </Box>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button flex="1" variant={active ? "solid" : "outline"} onClick={onClick}>
      {label}
    </Button>
  );
}
