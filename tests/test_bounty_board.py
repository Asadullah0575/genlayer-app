import pytest
from genlayer import *

def test_bounty_board(direct_vm, direct_deploy):
    # Deploy contract
    contract = direct_deploy("contracts/bounty_board.py")

    # Check initial task count is 0
    assert contract.get_task_count() == 0

    # Create task
    task_id = contract.create_task(
        "Sort list",
        "Write a python function to sort a list.",
        "The function sorts a list of numbers in ascending order."
    )
    assert task_id == 0
    assert contract.get_task_count() == 1

    # Check task contents
    task = contract.get_task(0)
    assert task.title == "Sort list"
    assert task.status == "Open"

    # Submit solution
    contract.submit_solution(0, "def sort_list(arr): return sorted(arr)")
    task = contract.get_task(0)
    assert task.status == "UnderReview"
    assert task.deliverable == "def sort_list(arr): return sorted(arr)"

    # Mock the LLM prompt response
    direct_vm.mock_llm(r".*", '{"approved": true, "reason": "The function works correctly."}')

    # Evaluate submission
    status = contract.evaluate_submission(0)
    assert status == "Completed"

    task = contract.get_task(0)
    assert task.status == "Completed"
    assert task.evaluation_result == "The function works correctly."
