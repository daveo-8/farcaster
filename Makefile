# Makefile for running frontend and backend tests with coverage

.PHONY: frontend-test backend-test

# Run frontend tests with coverage
frontend-test:
	node set-jsx.js react-jsx
	npm run test
	npm run coverage
	node set-jsx.js preserve
# not an issue if it fails to revert to preserve as npm run dev mandates it

backend-test:
	. venv/bin/activate && pytest