#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Generate on-screen-keyboard key data from XKB, so nobody hand-writes it.

The dashboard used to carry hand-authored key tables, which is how the Full
layout ended up with no `|` (the backslash was authored as an action key, so
shift never transformed it) and how `keyToCode()` came to cover only a-z/0-9,
making punctuation inject without a physical `code`. This script is the one
authoritative producer of that data, for two consumers:

  * the committed bundle module (`--format ts`), holding the US reference:
    every physical `code` with its base/shift/altgr characters, plus the
    character -> code index the injector needs;
  * the image-served static asset (`--format json`), holding the image's
    default layout, which the Dockerfile stage bakes to
    `/usr/share/selkies/web/osk/keymap.json`.

Both use the same walk, so a build-time and a run-time dump can never drift.

Position aliases come from the distro's own keycodes file, never from memory:
`<AE01>` is the number row's first key, `<AD01>` the qwerty row's, and so on.
Each alias is then asserted against the compiled layout's base character, so a
mis-mapped alias fails loudly instead of shifting the whole key face by one.

Run it where xkeyboard-config data lives (the webtop image, not this repo's dev
jail):

    sudo -n podman-remote exec -i webtop python3 - us --format ts \\
        < third_party/selkies/scripts/gen-osk-keymap.py \\
        > third_party/selkies/addons/selkies-dashboard/src/keyboard/gen-keymap.ts

    sudo -n podman-remote exec -i webtop python3 - "${SELKIES_XKB_LAYOUT:-us}" \\
        --format json --source image-default < third_party/selkies/scripts/gen-osk-keymap.py

Exit is non-zero when an alias cannot be resolved or an assertion fails.
"""

import ctypes
import json
import re
import sys
import unicodedata

KEYCODES_FILE = "/usr/share/X11/xkb/keycodes/evdev"
MAX_KEYCODE = 135  # pc105 lives well below this; walking to the X server's
                   # 700-key upper bound would triple the cost for nothing.

# XKB position alias -> UI Events `code`. Row patterns are documented in
# xkeyboard-config and verified against the image's own compiled us keymap:
# AE = number row, AD = qwerty row, AC = home row, AB = bottom row, indexes run
# left to right. Only character-producing keys belong here; Enter, Tab,
# Backspace and the modifiers are layout-independent and stay action keys in
# layouts.ts.
ALIAS_CODE = {
    "TLDE": "Backquote",
    "BKSL": "Backslash",
}
# Aliases whose names are regular enough to generate: the letter rows keep
# their left-to-right order, so the index alone picks the DOM code. Lengths are
# the real pc105 row lengths (AC ends at Quote, AB ends at Slash).
ROW_CODES = {
    "AE": ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",
           "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    "AD": ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI",
           "KeyO", "KeyP", "BracketLeft", "BracketRight"],
    "AC": ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK",
           "KeyL", "Semicolon", "Quote"],
    "AB": ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM",
           "Comma", "Period", "Slash"],
}
# The ISO extra key (`<LSGT>`, which XKB binds to '<' and '>') is deliberately
# absent: every layout in layouts.ts draws an ANSI topology, so a table entry
# for a key the keyboard never shows would only let a palette tap resolve to a
# position that does not exist on screen. Add it back when an ISO layout lands.
# What a US layout must put on each key, base and shifted. This is the
# assertion set: it is a property of the US layout, not of our geometry, and it
# is what catches a wrong alias mapping. Only the character-producing keys.
US_EXPECT = {
    "Backquote": ("`", "~"), "Digit1": ("1", "!"), "Digit2": ("2", "@"),
    "Digit3": ("3", "#"), "Digit4": ("4", "$"), "Digit5": ("5", "%"),
    "Digit6": ("6", "^"), "Digit7": ("7", "&"), "Digit8": ("8", "*"),
    "Digit9": ("9", "("), "Digit0": ("0", ")"), "Minus": ("-", "_"),
    "Equal": ("=", "+"), "BracketLeft": ("[", "{"), "BracketRight": ("]", "}"),
    "Backslash": ("\\", "|"), "Semicolon": (";", ":"), "Quote": ("'", '"'),
    "Comma": (",", "<"), "Period": (".", ">"), "Slash": ("/", "?"),
    "Space": (" ", " "),
}
for _c in "abcdefghijklmnopqrstuvwxyz":
    US_EXPECT["Key" + _c.upper()] = (_c, _c.upper())

CONTROL_BLOCK = 0x20  # below this, and in DEL..0x9F, a keysym is not a glyph.


def _load_xkbcommon():
    """Bind the handful of libxkbcommon entry points this script needs.

    Mirrors the bindings in selkies' input handler, including the older
    `xkb_rule_names` shape that has no leading `name` field.
    """
    lib = ctypes.CDLL("libxkbcommon.so.0")
    lib.xkb_context_new.restype = ctypes.c_void_p
    lib.xkb_keymap_new_from_names.restype = ctypes.c_void_p
    lib.xkb_keymap_new_from_names.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
    lib.xkb_keymap_min_keycode.restype = ctypes.c_uint32
    lib.xkb_keymap_min_keycode.argtypes = [ctypes.c_void_p]
    lib.xkb_keymap_max_keycode.restype = ctypes.c_uint32
    lib.xkb_keymap_max_keycode.argtypes = [ctypes.c_void_p]
    lib.xkb_keymap_num_levels_for_key.restype = ctypes.c_uint32
    lib.xkb_keymap_num_levels_for_key.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32]
    lib.xkb_keymap_key_get_syms_by_level.restype = ctypes.c_int
    lib.xkb_keymap_key_get_syms_by_level.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_uint32,
        ctypes.POINTER(ctypes.POINTER(ctypes.c_uint32))]
    lib.xkb_keymap_unref.argtypes = [ctypes.c_void_p]
    lib.xkb_keysym_to_utf8.restype = ctypes.c_int
    lib.xkb_keysym_to_utf8.argtypes = [ctypes.c_uint32, ctypes.c_char_p, ctypes.c_size_t]
    return lib


def _parse_keycodes(path):
    """alias -> X keycode, straight out of the distro's own file."""
    try:
        text = open(path, "r", encoding="utf-8", errors="replace").read()
    except OSError as err:
        raise SystemExit(f"cannot read {path}: {err}")
    pairs = re.findall(r"<([A-Za-z0-9_]+)>\s*=\s*(\d+)", text)
    if not pairs:
        raise SystemExit(f"no keycode aliases found in {path}")
    return {alias: int(num) for alias, num in pairs}


def _printable(lib, keysym):
    """The glyph a keysym draws, or '' when it should not appear on a key cap.

    Three things have to be dropped, each found by scanning this image's real
    layouts rather than assumed:

      * control characters — XKB's <TAB> dumps as "\\t", so a keysym can be a
        control code while still converting cleanly to UTF-8;
      * format characters (Unicode category Cf) — Hebrew AltGr yields U+200E
        and U+200F, invisible marks that would be a blank, unexplainable key;
      * arrows — AltGr+U/I/O/P is a long-standing XKB arrow-key hack, and a
        navigation function is not a character the keyboard should send as text.

    Everything else stays, including typographic punctuation: German AltGr+
    backslash really does type a right single quote, and hiding that would make
    the key face wrong in the other direction.
    """
    if not keysym:
        return ""
    buf = ctypes.create_string_buffer(8)
    if lib.xkb_keysym_to_utf8(keysym, buf, 8) <= 0:
        return ""
    try:
        ch = buf.value.decode("utf-8")
    except UnicodeDecodeError:
        return ""
    if not ch:
        return ""
    cp = ord(ch[0])
    if cp < 0x20 or 0x7F <= cp <= 0x9F:  # control
        return ""
    if 0xE000 <= cp <= 0xF8FF:  # private use
        return ""
    if 0x2190 <= cp <= 0x21FF:  # arrows: navigation, not text
        return ""
    if unicodedata.category(ch[0]) == "Cf":  # invisible formatting marks
        return ""
    return ch


def _levels(lib, keymap, keycode):
    """base/shift/altgr glyphs for one keycode, '' where the layer is empty."""
    out = ["", "", ""]
    count = min(3, lib.xkb_keymap_num_levels_for_key(keymap, keycode, 0) or 0)
    syms = ctypes.POINTER(ctypes.c_uint32)()
    for level in range(count):
        n = lib.xkb_keymap_key_get_syms_by_level(keymap, keycode, 0, level, ctypes.byref(syms))
        if n <= 0:
            continue
        glyph = _printable(lib, syms[0])
        if glyph:
            out[level] = glyph
    return out


def build(layout):
    """`code -> [base, shift, altgr]` for one layout, plus assertion results."""
    lib = _load_xkbcommon()
    ctx = lib.xkb_context_new(0)
    if not ctx:
        raise SystemExit("xkb_context_new failed")
    keycodes = _parse_keycodes(KEYCODES_FILE)

    wanted = dict(ALIAS_CODE)
    for row, codes in ROW_CODES.items():
        for index, code in enumerate(codes, start=1):
            wanted[f"{row}{index:02d}"] = code

    class Names(ctypes.Structure):
        _fields_ = [("rules", ctypes.c_char_p), ("model", ctypes.c_char_p),
                    ("layout", ctypes.c_char_p), ("variant", ctypes.c_char_p),
                    ("options", ctypes.c_char_p)]

    names = Names(b"evdev", b"pc105", layout.encode("utf-8"), None, None)
    keymap = lib.xkb_keymap_new_from_names(ctx, ctypes.byref(names), 0)
    if not keymap:
        raise SystemExit(f"could not compile layout '{layout}' (rules=evdev model=pc105)")
    try:
        low = lib.xkb_keymap_min_keycode(keymap)
        high = min(lib.xkb_keymap_max_keycode(keymap), MAX_KEYCODE)
        table, missing, failures = {}, [], []
        for alias, code in sorted(wanted.items(), key=lambda kv: keycodes.get(kv[0], 9999)):
            keycode = keycodes.get(alias)
            if not keycode or not (low <= keycode <= high):
                missing.append(f"{alias}->{code}")
                continue
            row = _levels(lib, keymap, keycode)
            if not any(row):
                missing.append(f"{alias}->{code}")
                continue
            table[code] = row
            expect = US_EXPECT.get(code)
            if layout == "us" and expect and row[0] != expect[0]:
                failures.append(f"{code}: XKB base {row[0]!r} != expected {expect[0]!r}")
            if layout == "us" and expect and row[1] != expect[1]:
                failures.append(f"{code}: XKB shift {row[1]!r} != expected {expect[1]!r}")
    finally:
        lib.xkb_keymap_unref(keymap)

    if failures:
        raise SystemExit("keymap assertion failed:\n  " + "\n  ".join(failures))
    if missing and layout == "us":
        # Every alias here is a core character key; on a us map there is no
        # legitimate reason for one to be absent, so treat it as a bug.
        raise SystemExit("unresolved aliases on a us keymap: " + ", ".join(missing))
    return table, missing


def char_index(table):
    """character -> `code`, base first so a shift glyph never steals its key."""
    index = {}
    for code, row in table.items():
        if row[0] and row[0] not in index:
            index[row[0]] = code
    for code, row in table.items():
        if row[1] and row[1] not in index:
            index[row[1]] = code
    return index


def emit_ts(table, chars, layout, source):
    """A committed dashboard module: never edit by hand, regenerate instead."""
    body = {
        "layout": layout,
        "source": source,
        "codes": {code: row for code, row in sorted(table.items())},
        "charToCode": {ch: code for ch, code in sorted(chars.items(), key=lambda kv: kv[1])},
    }
    payload = json.dumps(body, ensure_ascii=False, sort_keys=True, indent=2)
    return (
        "/*\n"
        " * This Source Code Form is subject to the terms of the Mozilla Public\n"
        " * License, v. 2.0. If a copy of the MPL was not distributed with this\n"
        " * file, You can obtain one at https://mozilla.org/MPL/2.0/.\n"
        " */\n"
        "\n"
        "/**\n"
        " * GENERATED FILE - DO NOT EDIT BY HAND.\n"
        " *\n"
        " * Produced by scripts/gen-osk-keymap.py from this image's XKB data, so the\n"
        " * keyboard's key face can never drift from what the container really maps.\n"
        " * Regenerate with the command line documented in that script; the layout,\n"
        " * geometry and widths still live in layouts.ts, which is hand-authored.\n"
        " *\n"
        " * `codes` maps a UI Events `code` to its [base, shift, altgr] glyphs.\n"
        " * `charToCode` is the reverse index the injector uses to send a real\n"
        " * physical key for punctuation, which hand-written tables never covered.\n"
        " */\n"
        "\n"
        "/** One physical key's glyphs, per shift level; '' means no glyph there. */\n"
        "export type KeyLevels = readonly [string, string, string];\n"
        "\n"
        f"const DATA = {payload} as const;\n"
        "\n"
        "/** The layout this module was generated from. */\n"
        "export const GEN_LAYOUT: string = DATA.layout;\n"
        "\n"
        "/** code -> [base, shift, altgr], from XKB. */\n"
        "export const GEN_CODES: Record<string, KeyLevels> = DATA.codes;\n"
        "\n"
        "/** character -> code, base level winning over the shifted one. */\n"
        "export const GEN_CHAR_TO_CODE: Record<string, string> = DATA.charToCode;\n"
        "\n"
        "/**\n"
        " * The glyph a physical key draws for a given shift state, or undefined\n"
        " * when this table has nothing to say about that key.\n"
        " */\n"
        "export function genGlyph(code: string | undefined, shift: boolean, altGr: boolean): string | undefined {\n"
        "  if (!code) return undefined;\n"
        "  const row = GEN_CODES[code];\n"
        "  if (!row) return undefined;\n"
        "  const glyph = row[altGr ? 2 : shift ? 1 : 0];\n"
        "  return glyph || undefined;\n"
        "}\n"
    )


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    flags = [a for a in argv[1:] if a.startswith("--")]
    layout = args[0] if args else "us"
    fmt = "ts"
    source = "image-default"
    for flag in flags:
        if flag.startswith("--format="):
            fmt = flag.split("=", 1)[1]
        elif flag.startswith("--source="):
            source = flag.split("=", 1)[1]
    if "--format" in flags or "--source" in flags:  # space-separated form
        rest = " ".join(flags)
        m = re.search(r"--format[= ](\w+)", rest)
        if m:
            fmt = m.group(1)
        m = re.search(r"--source[= ]([\w-]+)", rest)
        if m:
            source = m.group(1)

    table, missing = build(layout)
    chars = char_index(table)
    if fmt == "json":
        print(json.dumps({"v": 1, "layout": layout, "source": source,
                          "gen": 0, "codes": table, "charToCode": chars},
                         ensure_ascii=False, sort_keys=True, indent=None))
    elif fmt == "ts":
        sys.stdout.write(emit_ts(table, chars, layout, source))
    else:
        raise SystemExit(f"unknown --format {fmt}")
    print(f"# generated from layout={layout}: {len(table)} codes, {len(chars)} chars, "
          f"skipped={len(missing)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv)
