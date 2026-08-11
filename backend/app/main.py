import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models import FieldConfiguration, MaterialRequest, Requester, StockItem, Client
from app.schemas import (
    FieldConfigurationCreate, FieldConfigurationResponse,
    MaterialRequestCreate, MaterialRequestUpdate, MaterialRequestResponse,
    LoginRequest, LoginResponse, RequesterCreate, RequesterResponse,
    StockItemCreate, StockItemUpdate, StockItemResponse,
    ClientCreate, ClientResponse
)
from app import sheets
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Material Request Portal", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed default field configurations on startup if table is empty
@app.on_event("startup")
def seed_default_fields():
    db = next(get_db())
    try:
        count = db.query(FieldConfiguration).count()
        if count == 0:
            logger.info("Seeding default field configurations...")
            default_fields = [
                # System/Auto fields
                {"name": "Timestamp", "type": "text", "filled_by": "system", "is_active": True, "display_order": 1},
                {"name": "Indent ID No.", "type": "text", "filled_by": "system", "is_active": True, "display_order": 2},
                
                # Requester fields
                {"name": "Requester's Name", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 3},
                {"name": "Client Name", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 4},
                {"name": "Required Material Name", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 5},
                {"name": "Item Code (If Applicable)", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 6},
                {"name": "Quantity", "type": "number", "filled_by": "requester", "is_active": True, "display_order": 7},
                {"name": "Unit", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 8},
                {"name": "Priority", "type": "select", "options": json.dumps(["Low", "Medium", "High", "Critical"]), "filled_by": "requester", "is_active": True, "display_order": 9},
                {"name": "Expected Delivery Date", "type": "date", "filled_by": "requester", "is_active": True, "display_order": 10},
                {"name": "Additional Comments", "type": "text", "filled_by": "requester", "is_active": True, "display_order": 11},
                
                # Admin fields
                {"name": "Stock As on Date", "type": "date", "filled_by": "admin", "is_active": True, "display_order": 12},
                {"name": "ID No.", "type": "text", "filled_by": "admin", "is_active": True, "display_order": 13},
                {"name": "Approvel By Except for the Store Material", "type": "text", "filled_by": "admin", "is_active": True, "display_order": 14},
                {"name": "The Material has Arrived.", "type": "select", "options": json.dumps(["Pending", "Yes", "No"]), "filled_by": "admin", "is_active": True, "display_order": 15},
                {"name": "Material In Date", "type": "date", "filled_by": "admin", "is_active": True, "display_order": 16},
            ]
            
            for field in default_fields:
                db_field = FieldConfiguration(
                    name=field["name"],
                    type=field["type"],
                    options=field.get("options"),
                    filled_by=field["filled_by"],
                    is_active=field["is_active"],
                    display_order=field["display_order"]
                )
                db.add(db_field)
            db.commit()
            logger.info("Successfully seeded default field configurations.")
            
            # Attempt to sync headers to sheets if credentials exist
            try:
                db_fields = db.query(FieldConfiguration).all()
                sheets.sync_headers(db_fields)
            except Exception as se:
                logger.warning(f"Initial Sheets header sync bypassed during seed: {str(se)}")
            
        # Seed default requesters (independent of FieldConfiguration count)
        requester_count = db.query(Requester).count()
        if requester_count == 0:
            logger.info("Seeding default requesters...")
            default_requesters = ["Pranav Khandelwal", "Kamlesh Kumar", "Store Staff"]
            for name in default_requesters:
                db_req = Requester(name=name)
                db.add(db_req)
            db.commit()
            logger.info("Successfully seeded default requesters.")

        # Pull stock items from Google Sheet on startup to cache them locally
        try:
            logger.info("Syncing inventory list from Google Sheets on startup...")
            sheet_items = sheets.pull_stock_data()
            if sheet_items:
                for item in sheet_items:
                    existing = db.query(StockItem).filter(StockItem.item_name.ilike(item["item_name"])).first()
                    if not existing:
                        db_item = StockItem(
                            item_code=item["item_code"],
                            item_name=item["item_name"],
                            quantity=item["quantity"],
                            unit=item["unit"],
                            is_approved=item["is_approved"]
                        )
                        db.add(db_item)
                    else:
                        existing.quantity = item["quantity"]
                        existing.unit = item["unit"]
                        existing.is_approved = item["is_approved"]
                        if item["item_code"]:
                            existing.item_code = item["item_code"]
                db.commit()
                logger.info("Successfully synchronized local stock cache with Google Sheet.")
        except Exception as e:
            logger.warning(f"Failed to pull stock items on boot: {str(e)}")

        # Pull clients from Google Sheet on startup to cache them locally
        try:
            logger.info("Syncing client directory from Google Sheets on startup...")
            sheet_clients = sheets.pull_client_data()
            if sheet_clients:
                for c in sheet_clients:
                    existing = db.query(Client).filter(Client.name.ilike(c["name"])).first()
                    if not existing:
                        db_client = Client(
                            name=c["name"],
                            details=c["details"]
                        )
                        db.add(db_client)
                    else:
                        existing.details = c["details"]
                db.commit()
                logger.info("Successfully synchronized local client cache with Google Sheet.")
        except Exception as e:
            logger.warning(f"Failed to pull clients on boot: {str(e)}")
    except Exception as e:
        logger.error(f"Error seeding database: {str(e)}")
        db.rollback()
    finally:
        db.close()

# --- Auth Router ---
@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    if payload.role == "admin":
        if payload.password == settings.ADMIN_PASSWORD:
            return LoginResponse(success=True, role="admin", token="admin-session-token")
        else:
            raise HTTPException(status_code=401, detail="Incorrect admin password")
    elif payload.role == "requester":
        if not payload.username or not payload.username.strip():
            raise HTTPException(status_code=400, detail="Username is required for requester")
        return LoginResponse(success=True, role="requester", username=payload.username.strip())
    else:
        raise HTTPException(status_code=400, detail="Invalid role specified")

# --- Field Configurations Router ---
@app.get("/api/fields", response_model=List[FieldConfigurationResponse])
def get_fields(db: Session = Depends(get_db)):
    fields = db.query(FieldConfiguration).order_by(FieldConfiguration.display_order).all()
    # Deserialize options from JSON string
    response_fields = []
    for f in fields:
        options = None
        if f.options:
            try:
                options = json.loads(f.options)
            except Exception:
                options = []
        response_fields.append(
            FieldConfigurationResponse(
                id=f.id,
                name=f.name,
                type=f.type,
                options=options,
                filled_by=f.filled_by,
                is_active=f.is_active,
                display_order=f.display_order
            )
        )
    return response_fields

@app.post("/api/fields", response_model=FieldConfigurationResponse)
def create_field(payload: FieldConfigurationCreate, db: Session = Depends(get_db)):
    # Check if field exists
    existing = db.query(FieldConfiguration).filter(FieldConfiguration.name.ilike(payload.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Field with name '{payload.name}' already exists.")
        
    # Set default order if not provided
    display_order = payload.display_order
    if display_order == 0:
        max_order = db.query(FieldConfiguration).order_by(FieldConfiguration.display_order.desc()).first()
        display_order = (max_order.display_order + 1) if max_order else 1

    db_field = FieldConfiguration(
        name=payload.name.strip(),
        type=payload.type,
        options=json.dumps(payload.options) if payload.options else None,
        filled_by=payload.filled_by,
        is_active=payload.is_active,
        display_order=display_order
    )
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    
    # Sync sheets columns
    try:
        all_fields = db.query(FieldConfiguration).all()
        sheets.sync_headers(all_fields)
    except Exception as e:
        logger.error(f"Error syncing headers after adding field: {str(e)}")

    options = json.loads(db_field.options) if db_field.options else None
    return FieldConfigurationResponse(
        id=db_field.id,
        name=db_field.name,
        type=db_field.type,
        options=options,
        filled_by=db_field.filled_by,
        is_active=db_field.is_active,
        display_order=db_field.display_order
    )

@app.put("/api/fields/{field_id}", response_model=FieldConfigurationResponse)
def update_field(field_id: int, payload: FieldConfigurationCreate, db: Session = Depends(get_db)):
    db_field = db.query(FieldConfiguration).filter(FieldConfiguration.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Field configuration not found")
        
    # Check if name is being changed and if it collides
    if db_field.name.lower() != payload.name.lower():
        existing = db.query(FieldConfiguration).filter(FieldConfiguration.name.ilike(payload.name)).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Field with name '{payload.name}' already exists.")

    db_field.name = payload.name.strip()
    db_field.type = payload.type
    db_field.options = json.dumps(payload.options) if payload.options else None
    db_field.filled_by = payload.filled_by
    db_field.is_active = payload.is_active
    db_field.display_order = payload.display_order
    
    db.commit()
    db.refresh(db_field)
    
    # Sync sheets columns
    try:
        all_fields = db.query(FieldConfiguration).all()
        sheets.sync_headers(all_fields)
    except Exception as e:
        logger.error(f"Error syncing headers after updating field: {str(e)}")
        
    options = json.loads(db_field.options) if db_field.options else None
    return FieldConfigurationResponse(
        id=db_field.id,
        name=db_field.name,
        type=db_field.type,
        options=options,
        filled_by=db_field.filled_by,
        is_active=db_field.is_active,
        display_order=db_field.display_order
    )

# --- Material Requests Router ---
@app.get("/api/requests", response_model=List[MaterialRequestResponse])
def get_requests(
    requester_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MaterialRequest)
    if requester_name:
        query = query.filter(MaterialRequest.requester_name.ilike(requester_name.strip()))
    requests = query.order_by(MaterialRequest.created_at.desc()).all()
    
    response = []
    for req in requests:
        try:
            values = json.loads(req.values_json)
        except Exception:
            values = {}
        response.append(
            MaterialRequestResponse(
                id=req.id,
                indent_id=req.indent_id,
                requester_name=req.requester_name,
                status=req.status,
                created_at=req.created_at,
                values=values
            )
        )
    return response

@app.post("/api/requests", response_model=MaterialRequestResponse)
def create_request(payload: MaterialRequestCreate, db: Session = Depends(get_db)):
    # Generate Indent ID No.
    # Format: IND-YYYYMMDD-XXXX
    date_str = datetime.now().strftime("%Y%m%d")
    # Get requests count for today
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    count_today = db.query(MaterialRequest).filter(MaterialRequest.created_at >= today_start).count()
    indent_id = f"IND-{date_str}-{1001 + count_today}"
    
    # Ensure values dictionary exists
    req_values = payload.values or {}
    
    # Ensure system columns are written in value payload too for easier export
    req_values["Timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    req_values["Indent ID No."] = indent_id
    req_values["Requester's Name"] = payload.requester_name
    
    # Fetch active fields configuration to validate
    db_fields = db.query(FieldConfiguration).filter(FieldConfiguration.is_active == True).all()
    
    # Validate requester fields are filled
    for field in db_fields:
        if field.filled_by == "requester":
            # For simplicity, we just make sure key exists in values, 
            # we can add strict validation if required
            if field.name not in req_values:
                req_values[field.name] = ""
        elif field.filled_by == "admin":
            # Admin fields are empty on creation
            if field.name not in req_values:
                req_values[field.name] = ""

    # Register custom proposed stock items if material is new
    material_name = req_values.get("Required Material Name")
    if material_name and material_name.strip():
        existing_stock = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
        if not existing_stock:
            unit_val = req_values.get("Unit", "Nos")
            db_stock = StockItem(
                item_name=material_name.strip(),
                quantity=0.0,
                unit=unit_val,
                is_approved=False
            )
            db.add(db_stock)
            db.commit()
            db.refresh(db_stock)
            
            try:
                sheets.sync_stock_item(db_stock)
            except Exception as se:
                logger.error(f"Failed to sync proposed stock item to Google Sheet: {str(se)}")

    db_request = MaterialRequest(
        indent_id=indent_id,
        requester_name=payload.requester_name.strip(),
        status="Pending Admin",
        values_json=json.dumps(req_values)
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    # Append to Google Sheet
    try:
        sheets.append_request(db_request, db_fields)
    except Exception as e:
        logger.error(f"Failed to sync appended request to Google Sheets: {str(e)}")

    return MaterialRequestResponse(
        id=db_request.id,
        indent_id=db_request.indent_id,
        requester_name=db_request.requester_name,
        status=db_request.status,
        created_at=db_request.created_at,
        values=req_values
    )

@app.put("/api/requests/{request_id}", response_model=MaterialRequestResponse)
def update_request(request_id: int, payload: MaterialRequestUpdate, db: Session = Depends(get_db)):
    db_request = db.query(MaterialRequest).filter(MaterialRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Material request not found")

    try:
        current_values = json.loads(db_request.values_json)
    except Exception:
        current_values = {}
        
    # Update status and adjust stock levels if transitioning
    old_status = db_request.status
    new_status = payload.status
    if new_status:
        db_request.status = new_status
        if new_status == "Material Arrived" and old_status != "Material Arrived":
            # Deduct quantity from stock
            material_name = current_values.get("Required Material Name")
            qty_val = current_values.get("Quantity")
            if material_name and qty_val:
                try:
                    req_qty = float(qty_val)
                    stock_item = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
                    if stock_item:
                        stock_item.quantity = max(0.0, stock_item.quantity - req_qty)
                        db.commit()
                        logger.info(f"Deducted {req_qty} from StockItem '{stock_item.item_name}'. New level: {stock_item.quantity}")
                        try:
                            sheets.sync_stock_item(stock_item)
                        except Exception as se:
                            logger.error(f"Failed to sync stock deduction: {str(se)}")
                except ValueError:
                    logger.warning(f"Could not parse quantity '{qty_val}' for stock deduction.")
        elif old_status == "Material Arrived" and new_status != "Material Arrived":
            # Add quantity back to stock (reversion)
            material_name = current_values.get("Required Material Name")
            qty_val = current_values.get("Quantity")
            if material_name and qty_val:
                try:
                    req_qty = float(qty_val)
                    stock_item = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
                    if stock_item:
                        stock_item.quantity = stock_item.quantity + req_qty
                        db.commit()
                        logger.info(f"Reverted deduction: added {req_qty} back to StockItem '{stock_item.item_name}'. New level: {stock_item.quantity}")
                        try:
                            sheets.sync_stock_item(stock_item)
                        except Exception as se:
                            logger.error(f"Failed to sync stock reversion: {str(se)}")
                except ValueError:
                    pass
        
    # Update provided values (Admin values)
    if payload.values:
        for k, v in payload.values.items():
            current_values[k] = v
            
    # Register custom proposed stock items if material is new on update
    material_name = current_values.get("Required Material Name")
    if material_name and material_name.strip():
        existing_stock = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
        if not existing_stock:
            unit_val = current_values.get("Unit", "Nos")
            db_stock = StockItem(
                item_name=material_name.strip(),
                quantity=0.0,
                unit=unit_val,
                is_approved=False
            )
            db.add(db_stock)
            db.commit()
            db.refresh(db_stock)
            try:
                sheets.sync_stock_item(db_stock)
            except Exception as se:
                logger.error(f"Failed to sync proposed stock item to Google Sheet: {str(se)}")
            
    db_request.values_json = json.dumps(current_values)
    db.commit()
    db.refresh(db_request)
    
    # Push update to Google Sheets
    try:
        db_fields = db.query(FieldConfiguration).all()
        sheets.update_request(db_request, db_fields)
    except Exception as e:
        logger.error(f"Failed to sync updated request to Google Sheets: {str(e)}")

    return MaterialRequestResponse(
        id=db_request.id,
        indent_id=db_request.indent_id,
        requester_name=db_request.requester_name,
        status=db_request.status,
        created_at=db_request.created_at,
        values=current_values
    )

# --- Sheets Settings & Sync Router ---
@app.get("/api/sheets/status")
def get_sheets_status(db: Session = Depends(get_db)):
    client, spreadsheet = sheets.get_sheets_client()
    configured = (client is not None and spreadsheet is not None)
    
    sheet_details = {}
    if configured:
        try:
            worksheet = sheets.get_or_create_worksheet(spreadsheet)
            sheet_details = {
                "title": spreadsheet.title,
                "sheet_name": worksheet.title,
                "url": spreadsheet.url
            }
        except Exception as e:
            logger.error(f"Error fetching worksheet details: {str(e)}")
            configured = False
            
    return {
        "configured": configured,
        "spreadsheet_id": settings.GOOGLE_SPREADSHEET_ID,
        "sheet_name": settings.GOOGLE_SHEET_NAME,
        "credentials_configured": os.path.exists(settings.GOOGLE_CREDENTIALS_FILE) or os.path.exists(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), settings.GOOGLE_CREDENTIALS_FILE)),
        "sheet_details": sheet_details
    }

@app.post("/api/sheets/sync")
def sync_data(db: Session = Depends(get_db)):
    requests = db.query(MaterialRequest).order_by(MaterialRequest.created_at.asc()).all()
    fields = db.query(FieldConfiguration).all()
    
    success, msg = sheets.full_sync(requests, fields)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@app.post("/api/sheets/pull")
def pull_data(db: Session = Depends(get_db)):
    created, updated = sheets.pull_requests_from_sheet(db)
    try:
        sheet_items = sheets.pull_stock_data()
        if sheet_items:
            for item in sheet_items:
                existing = db.query(StockItem).filter(StockItem.item_name.ilike(item["item_name"].strip())).first()
                if not existing:
                    db_item = StockItem(
                        item_code=item["item_code"] or None,
                        item_name=item["item_name"].strip(),
                        quantity=item["quantity"],
                        unit=item["unit"],
                        is_approved=item["is_approved"]
                    )
                    db.add(db_item)
                else:
                    existing.quantity = item["quantity"]
                    existing.unit = item["unit"]
                    existing.is_approved = item["is_approved"]
                    if item["item_code"]:
                        existing.item_code = item["item_code"]
            db.commit()
            
        sheet_clients = sheets.pull_client_data()
        if sheet_clients:
            for c in sheet_clients:
                existing = db.query(Client).filter(Client.name.ilike(c["name"].strip())).first()
                if not existing:
                    db_client = Client(
                        name=c["name"].strip(),
                        details=c["details"]
                    )
                    db.add(db_client)
                else:
                    existing.details = c["details"]
            db.commit()
    except Exception as e:
        logger.error(f"Failed to pull auxiliary sheet data: {str(e)}")
        
    return {
        "message": f"Successfully pulled data from Google Sheets. Merged requests (New: {created}, Updated: {updated})."
    }

# --- Requesters Router ---
@app.get("/api/requesters", response_model=List[RequesterResponse])
def get_requesters(db: Session = Depends(get_db)):
    return db.query(Requester).order_by(Requester.name).all()

@app.post("/api/requesters", response_model=RequesterResponse)
def create_requester(payload: RequesterCreate, db: Session = Depends(get_db)):
    existing = db.query(Requester).filter(Requester.name.ilike(payload.name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="This name is already in the list.")
    
    db_req = Requester(name=payload.name.strip())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@app.delete("/api/requesters/{requester_id}")
def delete_requester(requester_id: int, db: Session = Depends(get_db)):
    db_req = db.query(Requester).filter(Requester.id == requester_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Requester name not found.")
    
    db.delete(db_req)
    db.commit()
    return {"message": f"Successfully removed '{db_req.name}'."}

# --- Stock/Inventory Router ---
@app.get("/api/stock", response_model=List[StockItemResponse])
def get_stock(db: Session = Depends(get_db)):
    return db.query(StockItem).order_by(StockItem.item_name).all()

@app.post("/api/stock", response_model=StockItemResponse)
def create_stock_item(payload: StockItemCreate, db: Session = Depends(get_db)):
    existing = db.query(StockItem).filter(StockItem.item_name.ilike(payload.item_name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="An item with this name already exists in inventory.")
        
    db_item = StockItem(
        item_code=payload.item_code.strip() if payload.item_code else None,
        item_name=payload.item_name.strip(),
        quantity=payload.quantity,
        unit=payload.unit.strip(),
        is_approved=payload.is_approved
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    try:
        sheets.sync_stock_item(db_item)
    except Exception as e:
        logger.error(f"Failed to sync stock item to Google Sheet: {str(e)}")
        
    return db_item

@app.put("/api/stock/{item_id}", response_model=StockItemResponse)
def update_stock_item(item_id: int, payload: StockItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Stock item not found.")
        
    if payload.item_name is not None:
        name_clean = payload.item_name.strip()
        if db_item.item_name.lower() != name_clean.lower():
            existing = db.query(StockItem).filter(StockItem.item_name.ilike(name_clean)).first()
            if existing:
                raise HTTPException(status_code=400, detail="An item with this name already exists.")
            db_item.item_name = name_clean

    if payload.item_code is not None:
        db_item.item_code = payload.item_code.strip() if payload.item_code else None
    if payload.quantity is not None:
        db_item.quantity = payload.quantity
    if payload.unit is not None:
        db_item.unit = payload.unit.strip()
    if payload.is_approved is not None:
        db_item.is_approved = payload.is_approved
        
    db.commit()
    db.refresh(db_item)
    
    try:
        sheets.sync_stock_item(db_item)
    except Exception as e:
        logger.error(f"Failed to sync updated stock item to Google Sheet: {str(e)}")
        
    return db_item

@app.delete("/api/stock/{item_id}")
def delete_stock_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Stock item not found.")
        
    db.delete(db_item)
    db.commit()
    return {"message": f"Successfully deleted '{db_item.item_name}'."}

# --- Client Directory Router ---
@app.get("/api/clients", response_model=List[ClientResponse])
def get_clients(db: Session = Depends(get_db)):
    return db.query(Client).order_by(Client.name).all()

@app.post("/api/clients", response_model=ClientResponse)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    existing = db.query(Client).filter(Client.name.ilike(payload.name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="A client with this name is already registered.")
        
    db_client = Client(
        name=payload.name.strip(),
        details=payload.details.strip() if payload.details else None
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    
    try:
        sheets.sync_client(db_client)
    except Exception as e:
        logger.error(f"Failed to sync client to Google Sheet: {str(e)}")
        
    return db_client

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found.")
        
    db.delete(db_client)
    db.commit()
    return {"message": f"Successfully deleted client '{db_client.name}'."}

if __name__ == "__main__":
    import uvicorn
    # Trigger reload comment
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

