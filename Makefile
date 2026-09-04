NAME    = hakarasenai
VERSION = $(shell python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
ZIP     = dist/$(NAME)-$(VERSION).zip
FILES   = manifest.json src rules icons _locales LICENSE README.md README.ja.md

.PHONY: build lint run run-android sign clean

# Build the zip to upload to addons.mozilla.org.
# Uses python3 rather than zip(1) so there is nothing extra to install.
build:
	mkdir -p dist
	rm -f $(ZIP)
	python3 -m zipfile -c $(ZIP) $(FILES)
	@echo "==> $(ZIP)"

# The targets below use web-ext; npx downloads it on first run.
lint:
	npx --yes web-ext lint --source-dir=. --ignore-files=dist

run:
	npx --yes web-ext run --source-dir=.

# Requires adb, USB debugging, and "Remote debugging via USB" enabled in
# Firefox for Android. Run `adb devices` first to find DEVICE.
run-android:
	npx --yes web-ext run --source-dir=. --target=firefox-android \
		--adb-device=$(DEVICE) --firefox-apk=org.mozilla.firefox

# Self-distribution: signs the add-on without listing it on AMO.
# Get the credentials at https://addons.mozilla.org/developers/addon/api/key/
#   make sign WEB_EXT_API_KEY=user:... WEB_EXT_API_SECRET=...
# For a public listing, upload the zip from `make build` on the AMO Developer
# Hub instead -- listed submissions go through review and cannot be automated.
sign:
	npx --yes web-ext sign --source-dir=. --ignore-files=dist --channel=unlisted

clean:
	rm -rf dist web-ext-artifacts
