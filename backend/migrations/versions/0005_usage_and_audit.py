"""usage events (limits) and admin audit log

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('usage_events',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'))
    op.create_index('ix_usage_events_user_id', 'usage_events', ['user_id'])
    op.create_index('ix_usage_events_created_at', 'usage_events', ['created_at'])
    op.create_table('admin_audit_log',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('actor_id', sa.String(length=36), nullable=False),
        sa.Column('action', sa.String(length=60), nullable=False),
        sa.Column('target_id', sa.String(length=36), nullable=True),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'))
    op.create_index('ix_admin_audit_log_actor_id', 'admin_audit_log', ['actor_id'])
    op.create_index('ix_admin_audit_log_created_at', 'admin_audit_log', ['created_at'])
    # Existing interviews count toward today's limits.
    op.execute("INSERT INTO usage_events (id, user_id, created_at) SELECT id, user_id, started_at FROM interview_sessions")


def downgrade() -> None:
    op.drop_index('ix_admin_audit_log_created_at', table_name='admin_audit_log')
    op.drop_index('ix_admin_audit_log_actor_id', table_name='admin_audit_log')
    op.drop_table('admin_audit_log')
    op.drop_index('ix_usage_events_created_at', table_name='usage_events')
    op.drop_index('ix_usage_events_user_id', table_name='usage_events')
    op.drop_table('usage_events')
