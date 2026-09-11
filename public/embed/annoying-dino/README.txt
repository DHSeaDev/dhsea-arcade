Annoying Dino 2.0.0 page engine, byte-identical to the file inside the Chrome Web Store
package (crx id gdpmkppegbolfogggnnokogbjhldiceg). Served here so dhseadev.online's
Dino pages can run the real dinosaur without shipping 130 KB through WordPress.
Consumers load /shared/chrome-shim.js with data-game-id="annoying-dino" first (storage
shim; the engine's storage calls are try/catch-wrapped so it also runs without it), then
this file. The engine starts itself on injection and exposes window.__annoyingDino
(start/stop/snapshot). Update by copying dino.js out of the current CRX; never edit.
