import json
import os
import io
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

CHANNEL_COLORS = {
    '6141': '#ff2244', # RTL
    '6143': '#00a8ff', # TV2
    '5901': '#00b894', # M1
    '5905': '#0984e3', # Duna
    '6723': '#e84118', # Super TV2
    '6142': '#ff4757', # RTL Kettő
    '6147': '#ff6b81', # RTL Három
    '5911': '#00d2d3', # Viasat 3
    '4739': '#c0392b', # ATV
    '4740': '#b71540', # Hír TV
    '6704': '#ff9f43', # Prime
    '6184': '#3867d6', # TV4
    '6236': '#0abde3', # Viasat 6
    '6148': '#e1b12c', # RTL Gold
    '5902': '#ff9f43', # M2
    '5906': '#2980b9', # Duna World
    '5904': '#9b59b6', # M5
    '5931': '#718093', # M3
    '8716': '#a55eea', # Viasat 2
    '5855': '#0652dd', # Euronews

    # Film
    '6150': '#e84118', # Film+
    '6152': '#8854d0', # Mozi+
    '6146': '#00cec9', # Cool TV
    '6652': '#f39c12', # AMC
    '6720': '#4b6584', # Moziverzum
    '7069': '#575fcf', # HBO
    '7158': '#3867d6', # HBO 2
    '7159': '#4b7bec', # HBO 3
    '6254': '#e056fd', # Film4
    '7060': '#f0932b', # TV2 Comedy
    '6149': '#eb4d4b', # Sorozat+
    '7074': '#686de0', # Film Café
    '7154': '#130f40', # AXN
    '7422': '#30336b', # Galaxy 4
    '8714': '#535c68', # Max4
    '6163': '#e056fd', # Izaura TV
    '6701': '#f9ca24', # Jocky TV
    '8489': '#be2edd', # Magyar Mozi TV

    # Doksi
    '5936': '#f1c40f', # Nat Geo
    '7325': '#e67e22', # History
    '6749': '#2ecc71', # Spektrum
    '5937': '#f39c12', # Nat Geo Wild
    '6589': '#27ae60', # Spektrum Home
    '8124': '#34495e', # Ozone TV

    # Sport
    '5903': '#00b894', # M4 Sport
    '6721': '#d63031', # Spíler 1
    '6722': '#c0392b', # Spíler 2
    '6718': '#2ed573', # Sport 1
    '6719': '#26af5f', # Sport 2
    '7084': '#ff9f43', # Arena4
    '8271': '#ee5253', # Match 4
    '6748': '#e74c3c', # TV Paprika
    '6751': '#e84393', # TLC
    '7087': '#e67e22', # TV2 Séf
    '6159': '#ff793f', # Sláger TV
    '6151': '#ff5252', # Muzsika TV
    '6162': '#34ace0', # Zenebutik
    '6603': '#ff5252', # Life TV
    '6455': '#ff79ac', # FEM3

    # Gyerek
    '7079': '#ff78e3', # Minimax
    '6764': '#ff9f43', # Nickelodeon
    '6767': '#74b9ff', # Disney
    '6765': '#2ecc71', # Nick Jr
    '6705': '#ff5252', # Nicktoons
    '6707': '#fab1a0', # TV2 Kids
    '7080': '#ffeaa7'  # JimJam
}

DEFAULT_PALETTE = {
    'hu-live-orszagos': '#ff4757',
    'hu-live-film': '#a55eea',
    'hu-live-doksi': '#ffbe76',
    'hu-live-sport': '#2ed573',
    'hu-live-gyerek': '#ff78e3',
    'hu-live-helyi': '#00d2d3'
}

# Ensure output directories exist
os.makedirs('public/tv-logos', exist_ok=True)
os.makedirs('public/tv-posters', exist_ok=True)
os.makedirs('public/tv-backgrounds', exist_ok=True)

import re

with open('src/scrapers/onlinestream.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

m_ch = re.search(r'const ALL_CHANNELS = (\[.*?\]);\s*\n(?:const CHANNELS_BY_ID|module\.exports|async function|function )', js_text, re.DOTALL)
channels = json.loads(m_ch.group(1))
channels_by_id = {str(c['channelId']): c for c in channels}

m_vh = re.search(r'const VERIFIED_CHANNEL_HEIGHTS = (\{.*?\});\s*\n', js_text, re.DOTALL)
verified_heights = json.loads(m_vh.group(1)) if m_vh else {}

with open('scripts/explicit_logos_map.json', 'r', encoding='utf-8') as f:
    explicit_logos = json.load(f)

try:
    font_pill = ImageFont.truetype("arialbd.ttf", 18)
    font_name = ImageFont.truetype("arialbd.ttf", 36)
    font_sub = ImageFont.truetype("arial.ttf", 20)
    font_bg_title = ImageFont.truetype("arialbd.ttf", 54)
    font_bg_sub = ImageFont.truetype("arial.ttf", 24)
except:
    font_pill = ImageFont.load_default()
    font_name = font_pill
    font_sub = font_pill
    font_bg_title = font_pill
    font_bg_sub = font_pill

def get_channel_logo(cid, ch):
    # 1. Local cached logo file
    local_path = f"public/tv-logos/{cid}.png"
    if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
        try:
            return Image.open(local_path).convert('RGBA')
        except:
            pass

    # 2. Explicit logo URL
    logo_url = explicit_logos.get(cid)
    
    # 3. Fallback to onlinestream logo URL
    if not logo_url:
        logo_url = ch.get('logo') or f"https://onlinestream.live/logos/s{cid}.png"

    # Try downloading
    for attempt in range(2):
        try:
            req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read()
                img = Image.open(io.BytesIO(data)).convert('RGBA')
                img.save(local_path, format='PNG')
                return img
        except Exception as e:
            if attempt == 0 and logo_url != f"https://onlinestream.live/logos/s{cid}.png":
                logo_url = f"https://onlinestream.live/logos/s{cid}.png"
            else:
                break

    # If completely failed, generate clean text emblem
    img = Image.new('RGBA', (300, 300), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    initials = "".join([w[0] for w in ch['name'].split()[:3]]).upper()
    draw.rounded_rectangle([(10, 10), (290, 290)], radius=40, fill=(30, 35, 45, 230), outline=(255, 255, 255, 60), width=3)
    draw.text((80, 110), initials, font=font_name, fill=(255, 255, 255, 255))
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

    # Resolution badge based on verified ground-truth
    h_val = verified_heights.get(str(cid), 1080)
    draw.rounded_rectangle([(440, 40), (560, 80)], radius=20, fill=(20, 25, 35, 220), outline=(255, 255, 255, 60), width=1)
    if h_val >= 1080:
        draw.text((462, 50), "1080p", font=font_pill, fill=(160, 240, 160, 255))
    elif h_val >= 720:
        draw.text((468, 50), "720p", font=font_pill, fill=(120, 220, 255, 255))
    elif h_val >= 480:
        draw.text((480, 50), "SD", font=font_pill, fill=(255, 215, 0, 255))
    else:
        draw.text((472, 50), "ÉLŐ", font=font_pill, fill=(200, 200, 200, 255))

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

    # Horizontal ambient gradient
    for x in range(width):
        ratio = x / width
        r = int(r_brand * 0.18 * ratio + 8 * (1 - ratio))
        g = int(g_brand * 0.18 * ratio + 10 * (1 - ratio))
        b = int(b_brand * 0.18 * ratio + 16 * (1 - ratio))
        draw.line([(x, 0), (x, height)], fill=(r, g, b, 255))

    # Glow right
    glow_size = 500
    glow = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for r in range(glow_size // 2, 0, -8):
        alpha = int(35 * (r / (glow_size // 2)))
        glow_draw.ellipse(
            (glow_size // 2 - r, glow_size // 2 - r, glow_size // 2 + r, glow_size // 2 + r),
            fill=(r_brand, g_brand, b_brand, alpha)
        )
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    base.alpha_composite(glow, (920 - glow_size // 2, 360 - glow_size // 2))

    # Left content: Badges & Name
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle([(80, 80), (200, 120)], radius=20, fill=(230, 20, 40, 240))
    draw.ellipse([(95, 95), (105, 105)], fill=(255, 255, 255, 255))
    draw.text((115, 89), "ÉLŐ TV", font=font_pill, fill=(255, 255, 255, 255))

    h_val = verified_heights.get(str(cid), 1080)
    draw.rounded_rectangle([(220, 80), (340, 120)], radius=20, fill=(20, 25, 35, 220), outline=(255, 255, 255, 60), width=1)
    if h_val >= 1080:
        draw.text((242, 90), "1080p FHD", font=font_pill, fill=(160, 240, 160, 255))
    elif h_val >= 720:
        draw.text((246, 90), "720p HD", font=font_pill, fill=(120, 220, 255, 255))
    elif h_val >= 480:
        draw.text((254, 90), "576p SD", font=font_pill, fill=(255, 215, 0, 255))
    else:
        draw.text((254, 90), "ÉLŐ TV", font=font_pill, fill=(200, 200, 200, 255))

    draw.text((80, 200), ch['name'], font=font_bg_title, fill=(255, 255, 255, 255))
    draw.text((80, 280), "Valós idejű HLS élő televíziós adás Nuvio & Stremio alatt.", font=font_bg_sub, fill=(180, 190, 205, 255))

    # Right Logo Card
    card_w, card_h = 440, 300
    card_x, card_y = 740, 210
    draw.rounded_rectangle(
        [(card_x, card_y), (card_x + card_w, card_y + card_h)],
        radius=28,
        fill=(14, 18, 28, 220),
        outline=(r_brand, g_brand, b_brand, 180),
        width=2
    )

    max_w, max_h = 380, 240
    logo_w, logo_h = logo_img.size
    scale = min(max_w / max_w if logo_w <= 0 else max_w / logo_w, max_h / max_h if logo_h <= 0 else max_h / logo_h)
    new_w = max(1, int(logo_w * scale))
    new_h = max(1, int(logo_h * scale))
    logo_resized = logo_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    paste_x = card_x + (card_w - new_w) // 2
    paste_y = card_y + (card_h - new_h) // 2
    base.alpha_composite(logo_resized, (paste_x, paste_y))

    base.save(out_path, format='PNG', optimize=True)

print("Starting generation of 146 channel PNG artworks (Posters & Backgrounds)...")
count = 0
for cid, ch in channels_by_id.items():
    brand_hex = CHANNEL_COLORS.get(cid) or DEFAULT_PALETTE.get(ch.get('category'), '#00d2d3')
    logo = get_channel_logo(cid, ch)
    render_poster(cid, ch, logo, brand_hex)
    render_background(cid, ch, logo, brand_hex)
    count += 1
    if count % 20 == 0:
        print(f"  Processed {count} / {len(channels_by_id)} channels...")

print(f"Done! Generated high-res PNG posters and backgrounds for all {count} channels.")
