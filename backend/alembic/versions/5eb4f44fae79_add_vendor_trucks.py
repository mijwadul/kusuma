"""Add vendor_trucks and project_hauling_prices

Revision ID: 5eb4f44fae79
Revises: 4db2e33f9d68
Create Date: 2026-06-14 18:09:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = '5eb4f44fae79'
down_revision: Union[str, None] = '4db2e33f9d68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'vendor_trucks' not in tables:
        op.create_table('vendor_trucks',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('vendor_id', sa.Integer(), sa.ForeignKey('vendors.id'), nullable=False),
            sa.Column('nopol', sa.String(50), nullable=False, unique=True, index=True),
            sa.Column('supir_default', sa.String(100), nullable=True),
            sa.Column('tipe_truk', sa.String(50), nullable=False, default="tronton"),
            sa.Column('panjang', sa.Float(), nullable=True),
            sa.Column('lebar', sa.Float(), nullable=True),
            sa.Column('tinggi', sa.Float(), nullable=True),
            sa.Column('status', sa.String(30), default="active"),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()'))
        )
    
    if 'project_hauling_prices' not in tables:
        op.create_table('project_hauling_prices',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('vendor_id', sa.Integer(), sa.ForeignKey('vendors.id'), nullable=False),
            sa.Column('price_per_unit', sa.DECIMAL(15, 2), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()'))
        )

def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if 'project_hauling_prices' in tables:
        op.drop_table('project_hauling_prices')
    
    if 'vendor_trucks' in tables:
        op.drop_table('vendor_trucks')
