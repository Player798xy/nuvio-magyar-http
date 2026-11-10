import os
import io
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def create_poster(channel_id, name, logo_url, brand_color='#ff2244', out_path='sample_pillow_poster.png'):
    width, height = 600, 900
    base = Image.new('RGBA', (width, height), (10, 13, 20, 255))
    draw = ImageDraw.Draw(base)

    # Gradient background
    r_brand, g_brand, b_brand = hex_to_rgb(brand_color)
    for y in range(height):
        ratio = y / height
        # Top has brand tint, bottom fades to deep charcoal/black
        r = int(r_brand * 0.22 * (1 - ratio) + 10 * ratio)
        g = int(g_brand * 0.22 * (1 - ratio) + 12 * ratio)
        b = int(b_brand * 0.22 * (1 - ratio) + 18 * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Ambient glow circle behind logo
    glow_size = 460
    glow = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for r in range(glow_size // 2, 0, -8):
        alpha = int(45 * (r / (glow_size / 2)))
        glow_draw.ellipse(
            (glow_size // 2 - r, glow_size // 2 - r, glow_size // 2 + r, glow_size // 2 + r),
            fill=(r_brand, g_brand, b_brand, alpha)
        )
    glow = glow.filter(ImageFilter.GaussianBlur(35))
    base.alpha_composite(glow, (width // 2 - glow_size // 2, 380 - glow_size // 2))

    # Top Badges: ÉLŐ TV (red pill) & 1080p FHD
    draw = ImageDraw.Draw(base)
    # ÉLŐ TV badge
    draw.rounded_rectangle([(40, 40), (160, 80)], radius=20, fill=(230, 20, 40, 240))
    # Red dot
    draw.ellipse([(55, 55), (65, 65)], fill=(255, 255, 255, 255))
    try:
        font_pill = ImageFont.truetype("arialbd.ttf", 18)
        font_name = ImageFont.truetype("arialbd.ttf", 36)
        font_sub = ImageFont.truetype("arial.ttf", 20)
    except:
        font_pill = ImageFont.load_default()
        font_name = font_pill
        font_sub = font_pill

    draw.text((75, 49), "ÉLŐ TV", font=font_pill, fill=(255, 255, 255, 255))

    # 1080p FHD badge
    draw.rounded_rectangle([(440, 40), (560, 80)], radius=20, fill=(20, 25, 35, 220), outline=(255, 255, 255, 60), width=1)
    draw.text((462, 50), "1080p", font=font_pill, fill=(160, 240, 160, 255))

    # Download & composite logo
    req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        logo_data = resp.read()
    logo_img = Image.open(io.BytesIO(logo_data)).convert('RGBA')

    # Resize logo maintaining aspect ratio (fit within 400x260)
    max_w, max_h = 420, 260
    logo_w, logo_h = logo_img.size
    scale = min(max_w / logo_w, max_h / logo_h)
    new_w, new_h = int(logo_w * scale), int(logo_h * scale)
    logo_resized = logo_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Logo container card
    card_w, card_h = 480, 320
    card_x, card_y = (width - card_w) // 2, 230
    draw.rounded_rectangle(
        [(card_x, card_y), (card_x + card_w, card_y + card_h)],
        radius=28,
        fill=(14, 18, 28, 220),
        outline=(r_brand, g_brand, b_brand, 180),
        width=2
    )

    # Paste centered logo inside container card
    paste_x = card_x + (card_w - new_w) // 2
    paste_y = card_y + (card_h - new_h) // 2
    base.alpha_composite(logo_resized, (paste_x, paste_y))

    # Bottom Title Pill Bar
    draw = ImageDraw.Draw(base)
    pill_w, pill_h = 520, 140
    pill_x, pill_y = (width - pill_w) // 2, 690
    draw.rounded_rectangle(
        [(pill_x, pill_y), (pill_x + pill_w, pill_y + pill_h)],
        radius=24,
        fill=(12, 16, 24, 240),
        outline=(255, 255, 255, 30),
        width=1
    )

    # Measure text centering
    bbox = draw.textbbox((0, 0), name, font=font_name)
    name_w = bbox[2] - bbox[0]
    name_x = (width - name_w) // 2
    draw.text((name_x, pill_y + 25), name, font=font_name, fill=(255, 255, 255, 255))

    sub_text = "HLS Élő Adás • Magyar Nyelven"
    bbox_sub = draw.textbbox((0, 0), sub_text, font=font_sub)
    sub_w = bbox_sub[2] - bbox_sub[0]
    sub_x = (width - sub_w) // 2
    draw.text((sub_x, pill_y + 80), sub_text, font=font_sub, fill=(180, 190, 205, 255))

    base.save(out_path, format='PNG', optimize=True)
    print(f"Saved {out_path} ({os.path.getsize(out_path)} bytes)")

# Test with RTL and Nat Geo
rtl_logo = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/rtl-hu.png'
create_poster('6141', 'RTL', rtl_logo, '#ff2244', 'scripts/sample_rtl_poster.png')

natgeo_logo = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/national-geographic-us.png'
create_poster('5936', 'National Geographic', natgeo_logo, '#f1c40f', 'scripts/sample_natgeo_poster.png')
