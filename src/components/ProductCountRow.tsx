import {
  Box,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Minus, Plus } from "lucide-react";

interface ProductCountRowProps {
  name: string;
  expectedQuantity: number;
  actualQuantity: number;
  onChange: (value: number) => void;
}

export function ProductCountRow({
  name,
  expectedQuantity,
  actualQuantity,
  onChange,
}: ProductCountRowProps) {
  return (
    <Box
      bg="whiteAlpha.900"
      borderRadius="24px"
      px={4}
      py={4}
      border="1px solid"
      borderColor="blackAlpha.100"
    >
      <Stack spacing={3}>
        <HStack justify="space-between" align="start">
          <Box minW={0}>
            <Text fontWeight="700">{name}</Text>
            <Text fontSize="sm" color="canvas.700">
              Expected {expectedQuantity}
            </Text>
          </Box>
          <Text
            fontWeight="800"
            color={actualQuantity - expectedQuantity < 0 ? "withdrawal.700" : "deposit.700"}
          >
            {actualQuantity - expectedQuantity >= 0 ? "+" : ""}
            {actualQuantity - expectedQuantity}
          </Text>
        </HStack>
        <HStack spacing={3}>
          <IconButton
            aria-label={`Decrease ${name}`}
            icon={<Minus size={18} />}
            borderRadius="full"
            onClick={() => onChange(Math.max(0, actualQuantity - 1))}
          />
          <Input
            value={String(actualQuantity)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
            }}
            inputMode="numeric"
            textAlign="center"
            fontWeight="800"
            fontSize="xl"
            borderColor="black"
            color="black"
            _hover={{ borderColor: "black" }}
            _focusVisible={{
              borderColor: "black",
              boxShadow: "0 0 0 1px black",
            }}
          />
          <IconButton
            aria-label={`Increase ${name}`}
            icon={<Plus size={18} />}
            borderRadius="full"
            onClick={() => onChange(actualQuantity + 1)}
          />
        </HStack>
      </Stack>
    </Box>
  );
}
