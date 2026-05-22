from langgraph.graph import StateGraph, END
from loguru import logger

from app.models.types import PRReviewState
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService

from .nodes import (
    IngestPRNode,
    BuildProjectContextNode,
    ArchitectureValidationNode,
    SecurityScanNode,
    PerformanceAnalysisNode,
    BestPracticesNode,
    AggregateFindingsNode,
    GenerateInlineCommentsNode,
    HumanEscalationNode,
    GeneratePRSummaryNode,
    RouteBySeverityNode,
)


class CodeReviewGraph:
    """Encapsulates the LangGraph PR review workflow, compiled once at startup.

    Graph structure:
        ingest_pr → build_project_context
                            ↓ (fan-out: 4 parallel edges)
        architecture_validation  security_scan  performance_check  best_practices
                            ↓ (fan-in: all 4 → aggregate_findings)
                     aggregate_findings
                            ↓ (conditional)
                 human_escalation ──┐
                 generate_inline_comments ←┘
                            ↓
                   generate_pr_summary → END
    """

    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._compiled_graph = self._build_graph()

    def _build_graph(self):
        logger.info("Building PR review workflow graph")

        workflow = StateGraph(PRReviewState)

        # Sequential entry nodes
        workflow.add_node("ingest_pr", IngestPRNode())
        workflow.add_node("build_project_context", BuildProjectContextNode())

        # Parallel analysis nodes
        workflow.add_node("architecture_validation", ArchitectureValidationNode(self._llm_service, self._prompt_service))
        workflow.add_node("security_scan", SecurityScanNode(self._llm_service, self._prompt_service))
        workflow.add_node("performance_check", PerformanceAnalysisNode(self._llm_service, self._prompt_service))
        workflow.add_node("best_practices", BestPracticesNode(self._llm_service, self._prompt_service))

        # Fan-in aggregation
        workflow.add_node("aggregate_findings", AggregateFindingsNode())

        # Post-aggregation nodes
        workflow.add_node("human_escalation", HumanEscalationNode())
        workflow.add_node("generate_inline_comments", GenerateInlineCommentsNode(self._llm_service, self._prompt_service))
        workflow.add_node("generate_pr_summary", GeneratePRSummaryNode(self._llm_service, self._prompt_service))

        # Sequential start
        workflow.add_edge("ingest_pr", "build_project_context")

        # Fan-out: build_project_context → 4 parallel analysis nodes
        workflow.add_edge("build_project_context", "architecture_validation")
        workflow.add_edge("build_project_context", "security_scan")
        workflow.add_edge("build_project_context", "performance_check")
        workflow.add_edge("build_project_context", "best_practices")

        # Fan-in: all 4 analysis nodes → aggregate_findings
        workflow.add_edge("architecture_validation", "aggregate_findings")
        workflow.add_edge("security_scan", "aggregate_findings")
        workflow.add_edge("performance_check", "aggregate_findings")
        workflow.add_edge("best_practices", "aggregate_findings")

        # Conditional routing after aggregation
        workflow.add_conditional_edges(
            "aggregate_findings",
            RouteBySeverityNode(),
            {
                "human_escalation": "human_escalation",
                "generate_inline_comments": "generate_inline_comments",
            },
        )

        # Both paths converge at generate_pr_summary
        workflow.add_edge("human_escalation", "generate_pr_summary")
        workflow.add_edge("generate_inline_comments", "generate_pr_summary")
        workflow.add_edge("generate_pr_summary", END)

        workflow.set_entry_point("ingest_pr")
        compiled = workflow.compile()

        logger.success("PR review workflow compiled successfully")
        return compiled

    async def ainvoke(self, state: PRReviewState) -> dict:
        return await self._compiled_graph.ainvoke(state)

    async def astream(self, state: PRReviewState):
        """Yields LangGraph astream_events for SSE streaming."""
        async for event in self._compiled_graph.astream_events(state, version="v2", subgraphs=True):
            yield event
