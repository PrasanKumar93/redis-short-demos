# Streaming LLM Output

Demo to show case usage of Redis streams to stream output from a large language model (LLM) to a front end to improve user experience/ performance.

## Setup

- Install npm dependencies: `npm install`

- Create a `.env` file in the root directory (streaming-llm-output) with the following content:

```
OPENAI_API_KEY=""
OPENAI_ORGANIZATION=
REDIS_URL=
```

- Run the back end server: `npm run backend`
- Run the front end server: `npm run frontend`
