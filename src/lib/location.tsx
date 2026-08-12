import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchAccessibleLocations, setCurrentLocation } from "./api";
import { AccessibleLocation } from "./types";

interface LocationContextValue {
  locations: AccessibleLocation[];
  currentLocationId: string | null;
  isLoadingLocations: boolean;
  isSwitchingLocation: boolean;
  refreshLocations: () => Promise<void>;
  changeLocation: (locationId: string) => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<AccessibleLocation[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isSwitchingLocation, setIsSwitchingLocation] = useState(false);

  useEffect(() => {
    void refreshLocations();
  }, []);

  async function refreshLocations() {
    setIsLoadingLocations(true);
    try {
      const nextLocations = await fetchAccessibleLocations();
      setLocations(nextLocations);
      setCurrentLocationId(
        nextLocations.find((location) => location.isCurrent)?.id ?? nextLocations[0]?.id ?? null,
      );
    } finally {
      setIsLoadingLocations(false);
    }
  }

  async function changeLocation(locationId: string) {
    if (!locationId || locationId === currentLocationId) {
      return;
    }

    setIsSwitchingLocation(true);
    try {
      await setCurrentLocation(locationId);
      await refreshLocations();
      setCurrentLocationId(locationId);
    } finally {
      setIsSwitchingLocation(false);
    }
  }

  const value = useMemo(
    () => ({
      locations,
      currentLocationId,
      isLoadingLocations,
      isSwitchingLocation,
      refreshLocations,
      changeLocation,
    }),
    [currentLocationId, isLoadingLocations, isSwitchingLocation, locations],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useCurrentLocation() {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useCurrentLocation must be used within LocationProvider.");
  }

  return context;
}
