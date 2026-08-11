import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file explicitly if it exists
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class Settings(BaseSettings):
    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./requests.db"
    GOOGLE_SPREADSHEET_ID: str = ""
    GOOGLE_SHEET_NAME: str = "Material Requests"
    GOOGLE_CREDENTIALS_FILE: str = "credentials.json"
    ADMIN_PASSWORD: str = "admin123"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
