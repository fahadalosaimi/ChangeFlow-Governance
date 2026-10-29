"""Tests never inherit an application database or credentials from .env."""
import os

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "a1-synthetic-test-only-secret-not-a-deployment-value"
os.environ["CREATE_TABLES_ON_STARTUP"] = "false"
os.environ["SQL_ECHO"] = "false"
os.environ["JWT_ALGORITHM"] = "HS256"
