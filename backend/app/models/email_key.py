"""Authoritative PostgreSQL email key with an SQLite development equivalent.

lower(btrim(email)) uses the database collation for case handling and trims ASCII
space only. It does not perform Unicode normalization or Gmail-style aliasing.
"""
from sqlalchemy import String
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement


class EmailKey(FunctionElement):
    type = String()
    inherit_cache = True


@compiles(EmailKey)
def compile_email_key(element, compiler, **kwargs):
    return "lower(trim(" + compiler.process(element.clauses, **kwargs) + "))"


@compiles(EmailKey, "postgresql")
def compile_pg_email_key(element, compiler, **kwargs):
    return "lower(btrim(" + compiler.process(element.clauses, **kwargs) + "))"
