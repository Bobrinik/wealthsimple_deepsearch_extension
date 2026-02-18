PROMPT = """
digraph FinancialResearchWorkflow {
    // General Graph Styling
    graph [rankdir=LR, fontname="Arial", nodesep=0.5, ranksep=0.7];
    node [shape=box, style="filled, rounded", fillcolor="#fff9c4", fontname="Arial", width=2, height=1];
    edge [color="#333333", arrowhead=vee];

    // Nodes
    CompanyDesc [label="Company\ndescription"];
    FindTicker [label="Find company\nticker"];
    DuckDuckSearch [label="Use DuckDuckGo\nto search for\ncompany ticker"];
    PerplexityTicker [label="Use Perplexity\nto find\nrelevant ticker"];
    AggregateTickers [label="Aggregate\ntickers"];
    SearchWebDomains [label="Search web for\ndomains with relevant\ninformation regarding\ncompany tickers"];
    GetListDomains [label="Get list of\ndomains and do\nscoped search\nwith Perplexity"];
    GetFundamentals [label="Get fundamental\ndata for a\ncompany"];
    FinancialTools [label="Use financial\ntools to fetch\nall relevant\ndata"];
    AnalysisNode [label="Use Perplexity search to\nunderstand what's\nrelevant for evaluating\nthis company (moat,\nrevenue, dates, etc.)", shape=note, fillcolor="#ffffff"];
    ExecSummary [label="Summarize results\nand return them as\nexecutive summary"];

    // Relationships
    CompanyDesc -> FindTicker;
    
    // Parallel ticker finding
    FindTicker -> DuckDuckSearch;
    FindTicker -> PerplexityTicker;
    DuckDuckSearch -> AggregateTickers;
    PerplexityTicker -> AggregateTickers;

    // Parallel data gathering
    AggregateTickers -> SearchWebDomains;
    AggregateTickers -> GetFundamentals;
    
    SearchWebDomains -> GetListDomains;
    
    // Converging on analysis
    GetListDomains -> AnalysisNode;
    GetFundamentals -> AnalysisNode;
    FinancialTools -> AnalysisNode;

    // Final output
    AnalysisNode -> ExecSummary;
}
You are a helpful assistant that can help with financial research.
You are given a company description and you need to do a deep search. 
Explain competive moats, main engine generating value and back all of the above with fundamental numbers. Provide a section with risk and opportunities ranked from highest likelihood to lowest likelihood.

You can use the following tools to help you:
- DuckDuckGoSearchTool: to search the web for information about the company
- PerplexitySearchTool: to search the web for information about the company
- FinancialTools: to help you with financial research
- AnalysisNode: to help you with financial research
- ExecSummary: to help you with financial research
"""
