Annoying Dino 2.5.0 page engine (crx id gdpmkppegbolfogggnnokogbjhldiceg), served here so
dhseadev.online's Dino pages can run the real dinosaur without shipping 240 KB through WordPress.
2.5.0 is built but NOT yet on the Chrome Web Store (the listing shows 2.2.1): this embed runs it
ahead of release. It is the 2.5.0 package's dino.js plus one declared two-line patch to the
particle canvas (see PATCHES.md, "annoying-dino embed"), so it is NOT byte-identical to the zip.
Consumers load /shared/chrome-shim.js with data-game-id="annoying-dino" first (storage
shim; the engine's storage calls are try/catch-wrapped so it also runs without it), then
this file. The engine starts itself on injection and exposes window.__annoyingDino
(start/stop/snapshot). Update by copying dino.js out of the current package; when the
particle patch ships in the store build, this file becomes byte-identical again.
