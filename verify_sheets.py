#!/usr/bin/env python3
import os
import sys
from datetime import datetime

# Add backend to path to load config
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

try:
    from dotenv import load_dotenv
    # Load dotenv from backend directory
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        print(f"[-] Warning: .env file not found at {env_path}")
except ImportError:
    print("[-] Warning: python-dotenv not installed. Using environment variables directly.")

def test_connection():
    print("=" * 60)
    print("  Google Sheets API Verification Script for AKFD Material Hub")
    print("=" * 60)
    
    # 1. Read Env configurations
    spreadsheet_id = os.getenv("GOOGLE_SPREADSHEET_ID")
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "Material Requests")
    creds_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    
    # Resolve relative credentials file path
    if creds_file and not os.path.isabs(creds_file):
        creds_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', creds_file)
        
    print(f"[+] Spreadsheet ID: {spreadsheet_id}")
    print(f"[+] Worksheet Name: {sheet_name}")
    print(f"[+] Credentials File: {creds_file}")
    
    if not spreadsheet_id:
        print("\n[-] Error: GOOGLE_SPREADSHEET_ID is not configured in backend/.env")
        print("Please configure this variable with your Google Spreadsheet ID.")
        return False
        
    if not os.path.exists(creds_file):
        print(f"\n[-] Error: Credentials file not found at: {creds_file}")
        print("Please place your downloaded service account JSON key file at this location.")
        return False
        
    # 2. Try authentication
    print("\n[~] Authenticating with Google Sheets API...")
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print("\n[-] Error: Required libraries 'gspread' or 'google-auth' are not installed.")
        print("Please run: pip install gspread google-auth")
        return False
        
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    
    try:
        creds = Credentials.from_service_account_file(creds_file, scopes=scopes)
        client = gspread.authorize(creds)
        print("[+] Authentication Successful!")
        print(f"[+] Service Account Email: {creds.service_account_email}")
    except Exception as e:
        print(f"\n[-] Authentication Failed: {str(e)}")
        return False
        
    # 3. Try opening the Spreadsheet
    print(f"\n[~] Connecting to Spreadsheet ID: {spreadsheet_id}...")
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
        print(f"[+] Connected to Spreadsheet: '{spreadsheet.title}'")
    except gspread.exceptions.APIError as ae:
        print(f"\n[-] API Error: {str(ae)}")
        print("\nPossible solutions:")
        print(f"1. Make sure you shared the Spreadsheet with: {creds.service_account_email}")
        print("2. Make sure the Service Account has 'Editor' access.")
        print("3. Check if the spreadsheet ID is correct.")
        return False
    except Exception as e:
        print(f"\n[-] Failed to open Spreadsheet: {str(e)}")
        return False
        
    # 4. Try opening / creating Worksheet
    print(f"\n[~] Locating Worksheet '{sheet_name}'...")
    try:
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
            print(f"[+] Worksheet '{sheet_name}' exists.")
        except gspread.exceptions.WorksheetNotFound:
            print(f"[~] Worksheet '{sheet_name}' not found. Creating it...")
            worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="20")
            print(f"[+] Worksheet '{sheet_name}' created successfully!")
            
        # Write test headers if empty
        row1 = worksheet.row_values(1)
        if not row1:
            test_headers = ["Timestamp", "Indent ID No.", "Requester's Name", "Required Material Name", "Status"]
            worksheet.insert_row(test_headers, 1)
            print("[+] Initialized sheet headers.")
            row1 = test_headers
            
        # 5. Append mock row
        print("\n[~] Testing write permissions (appending mock request row)...")
        mock_indent_id = f"IND-TEST-{datetime.now().strftime('%M%S')}"
        mock_row = [
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            mock_indent_id,
            "Verification Script",
            "Verification Material",
            "Verified"
        ]
        
        # Align with existing columns
        full_mock_row = []
        for col in row1:
            if col == "Timestamp":
                full_mock_row.append(mock_row[0])
            elif col == "Indent ID No.":
                full_mock_row.append(mock_row[1])
            elif col == "Requester's Name":
                full_mock_row.append(mock_row[2])
            elif col == "Required Material Name":
                full_mock_row.append(mock_row[3])
            elif col == "Status":
                full_mock_row.append(mock_row[4])
            else:
                full_mock_row.append("Mock Value")
                
        worksheet.append_row(full_mock_row)
        print(f"[+] Successfully wrote mock row with Indent ID: {mock_indent_id}")
        
        # 6. Locate and delete mock row (cleanup)
        print("\n[~] Running cleanup (locating and deleting mock row)...")
        indent_col_idx = row1.index("Indent ID No.") + 1 if "Indent ID No." in row1 else 2
        col_vals = worksheet.col_values(indent_col_idx)
        
        row_num = -1
        for idx, val in enumerate(col_vals):
            if val == mock_indent_id:
                row_num = idx + 1
                break
                
        if row_num != -1:
            # Clear row cells
            # In gspread, we can delete a row using delete_rows
            worksheet.delete_rows(row_num)
            print(f"[+] Successfully deleted mock row at index {row_num}.")
        else:
            print("[-] Warning: Mock row could not be located for deletion.")
            
        print("\n" + "=" * 60)
        print("  CONGRATULATIONS! Google Sheets API is fully functional!")
        print("=" * 60)
        print(f"Spreadsheet URL: {spreadsheet.url}")
        return True
        
    except Exception as e:
        print(f"\n[-] Error during Sheets interaction test: {str(e)}")
        return False

if __name__ == "__main__":
    test_connection()
