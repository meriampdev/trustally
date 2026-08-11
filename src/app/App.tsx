import { Spinner, VStack } from "@chakra-ui/react";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RouteSkeleton } from "../components/RouteSkeleton";
import { useAuth } from "../lib/auth";

const HomePage = lazy(() => import("../pages/HomePage"));
const TransactionsPage = lazy(() => import("../pages/TransactionsPage"));
const AddTransactionPage = lazy(() => import("../pages/AddTransactionPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const CountInventoryPage = lazy(() => import("../pages/CountInventoryPage"));
const ReconciliationPage = lazy(() => import("../pages/ReconciliationPage"));

export default function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <VStack minH="100dvh" justify="center" spacing={4}>
        <Spinner size="xl" color="brand.400" thickness="4px" />
      </VStack>
    );
  }

  return (
    <Suspense fallback={<RouteSkeleton />}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={user ? <AppShell><HomePage /></AppShell> : <Navigate to="/login" replace />}
        />
        <Route
          path="/activity"
          element={
            user ? (
              <AppShell>
                <TransactionsPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/capture"
          element={
            user ? (
              <AppShell>
                <AddTransactionPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/count"
          element={
            user ? (
              <AppShell>
                <CountInventoryPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reconciliations/:reconciliationId"
          element={
            user ? (
              <AppShell>
                <ReconciliationPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reports"
          element={
            user ? (
              <AppShell>
                <ReportsPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            user ? (
              <AppShell>
                <SettingsPage />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/" : "/login"} replace />}
        />
      </Routes>
    </Suspense>
  );
}
