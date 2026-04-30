"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const southAfricaBounds = {
  north: -22.1,
  south: -34.9,
  west: 16.4,
  east: 32.9,
};

function loadGoogleMapsPlaces(apiKey) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps can only load in the browser."));
      return;
    }

    if (window.google?.maps?.places) {
      resolve(window.google);
      return;
    }

    const existingScript = document.querySelector('script[data-google-maps-places="true"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", () =>
        reject(new Error("Unable to load Google Maps Places.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = "true";
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Unable to load Google Maps Places."));
    document.head.appendChild(script);
  });
}

export default function PlaceAutocompleteInput({
  value,
  onChange,
  placeholder,
  className,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [loadState, setLoadState] = useState("idle");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current || autocompleteRef.current) {
      return;
    }

    let active = true;

    loadGoogleMapsPlaces(apiKey)
      .then((google) => {
        if (!active || !inputRef.current || autocompleteRef.current) {
          return;
        }

        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "name"],
          componentRestrictions: { country: "za" },
          bounds: southAfricaBounds,
          strictBounds: false,
          types: ["geocode"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          const nextValue = place?.formatted_address || place?.name || inputRef.current?.value || "";
          onChange(nextValue);
        });

        setLoadState("ready");
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [apiKey, onChange]);

  const helperText = useMemo(() => {
    if (!apiKey) {
      return "Google Maps suggestions will appear here once a Google Places API key is added.";
    }

    if (loadState === "error") {
      return "Google Maps suggestions could not load, so you can type the address manually.";
    }

    if (loadState === "ready") {
      return "Start typing and choose the matching address suggestion.";
    }

    return "Loading Google Maps suggestions...";
  }, [apiKey, loadState]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      <p className="mt-3 text-sm text-[#7b7276]">{helperText}</p>
    </div>
  );
}
