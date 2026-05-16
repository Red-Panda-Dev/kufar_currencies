EXT_NAME := kufar-currencies
EXT_DIR := .
BUILD_DIR := build
FIREFOX_BUILD_DIR := $(BUILD_DIR)/firefox
CHROME_BUILD_DIR := $(BUILD_DIR)/chrome

.PHONY: test test-coverage format lint package-firefox package-chrome build-firefox build-chrome build clean run run-chrome

test:
	npm test

test-coverage:
	npm run test:coverage

format:
	npm run format

lint:
	npm run format:check

package-firefox:
	rm -rf $(FIREFOX_BUILD_DIR)
	mkdir -p $(FIREFOX_BUILD_DIR)/examples
	cp -r manifest.json background.js lib content popup icons $(FIREFOX_BUILD_DIR)/
	cp examples/nbrb_response.json $(FIREFOX_BUILD_DIR)/examples/
	rm -f $(EXT_NAME)-firefox.zip
	cd $(FIREFOX_BUILD_DIR) && zip -r ../../$(EXT_NAME)-firefox.zip .
	@echo "Built: $(EXT_NAME)-firefox.zip"

package-chrome:
	node scripts/build-chrome.mjs
	rm -f $(EXT_NAME)-chrome.zip
	cd $(CHROME_BUILD_DIR) && zip -r ../../$(EXT_NAME)-chrome.zip . -x "*_metadata*"
	@echo "Built: $(EXT_NAME)-chrome.zip"

build-firefox: lint test package-firefox

build-chrome: lint test package-chrome

build: lint test package-firefox package-chrome

clean:
	rm -rf build coverage
	rm -f *.zip

run:
	@echo "Manual browser run flow is documented in README.md"

run-chrome:
	@echo "Manual Chrome run flow is documented in README.md"
