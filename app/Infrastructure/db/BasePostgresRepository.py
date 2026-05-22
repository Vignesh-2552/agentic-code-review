from psycopg2.extras import RealDictCursor
from typing import Any, Dict, List, Optional, Tuple
import logging
import psycopg2

logger = logging.getLogger(__name__)

class BasePostgresRepository:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._connection = None

    def connect(self):
        """Establish connection to PostgreSQL database."""
        try:
            if self._connection is None or self._connection.closed:
                self._connection = psycopg2.connect(self.connection_string,
                    cursor_factory=RealDictCursor
                )
                logger.info("Successfully connected to PostgreSQL database")
            return self._connection
        except psycopg2.Error as e:
            logger.error(f"Failed to connect to PostgreSQL database: {e}")
            raise

    def disconnect(self):
        """Close database connection."""
        if self._connection and not self._connection.closed:
            self._connection.close()
            self._connection = None
            logger.info("Disconnected from PostgreSQL database")

    def execute_query(self, query: str, params: tuple=()) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results."""
        connection = self.connect()
        try:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                results = cursor.fetchall()
                return [dict(row) for row in results]
        except psycopg2.Error as e:
            logger.error(f"Query execution failed: {e}")
            connection.rollback()
            raise

    def execute_command(self, command: str, params: tuple=()) -> int:
        """Execute an INSERT, UPDATE, or DELETE command."""
        connection = self.connect()
        try:
            with connection.cursor() as cursor:
                cursor.execute(command, params)
                connection.commit()
                return cursor.rowcount
        except psycopg2.Error as e:
            logger.error(f"Command execution failed: {e}")
            connection.rollback()
            raise

    def execute_returning_command(self, command: str, params: tuple=()) -> List[Dict[str, Any]]:
        """Execute an INSERT, UPDATE, or DELETE command with RETURNING clause."""
        connection = self.connect()
        try:
            with connection.cursor() as cursor:
                cursor.execute(command, params)
                results = cursor.fetchall()
                connection.commit()
                return [dict(row) for row in results]
        except psycopg2.Error as e:
            logger.error(f"Returning command execution failed: {e}")
            connection.rollback()
            raise

    def execute_transaction(self, commands: List[Tuple[str, tuple]]) -> bool:
        """Execute multiple commands in a transaction."""
        connection = self.connect()
        try:
            with connection.cursor() as cursor:
                for command, params in commands:
                    cursor.execute(command, params)
                connection.commit()
                logger.info(f"Successfully executed transaction with {len(commands)} commands")
                return True
        except psycopg2.Error as e:
            logger.error(f"Transaction failed: {e}")
            connection.rollback()
            raise

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()
