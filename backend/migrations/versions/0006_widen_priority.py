"""widen recommendations.priority: 'recommended' (11 chars) did not fit String(10) on PostgreSQL

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('recommendations', schema=None) as batch_op:
        batch_op.alter_column('priority', existing_type=sa.String(length=10), type_=sa.String(length=16),
                              existing_nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('recommendations', schema=None) as batch_op:
        batch_op.alter_column('priority', existing_type=sa.String(length=16), type_=sa.String(length=10),
                              existing_nullable=False)
