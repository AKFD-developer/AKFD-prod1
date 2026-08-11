import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple
import os

from app.config import settings
from app.models import MaterialRequest, FieldConfiguration

logger = logging.getLogger("app.sheets")

# Helper to check if Sheets is configured
def get_sheets_client() -> Tuple[Any, Any]:
    """
    Returns (client, spreadsheet) if configured and authenticated.
    Otherwise returns (None, None).
    """
    if not settings.GOOGLE_SPREADSHEET_ID:
        logger.warning("GOOGLE_SPREADSHEET_ID is not configured. Google Sheets sync is disabled.")
        return None, None
        
    credentials_path = settings.GOOGLE_CREDENTIALS_FILE
    # If path is relative, resolve it relative to backend root
    if not os.path.isabs(credentials_path):
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        credentials_path = os.path.join(backend_dir, credentials_path)
        
    if not os.path.exists(credentials_path):
        logger.warning(f"Google credentials file not found at: {credentials_path}. Google Sheets sync is disabled.")
        return None, None
        
    try:
        import gspread
        from google.oauth2.service_account import Credentials
        
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        
        creds = Credentials.from_service_account_file(credentials_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(settings.GOOGLE_SPREADSHEET_ID)
        return client, spreadsheet
    except Exception as e:
        logger.error(f"Error authenticating with Google Sheets API: {str(e)}")
        return None, None

def get_or_create_worksheet(spreadsheet: Any) -> Any:
    """
    Gets the worksheet specified in settings, or creates it if it doesn't exist.
    """
    sheet_name = settings.GOOGLE_SHEET_NAME or "Material Requests"
    try:
        return spreadsheet.worksheet(sheet_name)
    except Exception:
        # Create sheet
        return spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="20")

def sync_headers(db_fields: List[FieldConfiguration]) -> List[str]:
    """
    Ensures Google Sheet headers match active database fields.
    Returns the list of headers (columns).
    """
    client, spreadsheet = get_sheets_client()
    # Sort fields by display_order
    sorted_fields = sorted(db_fields, key=lambda f: f.display_order)
    headers = [f.name for f in sorted_fields if f.is_active]
    
    # Ensure Timestamp and Indent ID No are always included
    if "Timestamp" not in headers:
        headers.insert(0, "Timestamp")
    if "Indent ID No." not in headers:
        # Put it after Timestamp or at the beginning
        idx = headers.index("Timestamp") + 1 if "Timestamp" in headers else 0
        headers.insert(idx, "Indent ID No.")

    if not client or not spreadsheet:
        return headers

    try:
        worksheet = get_or_create_worksheet(spreadsheet)
        
        # Read existing headers (row 1)
        row1 = worksheet.row_values(1)
        
        if not row1:
            # Sheet is empty, write headers
            worksheet.insert_row(headers, 1)
            logger.info("Initialized Google Sheet headers.")
        else:
            # Merge existing headers with new headers to preserve columns and order
            # Add missing headers to the end of the existing ones
            updated_headers = list(row1)
            changed = False
            for h in headers:
                if h not in updated_headers:
                    updated_headers.append(h)
                    changed = True
            
            if changed:
                # Update row 1 with merged headers
                worksheet.update("A1", [updated_headers])
                logger.info(f"Updated Google Sheet headers: added new custom columns. Headers are now: {updated_headers}")
                return updated_headers
            else:
                return updated_headers
    except Exception as e:
        logger.error(f"Failed to sync Google Sheet headers: {str(e)}")
        
    return headers

def append_request(request: MaterialRequest, db_fields: List[FieldConfiguration]) -> bool:
    """
    Appends a new request row to the Google Sheet.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return False

    try:
        worksheet = get_or_create_worksheet(spreadsheet)
        headers = worksheet.row_values(1)
        
        if not headers:
            # Sync headers first if empty
            headers = sync_headers(db_fields)
            
        values_dict = json.loads(request.values_json)
        
        # Build row values aligned with current headers
        row_values = []
        for header in headers:
            if header == "Timestamp":
                # Format request creation time
                row_values.append(request.created_at.strftime("%Y-%m-%d %H:%M:%S") if request.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            elif header == "Indent ID No.":
                row_values.append(request.indent_id)
            elif header == "Status":
                row_values.append(request.status)
            else:
                row_values.append(values_dict.get(header, ""))
                
        worksheet.append_row(row_values)
        logger.info(f"Successfully appended request {request.indent_id} to Google Sheet.")
        return True
    except Exception as e:
        logger.error(f"Failed to append request {request.indent_id} to Google Sheet: {str(e)}")
        return False

def update_request(request: MaterialRequest, db_fields: List[FieldConfiguration]) -> bool:
    """
    Updates an existing request row in Google Sheet by matching its Indent ID No.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return False

    try:
        worksheet = get_or_create_worksheet(spreadsheet)
        headers = worksheet.row_values(1)
        
        if not headers or "Indent ID No." not in headers:
            logger.error("Cannot update Google Sheet: Headers are missing or don't include 'Indent ID No.'")
            return False
            
        indent_col_idx = headers.index("Indent ID No.") + 1
        
        # Search for the row with matching Indent ID No.
        # Fetching all values of the Indent ID column
        indent_column_values = worksheet.col_values(indent_col_idx)
        
        row_num = -1
        for i, val in enumerate(indent_column_values):
            if val == request.indent_id:
                row_num = i + 1  # 1-indexed
                break
                
        if row_num == -1:
            logger.warning(f"Request {request.indent_id} not found in Google Sheet. Appending it instead.")
            return append_request(request, db_fields)
            
        # Build updated row values
        values_dict = json.loads(request.values_json)
        row_values = []
        for header in headers:
            if header == "Timestamp":
                # Don't change timestamp, preserve original if available in sheet, or write current
                row_values.append(request.created_at.strftime("%Y-%m-%d %H:%M:%S") if request.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            elif header == "Indent ID No.":
                row_values.append(request.indent_id)
            elif header == "Status":
                row_values.append(request.status)
            else:
                row_values.append(values_dict.get(header, ""))
                
        # Update the specific row
        # Update takes a range like 'A5:Z5'
        import gspread.utils
        col_letter = gspread.utils.rowcol_to_a1(1, len(headers)).split('1')[0]
        range_str = f"A{row_num}:{col_letter}{row_num}"
        worksheet.update(range_str, [row_values])
        
        logger.info(f"Successfully updated request {request.indent_id} (row {row_num}) in Google Sheet.")
        return True
    except Exception as e:
        logger.error(f"Failed to update request {request.indent_id} in Google Sheet: {str(e)}")
        return False

def full_sync(requests: List[MaterialRequest], db_fields: List[FieldConfiguration]) -> Tuple[bool, str]:
    """
    Clears the Google Sheet (except header row) and rewrites all requests.
    Returns (success, message).
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return False, "Google Sheets API is not configured or authenticated. Sync bypassed locally."

    try:
        if not requests:
            return False, "Synchronization aborted: The local database has no requests. To prevent accidental data loss, the Google Sheet was not cleared."

        worksheet = get_or_create_worksheet(spreadsheet)
        
        # Sync headers first
        headers = sync_headers(db_fields)
        
        # Clear sheet
        worksheet.clear()
        
        # Write headers to row 1
        worksheet.insert_row(headers, 1)
            
        # Build batch request rows
        all_rows = []
        for request in requests:
            values_dict = json.loads(request.values_json)
            row_values = []
            for header in headers:
                if header == "Timestamp":
                    row_values.append(request.created_at.strftime("%Y-%m-%d %H:%M:%S") if request.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                elif header == "Indent ID No.":
                    row_values.append(request.indent_id)
                elif header == "Status":
                    row_values.append(request.status)
                else:
                    row_values.append(values_dict.get(header, ""))
            all_rows.append(row_values)
            
        # Batch insert starting at row 2
        import gspread.utils
        col_letter = gspread.utils.rowcol_to_a1(1, len(headers)).split('1')[0]
        range_str = f"A2:{col_letter}{len(all_rows) + 1}"
        worksheet.update(range_str, all_rows)
        
        return True, f"Successfully synchronized {len(requests)} requests to Google Sheet."
    except Exception as e:
        error_msg = f"Failed to run full sync with Google Sheet: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def get_or_create_stock_worksheet(spreadsheet: Any) -> Any:
    """
    Gets the worksheet named 'Stock', or creates it if it doesn't exist.
    """
    try:
        return spreadsheet.worksheet("Stock")
    except Exception:
        # Create sheet and initialize headers
        worksheet = spreadsheet.add_worksheet(title="Stock", rows="1000", cols="5")
        worksheet.insert_row(["Item Code", "Item Name", "Available Quantity", "Unit", "Status"], 1)
        logger.info("Created 'Stock' worksheet with default headers.")
        return worksheet

def sync_stock_item(item: Any) -> bool:
    """
    Adds or updates a stock item row in the 'Stock' worksheet.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return False

    try:
        worksheet = get_or_create_stock_worksheet(spreadsheet)
        headers = ["Item Code", "Item Name", "Available Quantity", "Unit", "Status"]
        
        # Read existing rows to search for match
        rows = worksheet.get_all_values()
        
        # Determine status text
        status_text = "Approved" if item.is_approved else "Pending Approval"
        
        row_values = [
            item.item_code or "",
            item.item_name,
            str(item.quantity),
            item.unit,
            status_text
        ]
        
        # Find row by Item Name
        row_num = -1
        for i, r in enumerate(rows):
            if i == 0:
                continue  # Skip header
            # Match by Item Name (case insensitive)
            if len(r) > 1 and r[1].strip().lower() == item.item_name.strip().lower():
                row_num = i + 1  # 1-indexed
                break
                
        if row_num != -1:
            # Update row
            import gspread.utils
            col_letter = gspread.utils.rowcol_to_a1(1, len(headers)).split('1')[0]
            range_str = f"A{row_num}:{col_letter}{row_num}"
            worksheet.update(range_str, [row_values])
            logger.info(f"Updated Stock item '{item.item_name}' in Google Sheet (row {row_num}).")
        else:
            # Append row
            worksheet.append_row(row_values)
            logger.info(f"Appended new Stock item '{item.item_name}' to Google Sheet.")
            
        return True
    except Exception as e:
        logger.error(f"Failed to sync stock item '{item.item_name}' to Google Sheet: {str(e)}")
        return False

def pull_stock_data() -> List[Dict[str, Any]]:
    """
    Pulls all stock records from the Google Sheet.
    Returns list of parsed stock dictionaries.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return []

    try:
        worksheet = get_or_create_stock_worksheet(spreadsheet)
        records = worksheet.get_all_records()  # maps header -> cell value automatically
        parsed_items = []
        for r in records:
            # Skip if Item Name is empty
            if not r.get("Item Name"):
                continue
            parsed_items.append({
                "item_code": r.get("Item Code", ""),
                "item_name": r.get("Item Name", ""),
                "quantity": float(r.get("Available Quantity", 0.0) or 0.0),
                "unit": r.get("Unit", "Nos"),
                "is_approved": r.get("Status", "").strip().lower() != "pending approval"
            })
        return parsed_items
    except Exception as e:
        logger.error(f"Failed to pull stock data from Google Sheet: {str(e)}")
        return []

def get_or_create_clients_worksheet(spreadsheet: Any) -> Any:
    """
    Gets the worksheet named 'Clients', or creates it if it doesn't exist.
    """
    try:
        return spreadsheet.worksheet("Clients")
    except Exception:
        # Create sheet and initialize headers
        worksheet = spreadsheet.add_worksheet(title="Clients", rows="1000", cols="2")
        worksheet.insert_row(["Client Name", "Client Details"], 1)
        logger.info("Created 'Clients' worksheet with default headers.")
        return worksheet

def sync_client(client_obj: Any) -> bool:
    """
    Adds or updates a client row in the 'Clients' worksheet.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return False

    try:
        worksheet = get_or_create_clients_worksheet(spreadsheet)
        headers = ["Client Name", "Client Details"]
        
        # Read existing rows to search for match
        rows = worksheet.get_all_values()
        
        row_values = [
            client_obj.name,
            client_obj.details or ""
        ]
        
        # Find row by Client Name
        row_num = -1
        for i, r in enumerate(rows):
            if i == 0:
                continue  # Skip header
            if len(r) > 0 and r[0].strip().lower() == client_obj.name.strip().lower():
                row_num = i + 1  # 1-indexed
                break
                
        if row_num != -1:
            # Update row
            import gspread.utils
            col_letter = gspread.utils.rowcol_to_a1(1, len(headers)).split('1')[0]
            range_str = f"A{row_num}:{col_letter}{row_num}"
            worksheet.update(range_str, [row_values])
            logger.info(f"Updated Client '{client_obj.name}' in Google Sheet (row {row_num}).")
        else:
            # Append row
            worksheet.append_row(row_values)
            logger.info(f"Appended new Client '{client_obj.name}' to Google Sheet.")
            
        return True
    except Exception as e:
        logger.error(f"Failed to sync client '{client_obj.name}' to Google Sheet: {str(e)}")
        return False

def pull_client_data() -> List[Dict[str, Any]]:
    """
    Pulls all client records from the Google Sheet.
    Returns list of parsed client dictionaries.
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return []

    try:
        worksheet = get_or_create_clients_worksheet(spreadsheet)
        records = worksheet.get_all_records()
        parsed_clients = []
        for r in records:
            if not r.get("Client Name"):
                continue
            parsed_clients.append({
                "name": r.get("Client Name", "").strip(),
                "details": r.get("Client Details", "").strip()
            })
        return parsed_clients
    except Exception as e:
        logger.error(f"Failed to pull client data from Google Sheet: {str(e)}")
        return []

def pull_requests_from_sheet(db: Any) -> Tuple[int, int]:
    """
    Reads requests from Google Sheets 'Material Requests' and merges them into the SQLite database cache.
    Returns (created_count, updated_count).
    """
    client, spreadsheet = get_sheets_client()
    if not client or not spreadsheet:
        return 0, 0

    try:
        worksheet = get_or_create_worksheet(spreadsheet)
        records = worksheet.get_all_records()
        
        created_count = 0
        updated_count = 0
        
        from app.models import MaterialRequest, StockItem
        
        for r in records:
            indent_id = r.get("Indent ID No.")
            if not indent_id:
                continue
                
            status = r.get("Status", "Pending Admin").strip()
            requester_name = r.get("Requester's Name", "System Sync").strip()
            
            timestamp_str = r.get("Timestamp", "")
            created_at = None
            if timestamp_str:
                for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        created_at = datetime.strptime(str(timestamp_str).strip(), fmt)
                        break
                    except ValueError:
                        continue
            if not created_at:
                created_at = datetime.now()
                
            values_dict = {}
            for k, v in r.items():
                if k not in ("Timestamp", "Indent ID No.", "Status", "Requester's Name"):
                    values_dict[k] = str(v)
            
            db_request = db.query(MaterialRequest).filter(MaterialRequest.indent_id == indent_id).first()
            
            if db_request:
                old_status = db_request.status
                new_status = status
                old_values = json.loads(db_request.values_json) if db_request.values_json else {}
                
                if old_status != new_status or old_values != values_dict:
                    db_request.status = new_status
                    db_request.values_json = json.dumps(values_dict)
                    db_request.requester_name = requester_name
                    
                    if new_status == "Material Arrived" and old_status != "Material Arrived":
                        material_name = values_dict.get("Required Material Name")
                        qty_val = values_dict.get("Quantity")
                        if material_name and qty_val:
                            try:
                                req_qty = float(qty_val)
                                stock_item = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
                                if stock_item:
                                    stock_item.quantity = max(0.0, stock_item.quantity - req_qty)
                                    db.commit()
                                    sync_stock_item(stock_item)
                            except ValueError:
                                pass
                    elif old_status == "Material Arrived" and new_status != "Material Arrived":
                        material_name = values_dict.get("Required Material Name")
                        qty_val = values_dict.get("Quantity")
                        if material_name and qty_val:
                            try:
                                req_qty = float(qty_val)
                                stock_item = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
                                if stock_item:
                                    stock_item.quantity = stock_item.quantity + req_qty
                                    db.commit()
                                    sync_stock_item(stock_item)
                            except ValueError:
                                pass
                                
                    updated_count += 1
            else:
                new_req = MaterialRequest(
                    indent_id=indent_id,
                    requester_name=requester_name,
                    status=status,
                    created_at=created_at,
                    values_json=json.dumps(values_dict)
                )
                db.add(new_req)
                
                if status == "Material Arrived":
                    material_name = values_dict.get("Required Material Name")
                    qty_val = values_dict.get("Quantity")
                    if material_name and qty_val:
                        try:
                            req_qty = float(qty_val)
                            stock_item = db.query(StockItem).filter(StockItem.item_name.ilike(material_name.strip())).first()
                            if stock_item:
                                stock_item.quantity = max(0.0, stock_item.quantity - req_qty)
                                db.commit()
                                sync_stock_item(stock_item)
                        except ValueError:
                            pass
                
                created_count += 1
                
        db.commit()
        logger.info(f"Synchronized requests from Google Sheet to SQLite. Created: {created_count}, Updated: {updated_count}")
        return created_count, updated_count
    except Exception as e:
        logger.error(f"Failed to pull requests from Google Sheet: {str(e)}")
        return 0, 0



