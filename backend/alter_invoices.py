import os
import pymysql

# Get connection string from .env
# mysql+pymysql://Kusum4.db:Kusum4.db@localhost:3306/kusuma_db

def alter_table():
    try:
        connection = pymysql.connect(
            host='localhost',
            user='Kusum4.db',
            password='Kusum4.db',
            database='kusuma_db',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # Check if columns exist first to avoid errors
            cursor.execute("SHOW COLUMNS FROM invoices LIKE 'discount_type'")
            if not cursor.fetchone():
                print("Adding discount_type...")
                cursor.execute("ALTER TABLE invoices ADD COLUMN discount_type VARCHAR(20) NULL")
                
            cursor.execute("SHOW COLUMNS FROM invoices LIKE 'discount_value'")
            if not cursor.fetchone():
                print("Adding discount_value...")
                cursor.execute("ALTER TABLE invoices ADD COLUMN discount_value FLOAT NULL")
                
            cursor.execute("SHOW COLUMNS FROM invoices LIKE 'discount_amount'")
            if not cursor.fetchone():
                print("Adding discount_amount...")
                cursor.execute("ALTER TABLE invoices ADD COLUMN discount_amount FLOAT NULL")
                
            cursor.execute("SHOW COLUMNS FROM invoices LIKE 'final_amount'")
            if not cursor.fetchone():
                print("Adding final_amount...")
                cursor.execute("ALTER TABLE invoices ADD COLUMN final_amount FLOAT NULL")
                
        connection.commit()
        print("Successfully updated database schema.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    alter_table()
