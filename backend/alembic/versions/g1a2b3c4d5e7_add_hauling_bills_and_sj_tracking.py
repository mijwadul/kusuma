"""add hauling_bills table and hauling_is_billed to surat_jalan

Revision ID: g1a2b3c4d5e7
Revises: f1a2b3c4d5e6
Create Date: 2026-08-31 09:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import reflection


# revision identifiers, used by Alembic.
revision = 'g1a2b3c4d5e7'
down_revision = 'f1a2b3c4d5e6'


def upgrade():
    bind = op.get_bind()
    insp = reflection.Inspector.from_engine(bind)
    tables = insp.get_table_names()

    # 1. Create hauling_bills table if not exists
    if 'hauling_bills' not in tables:
        op.create_table(
            'hauling_bills',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('bill_number', sa.String(length=50), nullable=False),
            sa.Column('vendor_id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=True),
            sa.Column('nopol', sa.String(length=50), nullable=True),
            sa.Column('start_date', sa.Date(), nullable=False),
            sa.Column('end_date', sa.Date(), nullable=False),
            sa.Column('bill_date', sa.Date(), nullable=False),
            sa.Column('total_ritase', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('total_measurement', sa.Float(), nullable=False, server_default='0'),
            sa.Column('total_hauling_cost', sa.Float(), nullable=False, server_default='0'),
            sa.Column('total_material_deduction', sa.Float(), nullable=False, server_default='0'),
            sa.Column('total_net', sa.Float(), nullable=False, server_default='0'),
            sa.Column('measurement_type', sa.String(length=30), nullable=False, server_default='tonase'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='unpaid'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_downloaded', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_hauling_bills_bill_number'), 'hauling_bills', ['bill_number'], unique=True)
        op.create_index(op.f('ix_hauling_bills_id'), 'hauling_bills', ['id'], unique=False)

    # 2. Add columns to surat_jalan if not exists
    sj_cols = [c['name'] for c in insp.get_columns('surat_jalan')]
    if 'hauling_is_billed' not in sj_cols:
        op.add_column('surat_jalan', sa.Column('hauling_is_billed', sa.Boolean(), nullable=True, server_default='0'))
    if 'hauling_bill_id' not in sj_cols:
        op.add_column('surat_jalan', sa.Column('hauling_bill_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_surat_jalan_hauling_bill', 'surat_jalan', 'hauling_bills', ['hauling_bill_id'], ['id'], ondelete='SET NULL')



def downgrade():
    op.drop_constraint('fk_surat_jalan_hauling_bill', 'surat_jalan', type_='foreignkey')
    op.drop_column('surat_jalan', 'hauling_bill_id')
    op.drop_column('surat_jalan', 'hauling_is_billed')
    op.drop_index(op.f('ix_hauling_bills_id'), table_name='hauling_bills')
    op.drop_index(op.f('ix_hauling_bills_bill_number'), table_name='hauling_bills')
    op.drop_table('hauling_bills')
