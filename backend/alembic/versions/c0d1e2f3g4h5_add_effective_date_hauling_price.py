"""add effective_date to project hauling price

Revision ID: c0d1e2f3g4h5
Revises: 
Create Date: 2026-06-16 11:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0d1e2f3g4h5'
down_revision = 'bfef433159b8'

def upgrade():
    # We will use alembic op to add the column, using server_default for existing rows.
    op.add_column('project_hauling_prices', sa.Column('effective_date', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    op.drop_column('project_hauling_prices', 'effective_date')
