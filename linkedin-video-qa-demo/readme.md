## getVideoInfo()

- like title, description, thumbnail, etc.
- using youtube API (need google cloud API key)
- `services/video-search/src/transcripts/load.ts`

## getTranscript()

- full transcript of the video
- using search API (need search API key)
- `services/video-search/src/transcripts/load.ts`

## summarizeVideos()

- summarize transcript of the video + generate some questions on that summary
- split the large transcript files
- loadSummarizationChain takes smaller chunks of files, questionPrompt & refinePrompt to provide final summary
  - say internally it gets summary based on 1st transcript part
  - then summary + next transcript part == refined summary
  - then refined summary + next transcript part == refined summary .. so on
    (due to LLM input size issue, this chunk process)
- `services/video-search/src/api/prompt.ts`

## storeVideoVectors()

- create vector for summary & generated questions of video, store them in redis
- `services/video-search/src/api/store.ts`
- Note: transcripts can be stored in separate collection, meta data + summaryAndQuestions + summaryAndQuestionsVector can be in one collection

## searchVideos()

- `userQuestion -> standAloneSemanticQuestion -> VSS on Redis` -> video documents
- If no result, `userQuestion -> VSS on Redis` -> video documents
- `userQuestion + video documents` -> llm answer
- `services/video-search/src/api/search.ts`

## searchVideos() with semantic caching

- semanticSearch with score on question first -> return results if better score

```
// same content of above searchVideos()
```

- store question + llm answer in Redis cache ( say answerVectorStore)

Note : a flag to skip answer cache search, so that new answer is generated
