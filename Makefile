.PHONY: run-server run-agent

run-agent:
	uv run python -m app.main

run-server:
	uv run uvicorn app.server:app --host 0.0.0.0 --port 8000
