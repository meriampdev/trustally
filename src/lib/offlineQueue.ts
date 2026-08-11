import { useEffect, useState } from "react";
import {
  createCashMovement,
  createInventoryAdjustment,
  createInventoryCount,
  createPayment,
  createRestockEvent,
  isProbablyOfflineError,
} from "./api";
import {
  CashMovementInput,
  InventoryAdjustmentInput,
  InventoryCountInput,
  PaymentInput,
  RestockInput,
} from "./types";
import { useAuth } from "./auth";

type PendingOperation =
  | { id: string; type: "payment"; createdAt: string; payload: PaymentInput }
  | { id: string; type: "restock"; createdAt: string; payload: RestockInput }
  | {
      id: string;
      type: "cash_movement";
      createdAt: string;
      payload: CashMovementInput;
    }
  | {
      id: string;
      type: "inventory_adjustment";
      createdAt: string;
      payload: InventoryAdjustmentInput;
    }
  | {
      id: string;
      type: "inventory_count";
      createdAt: string;
      payload: InventoryCountInput;
    };

const STORAGE_KEY = "trustally.sync-queue";
const CHANGE_EVENT = "trustally-sync-queue-change";

export function enqueuePendingOperation(operation: Omit<PendingOperation, "id" | "createdAt">) {
  const next = {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as PendingOperation;

  const queue = [...getPendingOperations(), next];
  writeQueue(queue);

  return next;
}

export function getPendingOperations() {
  if (typeof window === "undefined") {
    return [] as PendingOperation[];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [] as PendingOperation[];
  }

  try {
    return JSON.parse(raw) as PendingOperation[];
  } catch {
    return [] as PendingOperation[];
  }
}

export function getPendingOperationCount() {
  return getPendingOperations().length;
}

export function useSyncQueue() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(getPendingOperationCount);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setPendingCount(getPendingOperationCount());
    };

    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);

    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleOnline = () => {
      void syncNow();
    };

    window.addEventListener("online", handleOnline);

    if (navigator.onLine && getPendingOperationCount() > 0) {
      void syncNow();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [user]);

  async function syncNow() {
    if (!user || !navigator.onLine) {
      return;
    }

    const queue = getPendingOperations();

    if (queue.length === 0) {
      setPendingCount(0);
      return;
    }

    setIsSyncing(true);

    try {
      for (const operation of queue) {
        try {
          await processOperation(operation);
          removePendingOperation(operation.id);
        } catch (error) {
          if (!isProbablyOfflineError(error)) {
            throw error;
          }

          break;
        }
      }
    } finally {
      setPendingCount(getPendingOperationCount());
      setIsSyncing(false);
    }
  }

  return {
    pendingCount,
    isSyncing,
    syncNow,
  };
}

async function processOperation(operation: PendingOperation) {
  switch (operation.type) {
    case "payment":
      await createPayment(operation.payload);
      return;
    case "restock":
      await createRestockEvent(operation.payload);
      return;
    case "cash_movement":
      await createCashMovement(operation.payload);
      return;
    case "inventory_adjustment":
      await createInventoryAdjustment(operation.payload);
      return;
    case "inventory_count":
      await createInventoryCount(operation.payload);
  }
}

function removePendingOperation(id: string) {
  writeQueue(getPendingOperations().filter((operation) => operation.id !== id));
}

function writeQueue(queue: PendingOperation[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
