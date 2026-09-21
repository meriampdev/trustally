import { Spinner, VStack } from "@chakra-ui/react";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RouteSkeleton } from "../components/RouteSkeleton";
import { useAuth } from "../lib/auth";
import { LocationProvider } from "../lib/location";

const HomePage = lazy(() => import("../pages/HomePage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const SetupPage = lazy(() => import("../pages/SetupPage"));
const HistoryPage = lazy(() => import("../pages/HistoryPage"));
const CycleDetailPage = lazy(() => import("../pages/CycleDetailPage"));
const CheckBoxPage = lazy(() => import("../pages/CheckBoxPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const MorePage = lazy(() => import("../pages/MorePage"));
const ProductsPage = lazy(() => import("../pages/ProductsPage"));
const AddStockPage = lazy(() => import("../pages/AddStockPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const PaymentsPage = lazy(() => import("../pages/PaymentsPage"));
const CashMovementsPage = lazy(() => import("../pages/CashMovementsPage"));
const RecordPayLaterPage = lazy(() => import("../pages/RecordPayLaterPage"));
const ExpensesPage = lazy(() => import("../pages/ExpensesPage"));
const BusinessReportsPage = lazy(() => import("../pages/BusinessReportsPage"));

function ProtectedPage({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? (
    <LocationProvider>
      <AppShell>{children}</AppShell>
    </LocationProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}

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
        <Route path="/" element={<ProtectedPage><HomePage /></ProtectedPage>} />
        <Route path="/setup" element={<ProtectedPage><SetupPage /></ProtectedPage>} />
        <Route path="/history" element={<ProtectedPage><HistoryPage /></ProtectedPage>} />
        <Route path="/history/:cycleId" element={<ProtectedPage><CycleDetailPage /></ProtectedPage>} />
        <Route path="/check-box" element={<ProtectedPage><CheckBoxPage /></ProtectedPage>} />
        <Route path="/reports" element={<ProtectedPage><ReportsPage /></ProtectedPage>} />
        <Route path="/reports/business" element={<ProtectedPage><BusinessReportsPage /></ProtectedPage>} />
        <Route path="/more" element={<ProtectedPage><MorePage /></ProtectedPage>} />
        <Route path="/products" element={<ProtectedPage><ProductsPage /></ProtectedPage>} />
        <Route path="/payments" element={<ProtectedPage><PaymentsPage /></ProtectedPage>} />
        <Route path="/pay-later" element={<ProtectedPage><RecordPayLaterPage /></ProtectedPage>} />
        <Route path="/cash-movements" element={<ProtectedPage><CashMovementsPage /></ProtectedPage>} />
        <Route path="/expenses" element={<ProtectedPage><ExpensesPage /></ProtectedPage>} />
        <Route path="/stock" element={<ProtectedPage><AddStockPage /></ProtectedPage>} />
        <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}
