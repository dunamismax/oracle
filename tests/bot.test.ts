import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScryfallBot } from "../src/bot";
import { BotConfig } from "../src/config";
import { ErrorType, createError } from "../src/errors";
import { Card } from "../src/scryfall";

function makeConfig(): BotConfig {
  return new BotConfig({
    MTG_DISCORD_TOKEN: "test-token",
  });
}

function makeCard(name: string): Card {
  return new Card({
    object: "card",
    id: `${name.toLowerCase().replaceAll(" ", "-")}-id`,
    name,
  });
}

describe("ScryfallBot query helpers", () => {
  let bot: ScryfallBot;

  beforeEach(() => {
    bot = new ScryfallBot(makeConfig());
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await bot.close();
  });

  it("hasScryfallClauses detects documented filters", () => {
    expect(bot.hasScryfallClauses("sol ring s:ltr")).toBe(true);
    expect(bot.hasScryfallClauses("sol ring is:showcase")).toBe(true);
    expect(bot.hasScryfallClauses('lightning bolt o:"deal damage"')).toBe(true);
  });

  it("hasScryfallClauses ignores card name punctuation", () => {
    expect(bot.hasScryfallClauses("Circle of Protection: Red")).toBe(false);
  });

  it("resolveCardQuery uses search for documented filters", async () => {
    const filteredCard = makeCard("Sol Ring");
    const searchSpy = vi
      .spyOn(bot.scryfallClient, "searchCardFirst")
      .mockResolvedValue(filteredCard);
    const getByNameSpy = vi
      .spyOn(bot.scryfallClient, "getCardByName")
      .mockResolvedValue(filteredCard);

    const [card, usedFallback] = await bot.resolveCardQuery("sol ring s:ltr");

    expect(card.name).toBe("Sol Ring");
    expect(usedFallback).toBe(false);
    expect(searchSpy).toHaveBeenCalledOnce();
    expect(searchSpy).toHaveBeenCalledWith("sol ring s:ltr", undefined, undefined);
    expect(getByNameSpy).not.toHaveBeenCalled();
  });

  it("resolveCardQuery falls back only for not found", async () => {
    const fallbackCard = makeCard("Sol Ring");
    const notFoundError = createError(
      ErrorType.NOT_FOUND,
      "No cards found matching query",
    );

    const searchSpy = vi
      .spyOn(bot.scryfallClient, "searchCardFirst")
      .mockRejectedValue(notFoundError);
    const getByNameSpy = vi
      .spyOn(bot.scryfallClient, "getCardByName")
      .mockResolvedValue(fallbackCard);

    const [card, usedFallback] = await bot.resolveCardQuery("sol ring s:ltr");

    expect(card.name).toBe("Sol Ring");
    expect(usedFallback).toBe(true);
    expect(searchSpy).toHaveBeenCalledOnce();
    expect(searchSpy).toHaveBeenCalledWith("sol ring s:ltr", undefined, undefined);
    expect(getByNameSpy).toHaveBeenCalledOnce();
    expect(getByNameSpy).toHaveBeenCalledWith("sol ring");
  });

  it("resolveCardQuery propagates non-not-found errors", async () => {
    const rateLimitError = createError(ErrorType.RATE_LIMIT, "API rate limit exceeded");

    const searchSpy = vi
      .spyOn(bot.scryfallClient, "searchCardFirst")
      .mockRejectedValue(rateLimitError);
    const getByNameSpy = vi
      .spyOn(bot.scryfallClient, "getCardByName")
      .mockResolvedValue(makeCard("Sol Ring"));

    await expect(bot.resolveCardQuery("sol ring s:ltr")).rejects.toBe(rateLimitError);
    expect(searchSpy).toHaveBeenCalledOnce();
    expect(searchSpy).toHaveBeenCalledWith("sol ring s:ltr", undefined, undefined);
    expect(getByNameSpy).not.toHaveBeenCalled();
  });

  it("resolveCardQuery uses search for sort hints", async () => {
    const sortedCard = makeCard("Cultivate");
    const searchSpy = vi
      .spyOn(bot.scryfallClient, "searchCardFirst")
      .mockResolvedValue(sortedCard);
    const getByNameSpy = vi
      .spyOn(bot.scryfallClient, "getCardByName")
      .mockResolvedValue(sortedCard);

    const [card, usedFallback] = await bot.resolveCardQuery(
      "cultivate order:usd dir:desc",
    );

    expect(card.name).toBe("Cultivate");
    expect(usedFallback).toBe(false);
    expect(searchSpy).toHaveBeenCalledOnce();
    expect(searchSpy).toHaveBeenCalledWith("cultivate", "usd", "desc");
    expect(getByNameSpy).not.toHaveBeenCalled();
  });
});
