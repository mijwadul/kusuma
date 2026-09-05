"""add vehicle_type to project_hauling_prices and project_material_items

Revision ID: h1a2b3c4d5e8
Revises: g1a2b3c4d5e7
Create Date: 2026-09-05 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection


# revision identifiers, used by Alembic.
revision = 'h1a2b3c4d5e8'
down_revision = 'g1a2b3c4d5e7'


def upgrade():
    bind = op.get_bind()
    insp = reflection.Inspector.from_engine(bind)

    # 1. Add vehicle_type to project_hauling_prices
    php_cols = [c['name'] for c in insp.get_columns('project_hauling_prices')]
    if 'vehicle_type' not in php_cols:
        op.add_column('project_hauling_prices', sa.Column('vehicle_type', sa.String(length=50), nullable=True))

    # 2. Add vehicle_type to project_material_items and make target_quantity nullable
    pmi_cols = [c['name'] for c in insp.get_columns('project_material_items')]
    if 'vehicle_type' not in pmi_cols:
        op.add_column('project_material_items', sa.Column('vehicle_type', sa.String(length=50), nullable=True))

    # Alter target_quantity to nullable
    op.alter_column('project_material_items', 'target_quantity',
               existing_type=sa.Float(),
               nullable=True)


def downgrade():
    op.alter_column('project_material_items', 'target_quantity',
               existing_type=sa.Float(),
               nullable=False)
    op.drop_column('project_material_items', 'vehicle_type')
    op.drop_column('project_hauling_prices', 'vehicle_type')
