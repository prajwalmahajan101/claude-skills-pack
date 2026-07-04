# code_assist — developer tasks
.PHONY: test eval eval-llm lint all

test:            ## run zero-dep unit tests
	node --test tests/ca-tools.test.js

eval:            ## structural consistency eval (CI-ready, zero API cost)
	node tests/structural-eval.js

eval-llm:        ## LLM-graded behavioral evals (costs API tokens; needs claude CLI)
	node tests/eval/run-evals.js

lint:            ## syntax-check all JS
	@for f in bin/*.js hooks/*.js tests/*.js tests/eval/*.js; do [ -f "$$f" ] && node -c "$$f" && echo "ok $$f"; done

all: lint test eval
