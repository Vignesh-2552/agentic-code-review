from typing import ClassVar

from langgraph.graph import END, StateGraph
from loguru import logger

from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.models.types import PRReviewState

from .nodes import (
    AggregateFindingsNode,
    ArchitectureValidationNode,
    BestPracticesNode,
    BuildProjectContextNode,
    GenerateInlineCommentsNode,
    GeneratePRSummaryNode,
    HumanEscalationNode,
    IngestPRNode,
    PerformanceAnalysisNode,
    RouteBySeverityNode,
    SecurityScanNode,
)


class CodeReviewGraph:
    """Encapsulates the LangGraph PR review workflow, compiled once at startup.

    Graph structure:
        ingest_pr → build_project_context
                            ↓ (fan-out: parallel edges)
        architecture_validation  security_scan  performance_check  best_practices
                            ↓ (fan-in: all → aggregate_findings)
                     aggregate_findings
                            ↓ (conditional)
                 human_escalation ──┐
                 generate_inline_comments ←┘
                            ↓
                   generate_pr_summary → END
    """

    # Single source of truth for the parallel analysis stage: node name → node class.
    # Adding/removing an analysis stage only requires editing this mapping.
    _ANALYSIS_NODE_CLASSES: ClassVar[dict[str, type]] = {
        "architecture_validation": ArchitectureValidationNode,
        "security_scan": SecurityScanNode,
        "performance_check": PerformanceAnalysisNode,
        "best_practices": BestPracticesNode,
    }

    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._compiled_graph = self._build_graph()

    def _register_analysis_nodes(self, workflow: StateGraph, fan_out_from: str, fan_in_to: str) -> None:
        """Register the parallel analysis nodes and wire their fan-out/fan-in edges."""
        for name, node_cls in self._ANALYSIS_NODE_CLASSES.items():
            workflow.add_node(name, node_cls(self._llm_service, self._prompt_service))
            workflow.add_edge(fan_out_from, name)
            workflow.add_edge(name, fan_in_to)

    def _build_graph(self):
        logger.info("Building PR review workflow graph")

        workflow = StateGraph(PRReviewState)

        # Sequential entry nodes
        workflow.add_node("ingest_pr", IngestPRNode())
        workflow.add_node("build_project_context", BuildProjectContextNode())

        # Fan-in aggregation (target node must exist before analysis nodes wire into it)
        workflow.add_node("aggregate_findings", AggregateFindingsNode())

        # Parallel analysis nodes + fan-out/fan-in edges
        self._register_analysis_nodes(
            workflow, fan_out_from="build_project_context", fan_in_to="aggregate_findings"
        )

        # Post-aggregation nodes
        workflow.add_node("human_escalation", HumanEscalationNode())
        workflow.add_node("generate_inline_comments", GenerateInlineCommentsNode(self._llm_service, self._prompt_service))
        workflow.add_node("generate_pr_summary", GeneratePRSummaryNode(self._llm_service, self._prompt_service))

        # Sequential start
        workflow.add_edge("ingest_pr", "build_project_context")

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
