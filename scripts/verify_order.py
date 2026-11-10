import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
scratch_path = r"C:\Users\Playe\.gemini\antigravity\brain\79aee8d7-ef25-401f-8944-a66a1bd7020d\scratch\onlinestream_channels.json"

with open(scratch_path, "r", encoding="utf-8") as f:
    d = json.load(f)

channels = d["channels"]
channels_by_id = {c["id"]: c for c in channels}

# Define ordered channel IDs per category
ORDERED_CATEGORIES = {
    "hu-live-orszagos": {
        "name": "🔴 Élő TV: Országos & Kereskedelmi",
        "description": "Országos kereskedelmi és közszolgálati televíziók nézettség szerint: RTL, TV2, M1, Duna, Super TV2, ATV, stb.",
        "ids": [
            "6141", # RTL
            "6143", # TV2
            "5901", # M1
            "5905", # Duna
            "6723", # Super TV2
            "6142", # RTL Kettő
            "6147", # RTL Három
            "5911", # Viasat 3
            "4739", # ATV
            "4740", # Hír TV
            "6704", # Prime
            "6184", # TV4
            "6236", # Viasat 6
            "6148", # RTL Gold
            "5902", # M2 / Petőfi TV
            "5906", # Duna World / M4 Sport+
            "5904", # M5
            "5931", # M3
            "8716", # Viasat 2
            "5855", # Euronews
            "4695", # Pannon RTV
            "9073", # RTV-1 Vajdaság
            "8999", # RTV-2 Vajdaság
            "1819", # Budapest Európa Televízió
            "6554", # Trimedio TV
            "4798", # EWTN
            "5927", # Apostol TV
            "5907"  # Közmédia időszakos közvetítések
        ]
    },
    "hu-live-film": {
        "name": "🎬 Élő TV: Film & Sorozat",
        "description": "Prémium mozifilmes és sorozatcsatornák népszerűségi sorrendben: Film+, Mozi+, Cool TV, AMC, Moziverzum, HBO 1-3, stb.",
        "ids": [
            "6150", # Film+
            "6152", # Mozi+
            "6146", # Cool TV
            "6652", # AMC
            "6720", # Moziverzum
            "7069", # HBO
            "7158", # HBO2
            "7159", # HBO3
            "6254", # Film4
            "7060", # TV2 Comedy
            "6149", # Sorozat+
            "7074", # Film Café
            "7154", # AXN Black
            "7422", # Galaxy 4
            "8714", # Max4
            "6163", # Izaura TV
            "6701", # Jocky TV
            "8489", # Magyar Mozi TV
            "9310", # Moziklub
            "9312", # Sorozatklub
            "9745"  # Classics TV Magyarország
        ]
    },
    "hu-live-doksi": {
        "name": "🌍 Élő TV: Ismeretterjesztő & Doksi",
        "description": "Természetfilmek, történelem, tudomány és dokumentumfilmek népszerűségi sorrendben: Nat Geo, History, Spektrum, stb.",
        "ids": [
            "5936", # National Geographic
            "7325", # History
            "6749", # Spektrum
            "5937", # National Geographic Wild
            "6589", # Spektrum Home
            "8124"  # Ozone TV
        ]
    },
    "hu-live-sport": {
        "name": "⚽ Élő TV: Sport, Zene & Életmód",
        "description": "Élő sportközvetítések, zene és életmód népszerűségi sorrendben: M4 Sport, Spíler 1-2, Sport 1-2, Arena4, TV Paprika, stb.",
        "ids": [
            "5903", # M4 Sport
            "6721", # Spíler 1
            "6722", # Spíler 2
            "6718", # Sport 1
            "6719", # Sport 2
            "7084", # Arena4
            "8271", # Match 4
            "6748", # TV Paprika
            "6751", # TLC
            "7087", # TV2 Séf
            "6159", # Sláger TV
            "6151", # Muzsika TV
            "6162", # Zenebutik
            "6603", # Life TV
            "6455", # FEM3
            "9311", # RTL Otthon
            "5939", # Lóverseny közvetítés
            "9608", # Bunyó TV
            "9787"  # TCL
        ]
    },
    "hu-live-gyerek": {
        "name": "🧸 Élő TV: Rajzfilm & Gyerek",
        "description": "Rajzfilmek, animációk és ifjúsági műsorok népszerűségi sorrendben: Minimax, Nickelodeon, Disney Channel, stb.",
        "ids": [
            "7079", # Minimax
            "6764", # Nickelodeon
            "6767", # Disney Channel
            "6765", # Nick Jr
            "6705", # Nicktoons
            "6707", # TV2 Kids
            "7080", # JimJam
            "9309"  # Kölyökklub
        ]
    },
    "hu-live-helyi": {
        "name": "📍 Élő TV: Helyi & Városi TV-k",
        "description": "Magyar városok és térségek helyi televíziói fontossági sorrendben: Debrecen, Sopron, Tisza TV, Fehérvár, Nyíregyháza, stb.",
        "ids": [
            # Nagyvárosok és legismertebbek elöl
            "4247", # Debrecen Televízió
            "1835", # Tisza TV
            "5982", # Sopron TV
            "1815", # Fehérvár TV
            "1853", # Nyíregyházi Televízió
            "1901", # Kecskeméti Televízió
            "1827", # Szombathelyi Televízió
            "1829", # Zalaegerszegi Televízió
            "5137", # Kapos TV
            "1035", # TV Eger
            "4788", # Szolnok TV
            "1821", # Gyöngyösi TV
            "5425", # 7.tv
            "3858", # Bajai TV
            "1811", # Kanizsa TV
            "1812", # TV Keszthely
            "5443", # TV2040 - Minden, ami Budaörs
            "4590", # Komáromi Televízió
            "4650", # Móri Városi TV
            "4653", # Orosházi Városi Televízió
            "4662", # Karcag TV
            "4699", # Halom TV
            "4738", # Ózdi Városi Televízió
            "4782", # Williams TV
            "4792", # XVTV
            "4794", # Jászsági Térségi TV
            "5026", # Líceum TV
            "5317", # Makó TV
            "5462", # TV13
            "5594", # K23TV
            "5656", # Vásárhelyi Televízió
            "5838", # TelePaks
            "5913", # Balaton TV
            "6144", # ESTV - A térség televíziója
            "6283", # Pilis TV
            "6294", # Globo TV
            "6328", # Mezőkövesdi Televízió
            "6356", # 16tv Budapest
            "6358", # Pannon Televízió
            "6411", # DSTV
            "6491", # Alföld TV
            "6495", # Komlós TV
            "6627", # RégióPlusz TV
            "6638", # Oroszlányi Városi Televízió
            "6670", # Szarvasi Televízió
            "6675", # Daru TV
            "6676", # Móra-Net TV - A térség televíziója
            "6677", # Kiskőrös TV
            "6744", # Völgyhíd TV
            "6790", # Berente TV
            "7371", # Bicskei Városi Televízió
            "7374", # Hévízi TV
            "8586", # Soltvadkerti Televízió
            "9068", # Sixo TV
            "9081", # Gran TV - Esztergom és térsége televíziója
            "9332", # Cegléd Városi TV
            "9711", # TaviTV
            "9713", # Tolnatáj Televízió
            "1802", # City TV
            "9727", # CAMUGO Channel 2
            "9654", # Pasaréti Ferencesek
            "8975", # Plébánia TV - Szentmise közvetítése az Országúti Ferences Plébániáról
            "9665", # ÚjSzövetség Gyülekezet
            "9668"  # Debrecen-Nagytemplomi Református Egyházközség
        ]
    }
}

# Verify counts
total_ordered = 0
for cat_id, info in ORDERED_CATEGORIES.items():
    print(f"{cat_id}: {len(info['ids'])} channels")
    total_ordered += len(info['ids'])
    for cid in info['ids']:
        if cid not in channels_by_id:
            print(f"ERROR: {cid} not found in channels_by_id!")

print(f"Total ordered channels: {total_ordered} / {len(channels)}")
