import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";

const tools = [
  {
    title: "Products",
    description: "Products, prices, costs, and stock.",
    actions: [
      { label: "Manage products", to: "/products" },
      { label: "Add stock", to: "/stock" },
    ],
  },
  {
    title: "Expenses",
    description: "Record expenses and review break-even progress.",
    actions: [{ label: "Open expenses", to: "/expenses" }],
  },
  {
    title: "Late payments",
    description: "Record amounts owed or payments received later.",
    actions: [
      { label: "Record amount owed", to: "/pay-later" },
      { label: "Record payment", to: "/payments" },
    ],
  },
  {
    title: "Cash movements",
    description: "Record cash removed, returned, or corrected.",
    actions: [{ label: "Open cash movements", to: "/cash-movements" }],
  },
  {
    title: "Settings",
    description: "Reserve goals, electricity cost, and reminders.",
    actions: [{ label: "Open settings", to: "/settings" }],
  },
  {
    title: "Exports",
    description: "Detailed reports, CSV files, and printable records.",
    actions: [{ label: "Open exports", to: "/reports/business" }],
  },
];

export default function MorePage() {
  return (
    <SectionCard eyebrow="More" title="Tools and settings">
      <Stack spacing={3}>
        {tools.map((tool) => (
          <Box key={tool.title} bg="canvas.50" borderRadius="22px" p={4}>
            <Text fontWeight="900">{tool.title}</Text>
            <Text color="canvas.700" fontSize="sm" mt={1}>{tool.description}</Text>
            <HStack mt={3} spacing={2} overflowX="auto" pb={1}>
              {tool.actions.map((action) => (
                <Button as={Link} to={action.to} key={action.to} size="sm" variant="outline" flexShrink={0}>
                  {action.label}
                </Button>
              ))}
            </HStack>
          </Box>
        ))}
      </Stack>
    </SectionCard>
  );
}
