/**
 * UI font loader.
 *
 * @module src-ui-fonts
 * @version 1.0.0
 * @file src/ui/fonts.ts
 * @since 0.0.1
 * @description Ensures the bundled UI font stylesheet is loaded once for HUD and menu rendering.
 */

const FONTS_CSS_URL = new URL("../styles/fonts.css", import.meta.url).href;

export function loadFonts(): void {
    const existing = document.getElementById(
        "sys-fonts",
    ) as HTMLLinkElement | null;
    if (existing) {
        if (
            !existing.getAttribute("href") ||
            existing.getAttribute("href") === "/assets/fonts/fonts.css"
        ) {
            existing.href = FONTS_CSS_URL;
        }
        return;
    }
    const l = document.createElement("link");
    l.id = "sys-fonts";
    l.rel = "stylesheet";
    l.href = FONTS_CSS_URL;
    document.head.appendChild(l);
}
