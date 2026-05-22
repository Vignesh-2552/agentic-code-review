from tempfile import NamedTemporaryFile

def get_temp_filename(file) -> str:
    """Generate a temporary filename.

    Args:
        file: The file object(currently unused)

    Returns:
        str: Path to the temporary file
    """
    with NamedTemporaryFile(delete=False) as tmp_file:
        return tmp_file.name
