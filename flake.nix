{
  # The tools the end-to-end tests need, pinned with the project instead of
  # installed globally: `nix develop -c npx playwright test` (or direnv, with
  # `use flake` in .envrc). The app itself needs none of this.
  description = "Six Points development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forEachSystem = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
      ];
    in
    {
      devShells = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # The browsers Playwright drives, from nixpkgs, so nothing lands in
          # ~/.cache/ms-playwright. Playwright only accepts the exact revisions
          # its own release expects: `playwright-driver.version` must equal the
          # `@playwright/test` pin in package.json (playwright.config.ts refuses
          # a run when they differ). Chromium and WebKit: the phone runs Safari.
          playwrightBrowsers = pkgs.playwright-driver.browsers.override {
            withFirefox = false;
          };
          # The app's fonts, served by the tests in place of Google Fonts (tests/app.ts),
          # so the layout is measured with the letters she sees and no test needs the network
          testFonts = pkgs.symlinkJoin {
            name = "six-points-test-fonts";
            paths = [
              pkgs.atkinson-hyperlegible-next.webfont
              pkgs.atkinson-hyperlegible-mono.webfont
            ];
          };
        in
        {
          default = pkgs.mkShellNoCC {
            packages = with pkgs; [
              nodejs_22
              python3 # the test server (python3 -m http.server)
            ];
            env = {
              PLAYWRIGHT_BROWSERS_PATH = "${playwrightBrowsers}";
              PLAYWRIGHT_DRIVER_VERSION = pkgs.playwright-driver.version;
              # The host check looks for FHS libraries a Nix-built browser does not need
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
              SIX_POINTS_FONTS = "${testFonts}/share/fonts/woff2";
            };
          };
        }
      );

      formatter = forEachSystem (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
