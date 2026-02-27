{
  description = "NixOS Flake Config Manager";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" ];
        };

        nativeBuildInputs = with pkgs; [
          rustToolchain
          pkg-config
          wrapGAppsHook3
          gobject-introspection
          nodejs_20
          nodePackages.npm
        ];

        buildInputs = with pkgs; [
          # Tauri system deps
          openssl
          glib
          gtk3
          webkitgtk_4_1
          libsoup_3
          librsvg
          pango
          gdk-pixbuf
          cairo
          atk
          # polkit for pkexec
          polkit
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          inherit nativeBuildInputs buildInputs;

          shellHook = ''
            echo "nixos-manager dev shell ready"
            echo "Run: npm install && npm run tauri dev"
          '';
        };

        # The packaged app
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "nixos-manager";
          version = "0.1.0";
          src = ./.;

          inherit nativeBuildInputs buildInputs;

          buildPhase = ''
            export HOME=$TMPDIR
            npm ci
            npm run tauri build -- --bundles deb
          '';

          installPhase = ''
            mkdir -p $out/bin $out/share/applications
            cp src-tauri/target/release/nixos-manager $out/bin/
          '';
        };
      }
    );
}
