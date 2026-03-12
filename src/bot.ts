import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  type Message,
  Partials,
} from "discord.js";

import type { BotConfig } from "./config";
import { BotError, ErrorType, createError } from "./errors";
import { withComponent } from "./logger";
import { type Card, ScryfallClient } from "./scryfall";

type SendableChannel = {
  send: (options: unknown) => Promise<unknown>;
};

type BotDependencies = {
  imageFetch?: typeof fetch;
  now?: () => number;
  scryfallClient?: ScryfallClient;
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatRulingSource(value: unknown): string {
  return value === "wotc" ? "Wizards" : "Scryfall";
}

function formatRulingValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toSendableChannel(channel: Message["channel"]): SendableChannel | null {
  if (
    typeof channel === "object" &&
    channel !== null &&
    "send" in channel &&
    typeof channel.send === "function"
  ) {
    return channel as SendableChannel;
  }

  return null;
}

export class MultiResolvedCard {
  constructor(
    readonly query: string,
    readonly card: Card | null = null,
    readonly usedFallback = false,
    readonly error: unknown = null,
  ) {}
}

export class ScryfallBot extends Client {
  static readonly SCRYFALL_CLAUSE_PATTERN =
    /^(?:-)?[a-z][a-z0-9_-]*(?::|<=|>=|=|<|>).+$/i;
  static readonly BRACKET_PATTERN = /\[\[([^\]]+)\]\]/u;
  static readonly MIN_FALLBACK_CARD_NAME_LENGTH = 2;

  readonly config: BotConfig;
  readonly scryfallClient: ScryfallClient;

  private readonly imageFetch: typeof fetch;
  private readonly logger = withComponent("bot");
  private readonly now: () => number;
  private readonly recentCommands = new Map<string, number>();
  private readonly processedMessageIds = new Set<string>();
  private readonly userRateLimits = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: BotConfig, dependencies: BotDependencies = {}) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    this.config = config;
    this.scryfallClient = dependencies.scryfallClient ?? new ScryfallClient();
    this.imageFetch = dependencies.imageFetch ?? fetch;
    this.now = dependencies.now ?? (() => Date.now() / 1000);

    this.once(Events.ClientReady, (client) => {
      this.logger.info("Bot is ready", {
        username: client.user?.username ?? "unknown",
      });
    });

    this.on(Events.MessageCreate, (message) => {
      void this.onMessage(message).catch((error) => {
        this.logger.error("Failed to handle message", {
          error: formatError(error),
        });
      });
    });

    this.on(Events.Error, (error) => {
      this.logger.error("Discord client error", { error: formatError(error) });
    });
  }

  async start(token: string): Promise<void> {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupDuplicateData();
      }, 60_000);
    }

    this.logger.info("Bot setup completed");
    await this.login(token);
  }

  async onMessage(message: Message): Promise<void> {
    if (message.author.bot) {
      return;
    }

    if (this.processedMessageIds.has(message.id)) {
      return;
    }

    const bracketMatch = this.extractBracketContent(message.content);
    const content = bracketMatch
      ? bracketMatch
      : message.content.startsWith(this.config.commandPrefix)
        ? message.content.slice(this.config.commandPrefix.length)
        : null;

    if (content === null) {
      return;
    }

    const channel = toSendableChannel(message.channel);
    if (!channel) {
      return;
    }

    const userId = message.author.id;
    const now = this.now();
    const lastCommand = this.userRateLimits.get(userId) ?? 0;
    const cooldown = this.config.commandCooldown;

    if (cooldown > 0 && now - lastCommand < cooldown) {
      this.logger.debug("Rate limited user", {
        user_id: userId,
        username: message.author.username,
        time_since_last: now - lastCommand,
      });
      return;
    }

    this.userRateLimits.set(userId, now);

    const normalized = content.toLowerCase().trim().replace(/\s+/gu, " ");
    const key = `${userId}:${normalized}`;
    const last = this.recentCommands.get(key);

    if (last !== undefined && now - last < 2.5) {
      this.logger.debug("Suppressed duplicate command", {
        user_id: userId,
        username: message.author.username,
        content: normalized.slice(0, 50),
        time_since_last: now - last,
      });
      return;
    }

    this.recentCommands.set(key, now);
    this.processedMessageIds.add(message.id);

    if (content.includes(";")) {
      await this.handleMultiCardLookup(message, channel, content);
      return;
    }

    const parts = content.trim().split(/\s+/u).filter(Boolean);
    const [commandToken, ...args] = parts;
    if (!commandToken) {
      return;
    }

    const command = commandToken.toLowerCase();

    if (["random", "rand", "r"].includes(command)) {
      await this.handleRandomCard(message, channel, args.join(" "));
      return;
    }

    if (["help", "h", "?"].includes(command)) {
      await this.handleHelp(message, channel);
      return;
    }

    if (command === "rules") {
      if (args.length > 0) {
        await this.handleRulesLookup(message, channel, args.join(" "));
      } else {
        await this.sendErrorMessage(
          channel,
          "Please provide a card name for rules lookup.",
        );
      }
      return;
    }

    await this.handleCardLookup(message, channel, parts.join(" "));
  }

  async handleRandomCard(
    message: Message,
    channel: SendableChannel,
    filterQuery = "",
  ): Promise<void> {
    this.logger.info(
      filterQuery ? "Fetching filtered random card" : "Fetching random card",
      {
        user_id: message.author.id,
        username: message.author.username,
        filter_query: filterQuery || undefined,
      },
    );

    try {
      const card = await this.scryfallClient.getRandomCard(filterQuery);
      await this.sendCardMessage(channel, card, false, filterQuery || "random");
    } catch (error) {
      this.logger.error("Random card command failed", {
        user_id: message.author.id,
        filter_query: filterQuery,
        error: formatError(error),
      });

      let errorMessage = "Sorry, something went wrong while fetching a random card.";

      if (error instanceof BotError) {
        if (error.errorType === ErrorType.NOT_FOUND && filterQuery) {
          errorMessage = `No cards found matching filters: '${filterQuery}'. Try broader criteria.`;
        } else if (error.errorType === ErrorType.RATE_LIMIT) {
          errorMessage = "API rate limit exceeded. Please try again in a moment.";
        }
      }

      await this.sendErrorMessage(channel, errorMessage);
    }
  }

  async handleCardLookup(
    message: Message,
    channel: SendableChannel,
    cardQuery: string,
  ): Promise<void> {
    if (!cardQuery) {
      await this.sendErrorMessage(channel, "Card query cannot be empty.");
      return;
    }

    this.logger.info("Looking up card", {
      user_id: message.author.id,
      username: message.author.username,
      card_query: cardQuery,
    });

    try {
      const [card, usedFallback] = await this.resolveCardQuery(cardQuery);
      await this.sendCardMessage(channel, card, usedFallback, cardQuery);
    } catch (error) {
      this.logger.error("Card lookup failed", {
        user_id: message.author.id,
        card_query: cardQuery,
        error: formatError(error),
      });

      let errorMessage = "Sorry, something went wrong while searching for that card.";

      if (error instanceof BotError) {
        if (error.errorType === ErrorType.NOT_FOUND) {
          errorMessage = this.hasScryfallClauses(cardQuery)
            ? `No cards found for '${cardQuery}'. Try simpler filters like \`e:set\` or \`is:foil\`, or check the spelling.`
            : `Card '${cardQuery}' not found. Try partial names like 'bolt' for 'Lightning Bolt'.`;
        } else if (error.errorType === ErrorType.RATE_LIMIT) {
          errorMessage = "API rate limit exceeded. Please try again in a moment.";
        }
      }

      await this.sendErrorMessage(channel, errorMessage);
    }
  }

  async handleRulesLookup(
    message: Message,
    channel: SendableChannel,
    cardQuery: string,
  ): Promise<void> {
    if (!cardQuery) {
      await this.sendErrorMessage(channel, "Card query cannot be empty.");
      return;
    }

    this.logger.info("Looking up rules for card", {
      user_id: message.author.id,
      username: message.author.username,
      card_query: cardQuery,
    });

    try {
      const [card, usedFallback] = await this.resolveCardQuery(cardQuery);
      const rulings = await this.scryfallClient.getCardRulings(card.id);

      if (rulings.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle("No Rulings Found")
          .setDescription(`No official rulings found for **${card.getDisplayName()}**.`)
          .setColor(0x9b59b6);

        if (card.scryfallUri) {
          embed.setURL(card.scryfallUri);
        }

        await channel.send({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Rulings for ${card.getDisplayName()}`)
        .setColor(this.getRarityColor(card.rarity));

      if (card.scryfallUri) {
        embed.setURL(card.scryfallUri);
      }

      if (usedFallback) {
        embed.setDescription(`*Showing closest match for '${cardQuery}'*`);
      }

      const visibleRulings = rulings.slice(0, 10);

      embed.addFields(
        visibleRulings.map((ruling) => {
          const source = formatRulingSource(ruling.source);
          const date = formatRulingValue(ruling.published_at, "Unknown date");
          const comment = formatRulingValue(ruling.comment, "No ruling text");
          const truncatedComment =
            comment.length > 1024 ? `${comment.slice(0, 1021)}...` : comment;

          return {
            name: `${source} (${date})`,
            value: truncatedComment,
            inline: false,
          };
        }),
      );

      if (rulings.length > visibleRulings.length) {
        embed.setFooter({
          text: `Showing ${visibleRulings.length} of ${rulings.length} rulings. Visit Scryfall for complete rulings.`,
        });
      } else {
        embed.setFooter({ text: `${rulings.length} ruling(s) found.` });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error("Rules lookup failed", {
        user_id: message.author.id,
        card_query: cardQuery,
        error: formatError(error),
      });

      const errorMessage =
        error instanceof BotError && error.errorType === ErrorType.NOT_FOUND
          ? `Card '${cardQuery}' not found for rules lookup.`
          : "Sorry, something went wrong while looking up rules for that card.";

      await this.sendErrorMessage(channel, errorMessage);
    }
  }

  async resolveCardQuery(cardQuery: string): Promise<[Card, boolean]> {
    const trimmedQuery = cardQuery.trim();
    const [cleanQuery, orderHint, directionHint] =
      this.extractSortParameters(trimmedQuery);
    const searchQuery = cleanQuery || trimmedQuery;
    const hasFilters =
      Boolean(orderHint) ||
      Boolean(directionHint) ||
      this.hasScryfallClauses(searchQuery);
    let usedFallback = false;
    let card: Card;

    if (hasFilters) {
      try {
        card = await this.scryfallClient.searchCardFirst(
          searchQuery,
          orderHint ?? undefined,
          directionHint ?? undefined,
        );
      } catch (error) {
        if (!(error instanceof BotError) || error.errorType !== ErrorType.NOT_FOUND) {
          throw error;
        }

        const cardName = this.extractCardName(searchQuery);
        if (cardName && cardName.length >= ScryfallBot.MIN_FALLBACK_CARD_NAME_LENGTH) {
          card = await this.scryfallClient.getCardByName(cardName);
          usedFallback = true;
        } else {
          throw error;
        }
      }
    } else {
      card = await this.scryfallClient.getCardByName(searchQuery);
    }

    if (!card.isValidCard()) {
      throw createError(ErrorType.NOT_FOUND, "No card found for query");
    }

    return [card, usedFallback];
  }

  async handleMultiCardLookup(
    message: Message,
    channel: SendableChannel,
    rawContent: string,
  ): Promise<void> {
    const queries = rawContent
      .split(";")
      .map((query) => query.trim())
      .filter(Boolean);

    if (queries.length === 0) {
      await this.sendErrorMessage(channel, "No valid card queries provided.");
      return;
    }

    const onlyQuery = queries[0];
    if (queries.length === 1 && onlyQuery) {
      await this.handleCardLookup(message, channel, onlyQuery);
      return;
    }

    this.logger.info("Multi-card lookup", {
      user_id: message.author.id,
      username: message.author.username,
      query_count: queries.length,
    });

    const resolvedCards: MultiResolvedCard[] = [];
    for (const query of queries) {
      try {
        const [card, usedFallback] = await this.resolveCardQuery(query);
        resolvedCards.push(new MultiResolvedCard(query, card, usedFallback));
      } catch (error) {
        resolvedCards.push(new MultiResolvedCard(query, null, false, error));
      }
    }

    const successCount = resolvedCards.filter(
      (item) => !item.error && item.card?.isValidCard(),
    ).length;

    if (successCount === 0) {
      await this.sendErrorMessage(channel, "Failed to resolve any requested cards.");
      return;
    }

    for (let index = 0; index < resolvedCards.length; index += 4) {
      await this.sendCardGridMessage(channel, resolvedCards.slice(index, index + 4));
    }
  }

  async sendCardGridMessage(
    channel: SendableChannel,
    items: MultiResolvedCard[],
  ): Promise<void> {
    const files: AttachmentBuilder[] = [];
    const markdownLines: string[] = [];

    for (const item of items) {
      if (item.error || !item.card || !item.card.isValidCard()) {
        markdownLines.push(`- ${item.query}: not found`);
        continue;
      }

      const name = item.card.getDisplayName();
      const label = item.usedFallback ? `${name} (closest match)` : name;

      markdownLines.push(
        item.card.scryfallUri ? `- [${label}](${item.card.scryfallUri})` : `- ${label}`,
      );

      if (!item.card.hasImage()) {
        continue;
      }

      try {
        const [imageData, filename] = await this.fetchImage(
          item.card.getBestImageUrl(["large", "normal", "small"]),
          name,
        );
        files.push(new AttachmentBuilder(imageData, { name: filename }));
      } catch (error) {
        this.logger.warning("Failed to fetch image", {
          error: formatError(error),
          image_url: item.card.getBestImageUrl(["large", "normal", "small"]),
        });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("Requested Cards")
      .setDescription(markdownLines.join("\n"))
      .setColor(0x5865f2);

    await channel.send({ embeds: [embed] });

    if (files.length > 0) {
      await channel.send({ files });
    }
  }

  async fetchImage(url: string, cardName: string): Promise<[Buffer, string]> {
    const response = await this.imageFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const pathname = new URL(url).pathname.toLowerCase();
    const extension = contentType.includes("png")
      ? ".png"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? ".jpg"
        : pathname.endsWith(".png")
          ? ".png"
          : pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")
            ? ".jpg"
            : ".jpg";

    return [
      Buffer.from(await response.arrayBuffer()),
      `${this.safeFilename(cardName)}${extension}`,
    ];
  }

  safeFilename(name: string): string {
    const safe = name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9._-]+/gu, "-")
      .replace(/^[-._]+|[-._]+$/gu, "");
    return safe ? safe.slice(0, 64) : "card";
  }

  hasScryfallClauses(query: string): boolean {
    return this.tokenizeQuery(query).some((token) => this.isScryfallClauseToken(token));
  }

  hasFilterParameters(query: string): boolean {
    return this.hasScryfallClauses(query);
  }

  tokenizeQuery(query: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let quote: "'" | '"' | null = null;
    let escaping = false;

    for (const char of query) {
      if (escaping) {
        current += char;
        escaping = false;
        continue;
      }

      if (quote) {
        if (char === "\\") {
          escaping = true;
          continue;
        }

        if (char === quote) {
          quote = null;
          continue;
        }

        current += char;
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }

      if (/\s/u.test(char)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (quote) {
      return query.trim().split(/\s+/u).filter(Boolean);
    }

    if (escaping) {
      current += "\\";
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  isScryfallClauseToken(token: string): boolean {
    const normalized = token
      .trim()
      .replace(/^[()[\]{}.,;'"`]+|[()[\]{}.,;'"`]+$/gu, "");
    if (!normalized || normalized.includes("://")) {
      return false;
    }

    return ScryfallBot.SCRYFALL_CLAUSE_PATTERN.test(normalized);
  }

  extractSortParameters(query: string): [string, string | null, string | null] {
    const tokens = this.tokenizeQuery(query);
    let order: string | null = null;
    let direction: string | null = null;
    const remainingTokens: string[] = [];

    for (const token of tokens) {
      const lowerToken = token.toLowerCase();

      if (lowerToken.startsWith("order:") || lowerToken.startsWith("sort:")) {
        const value = token
          .split(":", 2)[1]
          ?.trim()
          .replace(/^[()[\]{}.,;'"`]+|[()[\]{}.,;'"`]+$/gu, "");
        if (value) {
          order = value.toLowerCase();
        }
        continue;
      }

      if (lowerToken.startsWith("dir:") || lowerToken.startsWith("direction:")) {
        const value = token
          .split(":", 2)[1]
          ?.trim()
          .replace(/^[()[\]{}.,;'"`]+|[()[\]{}.,;'"`]+$/gu, "")
          .toLowerCase();
        if (value && ["asc", "desc", "auto"].includes(value)) {
          direction = value;
        }
        continue;
      }

      remainingTokens.push(token);
    }

    return [remainingTokens.join(" ").trim(), order, direction];
  }

  extractCardName(query: string): string {
    const essentialKeywords = new Set([
      "foil",
      "nonfoil",
      "fullart",
      "textless",
      "borderless",
    ]);

    return this.tokenizeQuery(query)
      .filter((word) => {
        const lowerWord = word.toLowerCase();
        return !this.isScryfallClauseToken(word) && !essentialKeywords.has(lowerWord);
      })
      .join(" ")
      .trim();
  }

  extractBracketContent(messageContent: string): string | null {
    const match = messageContent.match(ScryfallBot.BRACKET_PATTERN);
    return match?.[1]?.trim() || null;
  }

  async sendCardMessage(
    channel: SendableChannel,
    card: Card,
    usedFallback: boolean,
    originalQuery: string,
  ): Promise<void> {
    if (!card.isValidCard()) {
      await this.sendErrorMessage(channel, "Received invalid card data from API.");
      return;
    }

    if (!card.hasImage()) {
      const embed = new EmbedBuilder()
        .setTitle(card.getDisplayName())
        .setDescription(`**${card.typeLine}**\n${card.rulesText}`)
        .setColor(0x9b59b6);

      if (card.scryfallUri) {
        embed.setURL(card.scryfallUri);
      }

      embed.addFields(
        {
          name: "Set",
          value: `${card.setName} (${card.setCode.toUpperCase()})`,
          inline: true,
        },
        {
          name: "Rarity",
          value: card.rarity ? capitalize(card.rarity) : "Unknown",
          inline: true,
        },
      );

      if (card.manaCost) {
        const priceDisplay = card.getPriceDisplay();
        embed.addFields({
          name: "Mana Cost",
          value: priceDisplay ? `${card.manaCost} - ${priceDisplay}` : card.manaCost,
          inline: true,
        });
      }

      const legalityText = card.getFormatLegalities();
      if (legalityText) {
        embed.addFields({ name: "Legal in", value: legalityText, inline: false });
      }

      if (card.artist) {
        embed.addFields({ name: "Artist", value: card.artist, inline: true });
      }

      await channel.send({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(card.getDisplayName())
      .setColor(this.getRarityColor(card.rarity))
      .setImage(card.getBestImageUrl());

    if (card.scryfallUri) {
      embed.setURL(card.scryfallUri);
    }

    const descriptions: string[] = [];

    if (usedFallback) {
      descriptions.push(
        `*No exact match found for filters in \`${originalQuery}\`, showing closest match*`,
      );
    } else if (
      originalQuery &&
      originalQuery !== "random" &&
      this.hasScryfallClauses(originalQuery)
    ) {
      descriptions.push(`*Filtered result for: \`${originalQuery}\`*`);
    }

    if (card.manaCost) {
      const priceDisplay = card.getPriceDisplay();
      descriptions.push(
        priceDisplay
          ? `**Mana Cost:** ${card.manaCost} - **Cost:** ${priceDisplay}`
          : `**Mana Cost:** ${card.manaCost}`,
      );
    }

    if (descriptions.length > 0) {
      embed.setDescription(descriptions.join("\n"));
    }

    const legalityText = card.getFormatLegalities();
    if (legalityText) {
      embed.addFields({ name: "Legal in", value: legalityText, inline: false });
    }

    const footerParts = [
      card.setName,
      card.rarity ? capitalize(card.rarity) : "",
      card.artist ? `Art by ${card.artist}` : "",
    ].filter(Boolean);

    if (footerParts.length > 0) {
      embed.setFooter({ text: footerParts.join(" • ") });
    }

    await channel.send({ embeds: [embed] });
  }

  getRarityColor(rarity: string): number {
    const rarityColors: Record<string, number> = {
      mythic: 0xff8c00,
      rare: 0xffd700,
      uncommon: 0xc0c0c0,
      common: 0x000000,
      special: 0xff1493,
      bonus: 0x9370db,
    };

    return rarityColors[rarity.toLowerCase()] ?? 0x9b59b6;
  }

  async handleHelp(message: Message, channel: SendableChannel): Promise<void> {
    this.logger.info("Showing help information", {
      user_id: message.author.id,
      username: message.author.username,
    });

    const prefix = this.config.commandPrefix;
    const embed = new EmbedBuilder()
      .setTitle("Scryfall Discord Bot")
      .setDescription("Fast Magic card lookups with pricing, legality, and rulings.")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Essential Commands",
          value: `\`${prefix}lightning bolt\` • single-card lookup
\`[[Lightning Bolt]]\` • bracket style lookup
\`${prefix}rules counterspell\` • official rulings
\`${prefix}random\` • pull a random card (supports filters)`,
          inline: false,
        },
        {
          name: "Filtering & Sorting",
          value: `Mix Scryfall syntax directly in the query.
• Sets: \`e:mh3\`, \`s:ltr\`
• Showcase/foils: \`is:showcase is:foil\`
• Sort results: \`order:edhrec\`, \`order:usd dir:desc\`
• Example: \`${prefix}cultivate order:edhrec dir:desc\``,
          inline: true,
        },
        {
          name: "Multiple Cards",
          value: `Semicolons resolve several cards in a grid.
\`${prefix}bolt; counterspell; doom blade\`
\`${prefix}sol ring e:lea; mox ruby e:lea\``,
          inline: true,
        },
        {
          name: "Power Tips",
          value: `• Fuzzy match typos: \`ragav\` ⇒ Ragavan
• Rate limiting keeps chats friendly
• Search pools pick varied prints unless you sort
• Aliases: \`${prefix}r\`, \`${prefix}rand\`, \`${prefix}h\`, \`${prefix}?\``,
          inline: false,
        },
      )
      .setFooter({ text: "Powered by Scryfall API" });

    await channel.send({ embeds: [embed] });
  }

  async sendErrorMessage(channel: SendableChannel, message: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(message)
      .setColor(0xe74c3c);

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error("Failed to send error message", {
        error: formatError(error),
      });
    }
  }

  formatDuration(seconds: number): string {
    const wholeSeconds = Math.trunc(seconds);
    const days = Math.floor(wholeSeconds / 86_400);
    const hours = Math.floor((wholeSeconds % 86_400) / 3_600);
    const minutes = Math.floor((wholeSeconds % 3_600) / 60);
    const secs = wholeSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  }

  cleanupDuplicateData(): void {
    const now = this.now();
    const cutoff = now - 300;

    for (const [key, timestamp] of this.recentCommands.entries()) {
      if (timestamp < cutoff) {
        this.recentCommands.delete(key);
      }
    }

    for (const [userId, timestamp] of this.userRateLimits.entries()) {
      if (timestamp < cutoff) {
        this.userRateLimits.delete(userId);
      }
    }

    if (this.processedMessageIds.size > 1000) {
      const sortedIds = [...this.processedMessageIds].sort();
      this.processedMessageIds.clear();

      for (const messageId of sortedIds.slice(-500)) {
        this.processedMessageIds.add(messageId);
      }
    }
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down bot");

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    try {
      await this.scryfallClient.close();
    } catch (error) {
      this.logger.warning("Error closing scryfall client", {
        error: formatError(error),
      });
    }

    this.destroy();
  }
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
