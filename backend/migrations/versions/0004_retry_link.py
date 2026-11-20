"""link a practice interview to the one it retries

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('retry_of_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key('fk_session_retry_of', 'interview_sessions', ['retry_of_id'], ['id'],
                                    ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_session_retry_of', type_='foreignkey')
        batch_op.drop_column('retry_of_id')
