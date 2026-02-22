.PHONY: run-server run-agent

run-agent:
	uv run python -m app.agents.deep_research_agent

run-server:
	uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
