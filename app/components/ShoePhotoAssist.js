"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { formatCurrency } from "../lib/booking";

const pricingMap = {
  ordinary: {
    other: 130,
    white: 140,
    boots: 160,
  },
  suede: {
    other: 140,
    white: 150,
    boots: 170,
  },
};

function guessColourCategory(imageUrl) {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve("other");
        return;
      }

      context.drawImage(image, 0, 0, 32, 32);
      const { data } = context.getImageData(0, 0, 32, 32);

      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let index = 0; index < data.length; index += 4) {
        red += data[index];
        green += data[index + 1];
        blue += data[index + 2];
        count += 1;
      }

      const avgRed = red / count;
      const avgGreen = green / count;
      const avgBlue = blue / count;
      const brightness = (avgRed + avgGreen + avgBlue) / 3;
      const saturationSpread =
        Math.max(avgRed, avgGreen, avgBlue) - Math.min(avgRed, avgGreen, avgBlue);

      if (brightness > 180 && saturationSpread < 55) {
        resolve("white");
        return;
      }

      resolve("other");
    };

    image.onerror = () => resolve("other");
    image.src = imageUrl;
  });
}

export default function ShoePhotoAssist() {
  const [photoUrl, setPhotoUrl] = useState("");
  const [detectedColour, setDetectedColour] = useState("");
  const [materialGroup, setMaterialGroup] = useState("ordinary");
  const [styleGroup, setStyleGroup] = useState("other");

  const estimatedPrice = useMemo(() => {
    if (!pricingMap[materialGroup]) {
      return 0;
    }

    return pricingMap[materialGroup][styleGroup] || 0;
  }, [materialGroup, styleGroup]);

  const recommendation = useMemo(() => {
    if (materialGroup === "ordinary") {
      if (styleGroup === "boots") {
        return "Ordinary Sneakers & Shoes -> Boots";
      }

      return styleGroup === "white"
        ? "Ordinary Sneakers & Shoes -> White"
        : "Ordinary Sneakers & Shoes -> Other colours";
    }

    if (styleGroup === "boots") {
      return "Suede, Nubuck & Leather -> Boots";
    }

    return styleGroup === "white"
      ? "Suede, Nubuck & Leather -> White / Cream"
      : "Suede, Nubuck & Leather -> Other colours";
  }, [materialGroup, styleGroup]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPhotoUrl(nextUrl);

    const colourGuess = await guessColourCategory(nextUrl);
    setDetectedColour(colourGuess);

    if (styleGroup !== "boots") {
      setStyleGroup(colourGuess === "white" ? "white" : "other");
    }
  };

  return (
    <section className="rounded-[28px] border border-[#15467d] bg-[#0a1420]/95 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
          <Image
            src="/cleanstep-logo-system.png"
            alt="Cleanstep logo"
            width={48}
            height={48}
            className="h-12 w-12 object-contain p-1"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[#8cc4ff]">Photo assist beta</p>
          <h2 className="mt-1 text-xl font-semibold">Upload a shoe photo for a faster price match</h2>
        </div>
      </div>

      <p className="mt-4 text-sm text-white/62">
        This version uses the photo to suggest a colour group, then you confirm the material and style.
        It is ready for a real vision model later, but it already helps route the price correctly now.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-white/70 file:mr-4 file:rounded-2xl file:border-0 file:bg-[#0f4e93] file:px-4 file:py-3 file:font-semibold file:text-white"
        />

        {photoUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Uploaded shoe preview" className="h-52 w-full object-cover" />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Detected colour</p>
          <p className="mt-2 text-sm text-white/80">
            {detectedColour
              ? detectedColour === "white"
                ? "White / Cream detected"
                : "Other colour detected"
              : "Upload a shoe image to get a colour suggestion."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Estimated route</p>
          <p className="mt-2 text-sm text-white/80">{recommendation}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Material group</p>
          <div className="mt-3 grid gap-2">
            {[
              { value: "ordinary", label: "Ordinary Sneakers & Shoes" },
              { value: "suede", label: "Suede, Nubuck & Leather" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setMaterialGroup(option.value)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  materialGroup === option.value
                    ? "border-[#62a7ff] bg-[#0f4e93]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Style / colour option</p>
          <div className="mt-3 grid gap-2">
            {[
              { value: "other", label: "Other colours" },
              { value: "white", label: "White / Cream" },
              { value: "boots", label: "Boots" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStyleGroup(option.value)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  styleGroup === option.value
                    ? "border-[#62a7ff] bg-[#0f4e93]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#0f4e93]/40 bg-[#0f4e93]/14 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Recommended price</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">{recommendation}</p>
            <p className="mt-1 text-sm text-white/60">
              Use this as a quick guide, then continue with the full booking flow below.
            </p>
          </div>
          <span className="rounded-full bg-[#d42828]/15 px-4 py-2 text-base font-semibold text-[#ff8a8a]">
            {formatCurrency(estimatedPrice)}
          </span>
        </div>
      </div>
    </section>
  );
}
