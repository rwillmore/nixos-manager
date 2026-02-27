# nixos-manager

A NixOS flake configuration manager built with **Tauri v2 + Vite + React + TypeScript** (Rust backend).

## Features

- **Manage multiple flake configs** — add, remove, rescan; persisted in `~/.config/nixos-manager/configs.json`
- **Auto-detect flake roots** — scans `~/nix`, `~/.config`, `~/src`, `~/nixos`, `~/dotfiles`, `~/NixGaming` to max depth 4
- **Host discovery** — runs `nix eval .#nixosConfigurations --json` to populate host dropdown
- **Preview** — `nix build .#nixosConfigurations.<host>.config.system.build.toplevel -L` (non-root)
- **Apply** — `pkexec nixos-rebuild switch --flake <path>#<host>` (polkit auth prompt)
- **Apply guard** — Apply is disabled until Preview succeeds for the same config+host; any input change clears preview-ok
- **Update** — `nix flake update` in flake root
- **Backup** — `git add -A && git commit -m "…" [&& git push]`
- **Security** — Rust validates all paths (absolute, exists, contains flake.nix, no `..`) and host names (alphanumeric + `-_`) before building any commands

## Architecture

```
nixos-manager/
├── src-tauri/               # Rust / Tauri backend
│   ├── src/
│   │   ├── main.rs          # Binary entry point
│   │   ├── lib.rs           # Tauri app setup + command registration
│   │   ├── commands.rs      # All Tauri invoke handlers
│   │   ├── config.rs        # Persistent JSON config storage
│   │   ├── scanner.rs       # Flake root auto-detection
│   │   └── validator.rs     # Path + host name validation
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── build.rs
├── src/                     # React + TypeScript frontend
│   ├── App.tsx              # Root layout + state machine
│   ├── api.ts               # Tauri invoke() wrappers
│   ├── types.ts             # Shared TypeScript types
│   ├── components/
│   │   ├── Sidebar.tsx      # Config list + add/remove
│   │   ├── TopBar.tsx       # Host select + Preview/Apply/Actions
│   │   ├── LogPane.tsx      # Build output log
│   │   ├── EmptyState.tsx   # No-config placeholder
│   │   ├── AddConfigModal.tsx  # Add config + auto-scan
│   │   └── BackupModal.tsx  # Git commit message dialog
│   └── styles/
│       └── global.css       # Catppuccin Mocha + JetBrains Mono
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Prerequisites

- Rust (via rustup)
- Node.js 18+
- Tauri v2 CLI: `cargo install tauri-cli --version "^2"`
- System: `pkexec`, `nix`, `git`

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

This produces a `.deb` and AppImage in `src-tauri/target/release/bundle/`.

## NixOS Packaging (flake)

Add to your `flake.nix`:

```nix
{
  inputs.nixos-manager.url = "github:your-username/nixos-manager";

  outputs = { nixos-manager, ... }: {
    environment.systemPackages = [ nixos-manager.packages.${system}.default ];
  };
}
```

## Workflow

```
Select Config → Select Host → Preview → (success) → Apply
                                    ↓
                              (failure) → Fix config → Preview again
```

The **Apply** button is blocked until Preview succeeds for the exact `path+host` combination.
Changing the host, running `flake update`, or editing the config clears the preview gate.
