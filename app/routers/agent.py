"""Agent run endpoint."""

from fastapi import APIRouter

from app.agents.deep_research_agent import agent
from app.prompt import PROMPT
from app.schemas import TaskRequest, TaskResponse
from app.services import note_service

router = APIRouter(tags=["agent"])


@router.post("/run", response_model=TaskResponse)
def run_agent(request: TaskRequest):
    """Run the agent on the given task and return the result. Uses SQLite cache by company."""
    key = note_service.cache_key_from_task(request.task)
    cached = note_service.get_cached(key)
    if cached is not None:
        return TaskResponse(result=cached)
    result = agent.run(PROMPT + request.task)
    result_str = str(result)
    note_service.set_cached(key, result_str, sec_id=request.sec_id)
    return TaskResponse(result=result_str)
