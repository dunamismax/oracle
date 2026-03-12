import { z } from "zod";

import { ErrorType, createError } from "./errors";
import { withComponent } from "./logger";

const stringRecordSchema = z.record(z.string(), z.string()).catch({});

const cardFacePayloadSchema = z
  .object({
    object: z.string().catch(""),
    name: z.string().catch(""),
    mana_cost: z.string().catch(""),
    type_line: z.string().catch(""),
    oracle_text: z.string().catch(""),
    colors: z.array(z.string()).catch([]),
    artist: z.string().catch(""),
    image_uris: stringRecordSchema,
  })
  .passthrough();

const cardPayloadSchema = z
  .object({
    object: z.string().catch(""),
    id: z.string().catch(""),
    oracle_id: z.string().catch(""),
    name: z.string().catch(""),
    lang: z.string().catch(""),
    released_at: z.string().catch(""),
    uri: z.string().catch(""),
    scryfall_uri: z.string().catch(""),
    layout: z.string().catch(""),
    image_uris: stringRecordSchema,
    card_faces: z.array(cardFacePayloadSchema).catch([]),
    mana_cost: z.string().catch(""),
    cmc: z.number().catch(0),
    type_line: z.string().catch(""),
    oracle_text: z.string().catch(""),
    colors: z.array(z.string()).catch([]),
    set_name: z.string().catch(""),
    set: z.string().catch(""),
    rarity: z.string().catch(""),
    artist: z.string().catch(""),
    prices: stringRecordSchema,
    legalities: stringRecordSchema,
    image_status: z.string().catch(""),
    highres_image: z.boolean().catch(false),
  })
  .passthrough();

const searchResultPayloadSchema = z
  .object({
    object: z.string().catch(""),
    total_cards: z.number().catch(0),
    has_more: z.boolean().catch(false),
    next_page: z.string().catch(""),
    data: z.array(z.unknown()).catch([]),
  })
  .passthrough();

const rulingPayloadSchema = z.record(z.string(), z.unknown());

const rulingsResponseSchema = z
  .object({
    data: z.array(rulingPayloadSchema).catch([]),
  })
  .passthrough();

const scryfallErrorSchema = z
  .object({
    object: z.string().catch(""),
    code: z.string().catch(""),
    status: z.number().catch(0),
    details: z.string().catch(""),
    type: z.string().catch(""),
    warnings: z.array(z.string()).catch([]),
  })
  .passthrough();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class CardFace {
  readonly object: string;
  readonly name: string;
  readonly manaCost: string;
  readonly typeLine: string;
  readonly rulesText: string;
  readonly colors: string[];
  readonly artist: string;
  readonly imageUris: Record<string, string>;

  constructor(data: unknown) {
    const payload = cardFacePayloadSchema.parse(data);
    this.object = payload.object;
    this.name = payload.name;
    this.manaCost = payload.mana_cost;
    this.typeLine = payload.type_line;
    this.rulesText = payload.oracle_text;
    this.colors = payload.colors;
    this.artist = payload.artist;
    this.imageUris = payload.image_uris;
  }
}

export class Card {
  readonly object: string;
  readonly id: string;
  readonly cardIdentityId: string;
  readonly name: string;
  readonly lang: string;
  readonly releasedAt: string;
  readonly uri: string;
  readonly scryfallUri: string;
  readonly layout: string;
  readonly imageUris: Record<string, string>;
  readonly cardFaces: CardFace[];
  readonly manaCost: string;
  readonly cmc: number;
  readonly typeLine: string;
  readonly rulesText: string;
  readonly colors: string[];
  readonly setName: string;
  readonly setCode: string;
  readonly rarity: string;
  readonly artist: string;
  readonly prices: Record<string, string>;
  readonly legalities: Record<string, string>;
  readonly imageStatus: string;
  readonly highresImage: boolean;

  constructor(data: unknown) {
    const payload = cardPayloadSchema.parse(data);
    this.object = payload.object;
    this.id = payload.id;
    this.cardIdentityId = payload.oracle_id;
    this.name = payload.name;
    this.lang = payload.lang;
    this.releasedAt = payload.released_at;
    this.uri = payload.uri;
    this.scryfallUri = payload.scryfall_uri;
    this.layout = payload.layout;
    this.imageUris = payload.image_uris;
    this.cardFaces = payload.card_faces.map((face) => new CardFace(face));
    this.manaCost = payload.mana_cost;
    this.cmc = payload.cmc;
    this.typeLine = payload.type_line;
    this.rulesText = payload.oracle_text;
    this.colors = payload.colors;
    this.setName = payload.set_name;
    this.setCode = payload.set;
    this.rarity = payload.rarity;
    this.artist = payload.artist;
    this.prices = payload.prices;
    this.legalities = payload.legalities;
    this.imageStatus = payload.image_status;
    this.highresImage = payload.highres_image;
  }

  getBestImageUrl(
    preferFormats: string[] = ["png", "large", "normal", "small"],
  ): string {
    let imageUris = this.imageUris;
    const firstFace = this.cardFaces[0];

    if (firstFace && Object.keys(firstFace.imageUris).length > 0) {
      imageUris = firstFace.imageUris;
    }

    for (const formatType of preferFormats) {
      const url = imageUris[formatType];
      if (url) {
        return url;
      }
    }

    return Object.values(imageUris)[0] ?? "";
  }

  getDisplayName(): string {
    if (this.name) {
      return this.name;
    }

    if (this.cardFaces.length > 0) {
      return this.cardFaces.map((face) => face.name).join(" // ");
    }

    return "Unknown Card";
  }

  isValidCard(): boolean {
    return this.object === "card" && Boolean(this.name || this.cardFaces.length > 0);
  }

  hasImage(): boolean {
    return this.getBestImageUrl().length > 0;
  }

  getPriceDisplay(): string {
    const usdPrice = this.prices.usd;
    const usdFoilPrice = this.prices.usd_foil;
    const eurPrice = this.prices.eur;
    const tixPrice = this.prices.tix;

    if (usdPrice) {
      const parsed = Number.parseFloat(usdPrice);
      if (Number.isFinite(parsed)) {
        return `$${parsed.toFixed(2)}`;
      }
    }

    if (usdFoilPrice) {
      const parsed = Number.parseFloat(usdFoilPrice);
      if (Number.isFinite(parsed)) {
        return `$${parsed.toFixed(2)} (foil)`;
      }
    }

    if (eurPrice) {
      const parsed = Number.parseFloat(eurPrice);
      if (Number.isFinite(parsed)) {
        return `€${parsed.toFixed(2)}`;
      }
    }

    if (tixPrice) {
      const parsed = Number.parseFloat(tixPrice);
      if (Number.isFinite(parsed)) {
        return `${parsed.toFixed(2)} tix`;
      }
    }

    return "";
  }

  getFormatLegalities(): string {
    const formatNames: Record<string, string> = {
      standard: "Standard",
      pioneer: "Pioneer",
      modern: "Modern",
      legacy: "Legacy",
      vintage: "Vintage",
      commander: "Commander",
      oathbreaker: "Oathbreaker",
      brawl: "Brawl",
      historic: "Historic",
      pauper: "Pauper",
      penny: "Penny",
      duel: "Duel",
    };

    const legalFormats = Object.entries(formatNames)
      .filter(([formatKey]) => this.legalities[formatKey] === "legal")
      .map(([, formatName]) => formatName);

    if (legalFormats.length === 0) {
      return "Not legal in any major formats";
    }

    return legalFormats.join(", ");
  }
}

export class SearchResult {
  readonly object: string;
  readonly totalCards: number;
  readonly hasMore: boolean;
  readonly nextPage: string;
  readonly data: Card[];

  constructor(data: unknown) {
    const payload = searchResultPayloadSchema.parse(data);
    this.object = payload.object;
    this.totalCards = payload.total_cards;
    this.hasMore = payload.has_more;
    this.nextPage = payload.next_page;
    this.data = payload.data.map((cardData) => new Card(cardData));
  }
}

export class ScryfallError extends Error {
  readonly object: string;
  readonly code: string;
  readonly status: number;
  readonly details: string;
  readonly type: string;
  readonly warnings: string[];

  constructor(data: unknown) {
    const payload = scryfallErrorSchema.parse(data);
    super(`Scryfall API error: ${payload.details} (status: ${payload.status})`);
    this.name = "ScryfallError";
    this.object = payload.object;
    this.code = payload.code;
    this.status = payload.status;
    this.details = payload.details;
    this.type = payload.type;
    this.warnings = payload.warnings;
  }

  getErrorType(): ErrorType {
    if (this.status === 404) {
      return ErrorType.NOT_FOUND;
    }

    if (this.status === 429) {
      return ErrorType.RATE_LIMIT;
    }

    return ErrorType.API;
  }
}

export type Ruling = Record<string, unknown>;

export class ScryfallClient {
  static readonly BASE_URL = "https://api.scryfall.com";
  static readonly USER_AGENT = "scryfall-discord-bot/2.0.0";
  static readonly RATE_LIMIT_MS = 100;

  private readonly logger = withComponent("scryfall");
  private readonly headers: Record<string, string> = {
    "User-Agent": ScryfallClient.USER_AGENT,
    Accept: "application/json",
  };
  private lastRequestTime = 0;
  private pendingRateLimit = Promise.resolve();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async close(): Promise<void> {}

  private async waitForRateLimit(): Promise<void> {
    const turn = this.pendingRateLimit.then(async () => {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < ScryfallClient.RATE_LIMIT_MS) {
        await sleep(ScryfallClient.RATE_LIMIT_MS - elapsed);
      }
      this.lastRequestTime = Date.now();
    });

    this.pendingRateLimit = turn.catch(() => {});
    await turn;
  }

  private async request(endpoint: string): Promise<Response> {
    const startTime = Date.now();
    await this.waitForRateLimit();
    this.logger.debug("Making API request", { endpoint });

    try {
      const response = await this.fetchImpl(`${ScryfallClient.BASE_URL}${endpoint}`, {
        headers: this.headers,
      });

      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          throw createError(ErrorType.API, `HTTP error ${response.status}`, error);
        }

        throw new ScryfallError(payload);
      }

      this.logger.debug("API request successful", {
        endpoint,
        response_time_ms: Date.now() - startTime,
      });
      return response;
    } catch (error) {
      if (error instanceof ScryfallError) {
        this.logger.warning("API request failed", {
          endpoint,
          error: error.message,
          status: error.status,
        });
        throw createError(
          error.getErrorType(),
          error.details || "Scryfall API error",
          error,
        );
      }

      if (error instanceof Error && error.name === "BotError") {
        throw error;
      }

      this.logger.error("API request failed", {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      throw createError(
        ErrorType.NETWORK,
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  async getCardByName(name: string): Promise<Card> {
    if (!name) {
      throw createError(ErrorType.VALIDATION, "Card name cannot be empty");
    }

    const response = await this.request(
      `/cards/named?fuzzy=${encodeURIComponent(name)}`,
    );
    return new Card(await response.json());
  }

  async getCardByExactName(name: string): Promise<Card> {
    if (!name) {
      throw createError(ErrorType.VALIDATION, "Card name cannot be empty");
    }

    const response = await this.request(
      `/cards/named?exact=${encodeURIComponent(name)}`,
    );
    return new Card(await response.json());
  }

  private buildSearchEndpoint(
    query: string,
    order?: string,
    direction?: string,
    page?: number,
  ): string {
    const params = new URLSearchParams({ q: query });

    if (order) {
      params.set("order", order);
    }

    if (direction) {
      params.set("dir", direction);
    }

    if (page !== undefined) {
      params.set("page", String(page));
    }

    return `/cards/search?${params.toString()}`;
  }

  async getRandomCard(query = ""): Promise<Card> {
    const endpoint = query
      ? `/cards/random?${new URLSearchParams({ q: query }).toString()}`
      : "/cards/random";

    const response = await this.request(endpoint);
    return new Card(await response.json());
  }

  async searchCards(
    query: string,
    order?: string,
    direction?: string,
    page?: number,
  ): Promise<SearchResult> {
    if (!query) {
      throw createError(ErrorType.VALIDATION, "Search query cannot be empty");
    }

    const response = await this.request(
      this.buildSearchEndpoint(query, order, direction, page),
    );
    return new SearchResult(await response.json());
  }

  async searchCardFirst(
    query: string,
    order?: string,
    direction?: string,
  ): Promise<Card> {
    if (!query) {
      throw createError(ErrorType.VALIDATION, "Search query cannot be empty");
    }

    const result = await this.searchCards(query, order, direction);

    if (result.totalCards === 0 || result.data.length === 0) {
      throw createError(ErrorType.NOT_FOUND, "No cards found matching query");
    }

    const firstCard = result.data[0];
    if (!firstCard) {
      throw createError(ErrorType.NOT_FOUND, "No cards found matching query");
    }

    if (!order && result.data.length > 1) {
      const index = Math.floor(Math.random() * result.data.length);
      return result.data[index] ?? firstCard;
    }

    return firstCard;
  }

  async getCardRulings(cardId: string): Promise<Ruling[]> {
    if (!cardId) {
      throw createError(ErrorType.VALIDATION, "Card ID cannot be empty");
    }

    const response = await this.request(`/cards/${cardId}/rulings`);
    const payload = rulingsResponseSchema.parse(await response.json());
    return payload.data;
  }
}
