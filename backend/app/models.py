from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.sql import func
from app.database import Base

class FieldConfiguration(Base):
    __tablename__ = "field_configurations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, nullable=False, default="text")  # text, number, date, select
    options = Column(Text, nullable=True)  # JSON list of options for select dropdown
    filled_by = Column(String, nullable=False, default="requester")  # requester, admin, system
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)

class MaterialRequest(Base):
    __tablename__ = "material_requests"

    id = Column(Integer, primary_key=True, index=True)
    indent_id = Column(String, unique=True, index=True, nullable=False)
    requester_name = Column(String, index=True, nullable=True)
    status = Column(String, nullable=False, default="Pending Admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    values_json = Column(Text, nullable=False, default="{}")  # JSON string of all dynamic field values

class Requester(Base):
    __tablename__ = "requesters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String, unique=True, index=True, nullable=True)
    item_name = Column(String, unique=True, index=True, nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String, nullable=False, default="Nos")
    is_approved = Column(Boolean, nullable=False, default=True)

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    details = Column(Text, nullable=True)



