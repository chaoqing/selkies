/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * The on-screen keyboard settings: which keyboard types — the system's IME
 * or the transparent frontend overlay — and, for the overlay, which layout
 * it draws, what the terminal layout carries on its overlay rows, and how
 * visible its keys are against the stream. Choices are kept across reloads
 * in the shared state.
 * @module
 */
import { Field, NativeSelect, SwitchRow } from "@/panels/controls";
import { KEYBOARD_LAYOUTS, KEYBOARD_LAYOUT_IDS } from "@/keyboard/layouts";
import { useDashboard } from "@/state/dashboard";
import { t } from "@/i18n";

/** The keyboard source and the overlay's look, in one section. */
export function OnScreenKeyboardSettings() {
  const d = useDashboard();
  const frontend = d.oskSource === "frontend";
  const supportsToggles = !!KEYBOARD_LAYOUTS[d.oskLayoutId]?.supportsToggles;
  return (
    <>
      <Field htmlFor="oskSourceSelect" label={t("osk.sourceLabel")}>
        <NativeSelect id="oskSourceSelect" value={d.oskSource}
          onValueChange={(value) => d.setOskSource(value as "system" | "frontend")}
          options={[{ value: "system", label: t("osk.sourceSystem") }, { value: "frontend", label: t("osk.sourceFrontend") }]} />
      </Field>
      {frontend && (
        <>
          <Field htmlFor="oskLayoutSelect" label={t("osk.layoutLabel")}>
            <NativeSelect id="oskLayoutSelect" value={d.oskLayoutId}
              onValueChange={d.setOskLayoutId}
              options={KEYBOARD_LAYOUT_IDS.map((id) => ({ value: id, label: KEYBOARD_LAYOUTS[id].name }))} />
          </Field>
          {supportsToggles && (
            <>
              <SwitchRow id="oskStickyModsToggle" label={t("osk.stickyLabel")} title={t("osk.stickyDetails")}
                checked={d.oskStickyMods} onToggle={() => d.setOskStickyMods(!d.oskStickyMods)} />
              <SwitchRow id="oskFnRowToggle" label={t("osk.fnLabel")} checked={d.oskFnRow}
                onToggle={() => d.setOskFnRow(!d.oskFnRow)} />
            </>
          )}
          <Field htmlFor="oskOpacitySelect" label={t("osk.opacityLabel")}>
            <NativeSelect id="oskOpacitySelect" value={d.oskOpacity}
              onValueChange={d.setOskOpacity}
              options={["transparent", "medium", "solid"].map((tier) => ({ value: tier, label: t(`osk.opacity${tier[0].toUpperCase()}${tier.slice(1)}`) }))} />
          </Field>
        </>
      )}
    </>
  );
}
