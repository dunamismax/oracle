from collections.abc import AsyncIterator
from typing import Any, cast
from unittest.mock import AsyncMock

import discord
import pytest
import pytest_asyncio

from mtg_card_bot.bot import MTGCardBot, MultiResolvedCard
from mtg_card_bot.config import MTGConfig
from mtg_card_bot.errors import ErrorType, create_error
from mtg_card_bot.scryfall import Card


class FakeChannel:
    def __init__(self) -> None:
        self.sent_messages: list[dict[str, Any]] = []

    async def send(
        self,
        *,
        embed: discord.Embed | None = None,
        files: list[discord.File] | None = None,
    ) -> None:
        self.sent_messages.append({"embed": embed, "files": files})


class FakeAuthor:
    def __init__(
        self, user_id: int = 1, name: str = "Stephen", *, bot: bool = False
    ) -> None:
        self.id = user_id
        self.name = name
        self.bot = bot


class FakeMessage:
    def __init__(
        self,
        content: str,
        *,
        message_id: int = 1,
        author: FakeAuthor | None = None,
        channel: FakeChannel | None = None,
    ) -> None:
        self.content = content
        self.id = message_id
        self.author = author or FakeAuthor()
        self.channel = channel or FakeChannel()


def make_card(**overrides: Any) -> Card:
    data: dict[str, Any] = {
        "object": "card",
        "id": "lightning-bolt-id",
        "name": "Lightning Bolt",
        "scryfall_uri": "https://scryfall.com/card/lea/lightning-bolt-id",
        "image_uris": {
            "png": "https://img.example/lightning-bolt.png",
            "large": "https://img.example/lightning-bolt-large.jpg",
        },
        "mana_cost": "{R}",
        "type_line": "Instant",
        "oracle_text": "Lightning Bolt deals 3 damage to any target.",
        "set_name": "Limited Edition Alpha",
        "set": "lea",
        "rarity": "common",
        "artist": "Christopher Rush",
        "prices": {"usd": "1.25"},
        "legalities": {"modern": "legal", "commander": "legal"},
    }
    data.update(overrides)
    return Card(data)


@pytest_asyncio.fixture
async def bot(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[MTGCardBot]:
    monkeypatch.setenv("MTG_DISCORD_TOKEN", "test-token")
    instance = MTGCardBot(MTGConfig())
    yield instance
    await instance.close()


def _field_map(embed: discord.Embed) -> dict[str, str]:
    return {str(field.name): str(field.value) for field in embed.fields}


def test_extract_sort_parameters_strips_sort_tokens(bot: MTGCardBot) -> None:
    cleaned_query, order, direction = bot._extract_sort_parameters(
        "cultivate order:usd, direction:DESC"
    )

    assert cleaned_query == "cultivate"
    assert order == "usd"
    assert direction == "desc"


async def test_on_message_routes_bracket_lookup(
    bot: MTGCardBot, monkeypatch: pytest.MonkeyPatch
) -> None:
    lookup = AsyncMock()
    monkeypatch.setattr(bot, "_handle_card_lookup", lookup)
    message = FakeMessage("Could you grab [[Lightning Bolt]] for me?", message_id=101)

    await bot.on_message(cast(Any, message))

    lookup.assert_awaited_once_with(message, "Lightning Bolt")


async def test_on_message_routes_random_alias_with_filters(
    bot: MTGCardBot, monkeypatch: pytest.MonkeyPatch
) -> None:
    random_lookup = AsyncMock()
    monkeypatch.setattr(bot, "_handle_random_card", random_lookup)
    message = FakeMessage("!rand rarity:mythic e:mh3", message_id=102)

    await bot.on_message(cast(Any, message))

    random_lookup.assert_awaited_once_with(message, "rarity:mythic e:mh3")


async def test_on_message_routes_multi_lookup(
    bot: MTGCardBot, monkeypatch: pytest.MonkeyPatch
) -> None:
    multi_lookup = AsyncMock()
    monkeypatch.setattr(bot, "_handle_multi_card_lookup", multi_lookup)
    message = FakeMessage("!bolt; counterspell; doom blade", message_id=103)

    await bot.on_message(cast(Any, message))

    multi_lookup.assert_awaited_once_with(message, "bolt; counterspell; doom blade")


async def test_resolve_card_query_uses_search_and_fallback_for_filtered_queries(
    bot: MTGCardBot, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected_card = make_card(name="Sol Ring")
    search_first = AsyncMock(side_effect=create_error(ErrorType.NOT_FOUND, "missing"))
    get_by_name = AsyncMock(return_value=expected_card)
    monkeypatch.setattr(bot.scryfall_client, "search_card_first", search_first)
    monkeypatch.setattr(bot.scryfall_client, "get_card_by_name", get_by_name)

    card, used_fallback = await bot._resolve_card_query(
        "sol ring e:lea order:usd dir:desc"
    )

    assert card is expected_card
    assert used_fallback is True
    search_first.assert_awaited_once_with("sol ring e:lea", "usd", "desc")
    get_by_name.assert_awaited_once_with("sol ring")


async def test_send_card_message_without_image_uses_text_embed(bot: MTGCardBot) -> None:
    channel = FakeChannel()
    card = make_card(image_uris={})

    await bot._send_card_message(cast(Any, channel), card, False, "lightning bolt")

    assert len(channel.sent_messages) == 1
    embed = channel.sent_messages[0]["embed"]
    assert isinstance(embed, discord.Embed)
    assert embed.title == "Lightning Bolt"
    assert embed.description == (
        "**Instant**\nLightning Bolt deals 3 damage to any target."
    )

    fields = _field_map(embed)
    assert fields["Set"] == "Limited Edition Alpha (LEA)"
    assert fields["Rarity"] == "Common"
    assert fields["Mana Cost"] == "{R} - $1.25"
    assert fields["Legal in"] == "Modern, Commander"
    assert fields["Artist"] == "Christopher Rush"


async def test_send_card_message_with_image_includes_filter_context(
    bot: MTGCardBot,
) -> None:
    channel = FakeChannel()
    card = make_card(rarity="rare")

    await bot._send_card_message(
        cast(Any, channel),
        card,
        False,
        "lightning bolt e:lea order:usd dir:desc",
    )

    assert len(channel.sent_messages) == 1
    embed = channel.sent_messages[0]["embed"]
    assert isinstance(embed, discord.Embed)
    assert embed.title == "Lightning Bolt"
    assert embed.description == (
        "*Filtered result for: `lightning bolt e:lea order:usd dir:desc`*\n"
        "**Mana Cost:** {R} - **Cost:** $1.25"
    )
    assert embed.image.url == "https://img.example/lightning-bolt.png"
    assert _field_map(embed)["Legal in"] == "Modern, Commander"
    assert embed.footer.text == "Limited Edition Alpha • Rare • Art by Christopher Rush"


async def test_send_card_grid_message_builds_list_embed_and_images(
    bot: MTGCardBot, monkeypatch: pytest.MonkeyPatch
) -> None:
    channel = FakeChannel()
    fetch_image = AsyncMock(return_value=(b"image-bytes", "lightning-bolt.jpg"))
    monkeypatch.setattr(bot, "_fetch_image", fetch_image)
    items = [
        MultiResolvedCard("bolt", card=make_card()),
        MultiResolvedCard(
            "counterspall",
            card=make_card(
                name="Counterspell",
                scryfall_uri="https://scryfall.com/card/7ed/counterspell-id",
                image_uris={},
            ),
            used_fallback=True,
        ),
        MultiResolvedCard(
            "definitely-not-a-card", error=create_error(ErrorType.NOT_FOUND, "missing")
        ),
    ]

    await bot._send_card_grid_message(cast(Any, channel), items)

    assert len(channel.sent_messages) == 2

    list_embed = channel.sent_messages[0]["embed"]
    assert isinstance(list_embed, discord.Embed)
    assert list_embed.title == "Requested Cards"
    assert list_embed.description == "\n".join(
        [
            "- [Lightning Bolt](https://scryfall.com/card/lea/lightning-bolt-id)",
            "- [Counterspell (closest match)](https://scryfall.com/card/7ed/counterspell-id)",
            "- definitely-not-a-card: not found",
        ]
    )

    image_payload = channel.sent_messages[1]["files"]
    assert image_payload is not None
    assert len(image_payload) == 1
    assert image_payload[0].filename == "lightning-bolt.jpg"
    fetch_image.assert_awaited_once_with(
        "https://img.example/lightning-bolt-large.jpg",
        "Lightning Bolt",
    )
