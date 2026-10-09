// Supports both loading the project root (compiled assets in ./dist) and
// loading the generated dist directory directly as an unpacked extension.
const isProjectRootLoad = location.pathname.includes("/dist/devtools.html");
const panelPath = isProjectRootLoad ? "dist/panel.html" : "panel.html";

chrome.devtools.panels.create("API to Postman", "", panelPath, () => {
  // Chrome owns the panel lifecycle. No additional initialization is needed here.
});
