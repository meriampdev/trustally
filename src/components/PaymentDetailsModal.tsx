import {
  Badge,
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from "@chakra-ui/react";
import { formatCurrency, formatManilaDateTime } from "../lib/format";
import { CyclePaymentRecord } from "../lib/types";

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  records: CyclePaymentRecord[];
  channel?: CyclePaymentRecord["channel"];
}

export function PaymentDetailsModal({ isOpen, onClose, title, records, channel }: PaymentDetailsModalProps) {
  const visibleRecords = channel ? records.filter((record) => record.channel === channel) : records;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {visibleRecords.length ? (
            <Stack spacing={3}>
              {visibleRecords.map((record) => (
                <Box key={record.id} bg="canvas.50" borderRadius="20px" p={4}>
                  <Stack direction="row" justify="space-between" align="start" spacing={3}>
                    <Box>
                      <Text fontWeight="900">{record.method} · {formatCurrency(record.amount)}</Text>
                      <Text color="canvas.700" mt={1}>{record.cycleLabel} · {formatManilaDateTime(record.occurredAt)}</Text>
                    </Box>
                    <Badge colorScheme={record.isItemized ? "green" : "gray"}>
                      {record.isItemized ? "Recorded payment" : "Cycle total"}
                    </Badge>
                  </Stack>
                  {record.personLabel ? <Text mt={2}>Person: {record.personLabel}</Text> : null}
                  {record.referenceNumber ? <Text color="canvas.700" mt={1}>Reference: {record.referenceNumber}</Text> : null}
                  {record.note ? <Text color="canvas.700" mt={2}>{record.note}</Text> : null}
                  {record.recordedAt !== record.occurredAt ? (
                    <Text color="canvas.700" fontSize="sm" mt={2}>Recorded {formatManilaDateTime(record.recordedAt)}</Text>
                  ) : null}
                </Box>
              ))}
            </Stack>
          ) : (
            <Text color="canvas.700">No {channel ?? "payment"} records for this cycle or reporting period.</Text>
          )}
        </ModalBody>
        <ModalFooter><Button onClick={onClose}>Close</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}
