/**
 * Collectibles menu page.
 *
 * @module src-ui-menus-collectibles
 * @version 1.0.0
 * @file src/ui/menus/collectibles.ts
 * @since 0.0.1
 * @description Renders the collectibles overview and progress in the pause and menu UI.
 */

import { badge, icon } from "./icons";

export function createCollectiblesPage(sys: any) {
    const { data, save, audio } = sys;
    const el = document.createElement("div");
    el.className = "sys-coll";
    el.innerHTML = `<div class="cats sys-panel cut interactive"></div><div class="main sys-panel cut interactive"><div class="hd"><div><div class="sys-h3 cap"></div><h2 class="sys-h2 ttl"></h2></div><div class="pc"></div></div><div class="grid sys-scroll"></div></div>`;
    const CATS = [
        {
            id: "backpack",
            name: "Backpacks",
            list: () => data.backpacks,
            got: () => save.state.backpacks,
            cap: "Peter's memories",
        },
        {
            id: "landmark",
            name: "Landmarks",
            list: () => data.landmarks,
            got: () => save.state.landmarks,
            cap: "Photograph the city",
        },
        {
            id: "photo",
            name: "Secret Photos",
            list: () => data.secretPhotos,
            got: () => save.state.secretPhotos,
            cap: "Find where they were taken",
        },
        {
            id: "tower",
            name: "Research Towers",
            list: () => data.towers,
            got: () => save.state.towers,
            cap: "District scanners",
        },
        {
            id: "crime",
            name: "Crimes",
            list: () => [],
            got: () => [],
            cap: "Street justice",
        },
    ];
    let cat = "backpack",
        pendingHints: any[] = [];
    const distName = (id: string) =>
        data.districts.find((d: any) => d.id === id).name;
    function renderCats() {
        (el.querySelector(".cats") as HTMLElement).innerHTML = CATS.map(
            (c) =>
                `<div class="sys-list-item ${c.id === cat ? "on" : ""}" data-c="${c.id}">${badge(c.id === "crime" ? "crime" : c.id, 26)}<b>${c.name}</b><span>${c.id === "crime" ? save.state.crimes.stopped : `${c.got().length}/${c.list().length}`}</span></div>`,
        ).join("");
        el.querySelectorAll(".cats .sys-list-item").forEach((n) => {
            (n as HTMLElement).addEventListener("click", () => {
                cat = (n as HTMLElement).dataset.c!;
                audio.sfx.move();
                render();
            });
            (n as HTMLElement).addEventListener("mouseenter", () =>
                audio.sfx.hover(),
            );
        });
    }
    function render() {
        renderCats();
        const C = CATS.find((c) => c.id === cat)!;
        const got = new Set(C.got());
        const list = C.list();
        (el.querySelector(".cap") as HTMLElement).textContent = C.cap;
        (el.querySelector(".ttl") as HTMLElement).textContent = C.name;
        (el.querySelector(".pc") as HTMLElement).innerHTML =
            cat === "crime"
                ? `${save.state.crimes.stopped}<small> STOPPED</small>`
                : `${got.size}<small> / ${list.length}</small>`;
        const grid = el.querySelector(".grid") as HTMLElement;
        pendingHints = [];
        const chk = `<div class="ck">${icon("check", { color: "#e3262f", sw: 3 })}</div>`;
        if (cat === "backpack") {
            grid.innerHTML =
                '<div class="sys-drows">' +
                data.districts
                    .map((d: any) => {
                        const bp = list.filter((b: any) => b.district === d.id);
                        if (!bp.length) return "";
                        const n = bp.filter((b: any) => got.has(b.id)).length,
                            open = sys.towers.revealed(d.id);
                        const pips = bp
                            .map(
                                (b: any) =>
                                    `<i class="${got.has(b.id) ? "on" : ""}"></i>`,
                            )
                            .join("");
                        const items = bp
                            .filter((b: any) => got.has(b.id))
                            .map(
                                (b: any) =>
                                    `<span title="${b.desc.replace(/"/g, "&quot;")}">${b.item}</span>`,
                            )
                            .join("");
                        return `<div class="sys-drow ${n === bp.length ? "done" : ""}"><div class="h"><b>${d.name}</b><div class="pips">${pips}</div><em>${n}/${bp.length}</em></div>
          <div class="t">${items || ""}${n < bp.length ? `<small>${open ? `${bp.length - n} left — shown on the map` : "Locked — activate the district research tower"}</small>` : ""}</div></div>`;
                    })
                    .join("") +
                "</div>";
        } else if (false as unknown as boolean) {
            grid.innerHTML = list
                .map((b: any) =>
                    got.has(b.id)
                        ? `<div class="sys-citem got">${chk}<div class="dn">${distName(b.district)}</div><div class="nm">${b.item}</div><div class="ds">${b.desc}</div></div>`
                        : `<div class="sys-citem"><div class="dn">${distName(b.district)}</div><div class="nm" style="color:var(--sys-dim)">???</div><div class="ds">${sys.towers.revealed(b.district) ? (b.mount === "roof" ? "On a rooftop" : b.mount === "wall" ? "Webbed to a wall" : "Somewhere in the park") + " — shown on the map" : "Activate the district tower to locate"}</div></div>`,
                )
                .join("");
        } else if (cat === "landmark") {
            grid.innerHTML = list
                .map((l: any) => {
                    const th = save.state.photoThumbs[l.id];
                    const ok = got.has(l.id);
                    return `<div class="sys-citem photo ${ok ? "got" : ""}"><div class="img" style="${th ? `background-image:url(${th})` : ""}">${th ? "" : `<div class="q">${ok ? "" : "?"}</div>`}${ok ? '<div class="stamp">PHOTOGRAPHED</div>' : ""}</div>
          <div class="txt"><div class="dn">${distName(l.district)}</div><div class="nm">${ok || sys.towers.revealed(l.district) ? l.name : "???"}</div><div class="ds">${ok ? l.desc : sys.towers.revealed(l.district) ? "Frame it and press [F], or capture it in Photo Mode." : "Locked"}</div></div></div>`;
                })
                .join("");
        } else if (cat === "photo") {
            grid.innerHTML = list
                .map((p: any) => {
                    const ok = got.has(p.id);
                    const th = ok ? save.state.photoThumbs[p.id] : null;
                    return `<div class="sys-citem photo ${ok ? "got" : ""}"><div class="img sepia" data-hint="${p.id}" style="${th ? `background-image:url(${th})` : ""}"><div class="q">…</div>${ok ? '<div class="stamp">MATCHED</div>' : ""}</div>
          <div class="txt"><div class="dn">${distName(p.district)}</div><div class="nm">${ok ? "Matched" : "Where was this taken?"}</div><div class="ds">${p.hint}</div></div></div>`;
                })
                .join("");
            pendingHints = list.filter(
                (p: any) => !(got.has(p.id) && save.state.photoThumbs[p.id]),
            );
        } else if (cat === "tower") {
            grid.innerHTML = list
                .map(
                    (t: any) =>
                        `<div class="sys-citem ${got.has(t.id) ? "got" : ""}">${got.has(t.id) ? chk : ""}<div class="dn">${distName(t.district)}</div><div class="nm">${t.name}</div><div class="ds">${got.has(t.id) ? "Activated · fast travel unlocked" : "Not yet activated"}</div></div>`,
                )
                .join("");
        } else {
            const bt = save.state.crimes.byType,
                bd = save.state.crimes.byDistrict;
            grid.innerHTML =
                [
                    ["mugging", "Muggings"],
                    ["bankAlarm", "Bank Robberies"],
                    ["carChase", "Car Chases"],
                ]
                    .map(
                        ([k, n]) =>
                            `<div class="sys-citem"><div class="dn">Crime type</div><div class="nm">${n}</div><div class="ds" style="font-size:22px;color:#fff;font-family:var(--sys-head)">${bt[k] || 0}</div></div>`,
                    )
                    .join("") +
                data.districts
                    .map(
                        (d: any) =>
                            `<div class="sys-citem"><div class="dn">District</div><div class="nm">${d.name}</div><div class="ds">${bd[d.id] || 0} crimes stopped</div></div>`,
                    )
                    .join("");
        }
    }
    return {
        id: "collectibles",
        title: "Collectibles",
        el,
        hints: [["Click", "Category"]],
        footer: () =>
            `${save.state.backpacks.length + save.state.landmarks.length + save.state.secretPhotos.length}/${data.backpacks.length + data.landmarks.length + data.secretPhotos.length} COLLECTED`,
        show() {
            render();
        },
        update() {
            // render one sepia hint per frame (cached)
            const p = pendingHints.shift();
            if (!p) return;
            const url = sys.collect.renderHint(p);
            const d = el.querySelector(
                `[data-hint="${p.id}"]`,
            ) as HTMLElement | null;
            if (
                d &&
                url &&
                !(
                    save.state.secretPhotos.includes(p.id) &&
                    save.state.photoThumbs[p.id]
                )
            ) {
                d.style.backgroundImage = `url(${url})`;
                d.querySelector(".q")?.remove();
            }
        },
        key(e: KeyboardEvent) {
            const i = CATS.findIndex((c) => c.id === cat);
            if (e.code === "ArrowDown" || e.code === "KeyS") {
                cat = CATS[(i + 1) % CATS.length].id;
                audio.sfx.move();
                render();
                return true;
            }
            if (e.code === "ArrowUp" || e.code === "KeyW") {
                cat = CATS[(i - 1 + CATS.length) % CATS.length].id;
                audio.sfx.move();
                render();
                return true;
            }
            return false;
        },
    };
}
