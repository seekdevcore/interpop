---
name: claude-cookbooks
description: Use before implementing any Claude API / Anthropic SDK feature (prompt caching, tool use, extended thinking, RAG, vision, agent SDK, evals, sub-agents, JSON mode, moderation) — points to the official Anthropic cookbook notebooks at `/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main` so the implementation follows Anthropic's reference patterns instead of reinventing them.
---

# Claude Cookbooks — Reference Notebooks

## When to invoke this skill

Invoke this skill **before writing any code** that uses the Claude API or Anthropic SDK for the following:

- Prompt caching (cache control, hit-rate optimization)
- Tool use (function calling, structured JSON output, sub-agents)
- Extended thinking (with or without tool use)
- Vision / multimodal (images, PDFs, charts, OCR)
- Retrieval-Augmented Generation (RAG, Pinecone, Voyage embeddings)
- Claude Agent SDK (research agent, observability agent, SRE agent)
- Managed Agents / agent loops
- Evaluation pipelines (building evals, tool evaluation)
- Moderation filters
- Sub-agents (Haiku as sub-agent under Opus)

The principle: **never implement from scratch what Anthropic has already documented as a reference pattern.** Read the relevant notebook first, copy the proven approach, then adapt to the Interpop codebase.

## Path to the cookbook

All notebooks live locally at:

```
/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main/
```

Use `Read` to open `.ipynb` files directly. Notebooks render with code cells + outputs visible.

## Catalog (by category)

### 1. Patterns — building blocks

Path: `patterns/` (sub-directories — explore with `ls`)

Reusable agent / workflow patterns (routing, parallel calls, prompt chaining, reflection). Open this **before** designing any non-trivial multi-call Claude flow.

### 2. Tool use — function calling and structured output

Path: `tool_use/`

| Notebook                                    | Use case                          |
| ------------------------------------------- | --------------------------------- |
| `customer_service_agent.ipynb`              | End-to-end tool-using agent       |
| `calculator_tool.ipynb`                     | Minimal first tool-use example    |
| `extracting_structured_json.ipynb`          | Force JSON output via tool schema |
| `memory_cookbook.ipynb`                     | Conversation memory pattern       |
| `automatic-context-compaction.ipynb`        | Compaction when context grows     |
| `tool_choice.ipynb`, `parallel_tools.ipynb` | Advanced patterns (check folder)  |

### 3. Multimodal — vision and PDFs

Path: `multimodal/` and `misc/`

| Notebook                                  | Use case                              |
| ----------------------------------------- | ------------------------------------- |
| `getting_started_with_vision.ipynb`       | First Claude vision call              |
| `best_practices_for_vision.ipynb`         | Tips for accuracy and tokens          |
| `reading_charts_graphs_powerpoints.ipynb` | Chart / slide interpretation          |
| `how_to_transcribe_text.ipynb`            | OCR-like form extraction              |
| `crop_tool.ipynb`                         | Image crop tool                       |
| `using_sub_agents.ipynb`                  | Haiku as sub-agent under Opus         |
| `misc/pdf_upload_summarization.ipynb`     | PDF parsing + summary                 |
| `misc/illustrated_responses.ipynb`        | Generate images with Stable Diffusion |

### 4. Extended thinking

Path: `extended_thinking/`

- `extended_thinking.ipynb` — basic interleaved thinking
- `extended_thinking_with_tool_use.ipynb` — thinking + tool calls

Use when the task needs Claude to **reason explicitly** before acting (math, planning, debugging, deep analysis).

### 5. Claude Agent SDK

Path: `claude_agent_sdk/`

Pre-built agent recipes (numbered):

- `00_The_one_liner_research_agent.ipynb`
- `01_The_chief_of_staff_agent.ipynb`
- `02_The_observability_agent.ipynb`
- `03_The_site_reliability_agent.ipynb`
- `04_migrating_from_openai_agents_sdk.ipynb`

Open these before building a custom agent — one of them likely matches the use case.

### 6. Capabilities — classification, RAG, summarization

Path: `capabilities/`

- `classification/` — text/data classification techniques
- `retrieval_augmented_generation/` — RAG with external knowledge
- `summarization/` — effective summarization

### 7. Third-party integrations

Path: `third_party/`

- `Pinecone/rag_using_pinecone.ipynb` — vector DB RAG
- `Wikipedia/wikipedia-search-cookbook.ipynb` — Wikipedia-backed search
- `VoyageAI/how_to_create_embeddings.md` — Voyage embeddings

### 8. Advanced and miscellaneous

Path: `misc/` (mixed bag of essential recipes)

| Notebook                           | Use case                                 |
| ---------------------------------- | ---------------------------------------- |
| `prompt_caching.ipynb`             | **Always consult before adding caching** |
| `building_evals.ipynb`             | Automated eval pipelines                 |
| `how_to_enable_json_mode.ipynb`    | Consistent JSON output                   |
| `building_moderation_filter.ipynb` | Content moderation                       |
| `how_to_make_sql_queries.ipynb`    | Claude as SQL generator                  |
| `read_web_pages_with_haiku.ipynb`  | Cheap web-page reading                   |

### 9. Observability and tool evaluation

Path: `observability/`, `tool_evaluation/`

Use when adding tracing, metrics, or evaluating tool-call quality in production agents.

## Application flow (mandatory order)

1. **Classify the task** — does it touch any of the categories above? If yes, the cookbook covers it.
2. **Open the relevant notebook** with `Read` — read the cells (code + outputs) before writing any code.
3. **Copy the reference pattern** — start from the notebook's structure, not a blank file.
4. **Adapt to Interpop conventions** — DRF endpoints, JWT cookie auth, etc. The cookbook is platform-agnostic; respect the project stack.
5. **Add prompt caching** by default whenever the call has a stable system prompt — see `misc/prompt_caching.ipynb`.

## Hard rule for AI features in Interpop

Any Claude API integration in this project (article moderation, summarization, content tags, comment classification, etc.) **must** start with reading the matching cookbook notebook. Document the source notebook in code comments when the pattern is non-obvious.

## Guiding principle

> Anthropic's cookbook is the authoritative reference for how to use Claude.
> Reinventing a pattern that already exists in the cookbook is a code-review red flag.

## References

- Cookbook root: `/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main/`
- Cookbook README: `/home/gabriel/Documentos/Projetos/config/claude-cookbooks-main/README.md`
- Companion plugin: `claude-api` (Skill tool — for live SDK guidance + caching defaults).
