# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass

@allow_storage
@dataclass
class Task:
    id: u256
    creator: Address
    title: str
    description: str
    criteria: str
    deliverable: str
    candidate: Address
    status: str  # "Open", "UnderReview", "Completed", "Rejected"
    evaluation_result: str

class BountyBoard(gl.Contract):
    tasks: TreeMap[u256, Task]
    task_count: u256

    def __init__(self):
        self.tasks = TreeMap()
        self.task_count = 0

    @gl.public.write
    def create_task(self, title: str, description: str, criteria: str) -> u256:
        task_id = self.task_count
        new_task = Task(
            id=task_id,
            creator=gl.message.sender_address,
            title=title,
            description=description,
            criteria=criteria,
            deliverable="",
            candidate=Address("0x0000000000000000000000000000000000000000"),
            status="Open",
            evaluation_result=""
        )
        self.tasks[task_id] = new_task
        self.task_count += 1
        return task_id

    @gl.public.write
    def submit_solution(self, task_id: u256, deliverable: str):
        task = self.tasks[task_id]
        if task.status != "Open":
            raise ValueError("Task is not open for submissions")
        task.deliverable = deliverable
        task.candidate = gl.message.sender_address
        task.status = "UnderReview"
        self.tasks[task_id] = task

    @gl.public.write
    def evaluate_submission(self, task_id: u256) -> str:
        task = self.tasks[task_id]
        if task.status != "UnderReview":
            raise ValueError("Task is not under review")

        title = task.title
        description = task.description
        criteria = task.criteria
        deliverable = task.deliverable

        def get_input() -> str:
            return f"Task Title: {title}\nTask Description: {description}\nSubmitted Deliverable:\n{deliverable}"

        # Evaluate using GenLayer's non-comparative prompt
        evaluation_json = gl.eq_principle.prompt_non_comparative(
            get_input,
            task="Evaluate the submitted deliverable against the task description. Determine if it successfully satisfies the requirements.",
            criteria=f"""
                Strictly verify if the deliverable satisfies the following criteria: {criteria}
                Output your response in the following JSON format:
                {{
                    "approved": true or false,
                    "reason": "a detailed explanation of why it was approved or rejected"
                }}
                Only output the JSON string, nothing else.
            """
        )

        import json
        try:
            res = json.loads(evaluation_json)
            approved = res.get("approved", False)
            reason = res.get("reason", "No reason provided.")
        except Exception as e:
            approved = False
            reason = f"Failed to parse evaluation output: {str(e)}. Raw output: {evaluation_json}"

        if approved:
            task.status = "Completed"
        else:
            task.status = "Rejected"
            task.deliverable = ""
            task.candidate = Address("0x0000000000000000000000000000000000000000")

        task.evaluation_result = reason
        self.tasks[task_id] = task
        return task.status

    @gl.public.view
    def get_task(self, task_id: u256) -> Task:
        return self.tasks[task_id]

    @gl.public.view
    def get_task_count(self) -> u256:
        return self.task_count
