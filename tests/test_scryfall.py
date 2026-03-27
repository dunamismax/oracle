import httpx
import pytest

from mtg_card_bot import errors
from mtg_card_bot.scryfall import ScryfallClient


async def test_get_card_by_name_uses_fuzzy_named_endpoint() -> None:
    captured_url: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_url["url"] = str(request.url)
        return httpx.Response(
            200,
            json={
                "object": "card",
                "id": "card-id",
                "name": "Lightning Bolt",
                "scryfall_uri": "https://scryfall.com/card/card-id",
            },
        )

    client = ScryfallClient()
    await client.client.aclose()
    client.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    try:
        card = await client.get_card_by_name("Lightning Bolt")
    finally:
        await client.close()

    assert card.name == "Lightning Bolt"
    assert captured_url["url"] == (
        "https://api.scryfall.com/cards/named?fuzzy=Lightning%20Bolt"
    )


async def test_get_card_by_name_maps_not_found_errors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            404,
            json={
                "object": "error",
                "status": 404,
                "code": "not_found",
                "details": "No cards found matching that query.",
                "type": "ambiguous",
            },
        )

    client = ScryfallClient()
    await client.client.aclose()
    client.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    try:
        with pytest.raises(errors.MTGError) as exc_info:
            await client.get_card_by_name("Missing Card")
    finally:
        await client.close()

    assert exc_info.value.error_type is errors.ErrorType.NOT_FOUND
    assert exc_info.value.message == "No cards found matching that query."
