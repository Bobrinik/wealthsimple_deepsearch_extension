"""Minimal FastAPI server exposing the smolagents CodeAgent as an HTTP endpoint."""

from fastapi import FastAPI
from pydantic import BaseModel

# Reuse the same agent and model as main (Gradio UI)
from app.main import agent
from app.prompt import PROMPT

app = FastAPI(title="Wealthsimple DeepSearch Agent", version="0.1.0")


class TaskRequest(BaseModel):
    task: str


class TaskResponse(BaseModel):
    result: str


@app.get("/health")
def health():
    """Health check for load balancers and monitoring."""
    return {"status": "ok"}


@app.post("/run", response_model=TaskResponse)
def run_agent(request: TaskRequest):
    """Run the agent on the given task and return the result."""
    result = agent.run(PROMPT + request.task)
    return TaskResponse(result=str(result))
