"""Unit tests for stable Scryfall helpers."""

from __future__ import annotations

import unittest

from app.scryfall import Card


class CardTests(unittest.TestCase):
    def test_get_best_image_url_prefers_png(self) -> None:
        card = Card(
            {
                "object": "card",
                "name": "Lightning Bolt",
                "image_uris": {
                    "small": "https://img.example/small.jpg",
                    "png": "https://img.example/card.png",
                },
            }
        )

        self.assertEqual(card.get_best_image_url(), "https://img.example/card.png")

    def test_get_price_display_prefers_usd(self) -> None:
        card = Card(
            {
                "object": "card",
                "name": "Sol Ring",
                "prices": {"usd": "2.5", "eur": "1.0"},
            }
        )

        self.assertEqual(card.get_price_display(), "$2.50")

    def test_get_format_legalities_returns_major_formats(self) -> None:
        card = Card(
            {
                "object": "card",
                "name": "Counterspell",
                "legalities": {
                    "modern": "legal",
                    "legacy": "legal",
                    "standard": "not_legal",
                },
            }
        )

        self.assertEqual(card.get_format_legalities(), "Modern, Legacy")
