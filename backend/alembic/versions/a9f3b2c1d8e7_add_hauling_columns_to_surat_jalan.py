"""Add hauling columns to surat_jalan

Revision ID: a9f3b2c1d8e7
Revises: 5eb4f44fae79
Create Date: 2026-06-14 18:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = 'a9f3b2c1d8e7'
down_revision: Union[str, None] = '5eb4f44fae79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    # Get current columns of surat_jalan
    sj_columns = [col['name'] for col in inspector.get_columns('surat_jalan')]
    
    if 'vendor_id' not in sj_columns:
        op.add_column('surat_jalan', sa.Column('vendor_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_surat_jalan_vendor_id',
            'surat_jalan', 'vendors',
            ['vendor_id'], ['id'],
            ondelete='SET NULL'
        )

    if 'truck_id' not in sj_columns:
        op.add_column('surat_jalan', sa.Column('truck_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_surat_jalan_truck_id',
            'surat_jalan', 'vendor_trucks',
            ['truck_id'], ['id'],
            ondelete='SET NULL'
        )

    if 'hauling_price' not in sj_columns:
        op.add_column('surat_jalan', sa.Column('hauling_price', sa.DECIMAL(15, 2), nullable=True))

    if 'hauling_cost' not in sj_columns:
        op.add_column('surat_jalan', sa.Column('hauling_cost', sa.DECIMAL(15, 2), nullable=True))

    if 'truck_type' not in sj_columns:
        op.add_column('surat_jalan', sa.Column('truck_type', sa.String(50), nullable=True))

    # Fix project_hauling_prices: add price_per_unit if missing
    php_columns = [col['name'] for col in inspector.get_columns('project_hauling_prices')]
    if 'price_per_unit' not in php_columns:
        op.add_column('project_hauling_prices', sa.Column('price_per_unit', sa.DECIMAL(15, 2), nullable=False, server_default='0'))
    
    # Drop old columns if they still exist
    for old_col in ['tipe_truk', 'harga_per_rit', 'harga_per_ton', 'harga_per_kubik']:
        if old_col in php_columns:
            op.drop_column('project_hauling_prices', old_col)


def downgrade() -> None:
    op.drop_constraint('fk_surat_jalan_truck_id', 'surat_jalan', type_='foreignkey')
    op.drop_constraint('fk_surat_jalan_vendor_id', 'surat_jalan', type_='foreignkey')
    op.drop_column('surat_jalan', 'hauling_cost')
    op.drop_column('surat_jalan', 'hauling_price')
    op.drop_column('surat_jalan', 'truck_id')
    op.drop_column('surat_jalan', 'vendor_id')
