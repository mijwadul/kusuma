"""add project invoice fields

Revision ID: d0d1e2f3g4h7
Revises: c0d1e2f3g4h6
Create Date: 2026-06-20 03:04:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd0d1e2f3g4h7'
down_revision = 'c0d1e2f3g4h6'
branch_labels = None
depends_on = None


def upgrade():
    # invoices
    op.add_column('invoices', sa.Column('invoice_type', sa.String(length=30), nullable=True))
    op.execute("UPDATE invoices SET invoice_type = 'material_sale'")
    op.alter_column('invoices', 'invoice_type', existing_type=sa.String(length=30), nullable=False)
    op.add_column('invoices', sa.Column('project_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'invoices', 'projects', ['project_id'], ['id'])

    # surat_jalan
    op.add_column('surat_jalan', sa.Column('is_invoiced', sa.Boolean(), nullable=True))
    op.execute("UPDATE surat_jalan SET is_invoiced = 0")
    op.add_column('surat_jalan', sa.Column('invoice_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'surat_jalan', 'invoices', ['invoice_id'], ['id'], ondelete='SET NULL')


def downgrade():
    # surat_jalan
    op.drop_constraint(None, 'surat_jalan', type_='foreignkey')
    op.drop_column('surat_jalan', 'invoice_id')
    op.drop_column('surat_jalan', 'is_invoiced')

    # invoices
    op.drop_constraint(None, 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'project_id')
    op.drop_column('invoices', 'invoice_type')
