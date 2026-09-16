import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getDefaultReportDateRange } from "../lib/reportRange";

interface DateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onApply: (startDate: string, endDate: string) => void;
  title?: string;
}

export function DateRangeModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply,
  title = "Choose a date range",
}: DateRangeModalProps) {
  const defaults = getDefaultReportDateRange();
  const [draftStartDate, setDraftStartDate] = useState(startDate || defaults.startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate || defaults.endDate);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const nextDefaults = getDefaultReportDateRange();
    setDraftStartDate(startDate || nextDefaults.startDate);
    setDraftEndDate(endDate || nextDefaults.endDate);
    setErrorMessage("");
  }, [isOpen, startDate, endDate]);

  function applyRange() {
    if (!draftStartDate || !draftEndDate) {
      setErrorMessage("Choose both a start date and an end date.");
      return;
    }
    if (draftStartDate > draftEndDate) {
      setErrorMessage("The start date must be on or before the end date.");
      return;
    }
    onApply(draftStartDate, draftEndDate);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(6px)" />
      <ModalContent bg="canvas.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="28px" mx={4}>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text color="canvas.700" mb={4}>
            Completed cycles whose completion date falls within this inclusive range will be included.
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
            <FormControl isRequired>
              <FormLabel>Start date</FormLabel>
              <Input
                type="date"
                value={draftStartDate}
                max={draftEndDate || undefined}
                onChange={(event) => {
                  setDraftStartDate(event.target.value);
                  setErrorMessage("");
                }}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>End date</FormLabel>
              <Input
                type="date"
                value={draftEndDate}
                min={draftStartDate || undefined}
                onChange={(event) => {
                  setDraftEndDate(event.target.value);
                  setErrorMessage("");
                }}
              />
            </FormControl>
          </SimpleGrid>
          {errorMessage ? <Text color="caution.600" mt={3}>{errorMessage}</Text> : null}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={applyRange}>Apply date range</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
