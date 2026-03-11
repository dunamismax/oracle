"""Unit tests for Discord bot query routing and fallback behavior."""

from __future__ import annotations

import unittest
from typing import Any
from unittest.mock import AsyncMock, patch

from app import errors
from app.bot import ScryfallBot
from app.config import BotConfig
from app.scryfall import Card


class ScryfallBotQueryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.config = BotConfig()
        self.config.discord_token = "test-token"
        self.bot = ScryfallBot(self.config)

    async def asyncTearDown(self) -> None:
        await self.bot.close()

    def test_has_scryfall_clauses_detects_documented_filters(self) -> None:
        self.assertTrue(self.bot._has_scryfall_clauses("sol ring s:ltr"))
        self.assertTrue(self.bot._has_scryfall_clauses("sol ring is:showcase"))
        self.assertTrue(
            self.bot._has_scryfall_clauses('lightning bolt o:"deal damage"')
        )

    def test_has_scryfall_clauses_ignores_card_name_punctuation(self) -> None:
        self.assertFalse(self.bot._has_scryfall_clauses("Circle of Protection: Red"))

    async def test_resolve_card_query_uses_search_for_documented_filters(self) -> None:
        filtered_card = self._make_card("Sol Ring")

        with patch.object(
            self.bot.scryfall_client,
            "search_card_first",
            AsyncMock(return_value=filtered_card),
        ) as search_card_first, patch.object(
            self.bot.scryfall_client,
            "get_card_by_name",
            AsyncMock(),
        ) as get_card_by_name:
            card, used_fallback = await self.bot._resolve_card_query("sol ring s:ltr")

        self.assertEqual(card.name, "Sol Ring")
        self.assertFalse(used_fallback)
        search_card_first.assert_awaited_once_with("sol ring s:ltr", None, None)
        get_card_by_name.assert_not_awaited()

    async def test_resolve_card_query_falls_back_only_for_not_found(self) -> None:
        fallback_card = self._make_card("Sol Ring")
        not_found_error = errors.create_error(
            errors.ErrorType.NOT_FOUND, "No cards found matching query"
        )

        with patch.object(
            self.bot.scryfall_client,
            "search_card_first",
            AsyncMock(side_effect=not_found_error),
        ) as search_card_first, patch.object(
            self.bot.scryfall_client,
            "get_card_by_name",
            AsyncMock(return_value=fallback_card),
        ) as get_card_by_name:
            card, used_fallback = await self.bot._resolve_card_query("sol ring s:ltr")

        self.assertEqual(card.name, "Sol Ring")
        self.assertTrue(used_fallback)
        search_card_first.assert_awaited_once_with("sol ring s:ltr", None, None)
        get_card_by_name.assert_awaited_once_with("sol ring")

    async def test_resolve_card_query_propagates_non_not_found_errors(self) -> None:
        rate_limit_error = errors.create_error(
            errors.ErrorType.RATE_LIMIT, "API rate limit exceeded"
        )

        with (
            patch.object(
                self.bot.scryfall_client,
                "search_card_first",
                AsyncMock(side_effect=rate_limit_error),
            ) as search_card_first,
            patch.object(
                self.bot.scryfall_client,
                "get_card_by_name",
                AsyncMock(),
            ) as get_card_by_name,
            self.assertRaises(errors.BotError) as exc_info,
        ):
            await self.bot._resolve_card_query("sol ring s:ltr")

        self.assertIs(exc_info.exception, rate_limit_error)
        search_card_first.assert_awaited_once_with("sol ring s:ltr", None, None)
        get_card_by_name.assert_not_awaited()

    async def test_resolve_card_query_uses_search_for_sort_hints(self) -> None:
        sorted_card = self._make_card("Cultivate")

        with patch.object(
            self.bot.scryfall_client,
            "search_card_first",
            AsyncMock(return_value=sorted_card),
        ) as search_card_first, patch.object(
            self.bot.scryfall_client,
            "get_card_by_name",
            AsyncMock(),
        ) as get_card_by_name:
            card, used_fallback = await self.bot._resolve_card_query(
                "cultivate order:usd dir:desc"
            )

        self.assertEqual(card.name, "Cultivate")
        self.assertFalse(used_fallback)
        search_card_first.assert_awaited_once_with("cultivate", "usd", "desc")
        get_card_by_name.assert_not_awaited()

    def _make_card(self, name: str) -> Card:
        payload: dict[str, Any] = {
            "object": "card",
            "id": f"{name.lower().replace(' ', '-')}-id",
            "name": name,
        }
        return Card(payload)
