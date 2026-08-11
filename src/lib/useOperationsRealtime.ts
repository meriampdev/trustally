import { useEffect, useRef } from "react";
import {
  createOperationalRealtimeChannel,
  removeRealtimeChannel,
} from "./api";

export function useOperationsRealtime(onChange: () => void) {
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    let active = true;
    let cleanup: (() => Promise<void>) | undefined;

    void createOperationalRealtimeChannel(() => {
      onChangeRef.current();
    })
      .then((channel) => {
        if (!active) {
          void removeRealtimeChannel(channel);
          return;
        }

        cleanup = async () => {
          await removeRealtimeChannel(channel);
        };
      })
      .catch(() => {
        cleanup = undefined;
      });

    return () => {
      active = false;

      if (cleanup) {
        void cleanup();
      }
    };
  }, []);
}
