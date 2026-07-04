# sutra — developer tasks
.PHONY: test lint all

test:            ## run zero-dep unit tests
	node --test tests/sutra-tools.test.js

lint:            ## syntax-check all JS
	@for f in bin/*.js hooks/*.js tests/*.js; do [ -f "$$f" ] && node -c "$$f" && echo "ok $$f"; done

all: lint test
