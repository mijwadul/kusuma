"""Add vendor_type to vendors

Revision ID: 4db2e33f9d68
Revises: 3ca1d22e8c57
Create Date: 2026-06-14 18:03:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '4db2e33f9d68'
down_revision: Union[str, None] = '3ca1d22e8c57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('vendors')]
    
    with op.batch_alter_table('vendors', schema=None) as batch_op:
        if 'vendor_type' not in columns:
            batch_op.add_column(sa.Column('vendor_type', sa.String(length=50), nullable=True, server_default='equipment'))

def downgrade() -> None:
    with op.batch_alter_table('vendors', schema=None) as batch_op:
        batch_op.drop_column('vendor_type')
