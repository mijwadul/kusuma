"""make vendor_id nullable in project_hauling_prices

Revision ID: c0d1e2f3g4h6
Revises: c0d1e2f3g4h5
Create Date: 2026-06-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c0d1e2f3g4h6'
down_revision = 'c0d1e2f3g4h5'
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column('project_hauling_prices', 'vendor_id',
               existing_type=mysql.INTEGER(display_width=11),
               nullable=True)

def downgrade():
    op.alter_column('project_hauling_prices', 'vendor_id',
               existing_type=mysql.INTEGER(display_width=11),
               nullable=False)
