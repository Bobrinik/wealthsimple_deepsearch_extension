"""Agent run request/response schemas."""

from pydantic import BaseModel


class TaskRequest(BaseModel):
    task: str
    sec_id: str | None = None


class TaskResponse(BaseModel):
    result: str
