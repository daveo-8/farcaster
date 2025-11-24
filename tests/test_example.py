import pytest

# Function to be tested
def add_numbers(a, b):
    return a + b

# Pytest test case
def test_add_numbers():
    result = add_numbers(2, 3)
    assert result == 5