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


def upgrade() -> None:
    # Use batch_alter_table to support SQLite as well as MySQL
    with op.batch_alter_table('surat_jalan', schema=None) as batch_op:
        batch_op.add_column(sa.Column('minus_berat', sa.Float(), nullable=True, server_default='0.0'))
        batch_op.add_column(sa.Column('minus_tinggi', sa.Float(), nullable=True, server_default='0.0'))

def downgrade() -> None:
    with op.batch_alter_table('surat_jalan', schema=None) as batch_op:
        batch_op.drop_column('minus_tinggi')
        batch_op.drop_column('minus_berat')
