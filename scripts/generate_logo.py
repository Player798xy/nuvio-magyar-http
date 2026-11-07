import os
from PIL import Image, ImageDraw, ImageFont

def generate_logo():
    W, H = 512, 512
    SCALE = 4  # 4x supersampling (2048x2048) for ultra-sharp, anti-aliased output
    w, h = W * SCALE, H * SCALE

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer rounded container (Addon tile)
    pad = 16 * SCALE
    r = 104 * SCALE

    # Deep dark background
    draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=r, fill=(8, 10, 14, 255))
    # Outer crisp electric mint border
    draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=r, outline=(94, 234, 212, 255), width=7 * SCALE)
    # Subtle inner dark hairline
    draw.rounded_rectangle([pad + 9 * SCALE, pad + 9 * SCALE, w - pad - 9 * SCALE, h - pad - 9 * SCALE], radius=r - 8 * SCALE, outline=(28, 35, 48, 255), width=2 * SCALE)

    # 2. CRT Screen Bezel
    scr_x1 = 44 * SCALE
    scr_y1 = 44 * SCALE
    scr_x2 = w - 44 * SCALE
    scr_y2 = 384 * SCALE
    scr_r = 44 * SCALE

    # Screen dark slate fill
    draw.rounded_rectangle([scr_x1, scr_y1, scr_x2, scr_y2], radius=scr_r, fill=(15, 18, 25, 255), outline=(38, 46, 64, 255), width=4 * SCALE)

    # 3. Fonts
    try:
        font_hu = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 170 * SCALE)
        font_badge = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 35 * SCALE)
    except Exception:
        font_hu = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    # 4. Central HU + Play Triangle
    text_hu = 'HU'
    hu_bbox = draw.textbbox((0, 0), text_hu, font=font_hu)
    hu_w = hu_bbox[2] - hu_bbox[0]
    hu_h = hu_bbox[3] - hu_bbox[1]

    play_gap = 26 * SCALE
    play_w = 88 * SCALE
    play_h = 104 * SCALE

    total_content_w = hu_w + play_gap + play_w
    start_x = scr_x1 + ((scr_x2 - scr_x1) - total_content_w) // 2

    # Vertical centering above bottom tricolor bar (bar takes 24px)
    content_area_h = (scr_y2 - 26 * SCALE) - scr_y1
    hu_y = scr_y1 + (content_area_h - hu_h) // 2 - 6 * SCALE

    # Draw HU in ultra-crisp white
    draw.text((start_x, hu_y), text_hu, font=font_hu, fill=(248, 250, 252, 255))

    # Draw Play Triangle in electric mint
    play_x = start_x + hu_w + play_gap
    play_y = hu_y + (hu_h - play_h) // 2 + 10 * SCALE
    draw.polygon([
        (play_x, play_y),
        (play_x + play_w, play_y + play_h / 2),
        (play_x, play_y + play_h)
    ], fill=(94, 234, 212, 255))

    # 5. Hungarian Tricolor Ribbon along the bottom of the CRT screen
    bar_h = 7 * SCALE
    bar_x1 = scr_x1 + 6 * SCALE
    bar_x2 = scr_x2 - 6 * SCALE
    bar_y = scr_y2 - 27 * SCALE

    # Hungarian Red (#dc2626)
    draw.rectangle([bar_x1, bar_y, bar_x2, bar_y + bar_h], fill=(220, 38, 38, 255))
    # Crisp White (#ffffff)
    draw.rectangle([bar_x1, bar_y + bar_h, bar_x2, bar_y + bar_h * 2], fill=(255, 255, 255, 255))
    # Hungarian Green (#16a34a)
    draw.rectangle([bar_x1, bar_y + bar_h * 2, bar_x2, bar_y + bar_h * 3], fill=(22, 163, 74, 255))

    # 6. Lower Pill: 'MAGYAR STREAMING PRO'
    badge_h = 62 * SCALE
    badge_y = 406 * SCALE
    badge_w = 424 * SCALE
    badge_x = (w - badge_w) // 2

    # Mint-tinted dark pill
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=16 * SCALE, fill=(6, 24, 20, 255), outline=(32, 92, 75, 255), width=3 * SCALE)

    badge_text = 'MAGYAR STREAMING PRO'
    bbox_b = draw.textbbox((0, 0), badge_text, font=font_badge)
    bw = bbox_b[2] - bbox_b[0]
    bh = bbox_b[3] - bbox_b[1]
    draw.text((badge_x + (badge_w - bw) // 2, badge_y + (badge_h - bh) // 2 - 2 * SCALE), badge_text, font=font_badge, fill=(94, 234, 212, 255))

    # 7. Downsample to pristine 512x512
    final_512 = img.resize((W, H), Image.Resampling.LANCZOS)

    public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    os.makedirs(public_dir, exist_ok=True)

    # Save logo.png and icon.png
    logo_png_path = os.path.join(public_dir, 'logo.png')
    icon_png_path = os.path.join(public_dir, 'icon.png')
    favicon_ico_path = os.path.join(public_dir, 'favicon.ico')

    final_512.save(logo_png_path, format='PNG', optimize=True)
    final_512.save(icon_png_path, format='PNG', optimize=True)

    # Save multi-resolution favicon.ico
    final_512.save(
        favicon_ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )

    print(f"Generated {logo_png_path} ({os.path.getsize(logo_png_path)} bytes)")
    print(f"Generated {icon_png_path} ({os.path.getsize(icon_png_path)} bytes)")
    print(f"Generated {favicon_ico_path} ({os.path.getsize(favicon_ico_path)} bytes)")

if __name__ == '__main__':
    generate_logo()
