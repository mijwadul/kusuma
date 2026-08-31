"""add material_deduction_per_rit to project_hauling_prices

Revision ID: f1a2b3c4d5e6
Revises: e456af295b69
Create Date: 2026-08-31 08:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e456af295b69'


def upgrade():
    op.add_column(
        'project_hauling_prices',
        sa.Column(
            'material_deduction_per_rit',
            sa.DECIMAL(15, 2),
            nullable=False,
            server_default='0'
        )
    )


def downgrade():
    op.drop_column('project_hauling_prices', 'material_deduction_per_rit')
