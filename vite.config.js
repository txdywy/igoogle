import { defineConfig } from "vite";

// Relative base so the built site works under a GitHub Pages project subpath
// (e.g. https://<user>.github.io/igoogle/) without hardcoding the repo name.
export default defineConfig({
  base: "./"
});
