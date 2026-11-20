"""Test database factory. Default is in-memory SQLite (fast). Set TEST_DATABASE_URL to run the SAME tests
against PostgreSQL, e.g.  TEST_DATABASE_URL=postgresql+psycopg://postgres@/mockview_test pytest"""
import os

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.db.models import Base

URL = os.getenv("TEST_DATABASE_URL")


def make_engine():
    if URL:
        eng = create_engine(URL)
        Base.metadata.drop_all(eng)
        Base.metadata.create_all(eng)
        return eng
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    return eng


def dispose(eng):
    if URL:
        eng.dispose()
