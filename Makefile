NAME    = hakarasenai
VERSION = $(shell python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
XPI     = dist/$(NAME)-$(VERSION).zip
FILES   = manifest.json src rules icons LICENSE README.md

.PHONY: build lint run clean

# AMO に上げる zip を作る(zip コマンドに依存しないよう python3 で固める)
build:
	mkdir -p dist
	rm -f $(XPI)
	python3 -m zipfile -c $(XPI) $(FILES)
	@echo "==> $(XPI)"

# 以下は web-ext を使う。初回は npx がダウンロードするのでネットが要る
lint:
	npx --yes web-ext lint --source-dir=.

run:
	npx --yes web-ext run --source-dir=.

clean:
	rm -rf dist web-ext-artifacts
