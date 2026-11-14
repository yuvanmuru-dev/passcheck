"""Webhook validation at the API boundary."""
from datetime import datetime, timezone
from typing import Annotated, Literal
from pydantic import BaseModel, Field

Name = Annotated[str, Field(min_length=1, max_length=80)]
class ChargeItem(BaseModel):
    name: Name
    qty: int = Field(ge=1, le=100)
class OrderItem(ChargeItem):
    price: float = Field(ge=0, allow_inf_nan=False)
    modifiers: list[Name] = Field(default_factory=list, max_length=10)
class POSPayload(BaseModel):
    external_id: str = Field(min_length=1, max_length=120)
    ticket_no: int = Field(ge=1)
    channel: Literal['dine_in','takeout','doordash','ubereats','drive_thru']
    station: int = Field(ge=1, le=3)
    items: list[OrderItem] = Field(min_length=1, max_length=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class ChargePayload(BaseModel):
    platform: Literal['doordash','ubereats']
    ticket_no: int = Field(ge=1)
    reason: Literal['missing_item','wrong_item','cold_food','other']
    items: list[ChargeItem] = Field(default_factory=list, max_length=100)
    amount: float = Field(ge=0, allow_inf_nan=False)
    customer_note: str = Field(default='', max_length=500)
    charged_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
