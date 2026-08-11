from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Field Configurations Schemas
class FieldConfigurationBase(BaseModel):
    name: str
    type: str  # text, number, date, select
    options: Optional[List[str]] = None
    filled_by: str  # requester, admin, system
    is_active: bool = True
    display_order: int = 0

class FieldConfigurationCreate(FieldConfigurationBase):
    pass

class FieldConfigurationResponse(FieldConfigurationBase):
    id: int

    class Config:
        from_attributes = True

# Material Requests Schemas
class MaterialRequestCreate(BaseModel):
    requester_name: str
    values: Dict[str, Any]  # Dictionary of active fields

class MaterialRequestUpdate(BaseModel):
    status: Optional[str] = None
    values: Dict[str, Any]  # Dictionary of admin/editable fields to update

class MaterialRequestResponse(BaseModel):
    id: int
    indent_id: str
    requester_name: Optional[str]
    status: str
    created_at: datetime
    values: Dict[str, Any]

    class Config:
        from_attributes = True

# Login Schema
class LoginRequest(BaseModel):
    role: str
    password: Optional[str] = None
    username: Optional[str] = None

class LoginResponse(BaseModel):
    success: bool
    role: str
    username: Optional[str] = None
    token: Optional[str] = None

# Requester Schemas
class RequesterCreate(BaseModel):
    name: str

class RequesterResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# StockItem Schemas
class StockItemBase(BaseModel):
    item_code: Optional[str] = None
    item_name: str
    quantity: float = 0.0
    unit: str = "Nos"
    is_approved: bool = True

class StockItemCreate(StockItemBase):
    pass

class StockItemUpdate(BaseModel):
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    is_approved: Optional[bool] = None

class StockItemResponse(StockItemBase):
    id: int

    class Config:
        from_attributes = True

# Client Schemas
class ClientCreate(BaseModel):
    name: str
    details: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
    name: str
    details: Optional[str] = None

    class Config:
        from_attributes = True



