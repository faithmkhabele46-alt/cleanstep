"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const autocompleteServiceRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const [loadState, setLoadState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || autocompleteServiceRef.current) {
      return;
    }

    let active = true;

    loadGoogleMapsPlaces(apiKey)
      .then((google) => {
        if (!active || !inputRef.current || autocompleteServiceRef.current) {
          return;
        }

        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

        setLoadState("ready");
        setErrorMessage("");
      })
      .catch(() => {
        if (active) {
          setLoadState("error");
          setErrorMessage("Google Maps suggestions could not load, so you can type the address manually.");
        }
      });

    return () => {
      active = false;
    };
  }, [apiKey]);

  useEffect(() => {
    if (loadState !== "ready" || !autocompleteServiceRef.current) {
      return;
    }

    const trimmedValue = String(value || "").trim();

    if (trimmedValue.length < 1) {
      return;
    }

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: trimmedValue,
        componentRestrictions: { country: "za" },
        region: "za",
      },
      (predictions, status) => {
        if (status !== window.google?.maps?.places?.PlacesServiceStatus?.OK || !predictions) {
          setSuggestions([]);
          setShowSuggestions(false);
          if (status === window.google?.maps?.places?.PlacesServiceStatus?.REQUEST_DENIED) {
            setErrorMessage(
              "Google Maps is blocking address suggestions on this site. Add https://cleanstep.vercel.app/* to the API key referrer list in Google Cloud.",
            );
          } else if (status === window.google?.maps?.places?.PlacesServiceStatus?.ZERO_RESULTS) {
            setErrorMessage("Keep typing the street name as well so Google can match the address.");
          }
          return;
        }

        setErrorMessage("");
        setSuggestions(
          predictions.slice(0, 5).map((prediction) => ({
            id: prediction.place_id,
            description: prediction.description,
          })),
        );
        setShowSuggestions(true);
      },
    );
  }, [loadState, value]);

  const helperText = useMemo(() => {
    if (!apiKey) {
      return "Google Maps suggestions will appear here once a Google Places API key is added.";
    }

    if (loadState === "error") {
      return errorMessage || "Google Maps suggestions could not load, so you can type the address manually.";
    }

    if (loadState === "ready") {
      if (errorMessage) {
        return errorMessage;
      }

      return suggestions.length > 0
        ? "Tap one of the matching address suggestions below."
        : "Keep typing and the matching address suggestions will appear below.";
    }

    return "Loading Google Maps suggestions...";
  }, [apiKey, errorMessage, loadState, suggestions.length]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);

          if (!String(nextValue || "").trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }}
        onFocus={() => {
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
          }

          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => {
            setShowSuggestions(false);
          }, 150);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#1f4b8f]/12 bg-white shadow-[0_20px_50px_rgba(31,75,143,0.16)]">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(suggestion.description);
                setSuggestions([]);
              }}
              className="block w-full border-t border-[#1f4b8f]/8 px-4 py-3 text-left text-sm text-[#3f363a] first:border-t-0 hover:bg-[#eef4ff]"
            >
              {suggestion.description}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-[#7b7276]">{helperText}</p>
    </div>
  );
}
