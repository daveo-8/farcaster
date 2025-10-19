# Makefile for running frontend tests with coverage

.PHONY: test

# Run frontend tests with coverage
test:
	-npx c8 --include src \
	--exclude "src/app/.well-known/**" \
	--exclude "src/app/api/**" \
	--exclude "src/hooks/**" \
	--exclude "src/lib/**" \
	--all --check-coverage --lines 80 --functions 80 --branches 80 vitest
