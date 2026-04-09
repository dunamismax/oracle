import io
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from PIL import Image

from mtg_card_bot.grid import (
    CARD_HEIGHT,
    CARD_WIDTH,
    PADDING,
    calculate_grid_layout,
    compose_card_grid,
)


def _make_test_card_image() -> bytes:
    """Create a small test image that mimics a card."""
    img = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), (200, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_fake_card(**overrides: Any) -> MagicMock:
    """Create a minimal mock Card for grid tests."""
    card = MagicMock()
    card.get_display_name.return_value = overrides.get("name", "Test Card")
    card.get_best_image_url.return_value = overrides.get(
        "image_url", "https://img.example/card.png"
    )
    return card


class TestGridLayout:
    def test_two_cards_side_by_side(self) -> None:
        assert calculate_grid_layout(2) == (2, 1)

    def test_three_cards_single_row(self) -> None:
        assert calculate_grid_layout(3) == (3, 1)

    def test_four_cards_two_by_two(self) -> None:
        assert calculate_grid_layout(4) == (2, 2)

    def test_six_cards_three_by_two(self) -> None:
        assert calculate_grid_layout(6) == (3, 2)

    def test_nine_cards_three_by_three(self) -> None:
        assert calculate_grid_layout(9) == (3, 3)

    def test_ten_cards_five_by_two(self) -> None:
        assert calculate_grid_layout(10) == (5, 2)

    @pytest.mark.parametrize("count", range(1, 11))
    def test_layout_fits_all_cards(self, count: int) -> None:
        cols, rows = calculate_grid_layout(count)
        assert cols * rows >= count


class TestGridComposition:
    async def test_compose_produces_valid_png(self) -> None:
        test_image_bytes = _make_test_card_image()

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=test_image_bytes)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        cards = [_make_fake_card(name=f"Card {i}") for i in range(3)]

        try:
            result = await compose_card_grid(cards, client)
        finally:
            await client.aclose()

        # Verify it's a valid PNG
        img = Image.open(result)
        assert img.format == "PNG"

        # Verify dimensions: 3 columns, 1 row
        expected_width = 3 * CARD_WIDTH + 4 * PADDING
        expected_height = 1 * CARD_HEIGHT + 2 * PADDING
        assert img.size == (expected_width, expected_height)

    async def test_compose_four_cards_is_two_by_two(self) -> None:
        test_image_bytes = _make_test_card_image()

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=test_image_bytes)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        cards = [_make_fake_card(name=f"Card {i}") for i in range(4)]

        try:
            result = await compose_card_grid(cards, client)
        finally:
            await client.aclose()

        img = Image.open(result)
        expected_width = 2 * CARD_WIDTH + 3 * PADDING
        expected_height = 2 * CARD_HEIGHT + 3 * PADDING
        assert img.size == (expected_width, expected_height)

    async def test_compose_handles_download_failure(self) -> None:
        test_image_bytes = _make_test_card_image()
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                return httpx.Response(500, text="Server Error")
            return httpx.Response(200, content=test_image_bytes)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        cards = [_make_fake_card(name=f"Card {i}") for i in range(3)]

        try:
            result = await compose_card_grid(cards, client)
        finally:
            await client.aclose()

        # Should still produce a valid image with placeholder for failed card
        img = Image.open(result)
        assert img.format == "PNG"
        assert img.size[0] > 0
        assert img.size[1] > 0
