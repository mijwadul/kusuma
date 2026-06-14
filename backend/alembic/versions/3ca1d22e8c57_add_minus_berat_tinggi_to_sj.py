"""Add minus_berat and minus_tinggi to surat_jalan

Revision ID: 3ca1d22e8c57
Revises: 2fe1c22d7b46
Create Date: 2026-06-14 15:53:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ca1d22e8c57'
down_revision: Union[str, None] = '2fe1c22d7b46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.engine.reflection import Inspector

def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('surat_jalan')]
    
    # Use batch_alter_table to support SQLite as well as MySQL
    with op.batch_alter_table('surat_jalan', schema=None) as batch_op:
        if 'minus_berat' not in columns:
            batch_op.add_column(sa.Column('minus_berat', sa.Float(), nullable=True, server_default='0.0'))
        if 'minus_tinggi' not in columns:
            batch_op.add_column(sa.Column('minus_tinggi', sa.Float(), nullable=True, server_default='0.0'))

def downgrade() -> None:
    with op.batch_alter_table('surat_jalan', schema=None) as batch_op:
        batch_op.drop_column('minus_tinggi')
        batch_op.drop_column('minus_berat')
