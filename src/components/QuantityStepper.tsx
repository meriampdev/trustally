import { Button, HStack, Input, Text } from "@chakra-ui/react";

interface QuantityStepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}

export function QuantityStepper({
  label,
  value,
  onChange,
  min = 0,
}: QuantityStepperProps) {
  function update(nextValue: number) {
    onChange(Math.max(min, nextValue));
  }

  return (
    <HStack spacing={3}>
      {label ? (
        <Text minW="54px" color="canvas.700">
          {label}
        </Text>
      ) : null}
      <Button variant="outline" borderRadius="full" onClick={() => update(value - 1)}>
        -
      </Button>
      <Input
        value={String(value)}
        onChange={(event) => update(Number(event.target.value) || 0)}
        inputMode="numeric"
        textAlign="center"
        maxW="88px"
      />
      <Button variant="outline" borderRadius="full" onClick={() => update(value + 1)}>
        +
      </Button>
    </HStack>
  );
}
