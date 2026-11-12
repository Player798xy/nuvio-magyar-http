import json
import os
import io
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

EXPLICIT_LOGOS = {
    '9801': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/atv-extra-hu.png', # ATV Spirit / Extra
    '9802': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/poland/axn-spin-pl.png', # AXN Spin
    '9803': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/animal-planet-us.png', # Animal Planet
    '9810': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/dikh-tv-hu.png', # Dikh TV
    '9811': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/discovery-channel-us.png', # Discovery Channel
    '9812': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/disney-channel-us.png', # Disney Channel
    '9815': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/eurosport-1-fr.png', # Eurosport 1
    '9816': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/fix-hu.png', # FIX TV
    '9817': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/film4-hu.png', # Film Mánia fallback
    '9818': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/food-network-us.png', # Food Network
    '9821': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/hgtv-de.png', # HGTV
    '9824': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states/investigation-discovery-us.png', # Investigation Discovery
    '9832': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/rtl-hu.png', # RTL Klub
    '9833': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/rakosmente-tv-hu.png', # Rákosmente TV
    '9836': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/story4-hu.png', # Story4
    '9841': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/the-fishing-and-hunting-channel-hu.png', # Fishing & Hunting
    '9843': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/travelxp-hu.png', # Travel Channel
    '9846': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/viasat-explore-hu.png', # Viasat Explore
    '9847': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/viasat-history-hu.png', # Viasat History
    '9848': 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/hungary/viasat-nature-hu.png', # Viasat Nature
}

BRAND_COLORS = {
    '9801': '#c0392b', # ATV Spirit
    '9802': '#e84118', # AXN Spin
    '9803': '#00aeef', # Animal Planet
    '9810': '#e67e22', # Dikh TV
    '9811': '#005086', # Discovery Channel
    '9812': '#0055b8', # Disney Channel
    '9815': '#002d62', # Eurosport 1
    '9816': '#3498db', # FIX TV
    '9817': '#e84118', # Film Mánia
    '9818': '#e41b23', # Food Network
    '9821': '#289728', # HGTV
    '9824': '#b51a1a', # Investigation Discovery
    '9830': '#16a085', # PVTV
    '9832': '#ff2244', # RTL Klub
    '9833': '#2980b9', # Rákosmente TV
    '9836': '#a55eea', # Story4
    '9841': '#27ae60', # The Fishing & Hunting Channel
    '9843': '#f39c12', # Travel Channel
    '9846': '#2980b9', # Viasat Explore
    '9847': '#d35400', # Viasat History
    '9848': '#2ecc71', # Viasat Nature
}

CATEGORY_DEFAULT_COLORS = {
    'hu-live-orszagos': '#ff4757',
    'hu-live-film': '#a55eea',
    'hu-live-doksi': '#ffbe76',
    'hu-live-sport': '#2ed573',
    'hu-live-gyerek': '#ff78e3',
    'hu-live-helyi': '#00d2d3'
}

os.makedirs('public/tv-logos', exist_ok=True)
os.makedirs('public/tv-posters', exist_ok=True)
os.makedirs('public/tv-backgrounds', exist_ok=True)

# Try font loading
try:
    font_pill = ImageFont.truetype("arialbd.ttf", 18)
    font_name = ImageFont.truetype("arialbd.ttf", 36)
    font_sub = ImageFont.truetype("arial.ttf", 20)
    font_bg_title = ImageFont.truetype("arialbd.ttf", 54)
    font_bg_sub = ImageFont.truetype("arial.ttf", 24)
    font_emblem = ImageFont.truetype("arialbd.ttf", 52)
except:
    font_pill = ImageFont.load_default()
    font_name = font_pill
    font_sub = font_pill
    font_bg_title = font_pill
    font_bg_sub = font_pill
    font_emblem = font_pill

def get_channel_logo(cid, ch):
    local_path = f"public/tv-logos/{cid}.png"
    if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
        try:
            return Image.open(local_path).convert('RGBA')
        except:
            pass

    logo_url = EXPLICIT_LOGOS.get(cid)
    if logo_url:
        try:
            req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read()
                img = Image.open(io.BytesIO(data)).convert('RGBA')
                img.save(local_path, format='PNG')
                return img
        except Exception as e:
            print(f"Failed to download explicit logo for {ch['name']} ({cid}): {e}")

    # Generate custom high-end emblem logo
    img = Image.new('RGBA', (360, 360), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    brand_hex = BRAND_COLORS.get(cid, CATEGORY_DEFAULT_COLORS.get(ch.get('category', 'hu-live-helyi'), '#00d2d3'))
    r_brand, g_brand, b_brand = hex_to_rgb(brand_hex)

    # Rounded card with glowing border
    draw.rounded_rectangle([(10, 10), (350, 350)], radius=45, fill=(18, 22, 34, 240), outline=(r_brand, g_brand, b_brand, 220), width=4)

    # Initials or short name
    words = ch['name'].split()
    if len(words) == 1:
        initials = words[0][:5].upper()
    else:
        initials = "".join([w[0] for w in words[:4]]).upper()

    bbox = draw.textbbox((0, 0), initials, font=font_emblem)
    w_text = bbox[2] - bbox[0]
    h_text = bbox[3] - bbox[1]
    x_pos = (360 - w_text) // 2
    y_pos = (360 - h_text) // 2 - 10
    draw.text((x_pos, y_pos), initials, font=font_emblem, fill=(255, 255, 255, 255))

    img.save(local_path, format='PNG')
    return img

def render_poster(cid, ch, logo_img, brand_hex):
    out_path = f"public/tv-posters/{cid}.png"
    width, height = 600, 900
    base = Image.new('RGBA', (width, height), (10, 13, 20, 255))
    draw = ImageDraw.Draw(base)

    r_brand, g_brand, b_brand = hex_to_rgb(brand_hex)

    # Vertical gradient
    for y in range(height):
        ratio = y / height
        r = int(r_brand * 0.24 * (1 - ratio) + 8 * ratio)
        g = int(g_brand * 0.24 * (1 - ratio) + 10 * ratio)
        b = int(b_brand * 0.24 * (1 - ratio) + 16 * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Glow behind logo card
    glow_size = 460
    glow = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for r in range(glow_size // 2, 0, -8):
        alpha = int(45 * (r / (glow_size // 2)))
        glow_draw.ellipse(
            (glow_size // 2 - r, glow_size // 2 - r, glow_size // 2 + r, glow_size // 2 + r),
            fill=(r_brand, g_brand, b_brand, alpha)
        )
    glow = glow.filter(ImageFilter.GaussianBlur(35))
    base.alpha_composite(glow, (width // 2 - glow_size // 2, 380 - glow_size // 2))

    # Badges
    draw = ImageDraw.Draw(base)
    # ÉLŐ TV pill badge
    draw.rounded_rectangle([(40, 40), (160, 80)], radius=20, fill=(230, 20, 40, 240))
    draw.ellipse([(55, 55), (65, 65)], fill=(255, 255, 255, 255))
    draw.text((75, 49), "ÉLŐ TV", font=font_pill, fill=(255, 255, 255, 255))

    # Resolution badge
    draw.rounded_rectangle([(440, 40), (560, 80)], radius=20, fill=(20, 25, 35, 220), outline=(255, 255, 255, 60), width=1)
    draw.text((462, 50), "1080p", font=font_pill, fill=(160, 240, 160, 255))

    # Center Logo Card
    card_w, card_h = 480, 320
    card_x, card_y = (width - card_w) // 2, 230
    draw.rounded_rectangle(
        [(card_x, card_y), (card_x + card_w, card_y + card_h)],
        radius=28,
        fill=(14, 18, 28, 220),
        outline=(r_brand, g_brand, b_brand, 180),
        width=2
    )

    # Scale logo
    max_w, max_h = 420, 250
    logo_w, logo_h = logo_img.size
    scale = min(max_w / max_w if logo_w <= 0 else max_w / logo_w, max_h / max_h if logo_h <= 0 else max_h / logo_h)
    new_w = max(1, int(logo_w * scale))
    new_h = max(1, int(logo_h * scale))
    logo_resized = logo_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

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

    ch_name = ch['name']
    bbox = draw.textbbox((0, 0), ch_name, font=font_name)
    name_w = bbox[2] - bbox[0]
    name_x = (width - name_w) // 2
    draw.text((name_x, pill_y + 25), ch_name, font=font_name, fill=(255, 255, 255, 255))

    sub_text = "HLS Élő Adás • Magyar Nyelven"
    bbox_sub = draw.textbbox((0, 0), sub_text, font=font_sub)
    sub_w = bbox_sub[2] - bbox_sub[0]
    sub_x = (width - sub_w) // 2
    draw.text((sub_x, pill_y + 80), sub_text, font=font_sub, fill=(180, 190, 205, 255))

    base.save(out_path, format='PNG', optimize=True)

def render_background(cid, ch, logo_img, brand_hex):
    out_path = f"public/tv-backgrounds/{cid}.png"
    width, height = 1280, 720
    base = Image.new('RGBA', (width, height), (8, 10, 16, 255))
    draw = ImageDraw.Draw(base)

    r_brand, g_brand, b_brand = hex_to_rgb(brand_hex)

    # Ambient radial gradient
    for y in range(height):
        ratio_y = y / height
        for x in range(0, width, 4):
            ratio_x = x / width
            dist = ((ratio_x - 0.7)**2 + (ratio_y - 0.4)**2)**0.5
            factor = max(0, 1 - dist * 1.5)
            r = int(r_brand * 0.18 * factor + 6)
            g = int(g_brand * 0.18 * factor + 8)
            b = int(b_brand * 0.18 * factor + 12)
            draw.rectangle([(x, y), (x+4, y+1)], fill=(r, g, b, 255))

    # Glow card on right side
    card_w, card_h = 360, 240
    card_x, card_y = 800, (height - card_h) // 2
    draw.rounded_rectangle(
        [(card_x, card_y), (card_x + card_w, card_y + card_h)],
        radius=24,
        fill=(14, 18, 28, 200),
        outline=(r_brand, g_brand, b_brand, 140),
        width=2
    )

    max_w, max_h = 300, 180
    logo_w, logo_h = logo_img.size
    scale = min(max_w / max_w if logo_w <= 0 else max_w / logo_w, max_h / max_h if logo_h <= 0 else max_h / logo_h)
    new_w = max(1, int(logo_w * scale))
    new_h = max(1, int(logo_h * scale))
    logo_resized = logo_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    paste_x = card_x + (card_w - new_w) // 2
    paste_y = card_y + (card_h - new_h) // 2
    base.alpha_composite(logo_resized, (paste_x, paste_y))

    # Left side info
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle([(100, 240), (220, 280)], radius=20, fill=(230, 20, 40, 240))
    draw.ellipse([(115, 255), (125, 265)], fill=(255, 255, 255, 255))
    draw.text((135, 249), "ÉLŐ TV", font=font_pill, fill=(255, 255, 255, 255))

    ch_name = ch['name']
    draw.text((100, 310), ch_name, font=font_bg_title, fill=(255, 255, 255, 255))
    draw.text((100, 385), ch.get('description', 'Közvetlen HLS élő adás'), font=font_bg_sub, fill=(180, 190, 205, 255))

    base.save(out_path, format='PNG', optimize=True)

# Load ALL_CHANNELS from onlinestream.js
import re
with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

m_ch = re.search(r'const ALL_CHANNELS = (\[[\s\S]*?\]);\r?\n\r?\nconst CHANNELS_BY_ID', js_text)
if not m_ch:
    print('Failed to find ALL_CHANNELS')
    exit(1)

channels = json.loads(m_ch.group(1))

# Process missing channels
count = 0
for ch in channels:
    cid = str(ch['channelId'])
    p_path = f"public/tv-posters/{cid}.png"
    l_path = f"public/tv-logos/{cid}.png"
    b_path = f"public/tv-backgrounds/{cid}.png"

    if os.path.exists(p_path) and os.path.exists(l_path) and os.path.exists(b_path):
        continue

    print(f"Generating artwork for {ch['name']} ({cid})...")
    logo = get_channel_logo(cid, ch)
    brand_hex = BRAND_COLORS.get(cid, CATEGORY_DEFAULT_COLORS.get(ch.get('category'), '#00d2d3'))
    render_poster(cid, ch, logo, brand_hex)
    render_background(cid, ch, logo, brand_hex)
    count += 1

print(f"Successfully generated artwork for {count} channels!")
