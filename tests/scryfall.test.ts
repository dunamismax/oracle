import { describe, expect, it } from "vitest";

import { Card } from "../src/scryfall";

describe("Card", () => {
  it("getBestImageUrl prefers png", () => {
    const card = new Card({
      object: "card",
      name: "Lightning Bolt",
      image_uris: {
        small: "https://img.example/small.jpg",
        png: "https://img.example/card.png",
      },
    });

    expect(card.getBestImageUrl()).toBe("https://img.example/card.png");
  });

  it("getPriceDisplay prefers usd", () => {
    const card = new Card({
      object: "card",
      name: "Sol Ring",
      prices: {
        usd: "2.5",
        eur: "1.0",
      },
    });

    expect(card.getPriceDisplay()).toBe("$2.50");
  });

  it("getFormatLegalities returns major formats", () => {
    const card = new Card({
      object: "card",
      name: "Counterspell",
      legalities: {
        modern: "legal",
        legacy: "legal",
        standard: "not_legal",
      },
    });

    expect(card.getFormatLegalities()).toBe("Modern, Legacy");
  });
});
