import httpx
import pytest

from mtg_card_bot import errors
from mtg_card_bot.scryfall import ScryfallClient


async def _make_mock_client(handler):
    """Create a ScryfallClient with a mock transport and zero retry backoff."""
    client = ScryfallClient()
    client.RETRY_BACKOFF = 0.0  # Eliminate sleep in tests
    await client.client.aclose()
    client.client = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), follow_redirects=True
    )
    return client


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


async def test_request_retries_on_503_then_succeeds() -> None:
    """Verify that a 503 is retried and eventually succeeds."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(503, text="Service Unavailable")
        return httpx.Response(
            200,
            json={
                "object": "card",
                "id": "random-id",
                "name": "Black Lotus",
            },
        )

    client = await _make_mock_client(handler)

    try:
        card = await client.get_random_card()
    finally:
        await client.close()

    assert card.name == "Black Lotus"
    assert call_count == 3


async def test_request_exhausts_retries_on_persistent_503() -> None:
    """Verify that persistent 503s raise after all retries are exhausted."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="Service Unavailable")

    client = await _make_mock_client(handler)

    try:
        with pytest.raises(errors.MTGError) as exc_info:
            await client.get_random_card()
    finally:
        await client.close()

    assert exc_info.value.error_type is errors.ErrorType.API
    assert "temporarily unavailable" in exc_info.value.message.lower()


async def test_request_retries_on_network_error() -> None:
    """Verify that network errors are retried."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise httpx.ConnectError("Connection refused")
        return httpx.Response(
            200,
            json={
                "object": "card",
                "id": "card-id",
                "name": "Sol Ring",
            },
        )

    client = await _make_mock_client(handler)

    try:
        card = await client.get_random_card()
    finally:
        await client.close()

    assert card.name == "Sol Ring"
    assert call_count == 2


async def test_request_does_not_retry_404() -> None:
    """404 is a client error and should not be retried."""
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            404,
            json={
                "object": "error",
                "status": 404,
                "code": "not_found",
                "details": "Card not found",
            },
        )

    client = await _make_mock_client(handler)

    try:
        with pytest.raises(errors.MTGError) as exc_info:
            await client.get_card_by_name("doesntexist")
    finally:
        await client.close()

    assert exc_info.value.error_type is errors.ErrorType.NOT_FOUND
    assert call_count == 1  # No retries for 404
