"""Add pending rate and frozen costs

Revision ID: a1b2c3d4e5f6
Revises: 2b57c9f61d17
Create Date: 2026-06-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2b57c9f61d17'
branch_labels = None
depends_on = None

def upgrade():
    # Update equipment table
    op.add_column('equipment', sa.Column('pending_rental_rate_per_hour', sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column('equipment', sa.Column('locked_balance_for_pending_rate', sa.DECIMAL(precision=15, scale=2), nullable=True))
    
    # Update work_logs table
    op.add_column('work_logs', sa.Column('applied_rate', sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column('work_logs', sa.Column('total_cost', sa.DECIMAL(precision=15, scale=2), nullable=True))
    op.add_column('work_logs', sa.Column('split_details', sa.String(length=1000), nullable=True))

def downgrade():
    # Downgrade work_logs
    op.drop_column('work_logs', 'split_details')
    op.drop_column('work_logs', 'total_cost')
    op.drop_column('work_logs', 'applied_rate')
    
    # Downgrade equipment
    op.drop_column('equipment', 'locked_balance_for_pending_rate')
    op.drop_column('equipment', 'pending_rental_rate_per_hour')
