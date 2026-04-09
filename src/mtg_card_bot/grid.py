"""Server-side card grid image compositor for multi-card lookups."""

import asyncio
import io
from typing import TYPE_CHECKING

import httpx
from PIL import Image, ImageDraw, ImageFont

if TYPE_CHECKING:
    from .scryfall import Card

# Card image dimensions for "normal" Scryfall format
CARD_WIDTH = 488
CARD_HEIGHT = 680

# Grid styling
PADDING = 20
BG_COLOR = (30, 31, 34)  # Discord dark theme (#1e1f22)
CORNER_RADIUS = 16
PLACEHOLDER_COLOR = (55, 57, 63)  # Slightly lighter than background
PLACEHOLDER_TEXT_COLOR = (180, 180, 180)


def calculate_grid_layout(count: int) -> tuple[int, int]:
    """Return (columns, rows) for a given card count.

    Optimized for visual balance in Discord embeds on desktop and mobile.
    """
    layouts = {
        1: (1, 1),
        2: (2, 1),
        3: (3, 1),
        4: (2, 2),
        5: (3, 2),
        6: (3, 2),
        7: (4, 2),
        8: (4, 2),
        9: (3, 3),
        10: (5, 2),
    }
    if count in layouts:
        return layouts[count]
    # Fallback for >10: use 5 columns
    rows = (count + 4) // 5
    return (5, rows)


async def _download_image(client: httpx.AsyncClient, url: str) -> Image.Image | None:
    """Download a single card image. Returns None on failure."""
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGBA")
    except Exception:
        return None


def _make_rounded_mask(width: int, height: int, radius: int) -> Image.Image:
    """Create a rounded-rectangle alpha mask."""
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (width - 1, height - 1)], radius, fill=255)
    return mask


def _make_placeholder(width: int, height: int, card_name: str) -> Image.Image:
    """Create a placeholder image for a card whose image failed to download."""
    img = Image.new("RGBA", (width, height), PLACEHOLDER_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw card name centered
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except OSError:
        font = ImageFont.load_default()

    # Word-wrap the name to fit
    text = card_name if len(card_name) <= 30 else card_name[:27] + "..."
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    draw.text((x, y), text, fill=PLACEHOLDER_TEXT_COLOR, font=font)

    return img


def _apply_rounded_corners(img: Image.Image, radius: int) -> Image.Image:
    """Apply rounded corners to an image."""
    # Ensure RGBA
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Resize to expected card dimensions if needed
    if img.size != (CARD_WIDTH, CARD_HEIGHT):
        img = img.resize((CARD_WIDTH, CARD_HEIGHT), Image.LANCZOS)

    mask = _make_rounded_mask(CARD_WIDTH, CARD_HEIGHT, radius)
    output = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    output.paste(img, (0, 0), mask)
    return output


async def compose_card_grid(
    cards: list["Card"],
    http_client: httpx.AsyncClient,
) -> io.BytesIO:
    """Compose multiple card images into a single grid image.

    Downloads card images concurrently, arranges them in an adaptive grid
    with rounded corners and dark background, and returns PNG bytes.
    """
    if not cards:
        raise ValueError("No cards to compose")

    cols, rows = calculate_grid_layout(len(cards))

    # Download all images concurrently
    image_urls = [
        card.get_best_image_url(("normal", "large", "small")) for card in cards
    ]
    download_tasks = [_download_image(http_client, url) for url in image_urls]
    raw_images = await asyncio.gather(*download_tasks)

    # Apply rounded corners or create placeholders
    card_images: list[Image.Image] = []
    for i, raw in enumerate(raw_images):
        if raw is not None:
            card_images.append(_apply_rounded_corners(raw, CORNER_RADIUS))
        else:
            placeholder = _make_placeholder(
                CARD_WIDTH, CARD_HEIGHT, cards[i].get_display_name()
            )
            card_images.append(_apply_rounded_corners(placeholder, CORNER_RADIUS))

    # Calculate canvas dimensions
    canvas_width = cols * CARD_WIDTH + (cols + 1) * PADDING
    canvas_height = rows * CARD_HEIGHT + (rows + 1) * PADDING

    # Create canvas with Discord dark background
    canvas = Image.new("RGBA", (canvas_width, canvas_height), BG_COLOR)

    # Place cards on the grid, centering incomplete last rows
    for i, card_img in enumerate(card_images):
        row = i // cols
        col = i % cols

        # Check if this is the last row and if it's incomplete
        cards_in_last_row = len(card_images) % cols
        is_last_row = row == rows - 1
        if is_last_row and cards_in_last_row > 0:
            # Center the incomplete row
            total_cards_width = (
                cards_in_last_row * CARD_WIDTH + (cards_in_last_row - 1) * PADDING
            )
            x_offset = (canvas_width - total_cards_width) // 2
            x = x_offset + col * (CARD_WIDTH + PADDING)
        else:
            x = PADDING + col * (CARD_WIDTH + PADDING)

        y = PADDING + row * (CARD_HEIGHT + PADDING)
        canvas.paste(card_img, (x, y), card_img)

    # Convert to RGB for PNG output (no transparency needed for final image)
    final = Image.new("RGB", canvas.size, BG_COLOR)
    final.paste(canvas, (0, 0), canvas)

    # Save to buffer
    buffer = io.BytesIO()
    final.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer
