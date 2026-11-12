<div align="center">
    <img src="./.github/demo.png" alt="Spiderbench gameplay preview" />
    <br />
    <h1 align="center">Spiderbench</h1>

**A browser based web swinging game built with Three.js, Vite, Bun, and an optional Rust/WASM engine.**

<p align="center">
    <a href="https://bun.sh">
        <img alt="Bun" src="https://img.shields.io/badge/Bun-1.3+-FDE2E4?style=flat&logo=bun&logoColor=000000" />
    </a>
    <a href="https://threejs.org">
        <img alt="Three.js" src="https://img.shields.io/badge/Three.js-WebGL2-CDEAC0?style=flat&logo=threedotjs&logoColor=000000" />
    </a>
    <a href="https://vite.dev">
        <img alt="Vite" src="https://img.shields.io/badge/Vite-8-BEE1E6?style=flat&logo=vite&logoColor=000000" />
    </a>
    <a href="https://www.rust-lang.org">
        <img alt="Rust" src="https://img.shields.io/badge/Rust-Engine-FFF1BA?style=flat&logo=rust&logoColor=000000" />
    </a>
    <a href="https://webassembly.org">
        <img alt="WebAssembly" src="https://img.shields.io/badge/WebAssembly-Optional-E2D1F9?style=flat&logo=webassembly&logoColor=000000" />
    </a>
    <a href="LICENSE">
        <img alt="License" src="https://img.shields.io/badge/License-Source--Available-F7D6E0?style=flat" />
    </a>
</p>

</div>

Spiderbench is a third person web swinging game that runs in the browser. You can swing between buildings, run on walls, perch on ledges, zip to points, and move through a large procedural city with a custom traversal and animation system.

This repository is a non commercial fan project and technical demo. It is meant for local development, testing, and performance experiments.

## ✨ Features

- **Web swinging traversal:** Swinging, wall running, wall crawling, perching, zipping, diving, and other movement states driven by a custom state machine.
- **Large procedural city:** A Manhattan style island with an authored street layout, dense buildings, rooftops, parks, bridges, traffic, and pedestrians.
- **Real time rendering:** A Three.js WebGL2 pipeline with shadows, screen space effects, bloom, TAA, motion blur, and different time of day looks.
- **Playable browser build:** Runs as a Vite web app and can be built for production into `dist/`.
- **Optional Rust/WASM engine:** CPU heavy math helpers can run through the Rust/WASM module in `engine/` with JavaScript fallbacks if WASM is unavailable.
- **Developer tools:** In game help and a developer menu for testing and tuning.

## 🧰 Requirements

### For running and frontend development
- [Bun](https://bun.sh/) (package manager, script runner, and build commands)
- A modern browser with **WebGL2** support
- A GPU with decent WebGL performance (integrated GPUs can run it, but you may need lower settings)

### For Rust/WASM development and builds
- [Rust](https://www.rust-lang.org/tools/install) installed via `rustup`
- Rust WebAssembly target: `wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (builds the WASM package for the browser)
- [mise](https://mise.jdx.dev/) (recommended, provides task shortcuts for building WASM + frontend together)

## 🚀 Getting started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd spiderbench
```

If you already have the project folder, open a terminal in the project root.

### 2. Install Bun

Install Bun from https://bun.sh/ and verify it is available:

```bash
bun --version
```

### 3. Install Rust (for WASM builds)

Install Rust with `rustup`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On Windows, you can use the installer from https://rustup.rs/ and then restart your terminal.

Verify your Rust tools:

```bash
rustc --version
cargo --version
rustup --version
```

Add the WebAssembly target required by this project:

```bash
rustup target add wasm32-unknown-unknown
```

You can confirm it is installed with:

```bash
rustup target list --installed
```

### 4. Install wasm-pack

`wasm-pack` compiles the Rust crate in `engine/wasm` and generates the browser package in `src/engine/pkg/`.

Install it with Cargo:

```bash
cargo install wasm-pack
```

Or follow another official install method from https://rustwasm.github.io/wasm-pack/installer/

Verify installation:

```bash
wasm-pack --version
```

### 5. Install mise (recommended)

`mise` runs the project tasks defined in `mise.toml` so you can build WASM and start/build the app with one command.

Install mise from https://mise.jdx.dev/getting-started.html and verify:

```bash
mise --version
```

### 6. Install frontend dependencies

From the project root:

```bash
bun install
```

## 💻 Development

### Recommended: build WASM and start the dev server

This is the easiest way to work on the project because it rebuilds the WASM package and starts Vite:

```bash
mise run start
```

Then open:

```text
http://127.0.0.1:5173
```

### Frontend only dev server (if WASM is already built)

If `src/engine/pkg/` already exists and you are not changing Rust code:

```bash
bun run dev
```

Then open:

```text
http://127.0.0.1:5173
```

### Rebuild the Rust/WASM package during development

When you change files in `engine/core` or `engine/wasm`, rebuild the WASM output:

```bash
mise run wasm
```

This generates/updates:

```text
src/engine/pkg/
```

After rebuilding WASM, refresh the browser (and restart the dev server if needed).

## 🏗️ Build

### Full production build (recommended)

Build the Rust/WASM package and the frontend bundle together:

```bash
mise run build
```

Output:

```text
dist/
```

This is the best option when you want the production build to include the latest WASM output.

### Frontend only production build

If the WASM package in `src/engine/pkg/` is already up to date, you can build only the frontend:

```bash
bun run build
```

Output:

```text
dist/
```

### WASM only build

To build just the Rust/WASM package:

```bash
mise run wasm
```

Output:

```text
src/engine/pkg/
```

### Preview the production build locally

After creating a production build, preview it with Vite:

```bash
bun run preview
```

Vite will print the local preview URL in the terminal (commonly `http://127.0.0.1:4173`).

Typical production workflow:

```bash
mise run build
bun run preview
```

## 📜 Available scripts and tasks

### Bun scripts (`package.json`)

| Command | Description |
| :-- | :-- |
| `bun run dev` | Starts the Vite dev server on `127.0.0.1:5173` |
| `bun run build` | Builds the frontend production bundle into `dist/` |
| `bun run preview` | Serves the production build locally (Vite preview) |

### mise tasks (`mise.toml`)

| Command | Description |
| :-- | :-- |
| `mise run wasm` | Builds the Rust/WASM package into `src/engine/pkg/` |
| `mise run start` | Builds WASM, then starts the Vite dev server |
| `mise run build` | Builds WASM, then creates the frontend production build |

## 🦀 Rust/WASM engine notes

- **Location:** Rust workspace lives in `engine/` (`engine/core` for pure logic, `engine/wasm` for the browser wrapper).
- **Generated output:** `src/engine/pkg/` (created by `wasm-pack`).
- **Runtime behavior:** The game tries to load the WASM module and falls back to JavaScript implementations if WASM is not available.
- **When to rebuild:** Rebuild after changing Rust code (`mise run wasm` or `mise run start` / `mise run build`).
- **Common check:** If WASM builds fail, make sure `wasm32-unknown-unknown` is installed for your Rust toolchain.

## 🎮 Controls

| Input | Action |
| :-- | :-- |
| **H** | Show in game help/controls |
| **~** (dev server) | Open developer menu |
| **`?dev` URL parameter** (production build) | Enable developer menu on a build (when supported) |

Movement, swinging, and camera controls are documented in game. Use the in game help menu for the full control list.

## 📁 Project structure

| Path | Purpose |
| :-- | :-- |
| `src/` | Main game code (player, traversal, world, rendering, UI, systems) |
| `engine/` | Rust workspace for performance helpers |
| `engine/core/` | Pure Rust computation core |
| `engine/wasm/` | WASM bindings/crate for browser integration |
| `src/engine/pkg/` | Generated WASM package output (build artifact) |
| `public/` | Static assets served by the app |
| `dist/` | Production build output |
| `plan.md` | Performance optimization checklist and notes |
| `mise.toml` | Task shortcuts for WASM and app workflows |

## ⚙️ Performance tips

- Prefer a production build for performance testing (`mise run build` then `bun run preview`).
- Lower resolution/quality settings if your GPU is struggling.
- Expensive effects (shadows, post processing, heavy screen space effects) have the biggest impact on low end hardware.
- On older integrated GPUs, aiming for a stable 30 FPS is usually more realistic than 60 FPS.
- If loading feels slow, shader compilation and large asset initialization are common causes on weaker hardware.

## 📄 License

This project is source available and view only. See the [LICENSE](LICENSE) file for the full terms.

It is an unofficial fan project and is not affiliated with, endorsed by, or sponsored by Marvel, Disney, Sony, or Insomniac Games. Spider-Man and related names, characters, and likenesses are trademarks and copyrighted material of their respective owners.

## 🙏 Credits

- Bundled fonts are provided under the SIL Open Font License. See `public/assets/ui/fonts/` for font files and license details.
- In universe names may appear for fan/demo context; advertised brands in game are fictional except for in universe names like the Daily Bugle and Oscorp.
