import { Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";

export default function MorePage() {
  return (
    <Stack spacing={5}>
      <SectionCard eyebrow="More" title="Manage your box">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <ActionCard
            title="Products"
            description="Edit product details, archive products, and preserve price history."
            to="/products"
          />
          <ActionCard
            title="Record pay-later"
            description="Log message-based “I took bottles, I’ll pay later” updates right away."
            to="/pay-later"
          />
          <ActionCard
            title="Outstanding payments"
            description="Review open pay-later balances and record bulk or delayed payments."
            to="/payments"
          />
          <ActionCard
            title="Cash movements"
            description="Record cash removed, returned, or corrected without affecting revenue."
            to="/cash-movements"
          />
          <ActionCard
            title="Expenses & break-even"
            description="Record business expenses and see your break-even progress and projected date."
            to="/expenses"
          />
          <ActionCard
            title="Add stock"
            description="Record bottles you physically add while a cycle is active."
            to="/stock"
          />
          <ActionCard
            title="Historical data"
            description="Browse completed cycles, stock changes, and adjustments."
            to="/history"
          />
          <ActionCard
            title="Settings"
            description="Adjust coverage targets, reminders, and collection thresholds."
            to="/settings"
          />
          <ActionCard
            title="Initial setup"
            description="Use setup again only if you’re starting a brand-new honesty box."
            to="/setup"
          />
        </SimpleGrid>
      </SectionCard>
    </Stack>
  );
}

function ActionCard({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <SectionCard title={title}>
      <Text color="canvas.700">{description}</Text>
      <Button as={Link} to={to} mt={4}>
        Open
      </Button>
    </SectionCard>
  );
}
