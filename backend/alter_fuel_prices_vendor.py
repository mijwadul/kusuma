import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "kusuma.db")

# Jika .env ada, baca database URL dari sana
from dotenv import load_dotenv
load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("sqlite:///"):
    db_path = db_url.replace("sqlite:///", "")

print(f"Using database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE fuel_prices ADD COLUMN vendor_name VARCHAR(200);")
    conn.commit()
    print("Successfully added vendor_name to fuel_prices")
except Exception as e:
    print("Error or column already exists:", e)
finally:
    conn.close()
