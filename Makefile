EXT_NAME := kufar-currencies

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
	npm run package:firefox

package-chrome:
	npm run package:chrome

build-firefox: lint test package-firefox

build-chrome: lint test package-chrome

build: lint test package

clean:
	rm -rf build coverage
	rm -f *.zip

run:
	@echo "Manual browser run flow is documented in README.md"

run-chrome:
	@echo "Manual Chrome run flow is documented in README.md"
