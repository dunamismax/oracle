from mtg_card_bot.errors import ErrorType, create_error


def test_create_error_preserves_cause() -> None:
    cause = RuntimeError("boom")

    error = create_error(ErrorType.NETWORK, "Request failed", cause)

    assert error.error_type is ErrorType.NETWORK
    assert error.message == "Request failed"
    assert error.cause is cause
    assert str(error) == "Request failed"
