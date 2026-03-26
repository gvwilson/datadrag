.PHONY: setup run test

all: commands

## commands: show available commands (*)
commands:
	@grep -h -E '^##' ${MAKEFILE_LIST} \
	| sed -e 's/## //g' \
	| column -t -s ':'

## setup: set up for development
setup:
	npm install
	npx playwright install --with-deps

## build: build the bundle
build:
	npm run build

## run: run local server on port 3000
run:
	npx serve . -p 3000

## test: run tests
test:
	npm test
